package main

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"crypto/tls"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
	"golang.org/x/crypto/argon2"

	"pterodesk/internal/api"
	"pterodesk/internal/database"
	"pterodesk/internal/logger"
	"pterodesk/internal/panel"
	"pterodesk/internal/pterodactyl/discovery"
	"pterodesk/internal/security"
)

// DetachedWindowConfig holds settings for a detached standalone window
type DetachedWindowConfig struct {
	IsDetached bool   `json:"isDetached"`
	Type       string `json:"type"`     // "server", "file-editor", "nodes", "settings", "apikeys", "ide", etc.
	Server     string `json:"server"`   // server identifier
	Subtab     string `json:"subtab"`   // console, files, startup, etc.
	FilePath   string `json:"filePath"` // for file editor
	Title      string `json:"title"`
}

// App struct holds the application state
type App struct {
	ctx                 context.Context
	db                  *database.DB
	credentials         *security.CredentialStore
	panelManager        *panel.Manager
	activeConsoleWS     *api.ServerWebSocket
	activeConsoleServer string
	wsMu                sync.Mutex
	appDataDir          string
	detachedConfig      DetachedWindowConfig
	lockoutManager      *security.LockoutManager

	// In-memory Session Lock Guard
	sessionMu         sync.RWMutex
	lockConfigEnabled bool
	sessionLocked     bool
	lockConfigType    string
	lockConfigHash    string
	lockConfigSalt    string
	lockConfigEncSalt string
	detachedMu        sync.Mutex
	detachedCount     int
	appStartTime      time.Time
	startupDone       chan struct{}
}

func (a *App) waitForStartup() {
	if a.startupDone != nil {
		<-a.startupDone
	}
}

// NewApp creates a new App instance
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	a.appStartTime = time.Now()
	defer func() {
		if a.startupDone != nil {
			close(a.startupDone)
		}
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "app:ready")
		}
	}()

	// Determine fixed app data directory (persists across renames and releases)
	a.appDataDir = GetFixedAppDataDir()

	// Initialize logger
	if err := logger.Init(a.appDataDir, false); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
	}
	logger.Logger.Info().Str("dataDir", a.appDataDir).Msg("SynoraDesk starting up")

	// Clean old logs
	go logger.CleanOldLogs(a.appDataDir, 30)

	// Initialize lockout before creating the database so a fresh install is distinguishable
	// from an existing installation whose lockout file was deleted.
	a.credentials = security.NewCredentialStore()
	a.lockoutManager = security.NewLockoutManager(filepath.Join(a.appDataDir, "data"), a.credentials, func() { _ = a.wipeAllData() })
	// Initialize database
	db, err := database.New(a.appDataDir)
	if err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to initialize database")
		return
	}
	a.db = db
	// Load the verifier before exposing any IPC methods to the WebView.
	lockPath := filepath.Join(a.appDataDir, "data", "app_lock.dat")
	markerPath := filepath.Join(a.appDataDir, "data", "app_lock_enabled")
	raw, err := os.ReadFile(lockPath)
	if err != nil && os.IsNotExist(err) && a.db != nil {
		// Recovery from persistent database backup: ensures security lock survives reinstallations or file cleanups
		if backupB64, dbErr := a.db.GetSetting("app_lock"); dbErr == nil && backupB64 != "" {
			if decoded, decErr := base64.StdEncoding.DecodeString(backupB64); decErr == nil && len(decoded) > 0 {
				raw = decoded
				err = nil
				_ = os.WriteFile(lockPath, raw, 0600)
				_ = os.WriteFile(markerPath, []byte("enabled"), 0600)
				logger.Logger.Info().Msg("Restored app lock configuration from persistent database backup")
			}
		}
	}
	if err == nil {
		if plain, err := security.Decrypt(raw); err == nil {
			var stored struct{ Type, Salt, EncSalt, Hash string }
			if json.Unmarshal(plain, &stored) == nil && stored.Hash != "" && stored.Salt != "" {
				a.lockConfigType, a.lockConfigSalt, a.lockConfigEncSalt, a.lockConfigHash = stored.Type, stored.Salt, stored.EncSalt, stored.Hash
				a.lockConfigEnabled, a.sessionLocked = true, true
				if a.db != nil {
					_ = a.db.SaveSetting("app_lock", base64.StdEncoding.EncodeToString(raw))
					_ = a.db.SaveSetting("app_lock_type", stored.Type)
				}
			} else {
				logger.Logger.Error().Msg("Invalid app lock configuration; refusing to unlock")
				a.lockConfigEnabled, a.sessionLocked = true, true
			}
		} else {
			logger.Logger.Error().Err(err).Msg("Cannot decrypt app lock; refusing to unlock")
			a.lockConfigEnabled, a.sessionLocked = true, true
		}
	} else if err != nil && !os.IsNotExist(err) {
		a.lockConfigEnabled, a.sessionLocked = true, true
	} else if os.IsNotExist(err) {
		// If a previously configured installation loses its verifier, fail closed.
		if _, dbErr := os.Stat(filepath.Join(a.appDataDir, "data", "pterodesk.db")); dbErr == nil {
			if _, legacyErr := os.Stat(filepath.Join(a.appDataDir, "data", "app_lock_enabled")); legacyErr == nil {
				a.lockConfigEnabled, a.sessionLocked = true, true
			}
		}
	}
	logger.Logger.Info().Msg("Database initialized")

	// Pre-warm TPM 2.0 KEK once during startup if available
	_ = security.IsTPMHardwareBacked()
	// Initialize panel manager
	a.panelManager = panel.NewManager(a.db, a.credentials)
	if err := a.panelManager.Initialize(); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to initialize panel manager")
	}
	logger.Logger.Info().Msg("Panel manager initialized")

	// Restore window state for main window
	if !a.detachedConfig.IsDetached {
		go func() {
			time.Sleep(100 * time.Millisecond)
			if state, err := a.GetWindowState(); err == nil && state != nil {
				if state.IsMaximised {
					runtime.WindowMaximise(a.ctx)
				} else {
					if state.X > -5000 && state.Y > -5000 && (state.X != 0 || state.Y != 0) {
						runtime.WindowSetPosition(a.ctx, state.X, state.Y)
					}
					if state.Width >= 1024 && state.Height >= 700 {
						runtime.WindowSetSize(a.ctx, state.Width, state.Height)
					}
				}
			}
		}()
	}
}

// WindowState represents persisted window geometry and state
type WindowState struct {
	Width       int  `json:"width"`
	Height      int  `json:"height"`
	X           int  `json:"x"`
	Y           int  `json:"y"`
	IsMaximised bool `json:"is_maximised"`
}

func (a *App) getWindowStatePath() string {
	return filepath.Join(a.appDataDir, "data", "window_state.json")
}

// SaveWindowState stores window dimensions, coordinates, and maximize status
func (a *App) SaveWindowState(width, height, x, y int, isMaximised bool) error {
	if a.detachedConfig.IsDetached {
		return nil
	}
	state := WindowState{
		Width:       width,
		Height:      height,
		X:           x,
		Y:           y,
		IsMaximised: isMaximised,
	}
	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	path := a.getWindowStatePath()
	_ = os.MkdirAll(filepath.Dir(path), 0700)
	return os.WriteFile(path, data, 0600)
}

// GetWindowState returns the saved window state
func (a *App) GetWindowState() (*WindowState, error) {
	path := a.getWindowStatePath()
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	var state WindowState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

// --- Security Lockout & Self-Destruct Bindings ---

// GetSecurityLockoutStatus returns the current lockout state & remaining seconds
func (a *App) GetSecurityLockoutStatus() (security.LockoutStatus, error) {
	if a.lockoutManager == nil {
		return security.LockoutStatus{}, fmt.Errorf("lockout manager not initialized")
	}
	return a.lockoutManager.GetStatus(), nil
}

// RecordFailedPasscodeAttempt registers a failed passcode/PIN attempt
func (a *App) RecordFailedPasscodeAttempt() (security.LockoutStatus, error) {
	return security.LockoutStatus{}, fmt.Errorf("passcode attempts are recorded by UnlockSession")
}

// RecordSuccessfulPasscodeAttempt resets the failed attempt counter
func (a *App) RecordSuccessfulPasscodeAttempt() error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if a.lockoutManager == nil {
		return nil
	}
	return a.lockoutManager.RecordSuccess()
}

// UpdateSecurityLockoutConfig updates lockout and auto-wipe preferences
func (a *App) UpdateSecurityLockoutConfig(cfg security.LockoutConfig) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if a.lockoutManager == nil {
		return fmt.Errorf("lockout manager not initialized")
	}
	return a.lockoutManager.UpdateConfig(cfg)
}

// RestartApp finds os.Executable(), spawns a new process (with proper Windows flags so it starts independently),
// and exits the current process with os.Exit(0) or wails runtime.Quit(a.ctx).
func (a *App) RestartApp() error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	return a.restartApp()
}

func (a *App) restartApp() error {
	exe, err := os.Executable()
	if err != nil {
		logger.Logger.Error().Err(err).Msg("RestartApp: failed to find executable")
		return fmt.Errorf("failed to find executable: %w", err)
	}

	cmd := exec.Command(exe)
	setIndependentProcessFlags(cmd)

	if err := cmd.Start(); err != nil {
		logger.Logger.Error().Err(err).Msg("RestartApp: failed to launch new process")
		return fmt.Errorf("failed to launch new process: %w", err)
	}

	logger.Logger.Info().Str("exe", exe).Msg("RestartApp: new process launched successfully, exiting current process")

	go func() {
		time.Sleep(100 * time.Millisecond)
		if a.ctx != nil {
			runtime.Quit(a.ctx)
		}
		os.Exit(0)
	}()

	return nil
}

// WipeAllData safely purges all sensitive credentials, database, and settings
func (a *App) WipeAllData() error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	return a.wipeAllData()
}

func (a *App) wipeAllData() error {
	logger.Logger.Warn().Msg("SECURITY ALERT: Initiating complete data wipe due to maximum failed passcode attempts")
	a.disconnectServerConsole()
	if a.db != nil {
		a.db.Close()
	}

	// Remove SQLite database files
	dbDir := filepath.Join(a.appDataDir, "data")
	_ = os.Remove(filepath.Join(dbDir, "pterodesk.db"))
	_ = os.Remove(filepath.Join(dbDir, "pterodesk.db-wal"))
	_ = os.Remove(filepath.Join(dbDir, "pterodesk.db-shm"))
	_ = os.Remove(filepath.Join(dbDir, "window_state.json"))
	_ = os.Remove(filepath.Join(dbDir, "app_lock.dat"))
	_ = os.Remove(filepath.Join(dbDir, "app_lock_enabled"))
	_ = os.Remove(filepath.Join(dbDir, "sftp_known_hosts"))

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "security:data-wiped")
	}

	// Launch goroutine that waits 400ms and calls RestartApp() so the app restarts
	// cleanly with a fresh database and no 'database is closed' error.
	go func() {
		time.Sleep(400 * time.Millisecond)
		_ = a.restartApp()
	}()

	return nil
}

// --- In-Memory Session Lock Guard Bindings ---

type decryptedPanelKeys struct {
	record database.PanelRecord
	client string
	app    string
}

func (a *App) snapshotPanelKeys() ([]decryptedPanelKeys, error) {
	if a.db == nil || a.credentials == nil {
		return nil, nil
	}
	panels, err := a.db.GetAllPanels()
	if err != nil {
		return nil, err
	}
	res := make([]decryptedPanelKeys, 0, len(panels))
	for _, p := range panels {
		var clientPlain, appPlain string
		if p.ClientAPIKey != "" {
			clientPlain, err = a.credentials.DecryptString(p.ClientAPIKey)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt client API key for panel %s: %w", p.Name, err)
			}
		}
		if p.AppAPIKey != "" {
			appPlain, err = a.credentials.DecryptString(p.AppAPIKey)
			if err != nil {
				return nil, fmt.Errorf("failed to decrypt app API key for panel %s: %w", p.Name, err)
			}
		}
		res = append(res, decryptedPanelKeys{
			record: p,
			client: clientPlain,
			app:    appPlain,
		})
	}
	return res, nil
}

func (a *App) commitPanelKeys(snaps []decryptedPanelKeys) error {
	if a.db == nil || a.credentials == nil {
		return nil
	}
	for _, s := range snaps {
		if s.client != "" {
			enc, err := a.credentials.EncryptString(s.client)
			if err != nil {
				return fmt.Errorf("failed to re-encrypt client API key for panel %s: %w", s.record.Name, err)
			}
			s.record.ClientAPIKey = enc
		}
		if s.app != "" {
			enc, err := a.credentials.EncryptString(s.app)
			if err != nil {
				return fmt.Errorf("failed to re-encrypt app API key for panel %s: %w", s.record.Name, err)
			}
			s.record.AppAPIKey = enc
		}
		if err := a.db.SavePanel(s.record); err != nil {
			return err
		}
	}
	if a.panelManager != nil {
		return a.panelManager.Initialize()
	}
	return nil
}

