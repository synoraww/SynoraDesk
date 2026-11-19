package discovery

// PanelCapabilities reflects feature availability based on API keys and version
type PanelCapabilities struct {
	HasClientAPI      bool `json:"has_client_api"`
	HasApplicationAPI bool `json:"has_application_api"`
	IsV2              bool `json:"is_v2"`

	// Client capabilities
	CanViewServers     bool `json:"can_view_servers"`
	CanPowerAction     bool `json:"can_power_action"`
	CanConsole         bool `json:"can_console"`
	CanFileManager     bool `json:"can_file_manager"`
	CanSFTP            bool `json:"can_sftp"`
	CanManageBackups   bool `json:"can_manage_backups"`
	CanManageDatabases bool `json:"can_manage_databases"`
	CanManageSchedules bool `json:"can_manage_schedules"`
	CanManageSubusers  bool `json:"can_manage_subusers"`

	// Admin / Application capabilities
	CanAdminServers      bool `json:"can_admin_servers"`
	CanCreateServers     bool `json:"can_create_servers"`
	CanManageNodes       bool `json:"can_manage_nodes"`
	CanManageAllocations bool `json:"can_manage_allocations"`
	CanManageNests       bool `json:"can_manage_nests"` // 1.x only
}

// EvaluateCapabilities calculates active features for a panel profile
func EvaluateCapabilities(hasClientKey, hasAppKey bool, version PanelVersion) PanelCapabilities {
	caps := PanelCapabilities{
		HasClientAPI:      hasClientKey,
		HasApplicationAPI: hasAppKey,
		IsV2:              version.IsV2,
	}

	if hasClientKey {
		caps.CanViewServers = true
		caps.CanPowerAction = true
		caps.CanConsole = true
		caps.CanFileManager = true
		caps.CanSFTP = true
		caps.CanManageBackups = true
		caps.CanManageDatabases = true
		caps.CanManageSchedules = true
		caps.CanManageSubusers = true
	}

	if hasAppKey {
		caps.CanAdminServers = true
		caps.CanCreateServers = true
		caps.CanManageNodes = true
		caps.CanManageAllocations = true
		// Pterodactyl 2.x drops the legacy Nests API
		caps.CanManageNests = !version.IsV2
	}

	return caps
}
