package panel

import (
	"context"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"pterodesk/internal/api"
	"pterodesk/internal/database"
	"pterodesk/internal/security"
)

// Manager handles multi-panel configuration and API client management
type Manager struct {
	db          *database.DB
	credentials *security.CredentialStore
	clientAPIs  map[string]*api.ClientAPI
	appAPIs     map[string]*api.ApplicationAPI
	activePanel string
}

// NewManager creates a new panel manager
func NewManager(db *database.DB, credentials *security.CredentialStore) *Manager {
	return &Manager{
		db:          db,
		credentials: credentials,
		clientAPIs:  make(map[string]*api.ClientAPI),
		appAPIs:     make(map[string]*api.ApplicationAPI),
	}
}

// Initialize loads all panels and sets up API clients
func (m *Manager) Initialize() error {
	panels, err := m.db.GetAllPanels()
	if err != nil {
		return fmt.Errorf("failed to load panels: %w", err)
	}

	for _, p := range panels {
		if err := m.initAPIs(p); err != nil {
			// Log but don't fail - panel might have invalid credentials
			continue
		}
		if p.IsActive {
			m.activePanel = p.ID
		}
	}

	return nil
}

func (m *Manager) initAPIs(p database.PanelRecord) error {
	if p.ClientAPIKey != "" {
		token, err := m.credentials.DecryptString(p.ClientAPIKey)
		if err != nil {
			return fmt.Errorf("failed to decrypt client API key: %w", err)
		}
		m.clientAPIs[p.ID] = api.NewClientAPI(p.URL, token)
	}

	if p.AppAPIKey != "" {
		token, err := m.credentials.DecryptString(p.AppAPIKey)
		if err != nil {
			return fmt.Errorf("failed to decrypt app API key: %w", err)
		}
		m.appAPIs[p.ID] = api.NewApplicationAPI(p.URL, token)
	}

	return nil
}

// AddPanel adds a new panel
func (m *Manager) AddPanel(input PanelInput) (*Panel, error) {
	// Validate URL
	if err := validatePanelURL(input.URL); err != nil {
		return nil, err
	}

	id := uuid.New().String()
	now := time.Now()

	record := database.PanelRecord{
		ID:        id,
		Name:      input.Name,
		URL:       strings.TrimRight(input.URL, "/"),
		CreatedAt: now,
		UpdatedAt: now,
	}

	// Encrypt and store credentials
	if input.ClientAPIKey != "" {
		encrypted, err := m.credentials.EncryptString(input.ClientAPIKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt client API key: %w", err)
		}
		record.ClientAPIKey = encrypted
	}

	if input.AppAPIKey != "" {
		encrypted, err := m.credentials.EncryptString(input.AppAPIKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt app API key: %w", err)
		}
		record.AppAPIKey = encrypted
	}

	if err := m.db.SavePanel(record); err != nil {
		return nil, fmt.Errorf("failed to save panel: %w", err)
	}

	// Initialize API clients
	if err := m.initAPIs(record); err != nil {
		// Non-fatal, panel is saved but APIs might not work
	}

	return m.recordToPanel(record), nil
}

// UpdatePanel updates an existing panel
func (m *Manager) UpdatePanel(id string, input PanelInput) (*Panel, error) {
	existing, err := m.db.GetPanel(id)
	if err != nil {
		return nil, fmt.Errorf("panel not found: %w", err)
	}

	if err := validatePanelURL(input.URL); err != nil {
		return nil, err
	}

	existing.Name = input.Name
	existing.URL = strings.TrimRight(input.URL, "/")
	existing.UpdatedAt = time.Now()

	// Update credentials if provided
	if input.ClientAPIKey != "" {
		encrypted, err := m.credentials.EncryptString(input.ClientAPIKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt client API key: %w", err)
		}
		existing.ClientAPIKey = encrypted
	}

	if input.AppAPIKey != "" {
		encrypted, err := m.credentials.EncryptString(input.AppAPIKey)
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt app API key: %w", err)
		}
		existing.AppAPIKey = encrypted
	}

	if err := m.db.SavePanel(*existing); err != nil {
		return nil, fmt.Errorf("failed to update panel: %w", err)
	}

	// Reinitialize API clients
	delete(m.clientAPIs, id)
	delete(m.appAPIs, id)
	if err := m.initAPIs(*existing); err != nil {
		// Non-fatal
	}

	return m.recordToPanel(*existing), nil
}

// DeletePanel removes a panel
func (m *Manager) DeletePanel(id string) error {
	delete(m.clientAPIs, id)
	delete(m.appAPIs, id)

	if m.activePanel == id {
		m.activePanel = ""
	}

	return m.db.DeletePanel(id)
}

// SetActivePanel switches the active panel
func (m *Manager) SetActivePanel(id string) error {
	if err := m.db.SetActivePanel(id); err != nil {
		return fmt.Errorf("failed to set active panel: %w", err)
	}
	m.activePanel = id
	return nil
}

