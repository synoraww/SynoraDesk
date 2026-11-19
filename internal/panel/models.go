package panel

import "time"

// Panel represents a configured Pterodactyl Panel
type Panel struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	URL             string    `json:"url"`
	ClientAPIKey    string    `json:"clientApiKey,omitempty"` // Never sent to frontend with actual value
	AppAPIKey       string    `json:"appApiKey,omitempty"`    // Never sent to frontend with actual value
	Version         string    `json:"version"`
	IsActive        bool      `json:"isActive"`
	HasClientKey    bool      `json:"hasClientKey"`
	HasAppKey       bool      `json:"hasAppKey"`
	MaskedClientKey string    `json:"maskedClientKey,omitempty"`
	MaskedAppKey    string    `json:"maskedAppKey,omitempty"`
	CreatedAt       time.Time `json:"createdAt"`
	UpdatedAt       time.Time `json:"updatedAt"`
}

// PanelInput represents the input for creating/editing a panel
type PanelInput struct {
	Name         string `json:"name"`
	URL          string `json:"url"`
	ClientAPIKey string `json:"clientApiKey,omitempty"`
	AppAPIKey    string `json:"appApiKey,omitempty"`
}

// ConnectionTestResult represents the result of a connectivity test
type ConnectionTestResult struct {
	ClientAPI    bool   `json:"clientApi"`
	ClientError  string `json:"clientError,omitempty"`
	AppAPI       bool   `json:"appApi"`
	AppError     string `json:"appError,omitempty"`
	Version      string `json:"version,omitempty"`
	AccountName  string `json:"accountName,omitempty"`
	AccountEmail string `json:"accountEmail,omitempty"`
	AccountAdmin bool   `json:"accountAdmin,omitempty"`
}

// DashboardStats holds dashboard summary data
type DashboardStats struct {
	TotalPanels     int    `json:"totalPanels"`
	ActivePanel     string `json:"activePanel"`
	ActivePanelName string `json:"activePanelName"`
	TotalServers    int    `json:"totalServers"`
	RunningServers  int    `json:"runningServers"`
	OfflineServers  int    `json:"offlineServers"`
	TotalNodes      int    `json:"totalNodes"`
}