// SetLockConfig updates the session lock configuration
func (a *App) SetLockConfig(enabled bool, lockType string, passcode string, currentPasscode string) error {
	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()
	if a.lockConfigEnabled {
		if a.lockoutManager != nil {
			status := a.lockoutManager.GetStatus()
			if status.IsLockedOut {
				return fmt.Errorf("app is locked out")
			}
		}
		if !a.verifyPasscode(currentPasscode) {
			if a.lockoutManager != nil {
				_, _ = a.lockoutManager.RecordFailedAttempt()
			}
			return fmt.Errorf("authentication required: invalid current passcode")
		}
		if !security.IsPasscodeKeyActive() && a.lockConfigEncSalt != "" {
			if encSalt, err := hex.DecodeString(a.lockConfigEncSalt); err == nil && len(encSalt) > 0 {
				security.SetPasscodeKey(security.DerivePasscodeKey(currentPasscode, encSalt))
			}
		}
	}
	snaps, err := a.snapshotPanelKeys()
	if err != nil {
		return err
	}
	path := filepath.Join(a.appDataDir, "data", "app_lock.dat")
	marker := filepath.Join(a.appDataDir, "data", "app_lock_enabled")
	if !enabled {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
		if err := os.Remove(marker); err != nil && !os.IsNotExist(err) {
			return err
		}
		if a.db != nil {
			_ = a.db.SaveSetting("app_lock", "")
			_ = a.db.SaveSetting("app_lock_type", "")
		}
		security.ClearPasscodeKey()
		security.ClearDebugPasscodeKey()
		if err := a.commitPanelKeys(snaps); err != nil {
			return err
		}
		a.lockConfigEnabled, a.sessionLocked = false, false
		a.lockConfigHash, a.lockConfigSalt, a.lockConfigEncSalt, a.lockConfigType = "", "", "", "none"
		return nil
	}
	if lockType != "pin4" && lockType != "pin6" && lockType != "pin8" && lockType != "password" {
		return fmt.Errorf("invalid lock type")
	}
	if len(passcode) < 4 {
		return fmt.Errorf("passcode too short")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return err
	}
	encSalt := make([]byte, 16)
	if _, err := rand.Read(encSalt); err != nil {
		return err
	}
	hash := argon2.IDKey([]byte(passcode), salt, 3, 64*1024, 4, 32)
	stored, err := json.Marshal(struct{ Type, Salt, EncSalt, Hash string }{
		Type:    lockType,
		Salt:    hex.EncodeToString(salt),
		EncSalt: hex.EncodeToString(encSalt),
		Hash:    hex.EncodeToString(hash),
	})
	if err != nil {
		return err
	}
	// app_lock.dat must remain decryptable at boot before passcode entry (DPAPI/TPM only).
	encrypted, err := security.EncryptSystem(stored)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	if err := os.WriteFile(path, encrypted, 0600); err != nil {
		return err
	}
	if err := os.WriteFile(marker, []byte("enabled"), 0600); err != nil {
		return err
	}
	if a.db != nil {
		_ = a.db.SaveSetting("app_lock", base64.StdEncoding.EncodeToString(encrypted))
		_ = a.db.SaveSetting("app_lock_type", lockType)
		_ = a.db.SaveSetting("security_lock_on_launch", "true")
	}
	security.SetPasscodeKey(security.DerivePasscodeKey(passcode, encSalt))
	if err := a.commitPanelKeys(snaps); err != nil {
		return err
	}
	a.lockConfigType, a.lockConfigSalt, a.lockConfigEncSalt, a.lockConfigHash = lockType, hex.EncodeToString(salt), hex.EncodeToString(encSalt), hex.EncodeToString(hash)
	a.lockConfigEnabled, a.sessionLocked = true, false
	return nil
}

func (a *App) GetLockType() string {
	a.waitForStartup()
	a.sessionMu.RLock()
	defer a.sessionMu.RUnlock()
	if !a.lockConfigEnabled {
		return "none"
	}
	if a.lockConfigType == "" {
		return "password"
	}
	return a.lockConfigType
}

func (a *App) verifyPasscode(passcode string) bool {
	salt, err := hex.DecodeString(a.lockConfigSalt)
	if err != nil || len(salt) != 16 || a.lockConfigHash == "" {
		return false
	}
	actual := argon2.IDKey([]byte(passcode), salt, 3, 64*1024, 4, 32)
	expected, err := hex.DecodeString(a.lockConfigHash)
	return err == nil && subtle.ConstantTimeCompare(actual, expected) == 1
}

// LockSession locks the session if lock is enabled
func (a *App) LockSession() {
	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()
	a.sessionLocked = true
	security.ClearPasscodeKey()
}

// IsSessionLocked returns whether session lock is active and locked
func (a *App) IsSessionLocked() bool {
	a.waitForStartup()
	a.sessionMu.RLock()
	defer a.sessionMu.RUnlock()
	return a.lockConfigEnabled && a.sessionLocked
}

// UnlockSession verifies the provided passcode hash against the configured hash
func (a *App) UnlockSession(passcode string) (bool, error) {
	a.sessionMu.Lock()
	defer a.sessionMu.Unlock()

	// An enabled lock must always verify the passcode, including when not locked.
	if !a.lockConfigEnabled {
		return true, nil
	}

	// If lockout countdown is currently active, prevent unlocking
	if a.lockoutManager != nil {
		status := a.lockoutManager.GetStatus()
		if status.IsLockedOut && status.RemainingLockoutSeconds > 0 {
			return false, fmt.Errorf("app is locked out: %d seconds remaining", status.RemainingLockoutSeconds)
		}
	}

	if a.verifyPasscode(passcode) {
		if a.lockConfigEncSalt != "" {
			if encSalt, err := hex.DecodeString(a.lockConfigEncSalt); err == nil && len(encSalt) > 0 {
				security.SetPasscodeKey(security.DerivePasscodeKey(passcode, encSalt))
			}
			if a.panelManager != nil {
				_ = a.panelManager.Initialize()
			}
		} else {
			// Silent upgrade migration from pre-SDPASS1 versions (app_lock.dat lacked EncSalt).
			a.migrateLegacyLockOnUnlock(passcode)
		}
		a.sessionLocked = false
		if a.lockoutManager != nil {
			_ = a.lockoutManager.RecordSuccess()
		}
		if a.ctx != nil {
			runtime.EventsEmit(a.ctx, "session:unlocked")
		}
		return true, nil
	}

	if a.lockoutManager != nil {
		_, _ = a.lockoutManager.RecordFailedAttempt()
	}
	return false, fmt.Errorf("invalid passcode")
}

// migrateLegacyLockOnUnlock silently upgrades a pre-SDPASS1 app_lock.dat (without EncSalt)
// and re-encrypts panel credentials under the passcode-derived AES-256-GCM key.
func (a *App) migrateLegacyLockOnUnlock(passcode string) {
	snaps, err := a.snapshotPanelKeys()
	if err != nil {
		logger.Logger.Warn().Err(err).Msg("Legacy lock migration: failed to snapshot panel keys")
		return
	}
	encSalt := make([]byte, 16)
	if _, err := rand.Read(encSalt); err != nil {
		return
	}
	encSaltHex := hex.EncodeToString(encSalt)
	stored, err := json.Marshal(struct{ Type, Salt, EncSalt, Hash string }{
		Type:    a.lockConfigType,
		Salt:    a.lockConfigSalt,
		EncSalt: encSaltHex,
		Hash:    a.lockConfigHash,
	})
	if err != nil {
		return
	}
	encrypted, err := security.EncryptSystem(stored)
	if err != nil {
		return
	}
	path := filepath.Join(a.appDataDir, "data", "app_lock.dat")
	if err := os.WriteFile(path, encrypted, 0600); err != nil {
		return
	}
	if a.db != nil {
		_ = a.db.SaveSetting("app_lock", base64.StdEncoding.EncodeToString(encrypted))
	}
	a.lockConfigEncSalt = encSaltHex
	security.SetPasscodeKey(security.DerivePasscodeKey(passcode, encSalt))
	if err := a.commitPanelKeys(snaps); err != nil {
		logger.Logger.Warn().Err(err).Msg("Legacy lock migration: failed to re-encrypt panel keys")
	} else {
		logger.Logger.Info().Msg("Silently migrated legacy App Lock credentials to SDPASS1")
	}
}

// SecurityPreferences holds session lock preferences persisted in database
type SecurityPreferences struct {
	AutoLockMinutes int  `json:"auto_lock_minutes"`
	LockOnLaunch    bool `json:"lock_on_launch"`
}

// GetSecurityPreferences returns saved security preferences from persistent storage
func (a *App) GetSecurityPreferences() SecurityPreferences {
	prefs := SecurityPreferences{
		AutoLockMinutes: 0,
		LockOnLaunch:    true,
	}
	if a.db != nil {
		if val, err := a.db.GetSetting("security_autolock_minutes"); err == nil && val != "" {
			if mins, err := strconv.Atoi(val); err == nil {
				prefs.AutoLockMinutes = mins
			}
		}
		if val, err := a.db.GetSetting("security_lock_on_launch"); err == nil && val != "" {
			prefs.LockOnLaunch = val == "true"
		}
	}
	return prefs
}

// SetSecurityPreferences persists security preferences to database
func (a *App) SetSecurityPreferences(prefs SecurityPreferences) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if a.db != nil {
		_ = a.db.SaveSetting("security_autolock_minutes", strconv.Itoa(prefs.AutoLockMinutes))
		_ = a.db.SaveSetting("security_lock_on_launch", strconv.FormatBool(prefs.LockOnLaunch))
	}
	return nil
}

// checkSessionLock returns error if lock is enabled and session is locked
func (a *App) checkSessionLock() error {
	a.waitForStartup()
	a.sessionMu.RLock()
	defer a.sessionMu.RUnlock()
	if a.lockConfigEnabled && a.sessionLocked {
		return fmt.Errorf("app is locked: authentication required")
	}
	return nil
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	logger.Logger.Info().Msg("SynoraDesk shutting down")
	security.ClearPasscodeKey()
	if a.lockoutManager != nil {
		a.lockoutManager.Close()
	}
	if a.ctx != nil && !a.detachedConfig.IsDetached {
		isMax := runtime.WindowIsMaximised(a.ctx)
		w, h := runtime.WindowGetSize(a.ctx)
		x, y := runtime.WindowGetPosition(a.ctx)
		_ = a.SaveWindowState(w, h, x, y, isMax)
	}
	a.disconnectServerConsole()
	if a.db != nil {
		a.db.Close()
	}
}

// --- Panel Management Bindings ---

// GetPanels returns all configured panels
func (a *App) GetPanels() ([]panel.Panel, error) {
	a.waitForStartup()
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	if a.panelManager == nil {
		return []panel.Panel{}, nil
	}
	return a.panelManager.GetAllPanels()
}

// GetActivePanel returns the currently active panel
func (a *App) GetActivePanel() (*panel.Panel, error) {
	a.waitForStartup()
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	if a.panelManager == nil {
		return nil, nil
	}
	return a.panelManager.GetActivePanel()
}

// GetAccount returns the authenticated user account for the active panel (alias for GetCurrentAccount)
func (a *App) GetAccount() (*api.Account, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	return a.GetCurrentAccount()
}

// GetCurrentAccount returns the authenticated user account for the active panel
func (a *App) GetCurrentAccount() (*api.Account, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()
	return client.GetAccount(ctx)
}

// GetPanelAccount returns the authenticated user account for a specific panel
func (a *App) GetPanelAccount(panelID string) (*api.Account, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPIForPanel(panelID)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()
	return client.GetAccount(ctx)
}

// UpdateAccountEmail updates the email for the active account
func (a *App) UpdateAccountEmail(email, password string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.UpdateEmail(a.ctx, email, password)
}

// UpdateAccountPassword updates the password for the active account
func (a *App) UpdateAccountPassword(currentPassword, newPassword, confirmPassword string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.UpdatePassword(a.ctx, currentPassword, newPassword, confirmPassword)
}

// GetTwoFactorDetails retrieves 2FA setup details (secret & QR data)
func (a *App) GetTwoFactorDetails() (*api.TwoFactorDetails, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetTwoFactorDetails(a.ctx)
}

// EnableTwoFactor verifies TOTP code and enables 2FA, returning backup recovery tokens
func (a *App) EnableTwoFactor(code string) ([]string, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.EnableTwoFactor(a.ctx, code)
}

// DisableTwoFactor disables 2FA for the active account
func (a *App) DisableTwoFactor(password string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DisableTwoFactor(a.ctx, password)
}

// ListAccountAPIKeys retrieves all API keys for the current account
func (a *App) ListAccountAPIKeys() ([]api.AccountApiKey, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListAPIKeys(a.ctx)
}

// CreateAccountAPIKey creates a new API key
func (a *App) CreateAccountAPIKey(description string, allowedIPs []string) (*api.AccountApiKey, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CreateAPIKey(a.ctx, description, allowedIPs)
}

// DeleteAccountAPIKey deletes an API key
func (a *App) DeleteAccountAPIKey(identifier string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DeleteAPIKey(a.ctx, identifier)
}

// ListAccountSSHKeys retrieves all SSH keys for the current account
func (a *App) ListAccountSSHKeys() ([]api.AccountSSHKey, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListSSHKeys(a.ctx)
}

// CreateAccountSSHKey creates a new SSH key
func (a *App) CreateAccountSSHKey(name, publicKey string) (*api.AccountSSHKey, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CreateSSHKey(a.ctx, name, publicKey)
}

// RemoveAccountSSHKey removes an SSH key by fingerprint
func (a *App) RemoveAccountSSHKey(fingerprint string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.RemoveSSHKey(a.ctx, fingerprint)
}

// GetAccountActivity retrieves activity log for the current account
func (a *App) GetAccountActivity() ([]api.AccountActivity, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetAccountActivity(a.ctx)
}

// AddPanel adds a new panel configuration
func (a *App) AddPanel(input panel.PanelInput) (*panel.Panel, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	p, err := a.panelManager.AddPanel(input)
	if err != nil {
		logger.Logger.Error().Err(err).Str("name", input.Name).Msg("Failed to add panel")
		return nil, err
	}
	logger.Logger.Info().Str("name", input.Name).Str("id", p.ID).Msg("Panel added")
	a.logActivity(p.ID, p.Name, "", "panel.add", "success", "")
	return p, nil
}

