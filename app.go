package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	goruntime "runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"pterodesk/internal/api"
	"pterodesk/internal/database"
	"pterodesk/internal/dbclient"
	"pterodesk/internal/logger"
	"pterodesk/internal/panel"
	"pterodesk/internal/pterodactyl/discovery"
	"pterodesk/internal/security"
	"pterodesk/internal/sftp"
)

// DetachedWindowConfig holds settings for a detached standalone window
type DetachedWindowConfig struct {
	IsDetached bool   `json:"isDetached"`
	Type       string `json:"type"`       // "server", "file-editor", "nodes", "settings", "apikeys", "ide", etc.
	Server     string `json:"server"`     // server identifier
	Subtab     string `json:"subtab"`     // console, files, startup, etc.
	FilePath   string `json:"filePath"`   // for file editor
	IsSFTP     bool   `json:"isSftp"`
	Title      string `json:"title"`
}

// App struct holds the application state
type App struct {
	ctx                 context.Context
	db                  *database.DB
	credentials         *security.CredentialStore
	panelManager        *panel.Manager
	sftpSessions        *sftp.SessionManager
	activeSFTP          *sftp.Client
	activeDB            *dbclient.Client
	activeConsoleWS     *api.ServerWebSocket
	activeConsoleServer string
	wsMu                sync.Mutex
	appDataDir          string
	detachedConfig      DetachedWindowConfig
	lockoutManager      *security.LockoutManager
}

// NewApp creates a new App instance
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx

	// Determine fixed app data directory (persists across renames and releases)
	a.appDataDir = GetFixedAppDataDir()

	// Initialize logger
	if err := logger.Init(a.appDataDir, false); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to initialize logger: %v\n", err)
	}
	logger.Logger.Info().Str("dataDir", a.appDataDir).Msg("SynoraDesk starting up")

	// Clean old logs
	go logger.CleanOldLogs(a.appDataDir, 30)

	// Initialize database
	db, err := database.New(a.appDataDir)
	if err != nil {
		logger.Logger.Fatal().Err(err).Msg("Failed to initialize database")
		return
	}
	a.db = db
	logger.Logger.Info().Msg("Database initialized")

	// Initialize credential store
	a.credentials = security.NewCredentialStore()
	a.sftpSessions = sftp.NewSessionManager()

	// Initialize panel manager
	a.panelManager = panel.NewManager(a.db, a.credentials)
	if err := a.panelManager.Initialize(); err != nil {
		logger.Logger.Error().Err(err).Msg("Failed to initialize panel manager")
	}
	logger.Logger.Info().Msg("Panel manager initialized")

	// Initialize security lockout manager (tamper-proof persistent countdown)
	a.lockoutManager = security.NewLockoutManager(
		filepath.Join(a.appDataDir, "data"),
		a.credentials,
		func() {
			_ = a.WipeAllData()
		},
	)

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
	_ = os.MkdirAll(filepath.Dir(path), 0755)
	return os.WriteFile(path, data, 0644)
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
	if a.lockoutManager == nil {
		return security.LockoutStatus{}, fmt.Errorf("lockout manager not initialized")
	}
	return a.lockoutManager.RecordFailedAttempt()
}

// RecordSuccessfulPasscodeAttempt resets the failed attempt counter
func (a *App) RecordSuccessfulPasscodeAttempt() error {
	if a.lockoutManager == nil {
		return nil
	}
	return a.lockoutManager.RecordSuccess()
}

// UpdateSecurityLockoutConfig updates lockout and auto-wipe preferences
func (a *App) UpdateSecurityLockoutConfig(cfg security.LockoutConfig) error {
	if a.lockoutManager == nil {
		return fmt.Errorf("lockout manager not initialized")
	}
	return a.lockoutManager.UpdateConfig(cfg)
}

