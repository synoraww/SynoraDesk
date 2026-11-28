//go:build !debug

package security

// In production builds (!debug), no debug recovery key is ever saved or loaded.
func saveDebugPasscodeKey(_ []byte) {}

func loadDebugPasscodeKey() ([]byte, bool) {
	return nil, false
}

// ClearDebugPasscodeKey is a no-op in production builds.
func ClearDebugPasscodeKey() {}
