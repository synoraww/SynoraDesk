//go:build debug

package security

import (
	"os"
	"path/filepath"
)

func getDebugPasscodeKEKPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		configDir = os.Getenv("APPDATA")
		if configDir == "" {
			configDir = "."
		}
	}
	return filepath.Join(configDir, "SynoraDesk", "data", "debug_passcode_kek.dat")
}

// saveDebugPasscodeKey persists a DPAPI-wrapped copy of the passcode key ONLY in debug builds
// so developers can use -debug-reset-lock without losing test panel data.
func saveDebugPasscodeKey(key []byte) {
	if len(key) != 32 {
		return
	}
	enc, err := dpapiEncryptRaw(key)
	if err != nil {
		return
	}
	p := getDebugPasscodeKEKPath()
	_ = os.MkdirAll(filepath.Dir(p), 0700)
	_ = os.WriteFile(p, enc, 0600)
}

func loadDebugPasscodeKey() ([]byte, bool) {
	raw, err := os.ReadFile(getDebugPasscodeKEKPath())
	if err != nil || len(raw) == 0 {
		return nil, false
	}
	dec, err := dpapiDecryptRaw(raw)
	if err != nil || len(dec) != 32 {
		return nil, false
	}
	return dec, true
}

// ClearDebugPasscodeKey removes the debug recovery key file (debug builds only).
func ClearDebugPasscodeKey() {
	_ = os.Remove(getDebugPasscodeKEKPath())
}
