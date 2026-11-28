package security

import (
	"bytes"
	"fmt"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	dllCrypt32  = windows.NewLazySystemDLL("crypt32.dll")
	dllKernel32 = windows.NewLazySystemDLL("kernel32.dll")

	procCryptProtectData   = dllCrypt32.NewProc("CryptProtectData")
	procCryptUnprotectData = dllCrypt32.NewProc("CryptUnprotectData")
	procLocalFree          = dllKernel32.NewProc("LocalFree")
)

type dataBlob struct {
	cbData uint32
	pbData *byte
}

func newDataBlob(data []byte) *dataBlob {
	if len(data) == 0 {
		return &dataBlob{}
	}
	return &dataBlob{
		cbData: uint32(len(data)),
		pbData: &data[0],
	}
}

func (b *dataBlob) toBytes() []byte {
	d := make([]byte, b.cbData)
	copy(d, unsafe.Slice(b.pbData, b.cbData))
	return d
}

func (b *dataBlob) free() {
	if b.pbData != nil {
		procLocalFree.Call(uintptr(unsafe.Pointer(b.pbData)))
	}
}

// EncryptSystem encrypts system-level metadata (e.g. app_lock.dat, security_lockout.dat)
// using Windows DPAPI + TPM 2.0 without passcode-key wrapping, so it remains readable
// at startup before the user unlocks the session.
func EncryptSystem(data []byte) ([]byte, error) {
	dpapiBlob, err := dpapiEncryptRaw(data)
	if err != nil {
		return nil, err
	}
	if IsTPMEnabled() {
		if sealed, tpmErr := tpmSealFastEnvelope(dpapiBlob); tpmErr == nil {
			return sealed, nil
		}
	}
	return dpapiBlob, nil
}

// Encrypt encrypts data using Windows DPAPI (current user scope), wraps with TPM 2.0
// hardware-backed AES-256-GCM when available/enabled, and wraps with the user's
// Argon2id passcode-derived AES-256-GCM key (SDPASS1) whenever App Lock is active.
func Encrypt(data []byte) ([]byte, error) {
	inner, err := EncryptSystem(data)
	if err != nil {
		return nil, err
	}
	if IsPasscodeKeyActive() {
		if passSealed, passErr := wrapWithPasscodeKey(inner); passErr == nil {
			return passSealed, nil
		}
	}
	return inner, nil
}

// Decrypt decrypts SDPASS1 (passcode-bound AES-256-GCM), TPM+DPAPI (SDTPM2/SDTPM1), or legacy DPAPI blobs.
func Decrypt(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("cannot decrypt empty data")
	}
	if bytes.HasPrefix(data, []byte(passcodeEnvelopeMagic)) {
		inner, err := unwrapWithPasscodeKey(data)
		if err != nil {
			return nil, err
		}
		data = inner
	}
	if bytes.HasPrefix(data, []byte(tpmFastEnvelopeMagic)) {
		dpapiBlob, err := tpmOpenFastEnvelope(data)
		if err != nil {
			return nil, fmt.Errorf("failed to unwrap TPM hardware envelope (v2): %w", err)
		}
		return dpapiDecryptRaw(dpapiBlob)
	}
	if bytes.HasPrefix(data, []byte(tpmEnvelopeMagic)) {
		dpapiBlob, err := tpmOpenEnvelope(data)
		if err != nil {
			return nil, fmt.Errorf("failed to unwrap TPM hardware envelope: %w", err)
		}
		return dpapiDecryptRaw(dpapiBlob)
	}
	return dpapiDecryptRaw(data)
}

func dpapiEncryptRaw(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("cannot encrypt empty data")
	}

	inBlob := newDataBlob(data)
	var outBlob dataBlob

	r, _, err := procCryptProtectData.Call(
		uintptr(unsafe.Pointer(inBlob)),
		0, // description
		0, // optional entropy
		0, // reserved
		0, // prompt struct
		0, // flags
		uintptr(unsafe.Pointer(&outBlob)),
	)
	if r == 0 {
		return nil, fmt.Errorf("CryptProtectData failed: %w", err)
	}
	defer outBlob.free()

	return outBlob.toBytes(), nil
}

func dpapiDecryptRaw(data []byte) ([]byte, error) {
	if len(data) == 0 {
		return nil, fmt.Errorf("cannot decrypt empty data")
	}

	inBlob := newDataBlob(data)
	var outBlob dataBlob

	r, _, err := procCryptUnprotectData.Call(
		uintptr(unsafe.Pointer(inBlob)),
		0, // description
		0, // optional entropy
		0, // reserved
		0, // prompt struct
		0, // flags
		uintptr(unsafe.Pointer(&outBlob)),
	)
	if r == 0 {
		return nil, fmt.Errorf("CryptUnprotectData failed: %w", err)
	}
	defer outBlob.free()

	return outBlob.toBytes(), nil
}
