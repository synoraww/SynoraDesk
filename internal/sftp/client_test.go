package sftp

import (
	"crypto/rand"
	"crypto/rsa"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/crypto/ssh"
)

func TestVerifyHostKeyTOFU(t *testing.T) {
	path := filepath.Join(t.TempDir(), "hosts")
	keyPair := func() ssh.PublicKey {
		private, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			t.Fatal(err)
		}
		pub, err := ssh.NewPublicKey(&private.PublicKey)
		if err != nil {
			t.Fatal(err)
		}
		return pub
	}
	first, second := keyPair(), keyPair()
	if err := verifyHostKey(path, "example.com:2022", first); err != nil {
		t.Fatal(err)
	}
	if err := verifyHostKey(path, "example.com:2022", first); err != nil {
		t.Fatal(err)
	}
	if err := verifyHostKey(path, "example.com:2022", second); err == nil || !strings.Contains(err.Error(), "mismatch") {
		t.Fatalf("changed host key accepted: %v", err)
	}
}
