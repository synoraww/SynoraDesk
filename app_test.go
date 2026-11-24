package main

import (
	"path/filepath"
	"strings"
	"testing"

	"pterodesk/internal/database"
)

func TestSessionLockGuard_LockUnlock(t *testing.T) {
	app := NewApp()
	app.appDataDir = t.TempDir()
	pin := "1234"

	// Initially unlocked and not enabled
	if app.IsSessionLocked() {
		t.Fatalf("expected session not to be locked initially")
	}

	// Configure lock
	if err := app.SetLockConfig(true, "pin4", pin, ""); err != nil {
		t.Fatal(err)
	}

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
	unlocked, err := app.UnlockSession("9999")
	if unlocked || err == nil {
		t.Fatalf("expected unlock with wrong hash to fail, got unlocked=%v, err=%v", unlocked, err)
	}
	if !app.IsSessionLocked() {
		t.Fatalf("expected session to remain locked after failed unlock")
	}

	// Unlock with correct passcode
	unlocked, err = app.UnlockSession(pin)
	if !unlocked || err != nil {
		t.Fatalf("expected unlock with correct hash to succeed, got unlocked=%v, err=%v", unlocked, err)
	}
	if app.IsSessionLocked() {
		t.Fatalf("expected session to be unlocked after successful UnlockSession")
	}

	// Disable lock config
	if err := app.SetLockConfig(false, "none", "", pin); err != nil {
		t.Fatal(err)
	}
	if app.IsSessionLocked() {
		t.Fatalf("expected session not to be locked when disabled")
	}
}

func TestLockedIPCAndConfig(t *testing.T) {
	a := NewApp()
	a.appDataDir = t.TempDir()
	if err := a.SetLockConfig(true, "pin4", "1234", ""); err != nil {
		t.Fatal(err)
	}
	a.LockSession()
	checks := []error{a.WriteFile("", "", ""), a.SendServerCommand(""), a.WipeAllData(), a.OpenDetachedWindow(DetachedWindowConfig{})}
	for _, err := range checks {
		if err == nil || !strings.Contains(err.Error(), "app is locked") {
			t.Fatalf("expected lock error, got %v", err)
		}
	}
	if err := a.SetLockConfig(false, "none", "", "wrong"); err == nil {
		t.Fatal("disabled lock without correct PIN")
	}
	if !a.IsSessionLocked() {
		t.Fatal("configuration change unlocked session")
	}
	if isAllowedDownloadDir(filepath.Join(a.appDataDir, "Startup")) {
		t.Fatal("unsafe download directory allowed")
	}
}

func TestSecurityPreferencesAndRecovery(t *testing.T) {
	tempDir := t.TempDir()
	app := NewApp()
	app.appDataDir = tempDir
	db, err := database.New(tempDir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	app.db = db

	// Test SecurityPreferences
	prefs := SecurityPreferences{
		AutoLockMinutes: 15,
		LockOnLaunch:    true,
	}
	if err := app.SetSecurityPreferences(prefs); err != nil {
		t.Fatalf("SetSecurityPreferences failed: %v", err)
	}
	loadedPrefs := app.GetSecurityPreferences()
	if loadedPrefs.AutoLockMinutes != 15 || !loadedPrefs.LockOnLaunch {
		t.Fatalf("loaded preferences mismatch: %+v", loadedPrefs)
	}

	// Test Lock Setup and DB Backup
	pin := "5678"
	if err := app.SetLockConfig(true, "pin4", pin, ""); err != nil {
		t.Fatalf("SetLockConfig failed: %v", err)
	}

	// Verify setting saved in SQLite
	b64, err := db.GetSetting("app_lock")
	if err != nil || b64 == "" {
		t.Fatalf("expected app_lock backup in DB, got: %s (err: %v)", b64, err)
	}
	lockType, err := db.GetSetting("app_lock_type")
	if err != nil || lockType != "pin4" {
		t.Fatalf("expected app_lock_type in DB to be pin4, got: %s", lockType)
	}
}