// WipeAllData safely purges all sensitive credentials, database, and settings
func (a *App) WipeAllData() error {
	logger.Logger.Warn().Msg("SECURITY ALERT: Initiating complete data wipe due to maximum failed passcode attempts")
	a.DisconnectServerConsole()
	if a.sftpSessions != nil {
		a.sftpSessions.CloseAll()
	}
	if a.activeSFTP != nil {
		a.activeSFTP.Close()
	}
	if a.activeDB != nil {
		a.activeDB.Close()
	}
	if a.db != nil {
		a.db.Close()
	}

	// Remove SQLite database files
	dbDir := filepath.Join(a.appDataDir, "data")
	_ = os.Remove(filepath.Join(dbDir, "pterodesk.db"))
	_ = os.Remove(filepath.Join(dbDir, "pterodesk.db-wal"))
	_ = os.Remove(filepath.Join(dbDir, "pterodesk.db-shm"))
	_ = os.Remove(filepath.Join(dbDir, "window_state.json"))

	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "security:data-wiped")
	}
	return nil
}

// shutdown is called when the app is closing
func (a *App) shutdown(ctx context.Context) {
	logger.Logger.Info().Msg("SynoraDesk shutting down")
	if a.lockoutManager != nil {
		a.lockoutManager.Close()
	}
	if a.ctx != nil && !a.detachedConfig.IsDetached {
		isMax := runtime.WindowIsMaximised(a.ctx)
		w, h := runtime.WindowGetSize(a.ctx)
		x, y := runtime.WindowGetPosition(a.ctx)
		_ = a.SaveWindowState(w, h, x, y, isMax)
	}
	a.DisconnectServerConsole()
	if a.sftpSessions != nil {
		a.sftpSessions.CloseAll()
	}
	if a.activeSFTP != nil {
		a.activeSFTP.Close()
	}
	if a.activeDB != nil {
		a.activeDB.Close()
	}
	if a.db != nil {
		a.db.Close()
	}
}

// --- Panel Management Bindings ---

// GetPanels returns all configured panels
func (a *App) GetPanels() ([]panel.Panel, error) {
	return a.panelManager.GetAllPanels()
}

// GetActivePanel returns the currently active panel
func (a *App) GetActivePanel() (*panel.Panel, error) {
	return a.panelManager.GetActivePanel()
}

// GetCurrentAccount returns the authenticated user account for the active panel
func (a *App) GetCurrentAccount() (*api.Account, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetAccount(a.ctx)
}

// GetPanelAccount returns the authenticated user account for a specific panel
func (a *App) GetPanelAccount(panelID string) (*api.Account, error) {
	client, err := a.panelManager.GetClientAPIForPanel(panelID)
	if err != nil {
		return nil, err
	}
	return client.GetAccount(a.ctx)
}

// UpdateAccountEmail updates the email for the active account
func (a *App) UpdateAccountEmail(email, password string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.UpdateEmail(a.ctx, email, password)
}

// UpdateAccountPassword updates the password for the active account
func (a *App) UpdateAccountPassword(currentPassword, newPassword, confirmPassword string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.UpdatePassword(a.ctx, currentPassword, newPassword, confirmPassword)
}

// GetTwoFactorDetails retrieves 2FA setup details (secret & QR data)
func (a *App) GetTwoFactorDetails() (*api.TwoFactorDetails, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetTwoFactorDetails(a.ctx)
}

// EnableTwoFactor verifies TOTP code and enables 2FA, returning backup recovery tokens
func (a *App) EnableTwoFactor(code string) ([]string, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.EnableTwoFactor(a.ctx, code)
}

// DisableTwoFactor disables 2FA for the active account
func (a *App) DisableTwoFactor(password string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DisableTwoFactor(a.ctx, password)
}

// ListAccountAPIKeys retrieves all API keys for the current account
func (a *App) ListAccountAPIKeys() ([]api.AccountApiKey, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListAPIKeys(a.ctx)
}

