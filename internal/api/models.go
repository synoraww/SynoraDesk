package api

import "time"

// --- Pagination ---

// PaginationMeta represents pagination metadata from the API
type PaginationMeta struct {
	Total       int `json:"total"`
	Count       int `json:"count"`
	PerPage     int `json:"per_page"`
	CurrentPage int `json:"current_page"`
	TotalPages  int `json:"total_pages"`
}

// PaginationLinks represents pagination links
type PaginationLinks struct {
	Previous string `json:"previous"`
	Next     string `json:"next"`
}

// PaginatedResponse wraps a paginated API response
type PaginatedResponse[T any] struct {
	Object string `json:"object"`
	Data   []struct {
		Object     string `json:"object"`
		Attributes T      `json:"attributes"`
	} `json:"data"`
	Meta struct {
		Pagination PaginationMeta `json:"pagination"`
	} `json:"meta"`
}

// SingleResponse wraps a single API object response
type SingleResponse[T any] struct {
	Object     string `json:"object"`
	Attributes T      `json:"attributes"`
	Meta       struct {
		IsServerOwner   bool     `json:"is_server_owner"`
		UserPermissions []string `json:"user_permissions"`
	} `json:"meta"`
}

// --- Error Response ---

type APIErrorResponse struct {
	Errors []struct {
		Code   string `json:"code"`
		Status string `json:"status"`
		Detail string `json:"detail"`
	} `json:"errors"`
}

// --- Server Models ---

// Server represents a server from the Client API
type Server struct {
	ServerOwner     bool                 `json:"server_owner"`
	Identifier      string               `json:"identifier"`
	InternalID      int                  `json:"internal_id,omitempty"`
	UUID            string               `json:"uuid"`
	Name            string               `json:"name"`
	Node            string               `json:"node"`
	Description     string               `json:"description"`
	Limits          ServerLimits         `json:"limits"`
	Allocations     []Allocation         `json:"allocations,omitempty"`
	FeatureLimits   FeatureLimits        `json:"feature_limits"`
	Status          *string              `json:"status"`
	IsSuspended     bool                 `json:"is_suspended"`
	IsInstalling    bool                 `json:"is_installing"`
	IsTransferring  bool                 `json:"is_transferring"`
	InvocationLine  string               `json:"invocation,omitempty"`
	DockerImage     string               `json:"docker_image,omitempty"`
	EggFeatures     []string             `json:"egg_features,omitempty"`
	EggName         string               `json:"egg_name,omitempty"`
	UserPermissions []string             `json:"user_permissions,omitempty"`
	Relationships   *ServerRelationships `json:"relationships,omitempty"`
	SFTPDetails     SFTPDetails          `json:"sftp_details,omitempty"`
}

// ServerRelationships represents relationships attached to a server
type EggAttributes struct {
	UUID string `json:"uuid"`
	Name string `json:"name"`
}

type EggRelationship struct {
	Object     string        `json:"object"`
	Attributes EggAttributes `json:"attributes"`
}

type AllocationData struct {
	Attributes Allocation `json:"attributes"`
}

type AllocationsRelationship struct {
	Data []AllocationData `json:"data"`
}

type ServerRelationships struct {
	Egg         *EggRelationship         `json:"egg,omitempty"`
	Allocations *AllocationsRelationship `json:"allocations,omitempty"`
}

// SFTPDetails represents SFTP connection info for a server
type SFTPDetails struct {
	IP   string `json:"ip"`
	Port int    `json:"port"`
}

// ServerLimits represents resource limits
type ServerLimits struct {
	Memory      int     `json:"memory"`
	Swap        int     `json:"swap"`
	Disk        int     `json:"disk"`
	IO          int     `json:"io"`
	CPU         int     `json:"cpu"`
	Threads     *string `json:"threads"`
	OOMDisabled bool    `json:"oom_disabled,omitempty"`
}

// FeatureLimits represents feature limits
type FeatureLimits struct {
	Databases   int `json:"databases"`
	Allocations int `json:"allocations"`
	Backups     int `json:"backups"`
}

// Allocation represents a network allocation
type Allocation struct {
	ID        int     `json:"id"`
	IP        string  `json:"ip"`
	IPAlias   *string `json:"ip_alias"`
	Port      int     `json:"port"`
	Notes     *string `json:"notes"`
	IsDefault bool    `json:"is_default"`
}

