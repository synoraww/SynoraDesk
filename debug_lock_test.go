//go:build debug

package main

import (
	"os"
	"path/filepath"
	"testing"

	"pterodesk/internal/database"
)

func TestDebugClearLockState(t *testing.T) {
	dir := t.TempDir()
	dataDir := filepath.Join(dir, "data")
	if err := os.MkdirAll(dataDir, 0700); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"app_lock.dat", "app_lock_enabled", "security_lockout.dat"} {
		if err := os.WriteFile(filepath.Join(dataDir, name), []byte("dummy"), 0600); err != nil {
			t.Fatal(err)
		}
	}
	db, err := database.New(dir)
	if err != nil {
		t.Fatal(err)
	}
	_ = db.SaveSetting("app_lock", "abc")
	_ = db.SaveSetting("app_lock_type", "pin4")
	db.Close()

	if err := debugClearLockState(dir); err != nil {
		t.Fatalf("debugClearLockState failed: %v", err)
	}

	for _, name := range []string{"app_lock.dat", "app_lock_enabled", "security_lockout.dat"} {
		if _, err := os.Stat(filepath.Join(dataDir, name)); !os.IsNotExist(err) {
			t.Fatalf("expected %s to be removed", name)
		}
	}
	db2, err := database.New(dir)
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()
	if v, _ := db2.GetSetting("app_lock"); v != "" {
		t.Fatalf("expected app_lock setting cleared, got %q", v)
	}
	if v, _ := db2.GetSetting("app_lock_type"); v != "" {
		t.Fatalf("expected app_lock_type setting cleared, got %q", v)
	}
}