// CreateAccountAPIKey creates a new API key
func (a *App) CreateAccountAPIKey(description string, allowedIPs []string) (*api.AccountApiKey, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CreateAPIKey(a.ctx, description, allowedIPs)
}

// DeleteAccountAPIKey deletes an API key
func (a *App) DeleteAccountAPIKey(identifier string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DeleteAPIKey(a.ctx, identifier)
}

// ListAccountSSHKeys retrieves all SSH keys for the current account
func (a *App) ListAccountSSHKeys() ([]api.AccountSSHKey, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListSSHKeys(a.ctx)
}

// CreateAccountSSHKey creates a new SSH key
func (a *App) CreateAccountSSHKey(name, publicKey string) (*api.AccountSSHKey, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CreateSSHKey(a.ctx, name, publicKey)
}

// RemoveAccountSSHKey removes an SSH key by fingerprint
func (a *App) RemoveAccountSSHKey(fingerprint string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.RemoveSSHKey(a.ctx, fingerprint)
}

// GetAccountActivity retrieves activity log for the current account
func (a *App) GetAccountActivity() ([]api.AccountActivity, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetAccountActivity(a.ctx)
}

// AddPanel adds a new panel configuration
func (a *App) AddPanel(input panel.PanelInput) (*panel.Panel, error) {
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

// ListServers lists servers from the active panel's Client API
func (a *App) ListServers() ([]api.Server, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListServers(a.ctx)
}

// GetServer retrieves a specific server
func (a *App) GetServer(identifier string) (*api.Server, error) {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetServerResources(a.ctx, identifier)
}

// SendPowerAction sends a power signal to a server
func (a *App) SendPowerAction(identifier string, signal string) error {
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
	return a.db.GetActivities(50)
}

// GetRecentServers returns recently accessed servers
func (a *App) GetRecentServers() ([]database.RecentServerRecord, error) {
	return a.db.GetRecentServers(10)
}

// --- File Manager Bindings ---

// ListFiles lists files in a directory on a server
func (a *App) ListFiles(identifier, directory string) ([]api.FileObject, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListFiles(a.ctx, identifier, directory)
}

// GetFileContents gets file contents
func (a *App) GetFileContents(identifier, filePath string) (string, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	return client.GetFileContents(a.ctx, identifier, filePath)
}

// WriteFile writes content to a file
func (a *App) WriteFile(identifier, filePath, content string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.WriteFile(a.ctx, identifier, filePath, content)
}

// CreateFile creates a new folder/file
func (a *App) CreateFile(identifier, root, name string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.CreateFile(a.ctx, identifier, root, name)
}

// DeleteFiles deletes files/folders
func (a *App) DeleteFiles(identifier, root string, files []string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DeleteFiles(a.ctx, identifier, root, files)
}

// RenameFile renames or moves a file
func (a *App) RenameFile(identifier, root, from, to string) error {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	return client.GetFileDownloadURL(a.ctx, identifier, filePath)
}

// ChmodFile modifies file permissions via REST API
func (a *App) ChmodFile(identifier, root, file, mode string) error {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CompressFiles(a.ctx, identifier, root, files)
}

// DecompressFile extracts an archive
func (a *App) DecompressFile(identifier, root, file string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DecompressFile(a.ctx, identifier, root, file)
}

// CopyFile duplicates a file
func (a *App) CopyFile(identifier, location string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.CopyFile(a.ctx, identifier, location)
}

// PullRemoteFile pulls a remote file from an HTTP/HTTPS URL directly onto the server
func (a *App) PullRemoteFile(identifier, directory, url, filename string) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.PullFile(a.ctx, identifier, directory, url, filename, false, false)
}

// UploadServerFileDirect uploads file content directly using Wings presigned upload URL
func (a *App) UploadServerFileDirect(identifier, directory, filename, base64Content string) error {
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

// ChmodServerSFTPFile chmods a file over SFTP
func (a *App) ChmodServerSFTPFile(serverID, path, modeStr string) error {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return err
	}
	modeUint, err := strconv.ParseUint(modeStr, 8, 32)
	if err != nil {
		return fmt.Errorf("invalid octal mode: %w", err)
	}
	return cli.Chmod(path, os.FileMode(modeUint))
}