// UpdatePanel updates an existing panel
func (a *App) UpdatePanel(id string, input panel.PanelInput) (*panel.Panel, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	p, err := a.panelManager.UpdatePanel(id, input)
	if err != nil {
		logger.Logger.Error().Err(err).Str("id", id).Msg("Failed to update panel")
		return nil, err
	}
	logger.Logger.Info().Str("id", id).Msg("Panel updated")
	a.logActivity(id, p.Name, "", "panel.update", "success", "")
	return p, nil
}

// DeletePanel removes a panel
func (a *App) DeletePanel(id string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if err := a.panelManager.DeletePanel(id); err != nil {
		logger.Logger.Error().Err(err).Str("id", id).Msg("Failed to delete panel")
		return err
	}
	logger.Logger.Info().Str("id", id).Msg("Panel deleted")
	a.logActivity(id, "", "", "panel.delete", "success", "")
	return nil
}

// SwitchPanel switches the active panel
func (a *App) SwitchPanel(id string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if err := a.panelManager.SetActivePanel(id); err != nil {
		return err
	}
	logger.Logger.Info().Str("id", id).Msg("Active panel switched")
	// Emit event to frontend
	runtime.EventsEmit(a.ctx, "panel:switched", id)
	return nil
}

// TestPanelConnection tests API connectivity
func (a *App) TestPanelConnection(id string) (*panel.ConnectionTestResult, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	result, err := a.panelManager.TestConnection(id)
	if err != nil {
		return nil, err
	}
	logger.Logger.Info().
		Str("id", id).
		Bool("clientOk", result.ClientAPI).
		Bool("appOk", result.AppAPI).
		Msg("Panel connection tested")
	return result, nil
}

// --- Server Bindings ---

// GetServers returns all servers from the active panel (alias for ListServers)
func (a *App) GetServers() ([]api.Server, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	return a.ListServers()
}

// ListServers lists servers from the active panel's Client API
func (a *App) ListServers() ([]api.Server, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListServers(a.ctx)
}

// GetServerDetails retrieves full details for a server (alias for GetServer)
func (a *App) GetServerDetails(identifier string) (*api.Server, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	return a.GetServer(identifier)
}

// GetServer retrieves a specific server
func (a *App) GetServer(identifier string) (*api.Server, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	// Track as recently accessed
	server, err := client.GetServer(a.ctx, identifier)
	if err != nil {
		return nil, err
	}
	a.db.SaveRecentServer(database.RecentServerRecord{
		PanelID:    a.panelManager.GetActivePanelID(),
		ServerID:   identifier,
		ServerName: server.Name,
	})
	return server, nil
}

// GetServerResources gets current resource usage
func (a *App) GetServerResources(identifier string) (*api.ResourceUsage, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetServerResources(a.ctx, identifier)
}

// SendPowerAction sends a power signal to a server
func (a *App) SendPowerAction(identifier string, signal string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	if err := client.SendPowerAction(a.ctx, identifier, signal); err != nil {
		a.logActivity(a.panelManager.GetActivePanelID(), "", identifier, "server.power."+signal, "error", err.Error())
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", identifier, "server.power."+signal, "success", "")
	return nil
}

// --- Dashboard Bindings ---

// GetDashboardStats retrieves dashboard statistics
func (a *App) GetDashboardStats() (*panel.DashboardStats, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	stats := &panel.DashboardStats{}

	panels, err := a.panelManager.GetAllPanels()
	if err != nil {
		return nil, err
	}
	stats.TotalPanels = len(panels)

	activePanel, err := a.panelManager.GetActivePanel()
	if err == nil && activePanel != nil {
		stats.ActivePanel = activePanel.ID
		stats.ActivePanelName = activePanel.Name

		// Get server stats from Client API
		client, err := a.panelManager.GetClientAPI()
		if err == nil {
			servers, err := client.ListServers(a.ctx)
			if err == nil {
				stats.TotalServers = len(servers)
				for _, s := range servers {
					res, err := client.GetServerResources(a.ctx, s.Identifier)
					if err == nil {
						switch res.CurrentState {
						case "running":
							stats.RunningServers++
						case "offline", "":
							stats.OfflineServers++
						}
					}
				}
			}
		}

		// Get node count from Application API
		appAPI, err := a.panelManager.GetAppAPI()
		if err == nil {
			nodes, err := appAPI.ListNodes(a.ctx)
			if err == nil {
				stats.TotalNodes = len(nodes)
			}
		}
	}

	return stats, nil
}

// GetRecentActivities returns recent activity logs
func (a *App) GetRecentActivities() ([]database.ActivityRecord, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	return a.db.GetActivities(50)
}

// GetRecentServers returns recently accessed servers
func (a *App) GetRecentServers() ([]database.RecentServerRecord, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	return a.db.GetRecentServers(10)
}

// --- File Manager Bindings ---

// ListFiles lists files in a directory on a server
func (a *App) ListFiles(identifier, directory string) ([]api.FileObject, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListFiles(a.ctx, identifier, directory)
}

// GetFileContents gets file contents
func (a *App) GetFileContents(identifier, filePath string) (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	return client.GetFileContents(a.ctx, identifier, filePath)
}

// WriteFile writes content to a file
func (a *App) WriteFile(identifier, filePath, content string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.WriteFile(a.ctx, identifier, filePath, content)
}

// CreateFile creates a new folder/file
func (a *App) CreateFile(identifier, root, name string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.CreateFile(a.ctx, identifier, root, name)
}

// DeleteFiles deletes files/folders
func (a *App) DeleteFiles(identifier, root string, files []string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DeleteFiles(a.ctx, identifier, root, files)
}

// RenameFile renames or moves a file
func (a *App) RenameFile(identifier, root, from, to string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.RenameFile(a.ctx, identifier, root, []map[string]string{
		{"from": from, "to": to},
	})
}

// GetFileDownloadURL retrieves a presigned URL to download a file
func (a *App) GetFileDownloadURL(identifier, filePath string) (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	return client.GetFileDownloadURL(a.ctx, identifier, filePath)
}

// ChmodFile modifies file permissions via REST API
func (a *App) ChmodFile(identifier, root, file, mode string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.ChmodFiles(a.ctx, identifier, root, []api.ChmodFileEntry{
		{File: file, Mode: mode},
	})
}

// CompressFiles archives files/directories to a tar.gz archive
func (a *App) CompressFiles(identifier, root string, files []string) (*api.FileObject, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CompressFiles(a.ctx, identifier, root, files)
}

// DecompressFile extracts an archive
func (a *App) DecompressFile(identifier, root, file string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DecompressFile(a.ctx, identifier, root, file)
}

// CopyFile duplicates a file
func (a *App) CopyFile(identifier, location string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.CopyFile(a.ctx, identifier, location)
}

// PullRemoteFile pulls a remote file from an HTTP/HTTPS URL directly onto the server
func (a *App) PullRemoteFile(identifier, directory, url, filename string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.PullFile(a.ctx, identifier, directory, url, filename, false, false)
}

// UploadServerFileDirect uploads file content directly using Wings presigned upload URL
func (a *App) UploadServerFileDirect(identifier, directory, filename, base64Content string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	data, err := base64.StdEncoding.DecodeString(base64Content)
	if err != nil {
		return fmt.Errorf("failed to decode base64 file data: %w", err)
	}
	return client.UploadFileDirect(a.ctx, identifier, directory, filename, data)
}

// --- User Bindings (Application API) ---

// AdminListUsers lists panel users with server-side pagination and filters
func (a *App) AdminListUsers(opts api.ListOptions) (*api.PaginatedResult[api.User], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListUsersPage(a.ctx, opts)
}

// AdminGetUser retrieves a single panel user by ID
func (a *App) AdminGetUser(id int) (*api.User, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetUser(a.ctx, id)
}

// AdminCreateUser creates a new panel user
func (a *App) AdminCreateUser(req api.CreateUserRequest) (*api.User, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	user, err := appAPI.CreateUser(a.ctx, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.user.create", "success", fmt.Sprintf("user:%s", user.Username))
	return user, nil
}

// AdminUpdateUser updates an existing panel user
func (a *App) AdminUpdateUser(id int, req api.UpdateUserRequest) (*api.User, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	user, err := appAPI.UpdateUser(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.user.update", "success", fmt.Sprintf("user:%d", id))
	return user, nil
}

// AdminDeleteUser deletes a panel user
func (a *App) AdminDeleteUser(id int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.DeleteUser(a.ctx, id); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.user.delete", "success", fmt.Sprintf("user:%d", id))
	return nil
}

// --- Server Bindings (Application API) ---

// AdminListServers lists servers with server-side pagination and filters
func (a *App) AdminListServers(opts api.ListOptions) (*api.PaginatedResult[api.AppServer], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListServersPage(a.ctx, opts)
}

// AdminGetServer retrieves a server by internal ID
func (a *App) AdminGetServer(id int) (*api.AppServer, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetServer(a.ctx, id)
}

// AdminCreateServer provisions a new server
func (a *App) AdminCreateServer(req api.CreateServerRequest) (*api.AppServer, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	srv, err := appAPI.CreateServer(a.ctx, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), srv.Identifier, srv.Name, "admin.server.create", "success", fmt.Sprintf("server:%d", srv.ID))
	return srv, nil
}

// AdminUpdateServerDetails updates server details
func (a *App) AdminUpdateServerDetails(id int, req api.UpdateServerDetailsRequest) (*api.AppServer, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	srv, err := appAPI.UpdateServerDetails(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), srv.Identifier, srv.Name, "admin.server.update_details", "success", fmt.Sprintf("server:%d", id))
	return srv, nil
}

// AdminUpdateServerBuild updates server build & resource limits
func (a *App) AdminUpdateServerBuild(id int, req api.UpdateServerBuildRequest) (*api.AppServer, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	srv, err := appAPI.UpdateServerBuild(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), srv.Identifier, srv.Name, "admin.server.update_build", "success", fmt.Sprintf("server:%d", id))
	return srv, nil
}

// AdminUpdateServerStartup updates server startup configuration
func (a *App) AdminUpdateServerStartup(id int, req api.UpdateServerStartupRequest) (*api.AppServer, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	srv, err := appAPI.UpdateServerStartup(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), srv.Identifier, srv.Name, "admin.server.update_startup", "success", fmt.Sprintf("server:%d", id))
	return srv, nil
}

// AdminSuspendServer suspends a server
func (a *App) AdminSuspendServer(id int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.SuspendServer(a.ctx, id); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.server.suspend", "success", fmt.Sprintf("server:%d", id))
	return nil
}

// AdminUnsuspendServer unsuspends a server
func (a *App) AdminUnsuspendServer(id int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.UnsuspendServer(a.ctx, id); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.server.unsuspend", "success", fmt.Sprintf("server:%d", id))
	return nil
}

// AdminReinstallServer triggers server reinstallation
func (a *App) AdminReinstallServer(id int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.ReinstallServer(a.ctx, id); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.server.reinstall", "success", fmt.Sprintf("server:%d", id))
	return nil
}

// AdminDeleteServer deletes or force-deletes a server
func (a *App) AdminDeleteServer(id int, force bool) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	var errDel error
	if force {
		errDel = appAPI.ForceDeleteServer(a.ctx, id)
	} else {
		errDel = appAPI.DeleteServer(a.ctx, id)
	}
	if errDel != nil {
		return errDel
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.server.delete", "success", fmt.Sprintf("server:%d,force:%v", id, force))
	return nil
}

// --- Node Bindings (Application API) ---

// ListNodes lists all nodes
func (a *App) ListNodes() ([]api.Node, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNodes(a.ctx)
}

// AdminListNodes lists nodes with server-side pagination and filters
func (a *App) AdminListNodes(opts api.ListOptions) (*api.PaginatedResult[api.Node], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNodesPage(a.ctx, opts)
}

// GetNode retrieves a node
func (a *App) GetNode(id int) (*api.Node, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetNode(a.ctx, id)
}

// AdminGetNodeConfiguration retrieves the Wings daemon configuration for a node
func (a *App) AdminGetNodeConfiguration(id int) (*api.NodeConfiguration, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetNodeConfiguration(a.ctx, id)
}

// CreateNode creates a new node
func (a *App) CreateNode(req api.CreateNodeRequest) (*api.Node, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	node, err := appAPI.CreateNode(a.ctx, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "node.create", "success", "")
	return node, nil
}

// AdminUpdateNode updates an existing node
func (a *App) AdminUpdateNode(id int, req api.CreateNodeRequest) (*api.Node, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	node, err := appAPI.UpdateNode(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "node.update", "success", fmt.Sprintf("node:%d", id))
	return node, nil
}

// DeleteNode deletes a node
func (a *App) DeleteNode(id int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.DeleteNode(a.ctx, id); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "node.delete", "success", "")
	return nil
}

// --- Location Bindings (Application API) ---

// AdminListLocations lists locations with server-side pagination and filters
func (a *App) AdminListLocations(opts api.ListOptions) (*api.PaginatedResult[api.Location], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListLocationsPage(a.ctx, opts)
}

// AdminGetLocation retrieves a location by ID
func (a *App) AdminGetLocation(id int) (*api.Location, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetLocation(a.ctx, id)
}

