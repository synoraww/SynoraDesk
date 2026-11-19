package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

// DB wraps the SQLite database connection
type DB struct {
	conn *sql.DB
	path string
}

// GetSQLiteVersion queries and returns the underlying SQLite engine version
func (d *DB) GetSQLiteVersion() (string, error) {
	if d.conn == nil {
		return "", fmt.Errorf("database connection is nil")
	}
	var version string
	err := d.conn.QueryRow("SELECT sqlite_version()").Scan(&version)
	return version, err
}

// PanelRecord represents a stored panel configuration
type PanelRecord struct {
	ID           string    `json:"id"`
	Name         string    `json:"name"`
	URL          string    `json:"url"`
	ClientAPIKey string    `json:"clientApiKey"` // encrypted
	AppAPIKey    string    `json:"appApiKey"`    // encrypted
	Version      string    `json:"version"`
	IsActive     bool      `json:"isActive"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

// ActivityRecord represents a logged activity
type ActivityRecord struct {
	ID        int64     `json:"id"`
	PanelID   string    `json:"panelId"`
	PanelName string    `json:"panelName"`
	ServerID  string    `json:"serverId"`
	Action    string    `json:"action"`
	Result    string    `json:"result"`
	Error     string    `json:"error"`
	Timestamp time.Time `json:"timestamp"`
}

// RecentServerRecord tracks recently accessed servers
type RecentServerRecord struct {
	PanelID    string    `json:"panelId"`
	ServerID   string    `json:"serverId"`
	ServerName string    `json:"serverName"`
	AccessedAt time.Time `json:"accessedAt"`
}

// SettingRecord represents an app setting
type SettingRecord struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// New creates a new database connection
func New(appDataDir string) (*DB, error) {
	dbDir := filepath.Join(appDataDir, "data")
	if err := os.MkdirAll(dbDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	dbPath := filepath.Join(dbDir, "pterodesk.db")
	conn, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Set connection pool settings
	conn.SetMaxOpenConns(1) // SQLite supports single writer
	conn.SetMaxIdleConns(1)

	db := &DB{conn: conn, path: dbPath}
	if err := db.migrate(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// Close closes the database connection
func (db *DB) Close() error {
	if db.conn != nil {
		return db.conn.Close()
	}
	return nil
}

func (db *DB) migrate() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS panels (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			url TEXT NOT NULL,
			client_api_key TEXT DEFAULT '',
			app_api_key TEXT DEFAULT '',
			version TEXT DEFAULT '',
			is_active INTEGER DEFAULT 0,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS activities (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			panel_id TEXT NOT NULL,
			panel_name TEXT DEFAULT '',
			server_id TEXT DEFAULT '',
			action TEXT NOT NULL,
			result TEXT DEFAULT '',
			error TEXT DEFAULT '',
			timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS recent_servers (
			panel_id TEXT NOT NULL,
			server_id TEXT NOT NULL,
			server_name TEXT DEFAULT '',
			accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY (panel_id, server_id)
		)`,
		`CREATE TABLE IF NOT EXISTS settings (
			key TEXT PRIMARY KEY,
			value TEXT DEFAULT ''
		)`,
		`CREATE INDEX IF NOT EXISTS idx_activities_timestamp ON activities(timestamp DESC)`,
		`CREATE INDEX IF NOT EXISTS idx_activities_panel ON activities(panel_id)`,
		`CREATE INDEX IF NOT EXISTS idx_recent_servers_accessed ON recent_servers(accessed_at DESC)`,
	}

	for _, m := range migrations {
		if _, err := db.conn.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %s: %w", m[:50], err)
		}
	}
	return nil
}

// SavePanel inserts or replaces a panel record
func (db *DB) SavePanel(p PanelRecord) error {
	_, err := db.conn.Exec(`
		INSERT INTO panels (id, name, url, client_api_key, app_api_key, version, is_active, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			name = excluded.name,
			url = excluded.url,
			client_api_key = excluded.client_api_key,
			app_api_key = excluded.app_api_key,
			version = excluded.version,
			is_active = excluded.is_active,
			updated_at = excluded.updated_at
	`, p.ID, p.Name, p.URL, p.ClientAPIKey, p.AppAPIKey, p.Version, p.IsActive, p.CreatedAt, time.Now())
	return err
}