// RenameServerSFTPFile renames a file over SFTP
func (a *App) RenameServerSFTPFile(serverID, oldPath, newPath string) error {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return err
	}
	return cli.Rename(oldPath, newPath)
}

// --- Node Bindings (Application API) ---

// ListNodes lists all nodes
func (a *App) ListNodes() ([]api.Node, error) {
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNodes(a.ctx)
}

// GetNode retrieves a node
func (a *App) GetNode(id int) (*api.Node, error) {
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.GetNode(a.ctx, id)
}

// CreateNode creates a new node
func (a *App) CreateNode(req api.CreateNodeRequest) (*api.Node, error) {
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

// DeleteNode deletes a node
func (a *App) DeleteNode(id int) error {
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

// --- Nest/Egg Bindings ---

// ListNests lists all nests
func (a *App) ListNests() ([]api.Nest, error) {
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNests(a.ctx)
}

// ListEggs lists eggs for a nest
func (a *App) ListEggs(nestID int) ([]api.Egg, error) {
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListEggs(a.ctx, nestID)
}

// --- Database Bindings ---

// ListDatabases lists databases for a server
func (a *App) ListDatabases(identifier string) ([]api.Database, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListDatabases(a.ctx, identifier)
}

// --- Allocation Bindings ---

// ListNodeAllocations lists allocations for a node
func (a *App) ListNodeAllocations(nodeID int) ([]api.NodeAllocation, error) {
	appAPI, err := a.panelManager.GetAppAPI()
	if err != nil {
		return nil, err
	}
	return appAPI.ListNodeAllocations(a.ctx, nodeID)
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
	return a.appDataDir
}

// getBackgroundDir returns the dedicated directory where custom backgrounds are saved
func (a *App) getBackgroundDir() string {
	return filepath.Join(a.appDataDir, "backgrounds")
}

// OpenBackgroundFolder opens the dedicated background folder in Windows Explorer
func (a *App) OpenBackgroundFolder() error {
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

	bytes, err := os.ReadFile(path)
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
	_ = a.db.SaveSetting("custom_bg_enabled", "false")
	path, _ := a.db.GetSetting("custom_bg_path")
	if path != "" {
		_ = os.Remove(path)
	}
	_ = a.db.SaveSetting("custom_bg_path", "")
	return nil
}

// --- Server-Integrated SFTP File Manager Bindings ---

// ConnectServerSFTP connects a server directly to SFTP
func (a *App) ConnectServerSFTP(serverID, host string, port int, username, password string) error {
	_, err := a.sftpSessions.Connect(serverID, sftp.SFTPConfig{
		Host:     host,
		Port:     port,
		Username: username,
		Password: password,
	})
	if err != nil {
		logger.Logger.Error().Err(err).Str("server", serverID).Msg("Server SFTP connection failed")
		return err
	}
	logger.Logger.Info().Str("server", serverID).Msg("Server SFTP connected")
	a.logActivity(a.panelManager.GetActivePanelID(), "", serverID, "sftp.connect", "success", "")
	return nil
}

// IsServerSFTPConnected checks if server SFTP is active
func (a *App) IsServerSFTPConnected(serverID string) bool {
	if a.sftpSessions == nil {
		return false
	}
	return a.sftpSessions.IsConnected(serverID)
}

// DisconnectServerSFTP terminates SFTP for a server
func (a *App) DisconnectServerSFTP(serverID string) error {
	if a.sftpSessions == nil {
		return nil
	}
	return a.sftpSessions.Disconnect(serverID)
}

// ListServerSFTPFiles lists files via SFTP
func (a *App) ListServerSFTPFiles(serverID, path string) ([]sftp.FileEntry, error) {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return nil, err
	}
	return cli.ListDirectory(path)
}

// ReadServerSFTPFile reads file content via SFTP
func (a *App) ReadServerSFTPFile(serverID, path string) (string, error) {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return "", err
	}
	return cli.ReadFile(path)
}

