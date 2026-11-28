//go:build windows

package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/binary"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	tpmRuntimeEnabled atomic.Bool

	tpmAvailOnce sync.Once
	tpmAvailable bool

	tpmKEKMu     sync.Mutex
	tpmKEKLoaded bool
	tpmKEK       [32]byte
)

func init() {
	tpmRuntimeEnabled.Store(true)
}

// SetTPMEnabled enables or disables TPM 2.0 envelope wrapping for new Encrypt() calls (for diagnostics/testing).
// Decrypt() always supports both TPM+DPAPI and legacy DPAPI blobs regardless of this setting.
func SetTPMEnabled(enabled bool) {
	tpmRuntimeEnabled.Store(enabled)
}

// IsTPMEnabled returns whether TPM 2.0 envelope wrapping is currently enabled.
func IsTPMEnabled() bool {
	return tpmRuntimeEnabled.Load()
}

const (
	tpmEnvelopeMagic         = "SDTPM1\x00"
	tpmFastEnvelopeMagic     = "SDTPM2\x00"
	tpmKeyName               = "SynoraDesk_HardwareMaster_v1"
	msPlatformCryptoProvider = "Microsoft Platform Crypto Provider"
	ncryptRSAAlgorithm       = "RSA"
	ncryptLengthProperty     = "Length"
	ncryptKeyUsageProperty   = "Key Usage"
	bcryptSHA256Algorithm    = "SHA256"

	ncryptAllowDecryptFlag = 0x00000001
	ncryptAllowEncryptFlag = 0x00000002
	ncryptPadOAEPFlag      = 0x00000004
	ncryptSilentFlag       = 0x00000040
)

var (
	dllNcrypt = windows.NewLazySystemDLL("ncrypt.dll")

	procNCryptOpenStorageProvider = dllNcrypt.NewProc("NCryptOpenStorageProvider")
	procNCryptOpenKey             = dllNcrypt.NewProc("NCryptOpenKey")
	procNCryptCreatePersistedKey  = dllNcrypt.NewProc("NCryptCreatePersistedKey")
	procNCryptSetProperty         = dllNcrypt.NewProc("NCryptSetProperty")
	procNCryptFinalizeKey         = dllNcrypt.NewProc("NCryptFinalizeKey")
	procNCryptEncrypt             = dllNcrypt.NewProc("NCryptEncrypt")
	procNCryptDecrypt             = dllNcrypt.NewProc("NCryptDecrypt")
	procNCryptFreeObject          = dllNcrypt.NewProc("NCryptFreeObject")

	tpmMu sync.Mutex
)

type bcryptOAEPPaddingInfo struct {
	pszAlgId *uint16
	pbLabel  *byte
	cbLabel  uint32
}

// IsTPMHardwareBacked reports whether the Windows TPM 2.0 Key Storage Provider
// ("Microsoft Platform Crypto Provider") is available and can open/create the app master key.
func IsTPMHardwareBacked() bool {
	tpmAvailOnce.Do(func() {
		tpmMu.Lock()
		defer tpmMu.Unlock()

		hProv, hKey, err := openOrCreateTPMKey(true)
		if err != nil {
			tpmAvailable = false
			return
		}
		if hKey != 0 {
			procNCryptFreeObject.Call(hKey)
		}
		if hProv != 0 {
			procNCryptFreeObject.Call(hProv)
		}
		tpmAvailable = true
	})
	return tpmAvailable
}

func getTPMKEKPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		configDir = os.Getenv("APPDATA")
		if configDir == "" {
			configDir = "."
		}
	}
	return filepath.Join(configDir, "SynoraDesk", "data", "tpm_kek.dat")
}