// AdminCreateLocation creates a new location
func (a *App) AdminCreateLocation(req api.CreateLocationRequest) (*api.Location, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	loc, err := appAPI.CreateLocation(a.ctx, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.location.create", "success", fmt.Sprintf("location:%s", loc.Short))
	return loc, nil
}

// AdminUpdateLocation updates an existing location
func (a *App) AdminUpdateLocation(id int, req api.CreateLocationRequest) (*api.Location, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	loc, err := appAPI.UpdateLocation(a.ctx, id, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.location.update", "success", fmt.Sprintf("location:%d", id))
	return loc, nil
}

// AdminDeleteLocation deletes a location
func (a *App) AdminDeleteLocation(id int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.DeleteLocation(a.ctx, id); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.location.delete", "success", fmt.Sprintf("location:%d", id))
	return nil
}

// --- Nest/Egg Bindings ---

// ListNests lists all nests
func (a *App) ListNests() ([]api.Nest, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNests(a.ctx)
}

// AdminListNests lists nests with server-side pagination
func (a *App) AdminListNests(opts api.ListOptions) (*api.PaginatedResult[api.Nest], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNestsPage(a.ctx, opts)
}

// ListEggs lists eggs for a nest
func (a *App) ListEggs(nestID int) ([]api.Egg, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListEggs(a.ctx, nestID)
}

// AdminListEggs lists eggs for a nest with pagination
func (a *App) AdminListEggs(nestID int, opts api.ListOptions) (*api.PaginatedResult[api.Egg], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListEggsPage(a.ctx, nestID, opts)
}

// AdminGetEgg retrieves an egg with variables, config, and script
func (a *App) AdminGetEgg(nestID, eggID int) (*api.Egg, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetEgg(a.ctx, nestID, eggID)
}

// --- Database Bindings ---

// ListDatabases lists databases for a server
func (a *App) ListDatabases(identifier string) ([]api.Database, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListDatabases(a.ctx, identifier)
}

// --- Allocation Bindings ---

// ListNodeAllocations lists allocations for a node
func (a *App) ListNodeAllocations(nodeID int) ([]api.NodeAllocation, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNodeAllocations(a.ctx, nodeID)
}

// AdminListNodeAllocations lists allocations for a node with server-side pagination
func (a *App) AdminListNodeAllocations(nodeID int, opts api.ListOptions) (*api.PaginatedResult[api.NodeAllocation], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNodeAllocationsPage(a.ctx, nodeID, opts)
}

// AdminCreateNodeAllocations creates allocations on a node
func (a *App) AdminCreateNodeAllocations(nodeID int, req api.CreateAllocationRequest) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.CreateNodeAllocations(a.ctx, nodeID, req); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.allocation.create", "success", fmt.Sprintf("node:%d", nodeID))
	return nil
}

// AdminDeleteNodeAllocation deletes an allocation from a node
func (a *App) AdminDeleteNodeAllocation(nodeID, allocationID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.DeleteNodeAllocation(a.ctx, nodeID, allocationID); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.allocation.delete", "success", fmt.Sprintf("node:%d,alloc:%d", nodeID, allocationID))
	return nil
}

// --- Application API Server Database Bindings ---

// AdminListServerDatabases lists databases for a server via Application API
func (a *App) AdminListServerDatabases(serverID int, opts api.ListOptions) (*api.PaginatedResult[api.AppDatabase], error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListServerDatabases(a.ctx, serverID, opts)
}

// AdminGetServerDatabase retrieves a database (optionally with password)
func (a *App) AdminGetServerDatabase(serverID, databaseID int, includePassword bool) (*api.AppDatabase, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetServerDatabase(a.ctx, serverID, databaseID, includePassword)
}

// AdminCreateServerDatabase creates a database for a server via Application API
func (a *App) AdminCreateServerDatabase(serverID int, req api.CreateAppDatabaseRequest) (*api.AppDatabase, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	db, err := appAPI.CreateServerDatabase(a.ctx, serverID, req)
	if err != nil {
		return nil, err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.database.create", "success", fmt.Sprintf("server:%d,db:%s", serverID, db.Database))
	return db, nil
}

// AdminResetServerDatabasePassword rotates a database password
func (a *App) AdminResetServerDatabasePassword(serverID, databaseID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.ResetServerDatabasePassword(a.ctx, serverID, databaseID); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.database.reset_password", "success", fmt.Sprintf("server:%d,db:%d", serverID, databaseID))
	return nil
}

// AdminDeleteServerDatabase deletes a server database
func (a *App) AdminDeleteServerDatabase(serverID, databaseID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return err
	}
	if err := appAPI.DeleteServerDatabase(a.ctx, serverID, databaseID); err != nil {
		return err
	}
	a.logActivity(a.panelManager.GetActivePanelID(), "", "", "admin.database.delete", "success", fmt.Sprintf("server:%d,db:%d", serverID, databaseID))
	return nil
}

// AdminProbePermissions checks Application API permissions across all admin modules (up to 3 retries)
func (a *App) AdminProbePermissions() (map[string]api.PermissionProbeStatus, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ProbePermissions(a.ctx), nil
}

// AdminCheckNodeHealth pings a single Wings node and returns reachability + latency in ms
func (a *App) AdminCheckNodeHealth(nodeID int) (*api.NodeHealthStatus, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	node, err := appAPI.GetNode(a.ctx, nodeID)
	if err != nil {
		return nil, err
	}
	st := api.CheckNodeHealth(a.ctx, *node, nil)
	return &st, nil
}

// AdminCheckNodesHealth pings all nodes (or first page) concurrently and returns health + latency ms
func (a *App) AdminCheckNodesHealth() (map[int]api.NodeHealthStatus, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	nodes, err := appAPI.ListNodes(a.ctx)
	if err != nil {
		return nil, err
	}
	return api.CheckNodesHealth(a.ctx, nodes, nil), nil
}

// --- Settings & Custom Background ---

// CustomBackgroundInfo holds custom wallpaper configuration
type CustomBackgroundInfo struct {
	Enabled   bool    `json:"enabled"`
	Path      string  `json:"path"`
	DataURL   string  `json:"dataUrl"`
	Opacity   float64 `json:"opacity"`
	Blur      int     `json:"blur"`
	Scale     float64 `json:"scale"`
	PositionX float64 `json:"positionX"`
	PositionY float64 `json:"positionY"`
	FitMode   string  `json:"fitMode"`
}

// GetAppDataDir returns the application data directory
func (a *App) GetAppDataDir() string {
	if err := a.checkSessionLock(); err != nil {
		return ""
	}
	return a.appDataDir
}

// getBackgroundDir returns the dedicated directory where custom backgrounds are saved
func (a *App) getBackgroundDir() string {
	return filepath.Join(a.appDataDir, "backgrounds")
}

// OpenBackgroundFolder opens the dedicated background folder in Windows Explorer
func (a *App) OpenBackgroundFolder() error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	dir := a.getBackgroundDir()
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create background directory: %w", err)
	}
	cmd := exec.Command("explorer", dir)
	return cmd.Start()
}

// SelectAndSaveBackgroundImage opens a native file dialog to pick an image,
// copies it into the dedicated %APPDATA%/PteroDesk/backgrounds/ directory,
// saves configuration, and returns the data URL and file path.
func (a *App) SelectAndSaveBackgroundImage() (*CustomBackgroundInfo, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	filePath, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select Background Image",
		Filters: []runtime.FileFilter{
			{
				DisplayName: "Image Files (*.png;*.jpg;*.jpeg;*.webp)",
				Pattern:     "*.png;*.jpg;*.jpeg;*.webp",
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if filePath == "" {
		return a.GetCustomBackground()
	}

	bgDir := a.getBackgroundDir()
	if err := os.MkdirAll(bgDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create background directory: %w", err)
	}

	ext := filepath.Ext(filePath)
	if ext == "" {
		ext = ".png"
	}
	targetPath := filepath.Join(bgDir, "custom_bg"+ext)

	// Copy file to targetPath
	src, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open source image: %w", err)
	}
	defer src.Close()

	dst, err := os.Create(targetPath)
	if err != nil {
		return nil, fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		return nil, fmt.Errorf("failed to copy image: %w", err)
	}

	// Read and generate base64 data URL for fast and secure webview loading
	bytes, err := os.ReadFile(targetPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read copied image: %w", err)
	}

	mimeType := "image/png"
	switch ext {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".webp":
		mimeType = "image/webp"
	}
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(bytes))

	opacity := 0.75
	blur := 0
	scale := 1.0
	posX := 50.0
	posY := 50.0
	fitMode := "cover"
	if existing, err := a.GetCustomBackground(); err == nil && existing != nil && existing.Opacity > 0 {
		opacity = existing.Opacity
		blur = existing.Blur
		if existing.Scale > 0 {
			scale = existing.Scale
		}
		posX = existing.PositionX
		posY = existing.PositionY
		if existing.FitMode != "" {
			fitMode = existing.FitMode
		}
	}

	_ = a.db.SaveSetting("custom_bg_enabled", "true")
	_ = a.db.SaveSetting("custom_bg_path", targetPath)
	_ = a.db.SaveSetting("custom_bg_opacity", fmt.Sprintf("%.2f", opacity))
	_ = a.db.SaveSetting("custom_bg_blur", strconv.Itoa(blur))
	_ = a.db.SaveSetting("custom_bg_scale", fmt.Sprintf("%.2f", scale))
	_ = a.db.SaveSetting("custom_bg_pos_x", fmt.Sprintf("%.1f", posX))
	_ = a.db.SaveSetting("custom_bg_pos_y", fmt.Sprintf("%.1f", posY))
	_ = a.db.SaveSetting("custom_bg_fit_mode", fitMode)

	info := &CustomBackgroundInfo{
		Enabled:   true,
		Path:      targetPath,
		DataURL:   dataURL,
		Opacity:   opacity,
		Blur:      blur,
		Scale:     scale,
		PositionX: posX,
		PositionY: posY,
		FitMode:   fitMode,
	}
	logger.Logger.Info().Str("path", targetPath).Msg("Custom background image saved in separate folder")
	return info, nil
}

// GetCustomBackground retrieves the saved custom background info
func (a *App) GetCustomBackground() (*CustomBackgroundInfo, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	enabledStr, _ := a.db.GetSetting("custom_bg_enabled")
	enabled := enabledStr == "true"

	path, _ := a.db.GetSetting("custom_bg_path")
	opacityStr, _ := a.db.GetSetting("custom_bg_opacity")
	blurStr, _ := a.db.GetSetting("custom_bg_blur")
	scaleStr, _ := a.db.GetSetting("custom_bg_scale")
	posXStr, _ := a.db.GetSetting("custom_bg_pos_x")
	posYStr, _ := a.db.GetSetting("custom_bg_pos_y")
	fitMode, _ := a.db.GetSetting("custom_bg_fit_mode")

	opacity := 0.75
	if o, err := strconv.ParseFloat(opacityStr, 64); err == nil && o >= 0.1 && o <= 1.0 {
		opacity = o
	}

	blur := 0
	if b, err := strconv.Atoi(blurStr); err == nil && b >= 0 && b <= 50 {
		blur = b
	}

	scale := 1.0
	if s, err := strconv.ParseFloat(scaleStr, 64); err == nil && s >= 0.2 && s <= 5.0 {
		scale = s
	}

	posX := 50.0
	if px, err := strconv.ParseFloat(posXStr, 64); err == nil && px >= 0.0 && px <= 100.0 {
		posX = px
	}

	posY := 50.0
	if py, err := strconv.ParseFloat(posYStr, 64); err == nil && py >= 0.0 && py <= 100.0 {
		posY = py
	}

	if fitMode == "" {
		fitMode = "cover"
	}

	if !enabled || path == "" {
		return &CustomBackgroundInfo{
			Enabled:   false,
			Path:      path,
			DataURL:   "",
			Opacity:   opacity,
			Blur:      blur,
			Scale:     scale,
			PositionX: posX,
			PositionY: posY,
			FitMode:   fitMode,
		}, nil
	}

	bgDir := filepath.Clean(a.getBackgroundDir())
	cleanPath := filepath.Clean(path)
	if !strings.HasPrefix(strings.ToLower(cleanPath), strings.ToLower(bgDir+string(os.PathSeparator))) {
		return &CustomBackgroundInfo{
			Enabled:   false,
			Path:      "",
			DataURL:   "",
			Opacity:   opacity,
			Blur:      blur,
			Scale:     scale,
			PositionX: posX,
			PositionY: posY,
			FitMode:   fitMode,
		}, nil
	}
	if info, lerr := os.Lstat(cleanPath); lerr != nil || info.Mode()&os.ModeSymlink != 0 || info.IsDir() {
		return &CustomBackgroundInfo{
			Enabled:   false,
			Path:      "",
			DataURL:   "",
			Opacity:   opacity,
			Blur:      blur,
			Scale:     scale,
			PositionX: posX,
			PositionY: posY,
			FitMode:   fitMode,
		}, nil
	}

	bytes, err := os.ReadFile(cleanPath)
	if err != nil {
		return &CustomBackgroundInfo{
			Enabled:   false,
			Path:      path,
			DataURL:   "",
			Opacity:   opacity,
			Blur:      blur,
			Scale:     scale,
			PositionX: posX,
			PositionY: posY,
			FitMode:   fitMode,
		}, nil
	}

	ext := filepath.Ext(path)
	mimeType := "image/png"
	switch ext {
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".webp":
		mimeType = "image/webp"
	}
	dataURL := fmt.Sprintf("data:%s;base64,%s", mimeType, base64.StdEncoding.EncodeToString(bytes))

	return &CustomBackgroundInfo{
		Enabled:   true,
		Path:      path,
		DataURL:   dataURL,
		Opacity:   opacity,
		Blur:      blur,
		Scale:     scale,
		PositionX: posX,
		PositionY: posY,
		FitMode:   fitMode,
	}, nil
}