// ResourceUsage represents current resource utilization
type ResourceUsage struct {
	CurrentState string `json:"current_state"`
	IsSuspended  bool   `json:"is_suspended"`
	Resources    struct {
		MemoryBytes    int64   `json:"memory_bytes"`
		CPUAbsolute    float64 `json:"cpu_absolute"`
		DiskBytes      int64   `json:"disk_bytes"`
		NetworkRxBytes int64   `json:"network_rx_bytes"`
		NetworkTxBytes int64   `json:"network_tx_bytes"`
		Uptime         int64   `json:"uptime"`
	} `json:"resources"`
}

// --- Application API Server ---

// AppServer represents a server from the Application API
type AppServer struct {
	ID            int           `json:"id"`
	ExternalID    *string       `json:"external_id"`
	UUID          string        `json:"uuid"`
	Identifier    string        `json:"identifier"`
	Name          string        `json:"name"`
	Description   string        `json:"description"`
	Status        *string       `json:"status"`
	Suspended     bool          `json:"suspended"`
	Limits        ServerLimits  `json:"limits"`
	FeatureLimits FeatureLimits `json:"feature_limits"`
	User          int           `json:"user"`
	Node          int           `json:"node"`
	Allocation    int           `json:"allocation"`
	Nest          int           `json:"nest"`
	Egg           int           `json:"egg"`
	Container     Container     `json:"container"`
	CreatedAt     time.Time     `json:"created_at"`
	UpdatedAt     time.Time     `json:"updated_at"`
}

// Container represents server container configuration
type Container struct {
	StartupCommand string            `json:"startup_command"`
	Image          string            `json:"image"`
	Installed      int               `json:"installed"`
	Environment    map[string]string `json:"environment"`
}

// CreateServerRequest represents a request to create a server via Application API
type CreateServerRequest struct {
	Name          string            `json:"name"`
	User          int               `json:"user"`
	Egg           int               `json:"egg"`
	DockerImage   string            `json:"docker_image"`
	Startup       string            `json:"startup"`
	Environment   map[string]string `json:"environment"`
	Limits        ServerLimits      `json:"limits"`
	FeatureLimits FeatureLimits     `json:"feature_limits"`
	Allocation    struct {
		Default int `json:"default"`
	} `json:"allocation"`
}

// UpdateServerDetailsRequest represents a request to update server details
type UpdateServerDetailsRequest struct {
	Name        string  `json:"name"`
	User        int     `json:"user"`
	ExternalID  *string `json:"external_id,omitempty"`
	Description string  `json:"description"`
}

// UpdateServerBuildRequest represents a request to update server build config
type UpdateServerBuildRequest struct {
	Allocation    int           `json:"allocation"`
	OOMDisabled   bool          `json:"oom_disabled"`
	Limits        ServerLimits  `json:"limits"`
	FeatureLimits FeatureLimits `json:"feature_limits"`
}

// --- Node Models ---