// getOrLoadTPMKEK unwraps (or creates once) a 32-byte AES-256 Master Key protected by the TPM 2.0 chip.
// Because the unwrapped key is cached in memory for the process lifetime, subsequent Encrypt/Decrypt
// operations execute in ~1-3ms instead of invoking a ~700ms hardware RSA operation each time.
func getOrLoadTPMKEK() ([]byte, error) {
	tpmKEKMu.Lock()
	defer tpmKEKMu.Unlock()

	if tpmKEKLoaded {
		out := make([]byte, 32)
		copy(out, tpmKEK[:])
		return out, nil
	}

	kekPath := getTPMKEKPath()
	if raw, err := os.ReadFile(kekPath); err == nil && len(raw) > 0 {
		if unwrapped, decErr := tpmDecryptRSA(raw); decErr == nil && len(unwrapped) == 32 {
			copy(tpmKEK[:], unwrapped)
			for i := range unwrapped {
				unwrapped[i] = 0
			}
			tpmKEKLoaded = true
			out := make([]byte, 32)
			copy(out, tpmKEK[:])
			return out, nil
		}
	}

	// Generate a new 256-bit KEK, wrap it with TPM RSA-2048, and persist it.
	newKEK := make([]byte, 32)
	if _, err := rand.Read(newKEK); err != nil {
		return nil, err
	}
	wrapped, err := tpmEncryptRSA(newKEK)
	if err != nil {
		for i := range newKEK {
			newKEK[i] = 0
		}
		return nil, err
	}

	_ = os.MkdirAll(filepath.Dir(kekPath), 0700)
	if err := os.WriteFile(kekPath, wrapped, 0600); err != nil {
		for i := range newKEK {
			newKEK[i] = 0
		}
		return nil, err
	}

	copy(tpmKEK[:], newKEK)
	tpmKEKLoaded = true
	return newKEK, nil
}

// tpmSealFastEnvelope encrypts an already-DPAPI-protected blob using the cached TPM-backed AES-256-GCM KEK.
func tpmSealFastEnvelope(dpapiBlob []byte) ([]byte, error) {
	kek, err := getOrLoadTPMKEK()
	if err != nil {
		return nil, err
	}
	defer func() {
		for i := range kek {
			kek[i] = 0
		}
	}()

	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	sealed := gcm.Seal(nil, nonce, dpapiBlob, []byte(tpmFastEnvelopeMagic))

	out := make([]byte, 0, len(tpmFastEnvelopeMagic)+len(nonce)+len(sealed))
	out = append(out, tpmFastEnvelopeMagic...)
	out = append(out, nonce...)
	out = append(out, sealed...)
	return out, nil
}