// SaveCustomBackgroundSettings updates opacity, blur, scale, positions and fitMode
func (a *App) SaveCustomBackgroundSettings(opacity float64, blur int, scale float64, positionX float64, positionY float64, fitMode string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	_ = a.db.SaveSetting("custom_bg_opacity", fmt.Sprintf("%.2f", opacity))
	_ = a.db.SaveSetting("custom_bg_blur", strconv.Itoa(blur))
	if scale > 0 {
		_ = a.db.SaveSetting("custom_bg_scale", fmt.Sprintf("%.2f", scale))
	}
	_ = a.db.SaveSetting("custom_bg_pos_x", fmt.Sprintf("%.1f", positionX))
	_ = a.db.SaveSetting("custom_bg_pos_y", fmt.Sprintf("%.1f", positionY))
	if fitMode != "" {
		_ = a.db.SaveSetting("custom_bg_fit_mode", fitMode)
	}
	return nil
}

// RemoveCustomBackground disables and removes the custom background
func (a *App) RemoveCustomBackground() error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	_ = a.db.SaveSetting("custom_bg_enabled", "false")
	path, _ := a.db.GetSetting("custom_bg_path")
	if path != "" {
		_ = os.Remove(path)
	}
	_ = a.db.SaveSetting("custom_bg_path", "")
	return nil
}

// --- Console WebSocket Streaming Bindings ---

type consoleListener struct {
	ctx      context.Context
	serverID string
	mu       sync.Mutex
	pending  []string
	timer    *time.Timer
}

func (cl *consoleListener) OnConsoleOutput(line string) {
	cl.mu.Lock()
	cl.pending = append(cl.pending, line)
	if cl.timer == nil {
		cl.timer = time.AfterFunc(20*time.Millisecond, cl.flushConsoleOutput)
	}
	cl.mu.Unlock()
}

func (cl *consoleListener) flushConsoleOutput() {
	cl.mu.Lock()
	lines := cl.pending
	cl.pending = nil
	cl.timer = nil
	cl.mu.Unlock()

	for len(lines) > 0 {
		count := min(len(lines), 256)
		batch := append([]string(nil), lines[:count]...)
		lines = lines[count:]
		runtime.EventsEmit(cl.ctx, "console:output", map[string]interface{}{
			"server_id": cl.serverID,
			"lines":     batch,
		})
		runtime.EventsEmit(cl.ctx, fmt.Sprintf("server:console:%s", cl.serverID), batch)
	}
}

func (cl *consoleListener) OnStats(statsJSON string) {
	runtime.EventsEmit(cl.ctx, "console:stats", map[string]string{
		"server_id": cl.serverID,
		"stats":     statsJSON,
	})
	runtime.EventsEmit(cl.ctx, fmt.Sprintf("server:stats:%s", cl.serverID), statsJSON)
}

func (cl *consoleListener) OnStatus(status string) {
	runtime.EventsEmit(cl.ctx, "console:status", map[string]string{
		"server_id": cl.serverID,
		"status":    status,
	})
	runtime.EventsEmit(cl.ctx, fmt.Sprintf("server:status:%s", cl.serverID), status)
}

func (cl *consoleListener) OnError(err error) {
	runtime.EventsEmit(cl.ctx, "console:error", map[string]string{
		"server_id": cl.serverID,
		"error":     err.Error(),
	})
}

// ConnectServerConsole starts live WebSocket log & resource streaming for a server
func (a *App) ConnectServerConsole(serverID string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	a.wsMu.Lock()
	defer a.wsMu.Unlock()

	// If already streaming for this server, return ok
	if a.activeConsoleWS != nil && a.activeConsoleServer == serverID {
		return nil
	}

	// Disconnect existing if different
	if a.activeConsoleWS != nil {
		a.activeConsoleWS.Close()
		a.activeConsoleWS = nil
		a.activeConsoleServer = ""
	}

	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}

	activePanel, err := a.panelManager.GetActivePanel()
	if err != nil || activePanel == nil {
		return fmt.Errorf("no active panel selected")
	}

	auth, err := client.GetWebSocketAuth(a.ctx, serverID)
	if err != nil {
		return fmt.Errorf("failed to get websocket credentials: %w", err)
	}

	refresher := func(ctx context.Context) (*api.WebSocketAuth, error) {
		return client.GetWebSocketAuth(ctx, serverID)
	}

	listener := &consoleListener{
		ctx:      a.ctx,
		serverID: serverID,
	}

	ws := api.NewServerWebSocket(
		serverID,
		auth.Socket,
		auth.Token,
		activePanel.URL,
		refresher,
		listener,
		logger.Logger,
	)

	if err := ws.Connect(a.ctx); err != nil {
		return fmt.Errorf("failed to connect to server console: %w", err)
	}

	a.activeConsoleWS = ws
	a.activeConsoleServer = serverID
	logger.Logger.Info().Str("server_id", serverID).Msg("Connected to server live console WebSocket")
	return nil
}

// SendServerCommand sends a command through the live WebSocket console
func (a *App) SendServerCommand(command string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	a.wsMu.Lock()
	defer a.wsMu.Unlock()

	if a.activeConsoleWS == nil {
		return fmt.Errorf("console websocket is not connected")
	}
	return a.activeConsoleWS.SendCommand(command)
}

// SendServerPowerWS sends a power action through WebSocket
func (a *App) SendServerPowerWS(signal string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	a.wsMu.Lock()
	defer a.wsMu.Unlock()

	if a.activeConsoleWS == nil {
		return fmt.Errorf("console websocket is not connected")
	}
	return a.activeConsoleWS.SendPower(signal)
}

// DisconnectServerConsole closes the active WebSocket console
func (a *App) DisconnectServerConsole() {
	a.disconnectServerConsole()
}

func (a *App) disconnectServerConsole() {
	a.wsMu.Lock()
	defer a.wsMu.Unlock()

	if a.activeConsoleWS != nil {
		a.activeConsoleWS.Close()
		a.activeConsoleWS = nil
		a.activeConsoleServer = ""
	}
}

// --- Extended Backups Bindings ---

// ListBackups lists backups for a server
func (a *App) ListBackups(serverID string) ([]api.Backup, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListBackups(a.ctx, serverID)
}

// CreateBackup creates a new backup
func (a *App) CreateBackup(serverID, name string, isLocked bool, ignored string) (*api.Backup, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	backup, err := client.CreateBackupWithOptions(a.ctx, serverID, name, isLocked, ignored)
	if err != nil {
		a.logActivity("", "", serverID, "backup:create", "failed", err.Error())
		return nil, err
	}
	a.logActivity("", "", serverID, "backup:create", "success", fmt.Sprintf("Backup %s created", backup.Name))
	return backup, nil
}

// GetBackupDownloadURL retrieves the download URL for a backup
func (a *App) GetBackupDownloadURL(serverID, backupUUID string) (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	return client.GetBackupDownloadURL(a.ctx, serverID, backupUUID)
}

// ToggleBackupLock toggles the locked state of a backup
func (a *App) ToggleBackupLock(serverID, backupUUID string) (*api.Backup, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ToggleBackupLock(a.ctx, serverID, backupUUID)
}

// RestoreBackup restores a backup
func (a *App) RestoreBackup(serverID, backupUUID string, truncate bool) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.RestoreBackup(a.ctx, serverID, backupUUID, truncate)
	if err != nil {
		a.logActivity("", "", serverID, "backup:restore", "failed", err.Error())
		return err
	}
	a.logActivity("", "", serverID, "backup:restore", "success", "Backup restored")
	return nil
}

// DeleteBackup deletes a backup
func (a *App) DeleteBackup(serverID, backupUUID string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.DeleteBackup(a.ctx, serverID, backupUUID)
	if err != nil {
		a.logActivity("", "", serverID, "backup:delete", "failed", err.Error())
		return err
	}
	a.logActivity("", "", serverID, "backup:delete", "success", "Backup deleted")
	return nil
}

// --- Subusers Bindings ---

// ListSubusers lists subusers of a server
func (a *App) ListSubusers(serverID string) ([]api.Subuser, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListSubusers(a.ctx, serverID)
}

// CreateSubuser invites or adds a subuser
func (a *App) CreateSubuser(serverID, email string, permissions []string) (*api.Subuser, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	subuser, err := client.CreateSubuser(a.ctx, serverID, email, permissions)
	if err != nil {
		a.logActivity("", "", serverID, "subuser:create", "failed", err.Error())
		return nil, err
	}
	a.logActivity("", "", serverID, "subuser:create", "success", fmt.Sprintf("Added subuser %s", email))
	return subuser, nil
}

// UpdateSubuser updates permissions for a subuser
func (a *App) UpdateSubuser(serverID, subuserUUID string, permissions []string) (*api.Subuser, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.UpdateSubuser(a.ctx, serverID, subuserUUID, permissions)
}

// DeleteSubuser removes a subuser
func (a *App) DeleteSubuser(serverID, subuserUUID string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.DeleteSubuser(a.ctx, serverID, subuserUUID)
	if err != nil {
		a.logActivity("", "", serverID, "subuser:delete", "failed", err.Error())
		return err
	}
	a.logActivity("", "", serverID, "subuser:delete", "success", "Subuser removed")
	return nil
}

// --- Schedules Bindings ---

// ListSchedules returns schedules for a server
func (a *App) ListSchedules(serverID string) ([]api.Schedule, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListSchedules(a.ctx, serverID)
}

// CreateSchedule adds a schedule to a server
func (a *App) CreateSchedule(serverID, name string, cron api.CronExpression, isActive, onlyWhenOnline bool) (*api.Schedule, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CreateSchedule(a.ctx, serverID, name, cron, isActive, onlyWhenOnline)
}

// TriggerSchedule runs a schedule immediately
func (a *App) TriggerSchedule(serverID string, scheduleID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.TriggerSchedule(a.ctx, serverID, scheduleID)
}

// DeleteSchedule deletes a schedule
func (a *App) DeleteSchedule(serverID string, scheduleID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DeleteSchedule(a.ctx, serverID, scheduleID)
}

// --- Client Server Network (Allocations) Bindings ---

// ListServerAllocations lists all network allocations for a server
func (a *App) ListServerAllocations(serverID string) ([]api.Allocation, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListAllocations(a.ctx, serverID)
}

// AssignServerAllocation assigns a new allocation to the server
func (a *App) AssignServerAllocation(serverID string) (*api.Allocation, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	alloc, err := client.AssignAllocation(a.ctx, serverID)
	if err != nil {
		a.logActivity("", "", serverID, "network:assign", "failed", err.Error())
		return nil, err
	}
	a.logActivity("", "", serverID, "network:assign", "success", fmt.Sprintf("Assigned port %d", alloc.Port))
	return alloc, nil
}

// SetServerAllocationNote updates the note for an allocation
func (a *App) SetServerAllocationNote(serverID string, allocationID int, notes string) (*api.Allocation, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	alloc, err := client.SetAllocationNote(a.ctx, serverID, allocationID, notes)
	if err != nil {
		a.logActivity("", "", serverID, "network:note", "failed", err.Error())
		return nil, err
	}
	a.logActivity("", "", serverID, "network:note", "success", fmt.Sprintf("Updated note for port %d", alloc.Port))
	return alloc, nil
}

// SetServerPrimaryAllocation sets an allocation as primary
func (a *App) SetServerPrimaryAllocation(serverID string, allocationID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.SetPrimaryAllocation(a.ctx, serverID, allocationID)
	if err != nil {
		a.logActivity("", "", serverID, "network:primary", "failed", err.Error())
		return err
	}
	a.logActivity("", "", serverID, "network:primary", "success", fmt.Sprintf("Set allocation %d as primary", allocationID))
	return nil
}

// UnassignServerAllocation deletes an allocation from the server
func (a *App) UnassignServerAllocation(serverID string, allocationID int) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.UnassignAllocation(a.ctx, serverID, allocationID)
	if err != nil {
		a.logActivity("", "", serverID, "network:unassign", "failed", err.Error())
		return err
	}
	a.logActivity("", "", serverID, "network:unassign", "success", fmt.Sprintf("Unassigned allocation %d", allocationID))
	return nil
}

// --- Startup & Environment Bindings ---

// GetServerStartup gets full startup configuration including commands, docker images, and variables
func (a *App) GetServerStartup(identifier string) (*api.ServerStartupConfig, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetStartupConfiguration(a.ctx, identifier)
}

// UpdateServerStartupVariable updates a startup environment variable
func (a *App) UpdateServerStartupVariable(identifier, key, value string) (*api.StartupVariable, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	updated, err := client.UpdateStartupVariable(a.ctx, identifier, key, value)
	if err != nil {
		a.logActivity("", "", identifier, "startup:variable_update", "failed", fmt.Sprintf("Failed to update %s: %s", key, err.Error()))
		return nil, err
	}
	a.logActivity("", "", identifier, "startup:variable_update", "success", fmt.Sprintf("Updated %s", key))
	return updated, nil
}

// UpdateServerDockerImage updates the server's Docker image
func (a *App) UpdateServerDockerImage(identifier, dockerImage string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.UpdateDockerImage(a.ctx, identifier, dockerImage)
	if err != nil {
		a.logActivity("", "", identifier, "startup:docker_image_update", "failed", fmt.Sprintf("Failed to update docker image: %s", err.Error()))
		return err
	}
	a.logActivity("", "", identifier, "startup:docker_image_update", "success", fmt.Sprintf("Updated image to %s", dockerImage))
	return nil
}