// GetActivePanel returns the currently active panel
func (m *Manager) GetActivePanel() (*Panel, error) {
	if m.activePanel == "" {
		return nil, nil
	}
	record, err := m.db.GetPanel(m.activePanel)
	if err != nil {
		return nil, err
	}
	return m.recordToPanel(*record), nil
}

// GetAllPanels returns all configured panels (with masked credentials)
func (m *Manager) GetAllPanels() ([]Panel, error) {
	records, err := m.db.GetAllPanels()
	if err != nil {
		return nil, err
	}

	panels := make([]Panel, 0, len(records))
	for _, r := range records {
		panels = append(panels, *m.recordToPanel(r))
	}
	return panels, nil
}

// TestConnection tests API connectivity for a panel
func (m *Manager) TestConnection(id string) (*ConnectionTestResult, error) {
	record, err := m.db.GetPanel(id)
	if err != nil {
		return nil, fmt.Errorf("panel not found: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	result := &ConnectionTestResult{}

	// Test Client API
	if record.ClientAPIKey != "" {
		if clientAPI, ok := m.clientAPIs[id]; ok {
			account, err := clientAPI.GetAccount(ctx)
			if err != nil {
				result.ClientError = err.Error()
			} else {
				result.ClientAPI = true
				result.AccountName = account.Username
				result.AccountEmail = account.Email
				result.AccountAdmin = account.Admin
			}
		} else {
			result.ClientError = "Client API not initialized"
		}
	} else {
		result.ClientError = "No Client API key configured"
	}

	// Test Application API
	if record.AppAPIKey != "" {
		if appAPI, ok := m.appAPIs[id]; ok {
			err := appAPI.TestConnection(ctx)
			if err != nil {
				result.AppError = err.Error()
			} else {
				result.AppAPI = true
			}
		} else {
			result.AppError = "Application API not initialized"
		}
	} else {
		result.AppError = "No Application API key configured"
	}

	return result, nil
}

// GetClientAPI returns the Client API for the active panel
func (m *Manager) GetClientAPI() (*api.ClientAPI, error) {
	if m.activePanel == "" {
		return nil, fmt.Errorf("no active panel selected")
	}
	client, ok := m.clientAPIs[m.activePanel]
	if !ok {
		return nil, fmt.Errorf("client API not initialized for active panel")
	}
	return client, nil
}

// GetActivePanelLatencyMs returns the last recorded latency in ms for the active panel
func (m *Manager) GetActivePanelLatencyMs() int64 {
	if m.activePanel == "" {
		return 0
	}
	if client, ok := m.clientAPIs[m.activePanel]; ok {
		return client.GetLastLatencyMs()
	}
	return 0
}

// GetClientAPIForPanel returns the Client API for a specific panel ID
func (m *Manager) GetClientAPIForPanel(id string) (*api.ClientAPI, error) {
	client, ok := m.clientAPIs[id]
	if !ok {
		return nil, fmt.Errorf("client API not initialized for panel %s", id)
	}
	return client, nil
}

// GetAppAPI returns the Application API for the active panel
func (m *Manager) GetAppAPI() (*api.ApplicationAPI, error) {
	if m.activePanel == "" {
		return nil, fmt.Errorf("no active panel selected")
	}
	appAPI, ok := m.appAPIs[m.activePanel]
	if !ok {
		return nil, fmt.Errorf("application API not initialized for active panel")
	}
	return appAPI, nil
}

// GetActivePanelID returns the active panel ID
func (m *Manager) GetActivePanelID() string {
	return m.activePanel
}

func (m *Manager) recordToPanel(r database.PanelRecord) *Panel {
	p := &Panel{
		ID:           r.ID,
		Name:         r.Name,
		URL:          r.URL,
		Version:      r.Version,
		IsActive:     r.IsActive,
		HasClientKey: r.ClientAPIKey != "",
		HasAppKey:    r.AppAPIKey != "",
		CreatedAt:    r.CreatedAt,
		UpdatedAt:    r.UpdatedAt,
	}

	// Provide masked credentials for display
	if r.ClientAPIKey != "" {
		if decrypted, err := m.credentials.DecryptString(r.ClientAPIKey); err == nil {
			p.MaskedClientKey = m.credentials.MaskCredential(decrypted)
		}
	}
	if r.AppAPIKey != "" {
		if decrypted, err := m.credentials.DecryptString(r.AppAPIKey); err == nil {
			p.MaskedAppKey = m.credentials.MaskCredential(decrypted)
		}
	}

	return p
}

func validatePanelURL(rawURL string) error {
	if rawURL == "" {
		return fmt.Errorf("panel URL is required")
	}
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return fmt.Errorf("invalid panel URL: %w", err)
	}
	if parsed.Scheme != "https" && parsed.Scheme != "http" {
		return fmt.Errorf("panel URL must use http or https scheme")
	}
	if parsed.Host == "" {
		return fmt.Errorf("panel URL must have a host")
	}
	return nil
}