// tpmOpenFastEnvelope decrypts an SDTPM2 envelope using the cached TPM-backed AES-256-GCM KEK.
func tpmOpenFastEnvelope(envelope []byte) ([]byte, error) {
	kek, err := getOrLoadTPMKEK()
	if err != nil {
		return nil, err
	}
	defer func() {
		for i := range kek {
			kek[i] = 0
		}
	}()

	block, err := aes.NewCipher(kek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	pos := len(tpmFastEnvelopeMagic)
	nonceSize := gcm.NonceSize()
	if len(envelope) < pos+nonceSize+16 {
		return nil, fmt.Errorf("malformed SDTPM2 envelope")
	}
	nonce := envelope[pos : pos+nonceSize]
	ciphertext := envelope[pos+nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, []byte(tpmFastEnvelopeMagic))
}

func openOrCreateTPMKey(createIfMissing bool) (uintptr, uintptr, error) {
	if err := dllNcrypt.Load(); err != nil {
		return 0, 0, fmt.Errorf("ncrypt.dll unavailable: %w", err)
	}

	provName, err := windows.UTF16PtrFromString(msPlatformCryptoProvider)
	if err != nil {
		return 0, 0, err
	}
	keyName, err := windows.UTF16PtrFromString(tpmKeyName)
	if err != nil {
		return 0, 0, err
	}

	var hProv uintptr
	st, _, _ := procNCryptOpenStorageProvider.Call(
		uintptr(unsafe.Pointer(&hProv)),
		uintptr(unsafe.Pointer(provName)),
		0,
	)
	if st != 0 || hProv == 0 {
		return 0, 0, fmt.Errorf("NCryptOpenStorageProvider failed: 0x%x", st)
	}

	var hKey uintptr
	st, _, _ = procNCryptOpenKey.Call(
		hProv,
		uintptr(unsafe.Pointer(&hKey)),
		uintptr(unsafe.Pointer(keyName)),
		0,
		ncryptSilentFlag,
	)
	if st == 0 && hKey != 0 {
		return hProv, hKey, nil
	}

	if !createIfMissing {
		procNCryptFreeObject.Call(hProv)
		return 0, 0, fmt.Errorf("NCryptOpenKey failed: 0x%x", st)
	}

	algName, err := windows.UTF16PtrFromString(ncryptRSAAlgorithm)
	if err != nil {
		procNCryptFreeObject.Call(hProv)
		return 0, 0, err
	}

	st, _, _ = procNCryptCreatePersistedKey.Call(
		hProv,
		uintptr(unsafe.Pointer(&hKey)),
		uintptr(unsafe.Pointer(algName)),
		uintptr(unsafe.Pointer(keyName)),
		0,
		0,
	)
	if st != 0 || hKey == 0 {
		procNCryptFreeObject.Call(hProv)
		return 0, 0, fmt.Errorf("NCryptCreatePersistedKey failed: 0x%x", st)
	}

	lenProp, _ := windows.UTF16PtrFromString(ncryptLengthProperty)
	keyLen := uint32(2048)
	st, _, _ = procNCryptSetProperty.Call(
		hKey,
		uintptr(unsafe.Pointer(lenProp)),
		uintptr(unsafe.Pointer(&keyLen)),
		4,
		0,
	)
	if st != 0 {
		procNCryptFreeObject.Call(hKey)
		procNCryptFreeObject.Call(hProv)
		return 0, 0, fmt.Errorf("NCryptSetProperty(Length) failed: 0x%x", st)
	}

	usageProp, _ := windows.UTF16PtrFromString(ncryptKeyUsageProperty)
	usageFlags := uint32(ncryptAllowEncryptFlag | ncryptAllowDecryptFlag)
	st, _, _ = procNCryptSetProperty.Call(
		hKey,
		uintptr(unsafe.Pointer(usageProp)),
		uintptr(unsafe.Pointer(&usageFlags)),
		4,
		0,
	)
	if st != 0 {
		procNCryptFreeObject.Call(hKey)
		procNCryptFreeObject.Call(hProv)
		return 0, 0, fmt.Errorf("NCryptSetProperty(Key Usage) failed: 0x%x", st)
	}

	st, _, _ = procNCryptFinalizeKey.Call(hKey, ncryptSilentFlag)
	if st != 0 {
		procNCryptFreeObject.Call(hKey)
		procNCryptFreeObject.Call(hProv)
		return 0, 0, fmt.Errorf("NCryptFinalizeKey failed: 0x%x", st)
	}

	return hProv, hKey, nil
}

func tpmEncryptRSA(plaintext []byte) ([]byte, error) {
	tpmMu.Lock()
	defer tpmMu.Unlock()

	hProv, hKey, err := openOrCreateTPMKey(true)
	if err != nil {
		return nil, err
	}
	defer procNCryptFreeObject.Call(hKey)
	defer procNCryptFreeObject.Call(hProv)

	sha256Ptr, err := windows.UTF16PtrFromString(bcryptSHA256Algorithm)
	if err != nil {
		return nil, err
	}
	padInfo := bcryptOAEPPaddingInfo{pszAlgId: sha256Ptr}

	var outLen uint32
	st, _, _ := procNCryptEncrypt.Call(
		hKey,
		uintptr(unsafe.Pointer(&plaintext[0])),
		uintptr(len(plaintext)),
		uintptr(unsafe.Pointer(&padInfo)),
		0,
		0,
		uintptr(unsafe.Pointer(&outLen)),
		ncryptPadOAEPFlag|ncryptSilentFlag,
	)
	if st != 0 || outLen == 0 {
		return nil, fmt.Errorf("NCryptEncrypt(size) failed: 0x%x", st)
	}

	out := make([]byte, outLen)
	st, _, _ = procNCryptEncrypt.Call(
		hKey,
		uintptr(unsafe.Pointer(&plaintext[0])),
		uintptr(len(plaintext)),
		uintptr(unsafe.Pointer(&padInfo)),
		uintptr(unsafe.Pointer(&out[0])),
		uintptr(outLen),
		uintptr(unsafe.Pointer(&outLen)),
		ncryptPadOAEPFlag|ncryptSilentFlag,
	)
	if st != 0 {
		return nil, fmt.Errorf("NCryptEncrypt failed: 0x%x", st)
	}
	return out[:outLen], nil
}

func tpmDecryptRSA(ciphertext []byte) ([]byte, error) {
	if len(ciphertext) == 0 {
		return nil, fmt.Errorf("empty TPM ciphertext")
	}

	tpmMu.Lock()
	defer tpmMu.Unlock()

	hProv, hKey, err := openOrCreateTPMKey(false)
	if err != nil {
		return nil, err
	}
	defer procNCryptFreeObject.Call(hKey)
	defer procNCryptFreeObject.Call(hProv)

	sha256Ptr, err := windows.UTF16PtrFromString(bcryptSHA256Algorithm)
	if err != nil {
		return nil, err
	}
	padInfo := bcryptOAEPPaddingInfo{pszAlgId: sha256Ptr}

	var outLen uint32
	st, _, _ := procNCryptDecrypt.Call(
		hKey,
		uintptr(unsafe.Pointer(&ciphertext[0])),
		uintptr(len(ciphertext)),
		uintptr(unsafe.Pointer(&padInfo)),
		0,
		0,
		uintptr(unsafe.Pointer(&outLen)),
		ncryptPadOAEPFlag|ncryptSilentFlag,
	)
	if st != 0 || outLen == 0 {
		return nil, fmt.Errorf("NCryptDecrypt(size) failed: 0x%x", st)
	}

	out := make([]byte, outLen)
	st, _, _ = procNCryptDecrypt.Call(
		hKey,
		uintptr(unsafe.Pointer(&ciphertext[0])),
		uintptr(len(ciphertext)),
		uintptr(unsafe.Pointer(&padInfo)),
		uintptr(unsafe.Pointer(&out[0])),
		uintptr(outLen),
		uintptr(unsafe.Pointer(&outLen)),
		ncryptPadOAEPFlag|ncryptSilentFlag,
	)
	if st != 0 {
		return nil, fmt.Errorf("NCryptDecrypt failed: 0x%x", st)
	}
	return out[:outLen], nil
}

// tpmSealEnvelope wraps an already-DPAPI-protected blob with an AES-256-GCM key
// whose DEK is sealed inside the Windows TPM 2.0 KSP.
func tpmSealEnvelope(dpapiBlob []byte) ([]byte, error) {
	dek := make([]byte, 32)
	if _, err := rand.Read(dek); err != nil {
		return nil, err
	}
	defer func() {
		for i := range dek {
			dek[i] = 0
		}
	}()

	wrappedDEK, err := tpmEncryptRSA(dek)
	if err != nil {
		return nil, err
	}
	if len(wrappedDEK) > 0xFFFF {
		return nil, fmt.Errorf("wrapped DEK too large")
	}

	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	sealed := gcm.Seal(nil, nonce, dpapiBlob, []byte(tpmEnvelopeMagic))

	out := make([]byte, 0, len(tpmEnvelopeMagic)+2+len(wrappedDEK)+len(nonce)+len(sealed))
	out = append(out, tpmEnvelopeMagic...)
	var lenBuf [2]byte
	binary.BigEndian.PutUint16(lenBuf[:], uint16(len(wrappedDEK)))
	out = append(out, lenBuf[:]...)
	out = append(out, wrappedDEK...)
	out = append(out, nonce...)
	out = append(out, sealed...)
	return out, nil
}

// tpmOpenEnvelope unwraps the TPM-protected DEK and decrypts the inner DPAPI blob.
func tpmOpenEnvelope(envelope []byte) ([]byte, error) {
	minLen := len(tpmEnvelopeMagic) + 2 + 12 + 16
	if len(envelope) < minLen {
		return nil, fmt.Errorf("malformed TPM envelope")
	}
	pos := len(tpmEnvelopeMagic)
	wrappedLen := int(binary.BigEndian.Uint16(envelope[pos : pos+2]))
	pos += 2
	if wrappedLen == 0 || pos+wrappedLen+12 >= len(envelope) {
		return nil, fmt.Errorf("invalid wrapped DEK length")
	}
	wrappedDEK := envelope[pos : pos+wrappedLen]
	pos += wrappedLen

	dek, err := tpmDecryptRSA(wrappedDEK)
	if err != nil {
		return nil, err
	}
	defer func() {
		for i := range dek {
			dek[i] = 0
		}
	}()

	block, err := aes.NewCipher(dek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}

	nonceSize := gcm.NonceSize()
	if pos+nonceSize > len(envelope) {
		return nil, fmt.Errorf("truncated TPM envelope nonce")
	}
	nonce := envelope[pos : pos+nonceSize]
	ciphertext := envelope[pos+nonceSize:]

	return gcm.Open(nil, nonce, ciphertext, []byte(tpmEnvelopeMagic))
}