// RenameServer renames a server and its description
func (a *App) RenameServer(identifier, name, description string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.RenameServer(a.ctx, identifier, name, description)
	if err != nil {
		a.logActivity("", "", identifier, "server:rename", "failed", fmt.Sprintf("Failed to rename server: %s", err.Error()))
		return err
	}
	a.logActivity("", "", identifier, "server:rename", "success", fmt.Sprintf("Server renamed to %s", name))
	return nil
}

// ReinstallServer triggers server reinstallation
func (a *App) ReinstallServer(identifier string) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	err = client.ReinstallServer(a.ctx, identifier)
	if err != nil {
		a.logActivity("", "", identifier, "server:reinstall", "failed", fmt.Sprintf("Failed to reinstall server: %s", err.Error()))
		return err
	}
	a.logActivity("", "", identifier, "server:reinstall", "success", "Server reinstallation initiated")
	return nil
}

func safeDownloadToFile(ctx context.Context, downloadURL, targetPath string, allowOverwrite bool) error {
	if _, err := security.ValidateHTTPURL(downloadURL, false); err != nil {
		return fmt.Errorf("unsafe download URL: %w", err)
	}
	if info, err := os.Lstat(targetPath); err == nil {
		if info.Mode()&os.ModeSymlink != 0 {
			return fmt.Errorf("refusing to write to symlink destination")
		}
		if !allowOverwrite {
			return fmt.Errorf("download destination already exists")
		}
	} else if !os.IsNotExist(err) {
		return err
	}

	dlClient := &http.Client{
		Timeout: 5 * time.Minute,
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			if len(via) >= 5 {
				return fmt.Errorf("too many redirects")
			}
			if len(via) > 0 && strings.EqualFold(via[0].URL.Scheme, "https") && !strings.EqualFold(r.URL.Scheme, "https") {
				return fmt.Errorf("refusing HTTPS downgrade redirect")
			}
			_, err := security.ValidateHTTPURL(r.URL.String(), false)
			return err
		},
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, downloadURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create download request: %w", err)
	}
	resp, err := dlClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("download returned HTTP status %d", resp.StatusCode)
	}

	flags := os.O_WRONLY | os.O_CREATE
	if allowOverwrite {
		flags |= os.O_TRUNC
	} else {
		flags |= os.O_EXCL
	}
	outFile, err := os.OpenFile(targetPath, flags, 0600)
	if err != nil {
		return fmt.Errorf("failed to create local file: %w", err)
	}
	defer outFile.Close()

	if _, err := io.Copy(outFile, resp.Body); err != nil {
		return fmt.Errorf("failed to save file: %w", err)
	}
	return nil
}

// DownloadServerFileTo downloads a server file to user's specified path (default to Desktop or Downloads)
func (a *App) DownloadServerFileTo(identifier, filePath, destinationDir string) (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	if destinationDir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		destinationDir = filepath.Join(home, "Downloads")
	}
	if !isAllowedDownloadDir(destinationDir) {
		return "", fmt.Errorf("access denied: unauthorized destination directory")
	}
	fileName := filepath.Base(filePath)
	if fileName == "." || fileName == ".." || fileName == "" || strings.ContainsAny(fileName, "\\/:*?\"<>|\x00\r\n") || strings.IndexFunc(fileName, func(r rune) bool { return r < 32 }) >= 0 {
		return "", fmt.Errorf("invalid download filename")
	}
	targetFilePath := filepath.Join(destinationDir, fileName)
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	downloadURL, err := client.GetFileDownloadURL(a.ctx, identifier, filePath)
	if err != nil {
		return "", err
	}

	if err := safeDownloadToFile(a.ctx, downloadURL, targetFilePath, false); err != nil {
		return "", err
	}

	a.logActivity("", "", identifier, "file:download_local", "success", fmt.Sprintf("Downloaded %s to %s", filePath, targetFilePath))
	return targetFilePath, nil
}

func isAllowedDownloadDir(dir string) bool {
	home, err := os.UserHomeDir()
	if err != nil || !filepath.IsAbs(dir) {
		return false
	}
	dir = filepath.Clean(dir)
	for _, name := range []string{"Downloads", "Desktop"} {
		if strings.EqualFold(dir, filepath.Join(home, name)) {
			info, err := os.Lstat(dir)
			return err == nil && info.IsDir() && info.Mode()&os.ModeSymlink == 0
		}
	}
	return false
}

// DownloadServerFileWithDialog opens a native Windows Save File dialog and downloads the server file to chosen path
func (a *App) DownloadServerFileWithDialog(identifier, filePath, defaultFileName string) (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	if defaultFileName == "" {
		defaultFileName = filepath.Base(filePath)
	} else {
		defaultFileName = filepath.Base(defaultFileName)
	}
	targetPath, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultFileName,
		Title:           "Save Server File",
	})
	if err != nil {
		return "", err
	}
	if targetPath == "" {
		return "", nil // user cancelled
	}

	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	downloadURL, err := client.GetFileDownloadURL(a.ctx, identifier, filePath)
	if err != nil {
		return "", err
	}

	if err := safeDownloadToFile(a.ctx, downloadURL, targetPath, true); err != nil {
		return "", err
	}

	a.logActivity("", "", identifier, "file:download_dialog", "success", fmt.Sprintf("Downloaded %s to %s", filePath, targetPath))
	return targetPath, nil
}

// --- Discovery, Capabilities & Permissions Bindings ---

// GetPanelCapabilities returns active capabilities and compatibility for the current panel
func (a *App) GetPanelCapabilities() (*discovery.CompatibilityReport, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	active, err := a.panelManager.GetActivePanel()
	if err != nil || active == nil {
		return nil, fmt.Errorf("no active panel selected")
	}

	hasClient := active.HasClientKey
	hasApp := active.HasAppKey
	v := discovery.ParseVersion(active.Version)

	report := discovery.GenerateCompatibilityReport(v, hasClient, hasApp)
	return &report, nil
}

// GetAPIRegistry returns the full authoritative API endpoint registry
func (a *App) GetAPIRegistry() *discovery.Registry {
	return discovery.DefaultRegistry()
}

// GetAvailablePermissions returns the list of known client permissions
func (a *App) GetAvailablePermissions() []discovery.Permission {
	return discovery.ClientPermissions
}

// OpenDetachedWindow launches a new process of PteroDesk configured in detached mode
func (a *App) OpenDetachedWindow(config DetachedWindowConfig) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if a.detachedConfig.IsDetached {
		return fmt.Errorf("detached windows cannot open additional windows")
	}
	switch config.Type {
	case "", "server", "file-editor", "nodes", "settings", "apikeys", "ide", "activity", "admin":
	default:
		return fmt.Errorf("invalid detached window type")
	}
	for _, field := range []string{config.Type, config.Server, config.Subtab, config.FilePath, config.Title} {
		if strings.ContainsAny(field, "\r\n\x00") || len(field) > 512 {
			return fmt.Errorf("invalid detached window parameter")
		}
	}
	a.detachedMu.Lock()
	defer a.detachedMu.Unlock()
	if a.detachedCount >= 5 {
		return fmt.Errorf("maximum of 5 detached windows reached")
	}
	exe, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}

	args := []string{
		"-detached=true",
		fmt.Sprintf("-type=%s", config.Type),
		fmt.Sprintf("-server=%s", config.Server),
		fmt.Sprintf("-subtab=%s", config.Subtab),
		fmt.Sprintf("-file=%s", config.FilePath),
		fmt.Sprintf("-title=%s", config.Title),
	}

	cmd := exec.Command(exe, args...)
	setIndependentProcessFlags(cmd)
	if err := cmd.Start(); err != nil {
		return err
	}
	a.detachedCount++
	go func() { _ = cmd.Wait(); a.detachedMu.Lock(); a.detachedCount--; a.detachedMu.Unlock() }()
	return nil
}

// GetDetachedModeInfo returns the detached configuration of the current process
func (a *App) GetDetachedModeInfo() DetachedWindowConfig {
	return a.detachedConfig
}

// CloseCurrentWindow terminates the current Wails window/process
func (a *App) CloseCurrentWindow() {
	runtime.Quit(a.ctx)
}

// Helper to log activities
func (a *App) logActivity(panelID, panelName, serverID, action, result, errMsg string) {
	if a.db == nil {
		return
	}
	a.db.SaveActivity(database.ActivityRecord{
		PanelID:   panelID,
		PanelName: panelName,
		ServerID:  serverID,
		Action:    action,
		Result:    result,
		Error:     logger.RedactString(errMsg),
	})
}

// DiagnosticCheck represents a single automated health check item
type DiagnosticCheck struct {
	ID          string `json:"id"`
	Category    string `json:"category"` // "security", "storage", "network", "runtime"
	Title       string `json:"title"`
	Status      string `json:"status"` // "pass", "warn", "fail"
	Summary     string `json:"summary"`
	Detail      string `json:"detail"`
	Remediation string `json:"remediation,omitempty"`
}

// PanelConnectivityDiagnostics holds live network/TLS/API checks for the active panel
type PanelConnectivityDiagnostics struct {
	PanelID          string `json:"panelId"`
	PanelName        string `json:"panelName"`
	PanelURL         string `json:"panelUrl"`
	Scheme           string `json:"scheme"`
	DNSResolvedIPs   string `json:"dnsResolvedIps"`
	DNSLatencyMs     int64  `json:"dnsLatencyMs"`
	DNSError         string `json:"dnsError,omitempty"`
	TLSVersion       string `json:"tlsVersion,omitempty"`
	TLSCipherSuite   string `json:"tlsCipherSuite,omitempty"`
	TLSCertExpiry    string `json:"tlsCertExpiry,omitempty"`
	TLSCertIssuer    string `json:"tlsCertIssuer,omitempty"`
	TLSValid         bool   `json:"tlsValid"`
	TLSError         string `json:"tlsError,omitempty"`
	ClientAPIStatus  string `json:"clientApiStatus"`
	ClientAPILatency int64  `json:"clientApiLatencyMs"`
	ClientAPIError   string `json:"clientApiError,omitempty"`
	AppAPIStatus     string `json:"appApiStatus"`
	AppAPILatency    int64  `json:"appApiLatencyMs"`
	AppAPIError      string `json:"appApiError,omitempty"`
	CheckedAt        string `json:"checkedAt"`
}

// SystemDiagnostics holds diagnostic info for tooling, configuration, and bug reporting
type SystemDiagnostics struct {
	AppVersion          string                    `json:"appVersion"`
	WailsVersion        string                    `json:"wailsVersion"`
	OS                  string                    `json:"os"`
	OSName              string                    `json:"osName"`
	OSDisplayVersion    string                    `json:"osDisplayVersion"`
	OSBuild             string                    `json:"osBuild"`
	WebView2Version     string                    `json:"webView2Version"`
	Arch                string                    `json:"arch"`
	CPUCores            int                       `json:"cpuCores"`
	Hostname            string                    `json:"hostname"`
	GoVersion           string                    `json:"goVersion"`
	UptimeSeconds       int64                     `json:"uptimeSeconds"`
	SQLiteVersion       string                    `json:"sqliteVersion"`
	AppDataDir          string                    `json:"appDataDir"`
	DatabasePath        string                    `json:"databasePath"`
	DatabaseSizeBytes   int64                     `json:"databaseSizeBytes"`
	DatabaseWALBytes    int64                     `json:"databaseWalBytes"`
	DatabaseWALMode     bool                      `json:"databaseWalMode"`
	DatabaseJournalMode string                    `json:"databaseJournalMode"`
	DatabaseIntegrity   string                    `json:"databaseIntegrity"`
	LogFilesCount       int                       `json:"logFilesCount"`
	LogsTotalBytes      int64                     `json:"logsTotalBytes"`
	DiskFreeBytes       uint64                    `json:"diskFreeBytes"`
	PanelsCount         int                       `json:"panelsCount"`
	ActivePanelName     string                    `json:"activePanelName"`
	ActivePanelURL      string                    `json:"activePanelUrl"`
	ActivePanelScheme   string                    `json:"activePanelScheme"`
	ActiveHasClientKey  bool                      `json:"activeHasClientKey"`
	ActiveHasAppKey     bool                      `json:"activeHasAppKey"`
	ConsoleWSConnected  bool                      `json:"consoleWsConnected"`
	ConsoleWSServer     string                    `json:"consoleWsServer"`
	DPAPIActive         bool                      `json:"dpapiActive"`
	DPAPITestPassed     bool                      `json:"dpapiTestPassed"`
	DPAPILatencyMs      float64                   `json:"dpapiLatencyMs"`
	TPMHardwareBacked   bool                      `json:"tpmHardwareBacked"`
	SessionLockEnabled  bool                      `json:"sessionLockEnabled"`
	SessionLockType     string                    `json:"sessionLockType"`
	SecurityLockout     bool                      `json:"securityLockout"`
	AutoWipeEnabled     bool                      `json:"autoWipeEnabled"`
	FailedAttempts      int                       `json:"failedAttempts"`
	AllocatedMemMB      float64                   `json:"allocatedMemMb"`
	TotalAllocMemMB     float64                   `json:"totalAllocMemMb"`
	GCPauseTotalMs      float64                   `json:"gcPauseTotalMs"`
	NumGC               uint32                    `json:"numGc"`
	GoroutinesCount     int                       `json:"goroutinesCount"`
	DetachedCount       int                       `json:"detachedCount"`
	RecentLogErrors     []string                  `json:"recentLogErrors"`
	RecentFailedActions []database.ActivityRecord `json:"recentFailedActions"`
	HealthChecks        []DiagnosticCheck         `json:"healthChecks"`
	Timestamp           string                    `json:"timestamp"`
}

