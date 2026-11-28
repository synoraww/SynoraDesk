//go:build debug

package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"pterodesk/internal/database"
	"pterodesk/internal/security"
)

var debugResetLockFlag = flag.Bool("debug-reset-lock", false, "Debug only: clear App Lock and Lockout state before starting")

func isDebugBuild() bool {
	return true
}

func runDebugLockResetIfRequested() {
	if debugResetLockFlag == nil || !*debugResetLockFlag {
		return
	}
	if err := debugClearLockState(GetFixedAppDataDir()); err != nil {
		fmt.Fprintf(os.Stderr, "[DEBUG] Failed to reset lock state: %v\n", err)
		return
	}
	fmt.Println("[DEBUG] App Lock and Lockout state cleared.")
}

func debugClearLockState(appDataDir string) error {
	dataDir := filepath.Join(appDataDir, "data")
	for _, name := range []string{"app_lock.dat", "app_lock_enabled", "security_lockout.dat"} {
		if err := os.Remove(filepath.Join(dataDir, name)); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	db, err := database.New(appDataDir)
	if err != nil {
		return err
	}
	defer db.Close()

	// In debug builds, unwrap any SDPASS1 panel credentials via the debug recovery key
	// and re-seal them with DPAPI/TPM before clearing the lock and debug key.
	creds := security.NewCredentialStore()
	panels, err := db.GetAllPanels()
	if err == nil && len(panels) > 0 {
		type plainPanel struct {
			rec    database.PanelRecord
			client string
			app    string
		}
		var unwrapped []plainPanel
		for _, p := range panels {
			var cPlain, aPlain string
			if p.ClientAPIKey != "" {
				if v, decErr := creds.DecryptString(p.ClientAPIKey); decErr == nil {
					cPlain = v
				} else {
					fmt.Fprintf(os.Stderr, "[DEBUG] Warning: could not decrypt client key for panel %s: %v\n", p.Name, decErr)
					continue
				}
			}
			if p.AppAPIKey != "" {
				if v, decErr := creds.DecryptString(p.AppAPIKey); decErr == nil {
					aPlain = v
				} else {
					fmt.Fprintf(os.Stderr, "[DEBUG] Warning: could not decrypt app key for panel %s: %v\n", p.Name, decErr)
					continue
				}
			}
			unwrapped = append(unwrapped, plainPanel{rec: p, client: cPlain, app: aPlain})
		}
		security.ClearPasscodeKey()
		security.ClearDebugPasscodeKey()
		for _, u := range unwrapped {
			if u.client != "" {
				if enc, encErr := creds.EncryptString(u.client); encErr == nil {
					u.rec.ClientAPIKey = enc
				}
			}
			if u.app != "" {
				if enc, encErr := creds.EncryptString(u.app); encErr == nil {
					u.rec.AppAPIKey = enc
				}
			}
			_ = db.SavePanel(u.rec)
		}
	} else {
		security.ClearPasscodeKey()
		security.ClearDebugPasscodeKey()
	}

	if err := db.SaveSetting("app_lock", ""); err != nil {
		return err
	}
	if err := db.SaveSetting("app_lock_type", ""); err != nil {
		return err
	}
	return nil
}
