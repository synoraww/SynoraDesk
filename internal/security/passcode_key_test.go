package security

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestPasscodeKeyWrapAndUnwrap(t *testing.T) {
	ClearPasscodeKey()
	t.Cleanup(func() {
		ClearPasscodeKey()
		ClearDebugPasscodeKey()
	})

	salt := []byte("0123456789abcdef")
	key := DerivePasscodeKey("super-secret-1234", salt)
	if len(key) != 32 {
		t.Fatalf("expected 32-byte key, got %d", len(key))
	}

	SetPasscodeKey(key)
	if !IsPasscodeKeyActive() {
		t.Fatal("expected passcode key to be active")
	}

	plaintext := []byte("ptlc_secret_panel_api_key_value")
	ciphertext, err := Encrypt(plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	if !bytes.HasPrefix(ciphertext, []byte(passcodeEnvelopeMagic)) {
		t.Fatalf("expected SDPASS1 magic prefix, got %q", ciphertext[:8])
	}

	decrypted, err := Decrypt(ciphertext)
	if err != nil {
		t.Fatalf("Decrypt with active passcode key failed: %v", err)
	}
	if !bytes.Equal(decrypted, plaintext) {
		t.Fatalf("roundtrip mismatch: got %q, want %q", decrypted, plaintext)
	}

	// Clearing both in-memory and debug recovery keys must make SDPASS1 ciphertext unreadable.
	ClearPasscodeKey()
	ClearDebugPasscodeKey()
	if IsPasscodeKeyActive() {
		t.Fatal("expected passcode key to be inactive after ClearPasscodeKey")
	}
	if _, err := Decrypt(ciphertext); err == nil {
		t.Fatal("expected Decrypt to fail when passcode key is cleared")
	}

	// Wrong passcode must also fail to decrypt.
	wrongKey := DerivePasscodeKey("wrong-passcode", salt)
	SetPasscodeKey(wrongKey)
	if _, err := Decrypt(ciphertext); err == nil {
		t.Fatal("expected Decrypt with wrong passcode key to fail")
	}
}

func TestLockoutManagerMigratesLegacySDPASS1File(t *testing.T) {
	ClearPasscodeKey()
	ClearDebugPasscodeKey()
	t.Cleanup(func() {
		ClearPasscodeKey()
		ClearDebugPasscodeKey()
	})

	dir := t.TempDir()
	// Simulate an earlier build that accidentally sealed security_lockout.dat with SDPASS1
	// while unlocked, leaving an unreadable SDPASS1 file on next boot.
	fakeSDPASS1 := append([]byte(passcodeEnvelopeMagic), []byte("unreadable-old-payload")...)
	if err := os.WriteFile(filepath.Join(dir, "security_lockout.dat"), fakeSDPASS1, 0600); err != nil {
		t.Fatalf("failed to write legacy lockout file: %v", err)
	}

	lm := NewLockoutManager(dir, NewCredentialStore(), nil)
	defer lm.Close()

	status := lm.GetStatus()
	if status.IsLockedOut || status.RemainingLockoutSeconds != 0 {
		t.Fatalf("expected silent migration without forced lockout, got lockedOut=%v remaining=%d", status.IsLockedOut, status.RemainingLockoutSeconds)
	}

	// Subsequent saves must use EncryptSystem (not SDPASS1).
	saved, err := os.ReadFile(filepath.Join(dir, "security_lockout.dat"))
	if err != nil {
		t.Fatalf("failed to read migrated lockout file: %v", err)
	}
	if bytes.HasPrefix(saved, []byte(passcodeEnvelopeMagic)) {
		t.Fatal("expected migrated lockout file not to have SDPASS1 prefix")
	}
}