// WriteServerSFTPFile writes file content via SFTP
func (a *App) WriteServerSFTPFile(serverID, path, content string) error {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return err
	}
	return cli.WriteFile(path, content)
}

// DeleteServerSFTPFile deletes file or folder via SFTP
func (a *App) DeleteServerSFTPFile(serverID, path string) error {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return err
	}
	return cli.Remove(path)
}

// CreateServerSFTPFolder creates folder via SFTP
func (a *App) CreateServerSFTPFolder(serverID, path string) error {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return err
	}
	return cli.CreateDirectory(path)
}


// UploadServerSFTPFile uploads base64 data to remote path via SFTP
func (a *App) UploadServerSFTPFile(serverID, path, base64Content string) error {
	cli, err := a.sftpSessions.Get(serverID)
	if err != nil {
		return err
	}
	data, err := sftp.Base64ToBytes(base64Content)
	if err != nil {
		return fmt.Errorf("invalid base64 content: %w", err)
	}
	return cli.UploadBytes(path, data)
}

// --- SFTP Explorer Bindings ---

// ConnectSFTP establishes an SFTP session
func (a *App) ConnectSFTP(cfg sftp.SFTPConfig) error {
	if a.activeSFTP != nil {
		a.activeSFTP.Close()
	}
	client, err := sftp.NewClient(cfg)
	if err != nil {
		logger.Logger.Error().Err(err).Str("host", cfg.Host).Msg("SFTP connection failed")
		return err
	}
	a.activeSFTP = client
	logger.Logger.Info().Str("host", cfg.Host).Msg("SFTP connection established")
	return nil
}

// ListSFTPFiles lists files in a directory via SFTP
func (a *App) ListSFTPFiles(remotePath string) ([]sftp.FileEntry, error) {
	if a.activeSFTP == nil {
		return nil, fmt.Errorf("no active SFTP session")
	}
	return a.activeSFTP.ListDirectory(remotePath)
}

// ReadSFTPFile reads remote text file content
func (a *App) ReadSFTPFile(remotePath string) (string, error) {
	if a.activeSFTP == nil {
		return "", fmt.Errorf("no active SFTP session")
	}
	return a.activeSFTP.ReadFile(remotePath)
}

// WriteSFTPFile writes text file content to remote path
func (a *App) WriteSFTPFile(remotePath, content string) error {
	if a.activeSFTP == nil {
		return fmt.Errorf("no active SFTP session")
	}
	return a.activeSFTP.WriteFile(remotePath, content)
}

// CloseSFTP closes the active SFTP session
func (a *App) CloseSFTP() error {
	if a.activeSFTP != nil {
		err := a.activeSFTP.Close()
		a.activeSFTP = nil
		return err
	}
	return nil
}

// --- Database Client Bindings (MySQL / MariaDB) ---

// ConnectDatabase opens a MySQL connection
func (a *App) ConnectDatabase(cfg dbclient.DBConfig) error {
	if a.activeDB != nil {
		a.activeDB.Close()
	}
	client, err := dbclient.NewClient(cfg)
	if err != nil {
		logger.Logger.Error().Err(err).Str("host", cfg.Host).Msg("Database connection failed")
		return err
	}
	a.activeDB = client
	logger.Logger.Info().Str("host", cfg.Host).Str("database", cfg.Database).Msg("Database connected")
	return nil
}

// ExecuteSQL executes a SQL query and returns results
func (a *App) ExecuteSQL(query string) (*dbclient.QueryResult, error) {
	if a.activeDB == nil {
		return nil, fmt.Errorf("no active database connection")
	}
	return a.activeDB.ExecuteQuery(a.ctx, query)
}

