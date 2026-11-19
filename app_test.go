package main

import (
	"crypto/sha256"
	"encoding/hex"
	"strings"
	"testing"
)

func hashPasscode(passcode, salt string) string {
	data := passcode + "::" + salt + "::pterodesk_salt_v1"
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

func TestSessionLockGuard_LockUnlock(t *testing.T) {
	app := NewApp()
	salt := "test_salt_12345"
	pin := "1234"
	correctHash := hashPasscode(pin, salt)
	wrongHash := hashPasscode("9999", salt)

	// Initially unlocked and not enabled
	if app.IsSessionLocked() {
		t.Fatalf("expected session not to be locked initially")
	}

	// Configure lock
	app.SetLockConfig(true, "pin4", correctHash, salt)

	// Lock the session
	app.LockSession()
	if !app.IsSessionLocked() {
		t.Fatalf("expected session to be locked after LockSession()")
	}

	// Verify all 9 sensitive methods return exact locked error
	expectedErr := "app is locked: authentication required"

	if _, err := app.GetPanels(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetPanels: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetActivePanel(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetActivePanel: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetServers(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetServers: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.ListServers(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("ListServers: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetServer("srv-123"); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetServer: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetServerDetails("srv-123"); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetServerDetails: expected '%s', got '%v'", expectedErr, err)
	}

	if err := app.SendPowerAction("srv-123", "restart"); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("SendPowerAction: expected '%s', got '%v'", expectedErr, err)
	}

	if err := app.ConnectServerConsole("srv-123"); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("ConnectServerConsole: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetAccount(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetAccount: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetCurrentAccount(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetCurrentAccount: expected '%s', got '%v'", expectedErr, err)
	}

	if _, err := app.GetDashboardStats(); err == nil || !strings.Contains(err.Error(), expectedErr) {
		t.Fatalf("GetDashboardStats: expected '%s', got '%v'", expectedErr, err)
	}

	// Try unlocking with wrong passcode
	unlocked, err := app.UnlockSession(wrongHash)
	if unlocked || err == nil {
		t.Fatalf("expected unlock with wrong hash to fail, got unlocked=%v, err=%v", unlocked, err)
	}
	if !app.IsSessionLocked() {
		t.Fatalf("expected session to remain locked after failed unlock")
	}

	// Unlock with correct passcode
	unlocked, err = app.UnlockSession(correctHash)
	if !unlocked || err != nil {
		t.Fatalf("expected unlock with correct hash to succeed, got unlocked=%v, err=%v", unlocked, err)
	}
	if app.IsSessionLocked() {
		t.Fatalf("expected session to be unlocked after successful UnlockSession")
	}

	// Disable lock config
	app.SetLockConfig(false, "none", "", "")
	if app.IsSessionLocked() {
		t.Fatalf("expected session not to be locked when disabled")
	}
}