// Node represents a node from the Application API
type Node struct {
	ID                 int       `json:"id"`
	UUID               string    `json:"uuid"`
	Public             bool      `json:"public"`
	Name               string    `json:"name"`
	Description        string    `json:"description"`
	LocationID         int       `json:"location_id"`
	FQDN               string    `json:"fqdn"`
	Scheme             string    `json:"scheme"`
	BehindProxy        bool      `json:"behind_proxy"`
	MaintenanceMode    bool      `json:"maintenance_mode"`
	Memory             int       `json:"memory"`
	MemoryOverallocate int       `json:"memory_overallocate"`
	Disk               int       `json:"disk"`
	DiskOverallocate   int       `json:"disk_overallocate"`
	UploadSize         int       `json:"upload_size"`
	DaemonListen       int       `json:"daemon_listen"`
	DaemonSFTP         int       `json:"daemon_sftp"`
	DaemonBase         string    `json:"daemon_base"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
	AllocatedResources struct {
		Memory int `json:"memory"`
		Disk   int `json:"disk"`
	} `json:"allocated_resources,omitempty"`
}

// CreateNodeRequest represents a request to create a node
type CreateNodeRequest struct {
	Name               string `json:"name"`
	LocationID         int    `json:"location_id"`
	FQDN               string `json:"fqdn"`
	Scheme             string `json:"scheme"`
	Memory             int    `json:"memory"`
	MemoryOverallocate int    `json:"memory_overallocate"`
	Disk               int    `json:"disk"`
	DiskOverallocate   int    `json:"disk_overallocate"`
	UploadSize         int    `json:"upload_size"`
	DaemonSFTP         int    `json:"daemon_sftp"`
	DaemonListen       int    `json:"daemon_listen"`
	DaemonBase         string `json:"daemon_base,omitempty"`
	BehindProxy        bool   `json:"behind_proxy"`
	MaintenanceMode    bool   `json:"maintenance_mode"`
}

// --- User Models ---

// User represents a user
type User struct {
	ID         int       `json:"id"`
	ExternalID *string   `json:"external_id"`
	UUID       string    `json:"uuid"`
	Username   string    `json:"username"`
	Email      string    `json:"email"`
	FirstName  string    `json:"first_name"`
	LastName   string    `json:"last_name"`
	Language   string    `json:"language"`
	RootAdmin  bool      `json:"root_admin"`
	TwoFactor  bool      `json:"2fa"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// --- Database Models ---

// Database represents a server database
type Database struct {
	ID   string `json:"id"`
	Host struct {
		Address string `json:"address"`
		Port    int    `json:"port"`
	} `json:"host"`
	Name            string `json:"name"`
	Username        string `json:"username"`
	ConnectionsFrom string `json:"connections_from"`
	MaxConnections  int    `json:"max_connections"`
}

// --- Nest / Egg Models ---

// Nest represents a nest (game category)
type Nest struct {
	ID          int       `json:"id"`
	UUID        string    `json:"uuid"`
	Author      string    `json:"author"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// Egg represents an egg (game server type)
type Egg struct {
	ID           int               `json:"id"`
	UUID         string            `json:"uuid"`
	Name         string            `json:"name"`
	Nest         int               `json:"nest"`
	Author       string            `json:"author"`
	Description  string            `json:"description"`
	DockerImage  string            `json:"docker_image"`
	DockerImages map[string]string `json:"docker_images,omitempty"`
	Startup      string            `json:"startup"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// EggVariable represents a startup variable
type EggVariable struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	EnvVariable  string `json:"env_variable"`
	DefaultValue string `json:"default_value"`
	ServerValue  string `json:"server_value"`
	IsEditable   bool   `json:"is_editable"`
	Rules        string `json:"rules"`
}

// --- Location Models ---

// Location represents a location
type Location struct {
	ID        int       `json:"id"`
	Short     string    `json:"short"`
	Long      string    `json:"long"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// --- Backup Models ---

// Backup represents a server backup
type Backup struct {
	UUID         string     `json:"uuid"`
	Name         string     `json:"name"`
	IgnoredFiles []string   `json:"ignored_files"`
	SHA256Hash   *string    `json:"sha256_hash"`
	Bytes        int64      `json:"bytes"`
	IsSuccessful bool       `json:"is_successful"`
	IsLocked     bool       `json:"is_locked"`
	CreatedAt    time.Time  `json:"created_at"`
	CompletedAt  *time.Time `json:"completed_at"`
}

// --- File Models ---

// FileObject represents a file or directory
type FileObject struct {
	Name       string     `json:"name"`
	Mode       string     `json:"mode"`
	ModeBits   string     `json:"mode_bits"`
	Size       int64      `json:"size"`
	IsFile     bool       `json:"is_file"`
	IsSymlink  bool       `json:"is_symlink"`
	MimeType   string     `json:"mimetype"`
	CreatedAt  time.Time  `json:"created_at"`
	ModifiedAt *time.Time `json:"modified_at"`
}

// ChmodFileEntry represents a single file permission modification
type ChmodFileEntry struct {
	File string `json:"file"`
	Mode string `json:"mode"`
}

// PullFileRequest represents a request to pull a remote file directly to the server
type PullFileRequest struct {
	URL        string `json:"url"`
	Directory  string `json:"directory,omitempty"`
	Filename   string `json:"filename,omitempty"`
	UseHeader  bool   `json:"use_header,omitempty"`
	Foreground bool   `json:"foreground,omitempty"`
}

// SignedURLResponse represents presigned download or upload URLs from Pterodactyl/Wings
type SignedURLResponse struct {
	URL string `json:"url"`
}

// --- Subuser Models ---

// Subuser represents a server subuser
type Subuser struct {
	UUID        string    `json:"uuid"`
	Username    string    `json:"username"`
	Email       string    `json:"email"`
	Image       string    `json:"image"`
	TwoFactor   bool      `json:"2fa_enabled"`
	CreatedAt   time.Time `json:"created_at"`
	Permissions []string  `json:"permissions"`
}

// --- Startup Variable ---

// StartupVariable represents a startup variable with its current value
type StartupVariable struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	EnvVariable  string `json:"env_variable"`
	DefaultValue string `json:"default_value"`
	ServerValue  string `json:"server_value"`
	IsEditable   bool   `json:"is_editable"`
	Rules        string `json:"rules"`
}

// StartupResponse wraps the startup endpoint response
type StartupResponse struct {
	Object string `json:"object"`
	Data   []struct {
		Object     string          `json:"object"`
		Attributes StartupVariable `json:"attributes"`
	} `json:"data"`
	Meta struct {
		StartupCommand    string            `json:"startup_command"`
		RawStartupCommand string            `json:"raw_startup_command"`
		DockerImages      map[string]string `json:"docker_images"`
	} `json:"meta"`
}

// ServerStartupConfig contains all startup details including variables, commands, and docker images
type ServerStartupConfig struct {
	StartupCommand    string            `json:"startup_command"`
	RawStartupCommand string            `json:"raw_startup_command"`
	DockerImages      map[string]string `json:"docker_images"`
	Variables         []StartupVariable `json:"variables"`
}

// --- Node Allocation (Application API) ---

// NodeAllocation represents a node allocation from the Application API
type NodeAllocation struct {
	ID       int     `json:"id"`
	IP       string  `json:"ip"`
	Alias    *string `json:"alias"`
	Port     int     `json:"port"`
	Notes    *string `json:"notes"`
	Assigned bool    `json:"assigned"`
}

// CreateAllocationRequest represents a request to create allocations on a node
type CreateAllocationRequest struct {
	IP    string   `json:"ip"`
	Ports []string `json:"ports"`
}

// --- Account Models ---

// Account represents the authenticated user account
type Account struct {
	ID         int    `json:"id"`
	Admin      bool   `json:"admin"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	FirstName  string `json:"first_name"`
	LastName   string `json:"last_name"`
	Language   string `json:"language"`
	TwoFactor  bool   `json:"2fa,omitempty"`
	TwoFactor2 bool   `json:"2fa_enabled,omitempty"`
}

// AccountApiKey represents a Client API Key
type AccountApiKey struct {
	Identifier  string     `json:"identifier"`
	Description string     `json:"description"`
	AllowedIPs  []string   `json:"allowed_ips"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	CreatedAt   time.Time  `json:"created_at"`
	SecretToken string     `json:"secret_token,omitempty"`
}

// AccountSSHKey represents a registered SSH public key for SFTP
type AccountSSHKey struct {
	Name        string    `json:"name"`
	Fingerprint string    `json:"fingerprint"`
	PublicKey   string    `json:"public_key"`
	CreatedAt   time.Time `json:"created_at"`
}

// TwoFactorDetails represents TOTP QR code and setup secret
type TwoFactorDetails struct {
	ImageURLData string `json:"image_url_data"`
	Secret       string `json:"secret"`
}

// AccountActivity represents an audit/activity log entry for the account
type AccountActivity struct {
	ID                    string                 `json:"id"`
	Batch                 string                 `json:"batch"`
	Event                 string                 `json:"event"`
	IsAPI                 bool                   `json:"is_api"`
	IP                    string                 `json:"ip"`
	Description           *string                `json:"description"`
	Properties            map[string]interface{} `json:"properties"`
	HasAdditionalMetadata bool                   `json:"has_additional_metadata"`
	Timestamp             time.Time              `json:"timestamp"`
}

// --- Schedule Models ---

// Schedule represents a scheduled task runner
type Schedule struct {
	ID             int            `json:"id"`
	Name           string         `json:"name"`
	Cron           CronExpression `json:"cron"`
	IsActive       bool           `json:"is_active"`
	IsProcessing   bool           `json:"is_processing"`
	OnlyWhenOnline bool           `json:"only_when_online"`
	LastRunAt      *time.Time     `json:"last_run_at"`
	NextRunAt      *time.Time     `json:"next_run_at"`
	CreatedAt      time.Time      `json:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at"`
	Tasks          []ScheduleTask `json:"tasks,omitempty"`
}

// CronExpression represents the 5-field cron timing for schedules
type CronExpression struct {
	DayOfWeek  string `json:"day_of_week"`
	Month      string `json:"month"`
	DayOfMonth string `json:"day_of_month"`
	Hour       string `json:"hour"`
	Minute     string `json:"minute"`
}

// ScheduleTask represents an individual task within a schedule
type ScheduleTask struct {
	ID         int       `json:"id"`
	SequenceID int       `json:"sequence_id"`
	Action     string    `json:"action"` // "command", "power", "backup"
	Payload    string    `json:"payload"`
	TimeOffset int       `json:"time_offset"`
	IsQueued   bool      `json:"is_queued"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

