package security

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"fmt"
	"sync"

	"golang.org/x/crypto/argon2"
)

const passcodeEnvelopeMagic = "SDPASS1\x00"

var (
	passcodeMu        sync.RWMutex
	passcodeKeyActive bool
	passcodeKey       [32]byte
)

// DerivePasscodeKey derives a 256-bit AES key from the user's passcode and a random salt using Argon2id.
func DerivePasscodeKey(passcode string, salt []byte) []byte {
	return argon2.IDKey([]byte(passcode), salt, 3, 64*1024, 4, 32)
}

// SetPasscodeKey stores the active 32-byte passcode-derived AES key in memory and,
// in debug builds only, persists a debug-only recovery copy.
func SetPasscodeKey(key []byte) {
	if len(key) != 32 {
		return
	}
	passcodeMu.Lock()
	copy(passcodeKey[:], key)
	passcodeKeyActive = true
	passcodeMu.Unlock()

	saveDebugPasscodeKey(key)
}

// ClearPasscodeKey zeroes and clears the in-memory passcode key (called on lock/shutdown).
func ClearPasscodeKey() {
	passcodeMu.Lock()
	for i := range passcodeKey {
		passcodeKey[i] = 0
	}
	passcodeKeyActive = false
	passcodeMu.Unlock()
}

// IsPasscodeKeyActive reports whether an unlocked passcode-derived AES key is loaded in memory.
func IsPasscodeKeyActive() bool {
	passcodeMu.RLock()
	defer passcodeMu.RUnlock()
	return passcodeKeyActive
}

func getPasscodeKeyCopy() ([]byte, bool) {
	passcodeMu.RLock()
	defer passcodeMu.RUnlock()
	if !passcodeKeyActive {
		return nil, false
	}
	out := make([]byte, 32)
	copy(out, passcodeKey[:])
	return out, true
}

func wrapWithPasscodeKey(inner []byte) ([]byte, error) {
	key, ok := getPasscodeKeyCopy()
	if !ok {
		return nil, fmt.Errorf("passcode key not active")
	}
	defer zeroBytes(key)
	return sealWithAESGCM(key, inner, []byte(passcodeEnvelopeMagic))
}

func unwrapWithPasscodeKey(envelope []byte) ([]byte, error) {
	if key, ok := getPasscodeKeyCopy(); ok {
		defer zeroBytes(key)
		if plain, err := openWithAESGCM(key, envelope, []byte(passcodeEnvelopeMagic)); err == nil {
			return plain, nil
		}
	}
	// In debug builds only, attempt debug recovery key; in production this always fails.
	if dbgKey, ok := loadDebugPasscodeKey(); ok {
		defer zeroBytes(dbgKey)
		if plain, err := openWithAESGCM(dbgKey, envelope, []byte(passcodeEnvelopeMagic)); err == nil {
			return plain, nil
		}
	}
	return nil, fmt.Errorf("passcode key required to decrypt protected data")
}

func sealWithAESGCM(key, plaintext, aad []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
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
	sealed := gcm.Seal(nil, nonce, plaintext, aad)
	out := make([]byte, 0, len(aad)+len(nonce)+len(sealed))
	out = append(out, aad...)
	out = append(out, nonce...)
	out = append(out, sealed...)
	return out, nil
}

func openWithAESGCM(key, envelope, aad []byte) ([]byte, error) {
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	pos := len(aad)
	nonceSize := gcm.NonceSize()
	if len(envelope) < pos+nonceSize+16 {
		return nil, fmt.Errorf("malformed passcode envelope")
	}
	nonce := envelope[pos : pos+nonceSize]
	ciphertext := envelope[pos+nonceSize:]
	return gcm.Open(nil, nonce, ciphertext, aad)
}

func zeroBytes(b []byte) {
	for i := range b {
		b[i] = 0
	}
}
