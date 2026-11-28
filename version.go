package main

import (
	"os"
	"path/filepath"
	"strings"
)

// Application build and release metadata
// Single source of truth for versioning across the Go backend
const (
	AppVersion     = "1.06A"
	AppName        = "SynoraDesk"
	AppGitHubRepo  = "synoraww/SynoraDesk"
	AppAuthor      = "Synoraww"
	AppDescription = "Pterodactyl Panel Modern Desktop Client"
)

// GetFixedAppDataDir returns the fixed application data directory (%APPDATA%\SynoraDesk).
// It also migrates any existing data from legacy %APPDATA%\PteroDesk so users retain their databases,
// backgrounds, and settings seamlessly regardless of executable name.
func GetFixedAppDataDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		configDir = os.Getenv("APPDATA")
		if configDir == "" {
			configDir = "."
		}
	}

	synoraDir := filepath.Join(configDir, "SynoraDesk")
	pteroDir := filepath.Join(configDir, "PteroDesk")

	// Migration: if SynoraDesk directory does not exist but legacy PteroDesk exists, migrate it
	if _, err := os.Stat(synoraDir); os.IsNotExist(err) {
		if _, errOld := os.Stat(pteroDir); errOld == nil {
			if errRename := os.Rename(pteroDir, synoraDir); errRename != nil {
				_ = os.MkdirAll(synoraDir, 0755)
			}
		} else {
			_ = os.MkdirAll(synoraDir, 0755)
		}
	} else {
		// If SynoraDesk already exists, but PteroDesk also exists and has data that SynoraDesk lacks
		synoraData := filepath.Join(synoraDir, "data")
		pteroData := filepath.Join(pteroDir, "data")
		if _, err := os.Stat(synoraData); os.IsNotExist(err) {
			if _, errOld := os.Stat(pteroData); errOld == nil {
				_ = os.Rename(pteroData, synoraData)
			}
		}
	}

	_ = os.MkdirAll(synoraDir, 0700)
	_ = os.MkdirAll(filepath.Join(synoraDir, "data"), 0700)
	_ = os.MkdirAll(filepath.Join(synoraDir, "logs"), 0700)
	_ = os.MkdirAll(filepath.Join(synoraDir, "backgrounds"), 0700)

	return synoraDir
}

// GetFixedWebviewUserDataPath returns a fixed directory (%APPDATA%\SynoraDesk\webview)
// for Microsoft Edge WebView2 user data.
// By setting this explicitly, Wails will NEVER generate junk folders in %APPDATA%
// named after the executable (e.g. SynoraDesk-v1.02A-Windows-x64.exe, pterodesk.exe),
// avoiding folder locking and cache desynchronization when renaming the executable.
func GetFixedWebviewUserDataPath() string {
	appData := GetFixedAppDataDir()
	webviewPath := filepath.Join(appData, "webview")
	_ = os.MkdirAll(webviewPath, 0700)
	return webviewPath
}

// CleanLegacyExeFolders purges legacy junk folders in %APPDATA% that end with ".exe"
// created by previous builds when WebviewUserDataPath was unset.
func CleanLegacyExeFolders() {
	configDir, err := os.UserConfigDir()
	if err != nil || configDir == "" {
		return
	}

	entries, err := os.ReadDir(configDir)
	if err != nil {
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			name := entry.Name()
			lower := strings.ToLower(name)
			// Check if folder is named like an executable (e.g., SynoraDesk-*.exe, pterodesk*.exe)
			if strings.HasSuffix(lower, ".exe") && (strings.Contains(lower, "synoradesk") || strings.Contains(lower, "pterodesk")) {
				fullPath := filepath.Join(configDir, name)
				_ = os.RemoveAll(fullPath)
			}
		}
	}
}