// GetSystemDiagnostics performs a complete system, security, and storage health check
func (a *App) GetSystemDiagnostics() (*SystemDiagnostics, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	var m goruntime.MemStats
	goruntime.ReadMemStats(&m)

	dbPath := filepath.Join(a.appDataDir, "data", "pterodesk.db")
	var dbSize int64
	if fi, err := os.Stat(dbPath); err == nil {
		dbSize = fi.Size()
	}
	var walSize int64
	if fi, err := os.Stat(dbPath + "-wal"); err == nil {
		walSize = fi.Size()
	}

	panelsCount := 0
	activePanelName := "None"
	activePanelURL := ""
	activePanelScheme := ""
	activeHasClientKey := false
	activeHasAppKey := false
	if a.panelManager != nil {
		if active, err := a.panelManager.GetActivePanel(); err == nil && active != nil {
			activePanelName = active.Name
			activePanelURL = active.URL
			activeHasClientKey = active.HasClientKey
			activeHasAppKey = active.HasAppKey
			if parsed, perr := url.Parse(active.URL); perr == nil {
				activePanelScheme = strings.ToLower(parsed.Scheme)
			}
		}
		if panels, err := a.panelManager.GetAllPanels(); err == nil {
			panelsCount = len(panels)
		}
	}

	// In-memory test of Windows DPAPI (+ TPM 2.0 envelope if available)
	start := time.Now()
	testPayload := "synoradesk_diagnostic_dpapi_verify_" + strconv.FormatInt(time.Now().UnixNano(), 10)
	dpapiActive := a.credentials != nil
	dpapiPassed := false
	if a.credentials != nil {
		if enc, err := a.credentials.EncryptString(testPayload); err == nil {
			if dec, err2 := a.credentials.DecryptString(enc); err2 == nil && dec == testPayload {
				dpapiPassed = true
			}
		}
	}
	dpapiLatency := float64(time.Since(start).Microseconds()) / 1000.0
	tpmBacked := security.IsTPMHardwareBacked()

	lockoutActive := false
	autoWipeEnabled := false
	failedAttempts := 0
	if a.lockoutManager != nil {
		status := a.lockoutManager.GetStatus()
		lockoutActive = status.IsLockedOut
		autoWipeEnabled = status.EnableAutoWipe
		failedAttempts = status.FailedAttempts
	}

	a.sessionMu.RLock()
	lockEnabled := a.lockConfigEnabled
	lockType := a.lockConfigType
	a.sessionMu.RUnlock()
	if !lockEnabled || lockType == "" {
		lockType = "none"
	}

	a.wsMu.Lock()
	wsConnected := a.activeConsoleWS != nil
	wsServer := a.activeConsoleServer
	a.wsMu.Unlock()

	a.detachedMu.Lock()
	detachedCount := a.detachedCount
	a.detachedMu.Unlock()

	osName, osDisplayVer, osBuild := getWindowsBuildDetails()
	wv2Ver := getWebView2Version()
	hostName, _ := os.Hostname()

	sqliteVer := "3.x"
	dbIntegrity := "unknown"
	dbJournalMode := "unknown"
	var recentFailed []database.ActivityRecord
	if a.db != nil {
		if ver, err := a.db.GetSQLiteVersion(); err == nil && ver != "" {
			sqliteVer = ver
		}
		dbIntegrity, dbJournalMode = a.db.CheckIntegrity()
		if failed, err := a.db.GetRecentFailedActivities(10); err == nil {
			recentFailed = failed
		}
	}

	logCount, logsBytes := logger.GetLogStats(a.appDataDir)
	recentLogs := logger.ReadRecentErrors(a.appDataDir, 20)
	diskFree := getDiskFreeBytes(a.appDataDir)

	var uptimeSec int64
	if !a.appStartTime.IsZero() {
		uptimeSec = int64(time.Since(a.appStartTime).Seconds())
	}

	// Automated Health Checks
	checks := make([]DiagnosticCheck, 0, 6)
	if dpapiPassed && tpmBacked {
		checks = append(checks, DiagnosticCheck{
			ID:       "crypto_tpm_dpapi",
			Category: "security",
			Title:    "Mã hóa phần cứng TPM 2.0 + Windows DPAPI",
			Status:   "pass",
			Summary:  fmt.Sprintf("Hoạt động tốt (%.2f ms)", dpapiLatency),
			Detail:   "API keys và dữ liệu nhạy cảm được mã hóa 2 lớp: Windows DPAPI (Current User) + AES-256-GCM bọc khóa bởi TPM 2.0.",
		})
	} else if dpapiPassed {
		checks = append(checks, DiagnosticCheck{
			ID:          "crypto_tpm_dpapi",
			Category:    "security",
			Title:       "Mã hóa Windows DPAPI (Fallback)",
			Status:      "warn",
			Summary:     fmt.Sprintf("DPAPI hoạt động (%.2f ms), không có TPM 2.0", dpapiLatency),
			Detail:      "Thiết bị không khả dụng Microsoft Platform Crypto Provider (TPM 2.0); đang sử dụng Windows DPAPI thuần.",
			Remediation: "Bật TPM 2.0 trong BIOS/UEFI hoặc cấu hình vTPM nếu chạy trong máy ảo để tăng cường bảo vệ phần cứng.",
		})
	} else {
		checks = append(checks, DiagnosticCheck{
			ID:          "crypto_tpm_dpapi",
			Category:    "security",
			Title:       "Hệ thống mã hóa DPAPI",
			Status:      "fail",
			Summary:     "Kiểm tra mã hóa/giải mã thất bại",
			Detail:      "Không thể thực hiện roundtrip CryptProtectData/CryptUnprotectData.",
			Remediation: "Kiểm tra quyền tài khoản Windows hiện tại hoặc khởi động lại phiên đăng nhập Windows.",
		})
	}

	if lockEnabled {
		checks = append(checks, DiagnosticCheck{
			ID:       "session_lock",
			Category: "security",
			Title:    "Khóa phiên ứng dụng (App Lock)",
			Status:   "pass",
			Summary:  fmt.Sprintf("Đã bật (%s)", lockType),
			Detail:   "Ứng dụng yêu cầu xác thực Argon2id khi khởi động và hỗ trợ tự khóa khi nhàn rỗi.",
		})
	} else {
		checks = append(checks, DiagnosticCheck{
			ID:          "session_lock",
			Category:    "security",
			Title:       "Khóa phiên ứng dụng (App Lock)",
			Status:      "warn",
			Summary:     "Chưa kích hoạt",
			Detail:      "Bất kỳ ai có quyền truy cập vào phiên Windows hiện tại đều có thể mở SynoraDesk trực tiếp.",
			Remediation: "Vào Cài đặt -> Bảo mật để thiết lập mã PIN hoặc Mật khẩu.",
		})
	}

	if strings.EqualFold(dbIntegrity, "ok") {
		checks = append(checks, DiagnosticCheck{
			ID:       "sqlite_integrity",
			Category: "storage",
			Title:    "Toàn vẹn cơ sở dữ liệu SQLite",
			Status:   "pass",
			Summary:  fmt.Sprintf("OK (journal: %s)", strings.ToUpper(dbJournalMode)),
			Detail:   fmt.Sprintf("PRAGMA quick_check trả về 'ok'. Dung lượng DB: %d bytes, WAL: %d bytes.", dbSize, walSize),
		})
	} else {
		checks = append(checks, DiagnosticCheck{
			ID:          "sqlite_integrity",
			Category:    "storage",
			Title:       "Toàn vẹn cơ sở dữ liệu SQLite",
			Status:      "fail",
			Summary:     "Phát hiện bất thường",
			Detail:      fmt.Sprintf("PRAGMA quick_check: %s", dbIntegrity),
			Remediation: "Sao lưu %APPDATA%\\SynoraDesk\\data\\pterodesk.db và kiểm tra lỗi ổ đĩa.",
		})
	}

	if activePanelName == "None" || activePanelURL == "" {
		checks = append(checks, DiagnosticCheck{
			ID:          "panel_config",
			Category:    "network",
			Title:       "Cấu hình Panel kết nối",
			Status:      "warn",
			Summary:     "Chưa chọn Panel hoạt động",
			Detail:      fmt.Sprintf("Hiện có %d panel được lưu nhưng chưa có panel nào đang kích hoạt.", panelsCount),
			Remediation: "Mở mục Quản lý Panel để thêm hoặc kích hoạt một Pterodactyl Panel.",
		})
	} else if activePanelScheme == "http" {
		checks = append(checks, DiagnosticCheck{
			ID:          "panel_config",
			Category:    "network",
			Title:       "Bảo mật truyền tải Panel",
			Status:      "warn",
			Summary:     "Đang sử dụng HTTP không mã hóa",
			Detail:      "API token được truyền qua HTTP cleartext. Chỉ nên dùng cho mạng nội bộ/localhost đáng tin cậy.",
			Remediation: "Chuyển URL Panel sang HTTPS với chứng chỉ TLS hợp lệ.",
		})
	} else {
		checks = append(checks, DiagnosticCheck{
			ID:       "panel_config",
			Category: "network",
			Title:    "Cấu hình Panel kết nối",
			Status:   "pass",
			Summary:  fmt.Sprintf("%s (HTTPS)", activePanelName),
			Detail:   fmt.Sprintf("Client Key: %v | Application Key: %v", activeHasClientKey, activeHasAppKey),
		})
	}

	if diskFree > 0 && diskFree < 200*1024*1024 {
		checks = append(checks, DiagnosticCheck{
			ID:          "disk_space",
			Category:    "storage",
			Title:       "Dung lượng ổ đĩa khả dụng",
			Status:      "warn",
			Summary:     fmt.Sprintf("Còn trống %.1f MB", float64(diskFree)/(1024*1024)),
			Detail:      "Dung lượng trống thấp có thể ảnh hưởng đến SQLite WAL, log và tải tệp từ server.",
			Remediation: "Giải phóng dung lượng trên ổ đĩa chứa %APPDATA%.",
		})
	} else {
		checks = append(checks, DiagnosticCheck{
			ID:       "disk_space",
			Category: "storage",
			Title:    "Dung lượng ổ đĩa khả dụng",
			Status:   "pass",
			Summary:  fmt.Sprintf("Còn trống %.2f GB", float64(diskFree)/(1024*1024*1024)),
			Detail:   fmt.Sprintf("Thư mục log hiện có %d tệp (%d bytes).", logCount, logsBytes),
		})
	}

	return &SystemDiagnostics{
		AppVersion:          AppVersion,
		WailsVersion:        "v2.17.1",
		OS:                  goruntime.GOOS,
		OSName:              osName,
		OSDisplayVersion:    osDisplayVer,
		OSBuild:             osBuild,
		WebView2Version:     wv2Ver,
		Arch:                goruntime.GOARCH,
		CPUCores:            goruntime.NumCPU(),
		Hostname:            hostName,
		GoVersion:           goruntime.Version(),
		UptimeSeconds:       uptimeSec,
		SQLiteVersion:       sqliteVer,
		AppDataDir:          a.appDataDir,
		DatabasePath:        dbPath,
		DatabaseSizeBytes:   dbSize,
		DatabaseWALBytes:    walSize,
		DatabaseWALMode:     strings.EqualFold(dbJournalMode, "wal"),
		DatabaseJournalMode: dbJournalMode,
		DatabaseIntegrity:   dbIntegrity,
		LogFilesCount:       logCount,
		LogsTotalBytes:      logsBytes,
		DiskFreeBytes:       diskFree,
		PanelsCount:         panelsCount,
		ActivePanelName:     activePanelName,
		ActivePanelURL:      activePanelURL,
		ActivePanelScheme:   activePanelScheme,
		ActiveHasClientKey:  activeHasClientKey,
		ActiveHasAppKey:     activeHasAppKey,
		ConsoleWSConnected:  wsConnected,
		ConsoleWSServer:     wsServer,
		DPAPIActive:         dpapiActive,
		DPAPITestPassed:     dpapiPassed,
		DPAPILatencyMs:      dpapiLatency,
		TPMHardwareBacked:   tpmBacked,
		SessionLockEnabled:  lockEnabled,
		SessionLockType:     lockType,
		SecurityLockout:     lockoutActive,
		AutoWipeEnabled:     autoWipeEnabled,
		FailedAttempts:      failedAttempts,
		AllocatedMemMB:      float64(m.Alloc) / (1024 * 1024),
		TotalAllocMemMB:     float64(m.TotalAlloc) / (1024 * 1024),
		GCPauseTotalMs:      float64(m.PauseTotalNs) / 1e6,
		NumGC:               m.NumGC,
		GoroutinesCount:     goruntime.NumGoroutine(),
		DetachedCount:       detachedCount,
		RecentLogErrors:     recentLogs,
		RecentFailedActions: recentFailed,
		HealthChecks:        checks,
		Timestamp:           time.Now().UTC().Format(time.RFC3339),
	}, nil
}

