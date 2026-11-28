package main

import (
	"path/filepath"
	"testing"

	"pterodesk/internal/database"
)

func TestSessionLockGuardsSensitiveBindings(t *testing.T) {
	app := NewApp()
	app.appDataDir = t.TempDir()
	db, err := database.New(app.appDataDir)
	if err != nil {
		t.Fatalf("failed to init test db: %v", err)
	}
	defer db.Close()
	app.db = db

	app.sessionMu.Lock()
	app.lockConfigEnabled = true
	app.sessionLocked = true
	app.sessionMu.Unlock()

	if err := app.SetSecurityPreferences(SecurityPreferences{AutoLockMinutes: 0, LockOnLaunch: false}); err == nil {
		t.Fatal("expected SetSecurityPreferences to fail while session is locked")
	}
	if dir := app.GetAppDataDir(); dir != "" {
		t.Fatalf("expected GetAppDataDir to return empty string while locked, got %q", dir)
	}
	if err := app.OpenDetachedWindow(DetachedWindowConfig{Type: "invalid"}); err == nil {
		t.Fatal("expected OpenDetachedWindow to fail while locked")
	}
}

func TestGetCustomBackgroundRejectsPathOutsideBackgroundsDir(t *testing.T) {
	app := NewApp()
	app.appDataDir = t.TempDir()
	db, err := database.New(app.appDataDir)
	if err != nil {
		t.Fatalf("failed to init test db: %v", err)
	}
	defer db.Close()
	app.db = db

	outsidePath := filepath.Join(app.appDataDir, "data", "pterodesk.db")
	_ = db.SaveSetting("custom_bg_enabled", "true")
	_ = db.SaveSetting("custom_bg_path", outsidePath)

	info, err := app.GetCustomBackground()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if info.Enabled || info.DataURL != "" {
		t.Fatalf("expected GetCustomBackground to reject path outside backgrounds dir, got enabled=%v", info.Enabled)
	}
}

func TestOpenDetachedWindowValidation(t *testing.T) {
	app := NewApp()
	if err := app.OpenDetachedWindow(DetachedWindowConfig{Type: "malicious-type"}); err == nil {
		t.Fatal("expected error for invalid detached window type")
	}
	if err := app.OpenDetachedWindow(DetachedWindowConfig{Type: "server", Server: "abc\ndef"}); err == nil {
		t.Fatal("expected error for control characters in detached window config")
	}
}

func TestSystemDiagnosticsAndConnectivityLockGuard(t *testing.T) {
	app := NewApp()
	app.appDataDir = t.TempDir()
	db, err := database.New(app.appDataDir)
	if err != nil {
		t.Fatalf("failed to init test db: %v", err)
	}
	defer db.Close()
	app.db = db

	diag, err := app.GetSystemDiagnostics()
	if err != nil {
		t.Fatalf("GetSystemDiagnostics failed: %v", err)
	}
	if diag.DatabaseIntegrity != "ok" {
		t.Fatalf("expected DatabaseIntegrity 'ok', got %q", diag.DatabaseIntegrity)
	}
	if len(diag.HealthChecks) == 0 {
		t.Fatal("expected non-empty HealthChecks")
	}

	app.sessionMu.Lock()
	app.lockConfigEnabled = true
	app.sessionLocked = true
	app.sessionMu.Unlock()

	if _, err := app.RunPanelConnectivityCheck(); err == nil {
		t.Fatal("expected RunPanelConnectivityCheck to fail while session is locked")
	}
}
