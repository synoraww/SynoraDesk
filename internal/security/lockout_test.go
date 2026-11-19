package security

import (
	"os"
	"sync/atomic"
	"testing"
	"time"
)

func TestDefaultLockoutConfig(t *testing.T) {
	cfg := DefaultLockoutConfig()
	if cfg.EnableAutoWipe {
		t.Fatalf("expected EnableAutoWipe to default to false, got true")
	}
	if !cfg.EnableLockout {
		t.Fatalf("expected EnableLockout to default to true, got false")
	}
	if cfg.MaxAttempts != 5 {
		t.Fatalf("expected MaxAttempts to default to 5, got %d", cfg.MaxAttempts)
	}
	if cfg.LockoutDurationMinutes != 15 {
		t.Fatalf("expected LockoutDurationMinutes to default to 15, got %d", cfg.LockoutDurationMinutes)
	}
}

func TestLockout_TimedLockoutOnlyByDefault(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lockout_test_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	var wipeCalled int32
	creds := NewCredentialStore()
	lm := NewLockoutManager(tempDir, creds, func() {
		atomic.AddInt32(&wipeCalled, 1)
	})
	defer lm.Close()

	// Verify default config
	status := lm.GetStatus()
	if status.EnableAutoWipe {
		t.Fatalf("expected EnableAutoWipe to be false by default")
	}

	// Trigger 15 failed attempts (exceeding MaxAttempts=5 and WipeAttempts=10)
	var lastStatus LockoutStatus
	for i := 0; i < 15; i++ {
		lastStatus, err = lm.RecordFailedAttempt()
		if err != nil {
			t.Fatalf("unexpected error on attempt %d: %v", i+1, err)
		}
	}

	// Because EnableAutoWipe is false, wipe MUST NOT have occurred
	if lastStatus.DataWiped {
		t.Fatalf("expected DataWiped to be false when EnableAutoWipe is false")
	}
	if atomic.LoadInt32(&wipeCalled) != 0 {
		t.Fatalf("expected wipe callback NOT to be invoked when EnableAutoWipe is false")
	}

	// Timed lockout MUST be active
	if !lastStatus.IsLockedOut {
		t.Fatalf("expected IsLockedOut to be true")
	}
	if lastStatus.RemainingLockoutSeconds <= 0 {
		t.Fatalf("expected RemainingLockoutSeconds > 0, got %d", lastStatus.RemainingLockoutSeconds)
	}

	// Successful attempt should not succeed while locked out
	if err := lm.RecordSuccess(); err == nil {
		t.Fatalf("expected RecordSuccess to fail while locked out")
	}
}

func TestLockout_ExplicitAutoWipe(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lockout_wipe_test_*")
	if err != nil {
		t.Fatal(err)
	}
	defer os.RemoveAll(tempDir)

	var wipeCalled int32
	creds := NewCredentialStore()
	lm := NewLockoutManager(tempDir, creds, func() {
		atomic.AddInt32(&wipeCalled, 1)
	})
	defer lm.Close()

	// Explicitly enable Auto-Wipe with 3 attempts
	err = lm.UpdateConfig(LockoutConfig{
		EnableLockout:          true,
		MaxAttempts:            5,
		LockoutDurationMinutes: 1,
		EnableAutoWipe:         true,
		WipeAttempts:           3,
	})
	if err != nil {
		t.Fatal(err)
	}

	for i := 0; i < 2; i++ {
		st, err := lm.RecordFailedAttempt()
		if err != nil {
			t.Fatal(err)
		}
		if st.DataWiped {
			t.Fatalf("unexpected DataWiped at attempt %d", i+1)
		}
	}

	// 3rd attempt triggers wipe
	st, err := lm.RecordFailedAttempt()
	if err != nil {
		t.Fatal(err)
	}
	if !st.DataWiped {
		t.Fatalf("expected DataWiped to be true on attempt 3")
	}

	time.Sleep(50 * time.Millisecond)
	if atomic.LoadInt32(&wipeCalled) == 0 {
		t.Fatalf("expected wipe callback to be called when EnableAutoWipe is explicitly true")
	}
}