// ListSQLTables lists all tables in the active database
func (a *App) ListSQLTables() ([]string, error) {
	if a.activeDB == nil {
		return nil, fmt.Errorf("no active database connection")
	}
	return a.activeDB.ListTables(a.ctx)
}

// CloseDatabase closes the database connection
func (a *App) CloseDatabase() error {
	if a.activeDB != nil {
		err := a.activeDB.Close()
		a.activeDB = nil
		return err
	}
	return nil
}

// --- Console WebSocket Streaming Bindings ---

type consoleListener struct {
	ctx      context.Context
	serverID string
}

func (cl *consoleListener) OnConsoleOutput(line string) {
	runtime.EventsEmit(cl.ctx, "console:output", map[string]string{
		"server_id": cl.serverID,
		"line":      line,
	})
	runtime.EventsEmit(cl.ctx, fmt.Sprintf("server:console:%s", cl.serverID), line)
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
	a.wsMu.Lock()
	defer a.wsMu.Unlock()

	if a.activeConsoleWS == nil {
		return fmt.Errorf("console websocket is not connected")
	}
	return a.activeConsoleWS.SendCommand(command)
}

// SendServerPowerWS sends a power action through WebSocket
func (a *App) SendServerPowerWS(signal string) error {
	a.wsMu.Lock()
	defer a.wsMu.Unlock()

	if a.activeConsoleWS == nil {
		return fmt.Errorf("console websocket is not connected")
	}
	return a.activeConsoleWS.SendPower(signal)
}

// DisconnectServerConsole closes the active WebSocket console
func (a *App) DisconnectServerConsole() {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListBackups(a.ctx, serverID)
}

// CreateBackup creates a new backup
func (a *App) CreateBackup(serverID, name string, isLocked bool, ignored string) (*api.Backup, error) {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	return client.GetBackupDownloadURL(a.ctx, serverID, backupUUID)
}

// ToggleBackupLock toggles the locked state of a backup
func (a *App) ToggleBackupLock(serverID, backupUUID string) (*api.Backup, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ToggleBackupLock(a.ctx, serverID, backupUUID)
}

// RestoreBackup restores a backup
func (a *App) RestoreBackup(serverID, backupUUID string, truncate bool) error {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListSubusers(a.ctx, serverID)
}

// CreateSubuser invites or adds a subuser
func (a *App) CreateSubuser(serverID, email string, permissions []string) (*api.Subuser, error) {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.UpdateSubuser(a.ctx, serverID, subuserUUID, permissions)
}

// DeleteSubuser removes a subuser
func (a *App) DeleteSubuser(serverID, subuserUUID string) error {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListSchedules(a.ctx, serverID)
}

// CreateSchedule adds a schedule to a server
func (a *App) CreateSchedule(serverID, name string, cron api.CronExpression, isActive, onlyWhenOnline bool) (*api.Schedule, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.CreateSchedule(a.ctx, serverID, name, cron, isActive, onlyWhenOnline)
}

// TriggerSchedule runs a schedule immediately
func (a *App) TriggerSchedule(serverID string, scheduleID int) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.TriggerSchedule(a.ctx, serverID, scheduleID)
}

// DeleteSchedule deletes a schedule
func (a *App) DeleteSchedule(serverID string, scheduleID int) error {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return err
	}
	return client.DeleteSchedule(a.ctx, serverID, scheduleID)
}

// --- Client Server Network (Allocations) Bindings ---

// ListServerAllocations lists all network allocations for a server
func (a *App) ListServerAllocations(serverID string) ([]api.Allocation, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.ListAllocations(a.ctx, serverID)
}

// AssignServerAllocation assigns a new allocation to the server
func (a *App) AssignServerAllocation(serverID string) (*api.Allocation, error) {
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
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return nil, err
	}
	return client.GetStartupConfiguration(a.ctx, identifier)
}

