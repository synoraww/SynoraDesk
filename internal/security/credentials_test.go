package security

import (
	"testing"
)

func TestCredentialStore_MaskCredential(t *testing.T) {
	cs := NewCredentialStore()

	tests := []struct {
		input    string
		expected string
	}{
		{"", ""},
		{"short", "•••••"},
		{"12345678", "••••••••"},
		{"ptlc_abcdef1234567890", "ptlc•••••••••••••7890"},
		{"ptla_secret_token_1234", "ptla••••••••••••••1234"},
	}

	for _, tt := range tests {
		result := cs.MaskCredential(tt.input)
		if result != tt.expected {
			t.Errorf("MaskCredential(%q) = %q, expected %q", tt.input, result, tt.expected)
		}
	}
}

func TestCredentialStore_EncryptDecrypt(t *testing.T) {
	cs := NewCredentialStore()

	secret := "ptlc_test_api_key_value_987654321"
	encrypted, err := cs.EncryptString(secret)
	if err != nil {
		t.Fatalf("EncryptString failed: %v", err)
	}

	if encrypted == secret {
		t.Fatalf("Encrypted text should not equal plaintext")
	}

	decrypted, err := cs.DecryptString(encrypted)
	if err != nil {
		t.Fatalf("DecryptString failed: %v", err)
	}

	if decrypted != secret {
		t.Fatalf("Decrypted %q does not match original %q", decrypted, secret)
	}
}
