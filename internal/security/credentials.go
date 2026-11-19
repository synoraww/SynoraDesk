package security

import (
	"encoding/base64"
	"fmt"
	"strings"
)

// CredentialStore manages secure credential storage using DPAPI
type CredentialStore struct{}

// NewCredentialStore creates a new credential store
func NewCredentialStore() *CredentialStore {
	return &CredentialStore{}
}

// EncryptString encrypts a string credential and returns a base64-encoded ciphertext
func (cs *CredentialStore) EncryptString(plaintext string) (string, error) {
	if plaintext == "" {
		return "", fmt.Errorf("cannot encrypt empty string")
	}
	encrypted, err := Encrypt([]byte(plaintext))
	if err != nil {
		return "", fmt.Errorf("failed to encrypt credential: %w", err)
	}
	return base64.StdEncoding.EncodeToString(encrypted), nil
}

// DecryptString decrypts a base64-encoded ciphertext back to plaintext
func (cs *CredentialStore) DecryptString(ciphertext string) (string, error) {
	if ciphertext == "" {
		return "", fmt.Errorf("cannot decrypt empty string")
	}
	data, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode base64: %w", err)
	}
	decrypted, err := Decrypt(data)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt credential: %w", err)
	}
	return string(decrypted), nil
}

// MaskCredential masks a credential string for display, showing only the first 4 and last 4 characters
func (cs *CredentialStore) MaskCredential(credential string) string {
	if len(credential) <= 8 {
		return strings.Repeat("•", len(credential))
	}
	return credential[:4] + strings.Repeat("•", len(credential)-8) + credential[len(credential)-4:]
}