// UpdateServerStartupVariable updates a startup environment variable
func (a *App) UpdateServerStartupVariable(identifier, key, value string) (*api.StartupVariable, error) {
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

// DownloadServerFileTo downloads a server file to user's specified path (default to Desktop or Downloads)
func (a *App) DownloadServerFileTo(identifier, filePath, destinationDir string) (string, error) {
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return "", err
	}
	downloadURL, err := client.GetFileDownloadURL(a.ctx, identifier, filePath)
	if err != nil {
		return "", err
	}

	if destinationDir == "" {
		home, err := os.UserHomeDir()
		if err == nil {
			desktop := filepath.Join(home, "Desktop")
			if _, err := os.Stat(desktop); err == nil {
				destinationDir = desktop
			} else {
				destinationDir = filepath.Join(home, "Downloads")
			}
		}
	}

	fileName := filepath.Base(filePath)
	targetFilePath := filepath.Join(destinationDir, fileName)

	resp, err := http.Get(downloadURL)
	if err != nil {
		return "", fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("download returned HTTP status %d", resp.StatusCode)
	}

	outFile, err := os.Create(targetFilePath)
	if err != nil {
		return "", fmt.Errorf("failed to create local file: %w", err)
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to save file: %w", err)
	}

	a.logActivity("", "", identifier, "file:download_local", "success", fmt.Sprintf("Downloaded %s to %s", filePath, targetFilePath))
	return targetFilePath, nil
}