// RunPanelConnectivityCheck performs live DNS, TLS, and API latency diagnostics for the active panel
func (a *App) RunPanelConnectivityCheck() (*PanelConnectivityDiagnostics, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	if a.panelManager == nil {
		return nil, fmt.Errorf("panel manager not initialized")
	}
	active, err := a.panelManager.GetActivePanel()
	if err != nil || active == nil {
		return nil, fmt.Errorf("no active panel selected")
	}

	res := &PanelConnectivityDiagnostics{
		PanelID:   active.ID,
		PanelName: active.Name,
		PanelURL:  active.URL,
		CheckedAt: time.Now().UTC().Format(time.RFC3339),
	}

	parsed, err := url.Parse(active.URL)
	if err != nil {
		res.DNSError = err.Error()
		return res, nil
	}
	res.Scheme = strings.ToLower(parsed.Scheme)
	hostname := parsed.Hostname()
	port := parsed.Port()
	if port == "" {
		if res.Scheme == "https" {
			port = "443"
		} else {
			port = "80"
		}
	}

	// 1. DNS Lookup
	dnsCtx, dnsCancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer dnsCancel()
	dnsStart := time.Now()
	ips, dnsErr := net.DefaultResolver.LookupHost(dnsCtx, hostname)
	res.DNSLatencyMs = time.Since(dnsStart).Milliseconds()
	if dnsErr != nil {
		res.DNSError = dnsErr.Error()
	} else {
		res.DNSResolvedIPs = strings.Join(ips, ", ")
	}

	// 2. TLS Handshake (if HTTPS)
	if res.Scheme == "https" {
		dialer := &net.Dialer{Timeout: 5 * time.Second}
		conn, tlsErr := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(hostname, port), &tls.Config{
			ServerName: hostname,
			MinVersion: tls.VersionTLS12,
		})
		if tlsErr != nil {
			res.TLSValid = false
			res.TLSError = tlsErr.Error()
		} else {
			state := conn.ConnectionState()
			res.TLSValid = true
			res.TLSVersion = tls.VersionName(state.Version)
			res.TLSCipherSuite = tls.CipherSuiteName(state.CipherSuite)
			if len(state.PeerCertificates) > 0 {
				cert := state.PeerCertificates[0]
				res.TLSCertExpiry = cert.NotAfter.UTC().Format("2006-01-02 15:04 UTC")
				res.TLSCertIssuer = cert.Issuer.CommonName
			}
			_ = conn.Close()
		}
	}

	// 3. Client API Ping
	if active.HasClientKey {
		clientAPI, cerr := a.panelManager.GetClientAPI()
		if cerr != nil {
			res.ClientAPIStatus = "error"
			res.ClientAPIError = cerr.Error()
		} else {
			ctx, cancel := context.WithTimeout(a.ctx, 8*time.Second)
			start := time.Now()
			_, apiErr := clientAPI.GetAccount(ctx)
			cancel()
			res.ClientAPILatency = time.Since(start).Milliseconds()
			if apiErr != nil {
				res.ClientAPIStatus = "error"
				res.ClientAPIError = logger.RedactString(apiErr.Error())
			} else {
				res.ClientAPIStatus = "ok"
			}
		}
	} else {
		res.ClientAPIStatus = "unconfigured"
	}

	// 4. Application API Ping
	if active.HasAppKey {
		appAPI, aerr := a.panelManager.GetAppAPI()
		if aerr != nil {
			res.AppAPIStatus = "error"
			res.AppAPIError = aerr.Error()
		} else {
			ctx, cancel := context.WithTimeout(a.ctx, 8*time.Second)
			start := time.Now()
			apiErr := appAPI.TestConnection(ctx)
			cancel()
			res.AppAPILatency = time.Since(start).Milliseconds()
			if apiErr != nil {
				res.AppAPIStatus = "error"
				res.AppAPIError = logger.RedactString(apiErr.Error())
			} else {
				res.AppAPIStatus = "ok"
			}
		}
	} else {
		res.AppAPIStatus = "unconfigured"
	}

	return res, nil
}

// GitHubReleaseAsset holds asset download info
type GitHubReleaseAsset struct {
	Name          string `json:"name"`
	Size          int64  `json:"size"`
	DownloadURL   string `json:"downloadUrl"`
	DownloadCount int    `json:"downloadCount"`
}

// GitHubReleaseInfo holds release details for auto-updater
type GitHubReleaseInfo struct {
	TagName        string               `json:"tagName"`
	Name           string               `json:"name"`
	Body           string               `json:"body"`
	Prerelease     bool                 `json:"prerelease"`
	PublishedAt    string               `json:"publishedAt"`
	HTMLURL        string               `json:"htmlUrl"`
	HasUpdate      bool                 `json:"hasUpdate"`
	CurrentVersion string               `json:"currentVersion"`
	Assets         []GitHubReleaseAsset `json:"assets"`
}

// CheckGitHubUpdates queries GitHub releases with support for stable & pre-release channels
func (a *App) CheckGitHubUpdates(includePrerelease bool) (*GitHubReleaseInfo, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	client := &http.Client{Timeout: 10 * time.Second}
	url := fmt.Sprintf("https://api.github.com/repos/%s/releases", AppGitHubRepo)
	req, err := http.NewRequestWithContext(a.ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("lỗi khởi tạo yêu cầu kiểm tra cập nhật: %w", err)
	}
	req.Header.Set("User-Agent", fmt.Sprintf("%s-Updater/%s", AppName, AppVersion))
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("không thể kết nối tới máy chủ GitHub: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("không thể lấy thông tin phiên bản từ GitHub (mã trạng thái: %d)", resp.StatusCode)
	}

	type ghAsset struct {
		Name               string `json:"name"`
		Size               int64  `json:"size"`
		BrowserDownloadURL string `json:"browser_download_url"`
		DownloadCount      int    `json:"download_count"`
	}
	type ghRelease struct {
		TagName     string    `json:"tag_name"`
		Name        string    `json:"name"`
		Body        string    `json:"body"`
		Prerelease  bool      `json:"prerelease"`
		PublishedAt string    `json:"published_at"`
		HTMLURL     string    `json:"html_url"`
		Assets      []ghAsset `json:"assets"`
	}

	var releases []ghRelease
	if err := json.NewDecoder(resp.Body).Decode(&releases); err != nil {
		return nil, fmt.Errorf("lỗi giải mã dữ liệu release: %w", err)
	}

	if len(releases) == 0 {
		return nil, fmt.Errorf("không tìm thấy bản phát hành nào trên kho lưu trữ GitHub")
	}

	// Filter by channel
	var target *ghRelease
	if includePrerelease {
		target = &releases[0]
	} else {
		for i := range releases {
			if !releases[i].Prerelease {
				target = &releases[i]
				break
			}
		}
	}

	if target == nil {
		return nil, fmt.Errorf("không tìm thấy bản phát hành chính thức (stable) nào trên GitHub")
	}

	currentVer := AppVersion
	remoteVer := strings.TrimPrefix(target.TagName, "v")
	hasUpdate := remoteVer != currentVer && target.TagName != "v"+currentVer

	var assets []GitHubReleaseAsset
	for _, as := range target.Assets {
		assets = append(assets, GitHubReleaseAsset{
			Name:          as.Name,
			Size:          as.Size,
			DownloadURL:   as.BrowserDownloadURL,
			DownloadCount: as.DownloadCount,
		})
	}

	return &GitHubReleaseInfo{
		TagName:        target.TagName,
		Name:           target.Name,
		Body:           target.Body,
		Prerelease:     target.Prerelease,
		PublishedAt:    target.PublishedAt,
		HTMLURL:        target.HTMLURL,
		HasUpdate:      hasUpdate,
		CurrentVersion: currentVer,
		Assets:         assets,
	}, nil
}

// GetActivePanelPing returns the ping/latency in milliseconds from the client to the active panel
func (a *App) GetActivePanelPing() int64 {
	if a.checkSessionLock() != nil {
		return 0
	}
	if a.panelManager == nil {
		return 0
	}
	return a.panelManager.GetActivePanelLatencyMs()
}

// PingActivePanel sends a lightweight ping to the active panel and returns latency in ms
func (a *App) PingActivePanel() (int64, error) {
	if err := a.checkSessionLock(); err != nil {
		return 0, err
	}
	if a.panelManager == nil {
		return 0, fmt.Errorf("bộ quản lý panel chưa khởi tạo")
	}
	pingCtx, cancel := context.WithTimeout(a.ctx, 5*time.Second)
	defer cancel()

	if client, err := a.panelManager.GetClientAPI(); err == nil {
		start := time.Now()
		_, err = client.GetAccount(pingCtx)
		elapsed := time.Since(start).Milliseconds()
		if err != nil {
			return elapsed, err
		}
		return elapsed, nil
	}
	if appAPI, err := a.panelManager.GetAppAPI(); err == nil {
		start := time.Now()
		err = appAPI.TestConnection(pingCtx)
		elapsed := time.Since(start).Milliseconds()
		if err != nil {
			return elapsed, err
		}
		return elapsed, nil
	}
	return 0, fmt.Errorf("panel chưa cấu hình API key")
}

// --- Debug Manager Bindings (Diagnostic & Fault-Simulation Controls) ---

// DebugStatus holds current runtime debug toggle states
type DebugStatus struct {
	IsDebugBuild bool `json:"isDebugBuild"`
	TPMAvailable bool `json:"tpmAvailable"`
	TPMEnabled   bool `json:"tpmEnabled"`
	DBConnected  bool `json:"dbConnected"`
	DebugLogging bool `json:"debugLogging"`
}

// GetDebugStatus returns the current state of runtime debug controls
func (a *App) GetDebugStatus() (*DebugStatus, error) {
	if err := a.checkSessionLock(); err != nil {
		return nil, err
	}
	if !isDebugBuild() {
		return &DebugStatus{IsDebugBuild: false}, nil
	}
	dbConnected := false
	if a.db != nil && a.db.Ping() == nil {
		dbConnected = true
	}
	return &DebugStatus{
		IsDebugBuild: true,
		TPMAvailable: security.IsTPMHardwareBacked(),
		TPMEnabled:   security.IsTPMEnabled(),
		DBConnected:  dbConnected,
		DebugLogging: logger.IsDebugLevel(),
	}, nil
}

// DebugSetTPMEnabled toggles TPM 2.0 envelope wrapping at runtime (for testing DPAPI fallback)
func (a *App) DebugSetTPMEnabled(enabled bool) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	if !isDebugBuild() {
		return fmt.Errorf("debug manager is disabled in production builds")
	}
	security.SetTPMEnabled(enabled)
	logger.Logger.Warn().Bool("tpmEnabled", enabled).Msg("Debug Manager toggled TPM 2.0 envelope mode")
	return nil
}

// DebugTestCryptoRoundtrip tests Encrypt/Decrypt with the current TPM setting and reports mode & latency
func (a *App) DebugTestCryptoRoundtrip() (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	if !isDebugBuild() {
		return "", fmt.Errorf("debug manager is disabled in production builds")
	}
	payload := []byte("synoradesk_debug_crypto_test_" + strconv.FormatInt(time.Now().UnixNano(), 10))
	start := time.Now()
	enc, err := security.Encrypt(payload)
	if err != nil {
		return "", fmt.Errorf("encrypt failed: %w", err)
	}
	dec, err := security.Decrypt(enc)
	if err != nil {
		return "", fmt.Errorf("decrypt failed: %w", err)
	}
	elapsed := float64(time.Since(start).Microseconds()) / 1000.0
	if string(dec) != string(payload) {
		return "", fmt.Errorf("roundtrip mismatch")
	}
	mode := "Windows DPAPI only"
	if len(enc) >= 7 && (string(enc[:7]) == "SDTPM2\x00" || string(enc[:7]) == "SDTPM1\x00") {
		mode = "TPM 2.0 + Windows DPAPI (" + string(enc[:6]) + ")"
	}
	return fmt.Sprintf("OK | Mode: %s | Ciphertext: %d bytes | Latency: %.3f ms", mode, len(enc), elapsed), nil
}

// DebugToggleDBConnection disconnects or reconnects the local SQLite database for fault testing
func (a *App) DebugToggleDBConnection(disconnect bool) (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	if !isDebugBuild() {
		return "", fmt.Errorf("debug manager is disabled in production builds")
	}
	if disconnect {
		if a.db != nil {
			_ = a.db.Close()
			a.db = nil
		}
		logger.Logger.Warn().Msg("Debug Manager disconnected SQLite database")
		return "SQLite database disconnected", nil
	}
	if a.db != nil && a.db.Ping() == nil {
		return "SQLite database already connected", nil
	}
	db, err := database.New(a.appDataDir)
	if err != nil {
		return "", fmt.Errorf("failed to reconnect database: %w", err)
	}
	a.db = db
	a.panelManager = panel.NewManager(a.db, a.credentials)
	_ = a.panelManager.Initialize()
	logger.Logger.Info().Msg("Debug Manager reconnected SQLite database")
	return "SQLite database reconnected", nil
}

// DebugRunWALCheckpoint flushes the SQLite WAL journal into the main database file
func (a *App) DebugRunWALCheckpoint() (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	if a.db == nil {
		return "", fmt.Errorf("database is disconnected")
	}
	if err := a.db.WALCheckpoint(); err != nil {
		return "", err
	}
	return "PRAGMA wal_checkpoint(TRUNCATE) completed", nil
}

// DebugSetLogLevel toggles zerolog debug verbosity at runtime
func (a *App) DebugSetLogLevel(debug bool) error {
	if err := a.checkSessionLock(); err != nil {
		return err
	}
	logger.SetDebugLevel(debug)
	logger.Logger.Info().Bool("debug", debug).Msg("Debug Manager updated log level")
	return nil
}

// DebugRunGC forces Go garbage collection and returns post-GC heap stats
func (a *App) DebugRunGC() (string, error) {
	if err := a.checkSessionLock(); err != nil {
		return "", err
	}
	goruntime.GC()
	var m goruntime.MemStats
	goruntime.ReadMemStats(&m)
	return fmt.Sprintf("GC completed | Heap: %.2f MB | Goroutines: %d", float64(m.Alloc)/(1024*1024), goruntime.NumGoroutine()), nil
}