// GetPanel retrieves a single panel by ID
func (db *DB) GetPanel(id string) (*PanelRecord, error) {
	var p PanelRecord
	var isActive int
	err := db.conn.QueryRow(`SELECT id, name, url, client_api_key, app_api_key, version, is_active, created_at, updated_at FROM panels WHERE id = ?`, id).
		Scan(&p.ID, &p.Name, &p.URL, &p.ClientAPIKey, &p.AppAPIKey, &p.Version, &isActive, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	p.IsActive = isActive == 1
	return &p, nil
}

// GetAllPanels retrieves all panel records
func (db *DB) GetAllPanels() ([]PanelRecord, error) {
	rows, err := db.conn.Query(`SELECT id, name, url, client_api_key, app_api_key, version, is_active, created_at, updated_at FROM panels ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var panels []PanelRecord
	for rows.Next() {
		var p PanelRecord
		var isActive int
		if err := rows.Scan(&p.ID, &p.Name, &p.URL, &p.ClientAPIKey, &p.AppAPIKey, &p.Version, &isActive, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		p.IsActive = isActive == 1
		panels = append(panels, p)
	}
	return panels, nil
}

// DeletePanel removes a panel by ID
func (db *DB) DeletePanel(id string) error {
	_, err := db.conn.Exec(`DELETE FROM panels WHERE id = ?`, id)
	return err
}

// SetActivePanel sets a panel as active and deactivates all others
func (db *DB) SetActivePanel(id string) error {
	tx, err := db.conn.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if _, err := tx.Exec(`UPDATE panels SET is_active = 0`); err != nil {
		return err
	}
	if _, err := tx.Exec(`UPDATE panels SET is_active = 1 WHERE id = ?`, id); err != nil {
		return err
	}
	return tx.Commit()
}

// SaveActivity logs an activity
func (db *DB) SaveActivity(a ActivityRecord) error {
	_, err := db.conn.Exec(`
		INSERT INTO activities (panel_id, panel_name, server_id, action, result, error, timestamp)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, a.PanelID, a.PanelName, a.ServerID, a.Action, a.Result, a.Error, time.Now())
	return err
}

// GetActivities retrieves recent activities
func (db *DB) GetActivities(limit int) ([]ActivityRecord, error) {
	rows, err := db.conn.Query(`SELECT id, panel_id, panel_name, server_id, action, result, error, timestamp FROM activities ORDER BY timestamp DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var activities []ActivityRecord
	for rows.Next() {
		var a ActivityRecord
		if err := rows.Scan(&a.ID, &a.PanelID, &a.PanelName, &a.ServerID, &a.Action, &a.Result, &a.Error, &a.Timestamp); err != nil {
			return nil, err
		}
		activities = append(activities, a)
	}
	return activities, nil
}

// SaveRecentServer upserts a recently accessed server
func (db *DB) SaveRecentServer(r RecentServerRecord) error {
	_, err := db.conn.Exec(`
		INSERT INTO recent_servers (panel_id, server_id, server_name, accessed_at)
		VALUES (?, ?, ?, ?)
		ON CONFLICT(panel_id, server_id) DO UPDATE SET
			server_name = excluded.server_name,
			accessed_at = excluded.accessed_at
	`, r.PanelID, r.ServerID, r.ServerName, time.Now())
	return err
}

// GetRecentServers retrieves recently accessed servers
func (db *DB) GetRecentServers(limit int) ([]RecentServerRecord, error) {
	rows, err := db.conn.Query(`SELECT panel_id, server_id, server_name, accessed_at FROM recent_servers ORDER BY accessed_at DESC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var servers []RecentServerRecord
	for rows.Next() {
		var r RecentServerRecord
		if err := rows.Scan(&r.PanelID, &r.ServerID, &r.ServerName, &r.AccessedAt); err != nil {
			return nil, err
		}
		servers = append(servers, r)
	}
	return servers, nil
}

// GetSetting retrieves a setting value
func (db *DB) GetSetting(key string) (string, error) {
	var value string
	err := db.conn.QueryRow(`SELECT value FROM settings WHERE key = ?`, key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return value, err
}

// SaveSetting saves a setting
func (db *DB) SaveSetting(key, value string) error {
	_, err := db.conn.Exec(`
		INSERT INTO settings (key, value) VALUES (?, ?)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value
	`, key, value)
	return err
}