// DownloadServerFileWithDialog opens a native Windows Save File dialog and downloads the server file to chosen path
func (a *App) DownloadServerFileWithDialog(identifier, filePath, defaultFileName string) (string, error) {
	if defaultFileName == "" {
		defaultFileName = filepath.Base(filePath)
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

	resp, err := http.Get(downloadURL)
	if err != nil {
		return "", fmt.Errorf("failed to download file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("download returned HTTP status %d", resp.StatusCode)
	}

	outFile, err := os.Create(targetPath)
	if err != nil {
		return "", fmt.Errorf("failed to create local file: %w", err)
	}
	defer outFile.Close()

	_, err = io.Copy(outFile, resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to save file: %w", err)
	}

	a.logActivity("", "", identifier, "file:download_dialog", "success", fmt.Sprintf("Downloaded %s to %s", filePath, targetPath))
	return targetPath, nil
}


// --- Discovery, Capabilities & Permissions Bindings ---

// GetPanelCapabilities returns active capabilities and compatibility for the current panel
func (a *App) GetPanelCapabilities() (*discovery.CompatibilityReport, error) {
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
	if config.IsSFTP {
		args = append(args, "-sftp=true")
	}

	cmd := exec.Command(exe, args...)
	return cmd.Start()
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
	a.db.SaveActivity(database.ActivityRecord{
		PanelID:   panelID,
		PanelName: panelName,
		ServerID:  serverID,
		Action:    action,
		Result:    result,
		Error:     errMsg,
	})
}

// SystemDiagnostics holds diagnostic info for tooling, configuration, and bug reporting
type SystemDiagnostics struct {
	AppVersion        string  `json:"appVersion"`
	WailsVersion      string  `json:"wailsVersion"`
	OS                string  `json:"os"`
	OSName            string  `json:"osName"`
	OSDisplayVersion  string  `json:"osDisplayVersion"`
	OSBuild           string  `json:"osBuild"`
	WebView2Version   string  `json:"webView2Version"`
	Arch              string  `json:"arch"`
	CPUCores          int     `json:"cpuCores"`
	Hostname          string  `json:"hostname"`
	GoVersion         string  `json:"goVersion"`
	SQLiteVersion     string  `json:"sqliteVersion"`
	AppDataDir        string  `json:"appDataDir"`
	DatabasePath      string  `json:"databasePath"`
	DatabaseSizeBytes int64   `json:"databaseSizeBytes"`
	DatabaseWALMode   bool    `json:"databaseWalMode"`
	PanelsCount       int     `json:"panelsCount"`
	ActivePanelName   string  `json:"activePanelName"`
	DPAPIActive       bool    `json:"dpapiActive"`
	DPAPITestPassed   bool    `json:"dpapiTestPassed"`
	DPAPILatencyMs    float64 `json:"dpapiLatencyMs"`
	SecurityLockout   bool    `json:"securityLockout"`
	AllocatedMemMB    float64 `json:"allocatedMemMb"`
	TotalAllocMemMB   float64 `json:"totalAllocMemMb"`
	GoroutinesCount   int     `json:"goroutinesCount"`
	Timestamp         string  `json:"timestamp"`
}

// GetSystemDiagnostics performs a complete system, security, and storage health check
func (a *App) GetSystemDiagnostics() (*SystemDiagnostics, error) {
	var m goruntime.MemStats
	goruntime.ReadMemStats(&m)

	dbPath := filepath.Join(a.appDataDir, "data", "pterodesk.db")
	var dbSize int64
	if fi, err := os.Stat(dbPath); err == nil {
		dbSize = fi.Size()
	}

	panelsCount := 0
	activePanelName := "None"
	if a.panelManager != nil {
		if active, err := a.panelManager.GetActivePanel(); err == nil && active != nil {
			activePanelName = active.Name
		}
		if panels, err := a.panelManager.GetAllPanels(); err == nil {
			panelsCount = len(panels)
		}
	}

	// In-memory test of Windows DPAPI
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

	lockoutActive := false
	if a.lockoutManager != nil {
		status := a.lockoutManager.GetStatus()
		lockoutActive = status.IsLockedOut
	}

	osName, osDisplayVer, osBuild := getWindowsBuildDetails()
	wv2Ver := getWebView2Version()
	hostName, _ := os.Hostname()

	sqliteVer := "3.x"
	if a.db != nil {
		if ver, err := a.db.GetSQLiteVersion(); err == nil && ver != "" {
			sqliteVer = ver
		}
	}

	return &SystemDiagnostics{
		AppVersion:        AppVersion,
		WailsVersion:      "v2.17.1",
		OS:                goruntime.GOOS,
		OSName:            osName,
		OSDisplayVersion:  osDisplayVer,
		OSBuild:           osBuild,
		WebView2Version:   wv2Ver,
		Arch:              goruntime.GOARCH,
		CPUCores:          goruntime.NumCPU(),
		Hostname:          hostName,
		GoVersion:         goruntime.Version(),
		SQLiteVersion:     sqliteVer,
		AppDataDir:        a.appDataDir,
		DatabasePath:      dbPath,
		DatabaseSizeBytes: dbSize,
		DatabaseWALMode:   true,
		PanelsCount:       panelsCount,
		ActivePanelName:   activePanelName,
		DPAPIActive:       dpapiActive,
		DPAPITestPassed:   dpapiPassed,
		DPAPILatencyMs:    dpapiLatency,
		SecurityLockout:   lockoutActive,
		AllocatedMemMB:    float64(m.Alloc) / (1024 * 1024),
		TotalAllocMemMB:   float64(m.TotalAlloc) / (1024 * 1024),
		GoroutinesCount:   goruntime.NumGoroutine(),
		Timestamp:         time.Now().UTC().Format(time.RFC3339),
	}, nil
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
	if a.panelManager == nil {
		return 0
	}
	return a.panelManager.GetActivePanelLatencyMs()
}

// PingActivePanel sends a lightweight ping to the active panel and returns latency in ms
func (a *App) PingActivePanel() (int64, error) {
	if a.panelManager == nil {
		return 0, fmt.Errorf("bộ quản lý panel chưa khởi tạo")
	}
	client, err := a.panelManager.GetClientAPI()
	if err != nil {
		return 0, err
	}
	start := time.Now()
	_, err = client.GetAccount(a.ctx)
	elapsed := time.Since(start).Milliseconds()
	if err != nil {
		return elapsed, err
	}
	return elapsed, nil
}
