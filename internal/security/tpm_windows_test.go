//go:build windows

package security

import (
	"bytes"
	"testing"
	"time"
)

func TestEncryptDecryptAndLegacyDPAPIBackwardCompat(t *testing.T) {
	secret := []byte("ptlc_hardware_protected_test_token_123456")

	// 1. Warmup + measure SDTPM2 speed
	enc, err := Encrypt(secret)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}
	dec, err := Decrypt(enc)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}
	if !bytes.Equal(dec, secret) {
		t.Fatalf("roundtrip mismatch: got %q, want %q", dec, secret)
	}

	start := time.Now()
	for i := 0; i < 5; i++ {
		e, err := Encrypt(secret)
		if err != nil {
			t.Fatalf("Encrypt[%d] failed: %v", i, err)
		}
		d, err := Decrypt(e)
		if err != nil {
			t.Fatalf("Decrypt[%d] failed: %v", i, err)
		}
		if !bytes.Equal(d, secret) {
			t.Fatalf("roundtrip[%d] mismatch", i)
		}
	}
	avgMs := float64(time.Since(start).Microseconds()) / 5000.0
	t.Logf("Average TPM+DPAPI roundtrip (warm): %.3f ms (header=%q)", avgMs, string(enc[:6]))

	// 2. Legacy raw DPAPI blob must still decrypt cleanly
	legacyBlob, err := dpapiEncryptRaw(secret)
	if err != nil {
		t.Fatalf("dpapiEncryptRaw failed: %v", err)
	}
	decLegacy, err := Decrypt(legacyBlob)
	if err != nil {
		t.Fatalf("Decrypt(legacyBlob) failed: %v", err)
	}
	if !bytes.Equal(decLegacy, secret) {
		t.Fatalf("legacy decrypt mismatch: got %q, want %q", decLegacy, secret)
	}

	// 3. Log whether TPM 2.0 hardware backing is active on this host
	t.Logf("IsTPMHardwareBacked() = %v", IsTPMHardwareBacked())
}
