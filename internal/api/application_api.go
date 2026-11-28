package api

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"pterodesk/internal/security"
)

// ApplicationAPI wraps the Pterodactyl Application API (/api/application)
type ApplicationAPI struct {
	http *HTTPClient
}

// NewApplicationAPI creates a new Application API wrapper
func NewApplicationAPI(baseURL, token string) *ApplicationAPI {
	return &ApplicationAPI{
		http: NewHTTPClient(ClientConfig{
			BaseURL: fmt.Sprintf("%s/api/application", baseURL),
			Token:   token,
		}),
	}
}

// NewApplicationAPIWithConfig creates an Application API wrapper with custom ClientConfig
func NewApplicationAPIWithConfig(cfg ClientConfig) *ApplicationAPI {
	cfg.BaseURL = fmt.Sprintf("%s/api/application", cfg.BaseURL)
	return &ApplicationAPI{
		http: NewHTTPClient(cfg),
	}
}

// GetLastLatencyMs returns the roundtrip latency of the last request
func (a *ApplicationAPI) GetLastLatencyMs() int64 {
	if a.http == nil {
		return 0
	}
	return a.http.GetLastLatencyMs()
}

// UpdateCredentials updates the API base URL and token
func (a *ApplicationAPI) UpdateCredentials(baseURL, token string) {
	a.http.SetBaseURL(fmt.Sprintf("%s/api/application", baseURL))
	a.http.SetToken(token)
}

// --- Users ---

// ListUsers lists all panel users (legacy unpaginated helper)
func (a *ApplicationAPI) ListUsers(ctx context.Context) ([]User, error) {
	return FetchAllPages[User](ctx, a.http, "/users")
}

// ListUsersPage lists panel users with server-side pagination and filtering
func (a *ApplicationAPI) ListUsersPage(ctx context.Context, opts ListOptions) (*PaginatedResult[User], error) {
	return FetchPage[User](ctx, a.http, "/users", opts)
}

// GetUser retrieves a user by ID
func (a *ApplicationAPI) GetUser(ctx context.Context, id int) (*User, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid user id: %d", id)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/users/%d", id))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[User]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse user response: %w", err)
	}
	return &resp.Attributes, nil
}

// GetUserByExternalID retrieves a user by external ID
func (a *ApplicationAPI) GetUserByExternalID(ctx context.Context, externalID string) (*User, error) {
	ext := strings.TrimSpace(externalID)
	if err := security.ValidatePathIdentifier(ext); err != nil {
		return nil, fmt.Errorf("invalid external_id: %w", err)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/users/external/%s", url.PathEscape(ext)))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[User]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse user response: %w", err)
	}
	return &resp.Attributes, nil
}

func validateUserFields(email, username, firstName, lastName string) error {
	e := strings.TrimSpace(email)
	if e == "" || !strings.Contains(e, "@") || !strings.Contains(e, ".") {
		return fmt.Errorf("valid email address is required")
	}
	if strings.TrimSpace(username) == "" {
		return fmt.Errorf("username is required")
	}
	if strings.TrimSpace(firstName) == "" {
		return fmt.Errorf("first_name is required")
	}
	if strings.TrimSpace(lastName) == "" {
		return fmt.Errorf("last_name is required")
	}
	return nil
}

// CreateUser creates a new panel user
func (a *ApplicationAPI) CreateUser(ctx context.Context, req CreateUserRequest) (*User, error) {
	if err := validateUserFields(req.Email, req.Username, req.FirstName, req.LastName); err != nil {
		return nil, err
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Username = strings.TrimSpace(req.Username)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	if strings.TrimSpace(req.Language) == "" {
		req.Language = "en"
	}

	data, _, err := a.http.Post(ctx, "/users", req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[User]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse create user response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateUser updates an existing panel user
func (a *ApplicationAPI) UpdateUser(ctx context.Context, id int, req UpdateUserRequest) (*User, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid user id: %d", id)
	}
	if err := validateUserFields(req.Email, req.Username, req.FirstName, req.LastName); err != nil {
		return nil, err
	}
	req.Email = strings.TrimSpace(req.Email)
	req.Username = strings.TrimSpace(req.Username)
	req.FirstName = strings.TrimSpace(req.FirstName)
	req.LastName = strings.TrimSpace(req.LastName)
	if strings.TrimSpace(req.Language) == "" {
		req.Language = "en"
	}

	data, _, err := a.http.Patch(ctx, fmt.Sprintf("/users/%d", id), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[User]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse update user response: %w", err)
	}
	return &resp.Attributes, nil
}

// DeleteUser deletes a panel user
func (a *ApplicationAPI) DeleteUser(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid user id: %d", id)
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/users/%d", id))
	return err
}

// --- Servers ---

// ListServers lists all servers (legacy unpaginated helper)
func (a *ApplicationAPI) ListServers(ctx context.Context) ([]AppServer, error) {
	return FetchAllPages[AppServer](ctx, a.http, "/servers")
}

// ListServersPage lists servers with server-side pagination, filtering, and includes
func (a *ApplicationAPI) ListServersPage(ctx context.Context, opts ListOptions) (*PaginatedResult[AppServer], error) {
	return FetchPage[AppServer](ctx, a.http, "/servers", opts)
}

// GetServer retrieves a server by internal ID
func (a *ApplicationAPI) GetServer(ctx context.Context, id int) (*AppServer, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid server id: %d", id)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/servers/%d", id))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppServer]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse server response: %w", err)
	}
	return &resp.Attributes, nil
}

// GetServerByExternalID retrieves a server by external ID
func (a *ApplicationAPI) GetServerByExternalID(ctx context.Context, externalID string) (*AppServer, error) {
	ext := strings.TrimSpace(externalID)
	if err := security.ValidatePathIdentifier(ext); err != nil {
		return nil, fmt.Errorf("invalid external_id: %w", err)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/servers/external/%s", url.PathEscape(ext)))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppServer]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse server response: %w", err)
	}
	return &resp.Attributes, nil
}

// CreateServer creates a new server
func (a *ApplicationAPI) CreateServer(ctx context.Context, req CreateServerRequest) (*AppServer, error) {
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("server name is required")
	}
	if req.User <= 0 {
		return nil, fmt.Errorf("valid user id is required")
	}
	if req.Egg <= 0 {
		return nil, fmt.Errorf("valid egg id is required")
	}
	if req.Allocation.Default <= 0 {
		return nil, fmt.Errorf("default allocation id is required")
	}
	if strings.TrimSpace(req.DockerImage) == "" {
		return nil, fmt.Errorf("docker_image is required")
	}
	if strings.TrimSpace(req.Startup) == "" {
		return nil, fmt.Errorf("startup command is required")
	}
	if req.Environment == nil {
		req.Environment = map[string]interface{}{}
	}
	req.Name = strings.TrimSpace(req.Name)

	data, _, err := a.http.Post(ctx, "/servers", req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppServer]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse create server response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateServerDetails updates server details (name, description, owner, external_id)
func (a *ApplicationAPI) UpdateServerDetails(ctx context.Context, id int, req UpdateServerDetailsRequest) (*AppServer, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid server id: %d", id)
	}
	if strings.TrimSpace(req.Name) == "" {
		return nil, fmt.Errorf("server name is required")
	}
	if req.User <= 0 {
		return nil, fmt.Errorf("valid user id is required")
	}
	req.Name = strings.TrimSpace(req.Name)

	data, _, err := a.http.Patch(ctx, fmt.Sprintf("/servers/%d/details", id), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppServer]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse update server response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateServerBuild updates server build configuration
func (a *ApplicationAPI) UpdateServerBuild(ctx context.Context, id int, req UpdateServerBuildRequest) (*AppServer, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid server id: %d", id)
	}
	if req.Allocation <= 0 {
		return nil, fmt.Errorf("allocation id is required")
	}
	data, _, err := a.http.Patch(ctx, fmt.Sprintf("/servers/%d/build", id), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppServer]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse update build response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateServerStartup updates server startup command, egg, docker image, and environment
func (a *ApplicationAPI) UpdateServerStartup(ctx context.Context, id int, req UpdateServerStartupRequest) (*AppServer, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid server id: %d", id)
	}
	if strings.TrimSpace(req.Startup) == "" {
		return nil, fmt.Errorf("startup command is required")
	}
	if req.Egg <= 0 {
		return nil, fmt.Errorf("valid egg id is required")
	}
	if strings.TrimSpace(req.Image) == "" {
		return nil, fmt.Errorf("docker image is required")
	}
	if req.Environment == nil {
		req.Environment = map[string]interface{}{}
	}
	data, _, err := a.http.Patch(ctx, fmt.Sprintf("/servers/%d/startup", id), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppServer]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse update startup response: %w", err)
	}
	return &resp.Attributes, nil
}

// SuspendServer suspends a server
func (a *ApplicationAPI) SuspendServer(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid server id: %d", id)
	}
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/suspend", id), nil)
	return err
}

// UnsuspendServer unsuspends a server
func (a *ApplicationAPI) UnsuspendServer(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid server id: %d", id)
	}
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/unsuspend", id), nil)
	return err
}

// ReinstallServer reinstalls a server
func (a *ApplicationAPI) ReinstallServer(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid server id: %d", id)
	}
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/reinstall", id), nil)
	return err
}

// DeleteServer deletes a server
func (a *ApplicationAPI) DeleteServer(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid server id: %d", id)
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/servers/%d", id))
	return err
}

// ForceDeleteServer force-deletes a server
func (a *ApplicationAPI) ForceDeleteServer(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid server id: %d", id)
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/servers/%d/force", id))
	return err
}

// --- Nodes ---

// ListNodes lists all nodes (legacy unpaginated helper)
func (a *ApplicationAPI) ListNodes(ctx context.Context) ([]Node, error) {
	return FetchAllPages[Node](ctx, a.http, "/nodes")
}

// ListNodesPage lists nodes with server-side pagination and filtering
func (a *ApplicationAPI) ListNodesPage(ctx context.Context, opts ListOptions) (*PaginatedResult[Node], error) {
	return FetchPage[Node](ctx, a.http, "/nodes", opts)
}

// GetNode retrieves a node by ID
func (a *ApplicationAPI) GetNode(ctx context.Context, id int) (*Node, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid node id: %d", id)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/nodes/%d", id))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Node]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse node response: %w", err)
	}
	return &resp.Attributes, nil
}

// GetNodeConfiguration retrieves the Wings daemon configuration for a node
func (a *ApplicationAPI) GetNodeConfiguration(ctx context.Context, id int) (*NodeConfiguration, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid node id: %d", id)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/nodes/%d/configuration", id))
	if err != nil {
		return nil, err
	}
	var cfg NodeConfiguration
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse node configuration: %w", err)
	}
	return &cfg, nil
}

func validateNodeRequest(req CreateNodeRequest) error {
	if strings.TrimSpace(req.Name) == "" {
		return fmt.Errorf("node name is required")
	}
	if req.LocationID <= 0 {
		return fmt.Errorf("valid location_id is required")
	}
	if strings.TrimSpace(req.FQDN) == "" {
		return fmt.Errorf("fqdn is required")
	}
	if req.Scheme != "http" && req.Scheme != "https" {
		return fmt.Errorf("scheme must be 'http' or 'https'")
	}
	if req.Memory <= 0 || req.Disk <= 0 {
		return fmt.Errorf("memory and disk must be greater than 0")
	}
	if req.DaemonListen <= 0 || req.DaemonSFTP <= 0 {
		return fmt.Errorf("daemon_listen and daemon_sftp ports must be greater than 0")
	}
	return nil
}

// CreateNode creates a new node
func (a *ApplicationAPI) CreateNode(ctx context.Context, req CreateNodeRequest) (*Node, error) {
	if err := validateNodeRequest(req); err != nil {
		return nil, err
	}
	req.Name = strings.TrimSpace(req.Name)
	req.FQDN = strings.TrimSpace(req.FQDN)
	data, _, err := a.http.Post(ctx, "/nodes", req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Node]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse create node response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateNode updates a node
func (a *ApplicationAPI) UpdateNode(ctx context.Context, id int, req CreateNodeRequest) (*Node, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid node id: %d", id)
	}
	if err := validateNodeRequest(req); err != nil {
		return nil, err
	}
	req.Name = strings.TrimSpace(req.Name)
	req.FQDN = strings.TrimSpace(req.FQDN)
	data, _, err := a.http.Patch(ctx, fmt.Sprintf("/nodes/%d", id), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Node]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse update node response: %w", err)
	}
	return &resp.Attributes, nil
}

// DeleteNode deletes a node
func (a *ApplicationAPI) DeleteNode(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid node id: %d", id)
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/nodes/%d", id))
	return err
}

// --- Node Allocations ---

// ListNodeAllocations lists allocations for a node (legacy unpaginated helper)
func (a *ApplicationAPI) ListNodeAllocations(ctx context.Context, nodeID int) ([]NodeAllocation, error) {
	return FetchAllPages[NodeAllocation](ctx, a.http, fmt.Sprintf("/nodes/%d/allocations", nodeID))
}

// ListNodeAllocationsPage lists allocations for a node with server-side pagination and filters
func (a *ApplicationAPI) ListNodeAllocationsPage(ctx context.Context, nodeID int, opts ListOptions) (*PaginatedResult[NodeAllocation], error) {
	if nodeID <= 0 {
		return nil, fmt.Errorf("invalid node id: %d", nodeID)
	}
	return FetchPage[NodeAllocation](ctx, a.http, fmt.Sprintf("/nodes/%d/allocations", nodeID), opts)
}

// CreateNodeAllocations creates allocations for a node
func (a *ApplicationAPI) CreateNodeAllocations(ctx context.Context, nodeID int, req CreateAllocationRequest) error {
	if nodeID <= 0 {
		return fmt.Errorf("invalid node id: %d", nodeID)
	}
	req.IP = strings.TrimSpace(req.IP)
	req.Alias = strings.TrimSpace(req.Alias)
	if req.IP == "" {
		return fmt.Errorf("ip address is required")
	}
	if len(req.Ports) == 0 {
		return fmt.Errorf("at least one port or port range is required")
	}
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/nodes/%d/allocations", nodeID), req)
	return err
}

// DeleteNodeAllocation deletes an allocation from a node
func (a *ApplicationAPI) DeleteNodeAllocation(ctx context.Context, nodeID, allocationID int) error {
	if nodeID <= 0 || allocationID <= 0 {
		return fmt.Errorf("invalid node or allocation id")
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/nodes/%d/allocations/%d", nodeID, allocationID))
	return err
}

// --- Server Databases (Application API) ---

// ListServerDatabases lists databases for a server via Application API
func (a *ApplicationAPI) ListServerDatabases(ctx context.Context, serverID int, opts ListOptions) (*PaginatedResult[AppDatabase], error) {
	if serverID <= 0 {
		return nil, fmt.Errorf("invalid server id: %d", serverID)
	}
	return FetchPage[AppDatabase](ctx, a.http, fmt.Sprintf("/servers/%d/databases", serverID), opts)
}

// GetServerDatabase retrieves a single server database (optionally including password/host)
func (a *ApplicationAPI) GetServerDatabase(ctx context.Context, serverID, databaseID int, includePassword bool) (*AppDatabase, error) {
	if serverID <= 0 || databaseID <= 0 {
		return nil, fmt.Errorf("invalid server or database id")
	}
	path := fmt.Sprintf("/servers/%d/databases/%d?include=host", serverID, databaseID)
	if includePassword {
		path = fmt.Sprintf("/servers/%d/databases/%d?include=host,password", serverID, databaseID)
	}
	data, _, err := a.http.Get(ctx, path)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppDatabase]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse database response: %w", err)
	}
	return &resp.Attributes, nil
}

// CreateServerDatabase creates a database for a server via Application API
func (a *ApplicationAPI) CreateServerDatabase(ctx context.Context, serverID int, req CreateAppDatabaseRequest) (*AppDatabase, error) {
	if serverID <= 0 {
		return nil, fmt.Errorf("invalid server id: %d", serverID)
	}
	req.Database = strings.TrimSpace(req.Database)
	req.Remote = strings.TrimSpace(req.Remote)
	if req.Database == "" {
		return nil, fmt.Errorf("database name is required")
	}
	if req.Remote == "" {
		req.Remote = "%"
	}
	if req.Host <= 0 {
		return nil, fmt.Errorf("valid database host id is required")
	}
	data, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/databases", serverID), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AppDatabase]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse create database response: %w", err)
	}
	return &resp.Attributes, nil
}

// ResetServerDatabasePassword rotates the password of a server database
func (a *ApplicationAPI) ResetServerDatabasePassword(ctx context.Context, serverID, databaseID int) error {
	if serverID <= 0 || databaseID <= 0 {
		return fmt.Errorf("invalid server or database id")
	}
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/databases/%d/reset-password", serverID, databaseID), nil)
	return err
}

// DeleteServerDatabase deletes a server database
func (a *ApplicationAPI) DeleteServerDatabase(ctx context.Context, serverID, databaseID int) error {
	if serverID <= 0 || databaseID <= 0 {
		return fmt.Errorf("invalid server or database id")
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/servers/%d/databases/%d", serverID, databaseID))
	return err
}

// --- Locations ---

// ListLocations lists all locations (legacy unpaginated helper)
func (a *ApplicationAPI) ListLocations(ctx context.Context) ([]Location, error) {
	return FetchAllPages[Location](ctx, a.http, "/locations")
}

// ListLocationsPage lists locations with server-side pagination and filtering
func (a *ApplicationAPI) ListLocationsPage(ctx context.Context, opts ListOptions) (*PaginatedResult[Location], error) {
	return FetchPage[Location](ctx, a.http, "/locations", opts)
}

// GetLocation retrieves a location by ID
func (a *ApplicationAPI) GetLocation(ctx context.Context, id int) (*Location, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid location id: %d", id)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/locations/%d", id))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Location]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse location response: %w", err)
	}
	return &resp.Attributes, nil
}

// CreateLocation creates a new location
func (a *ApplicationAPI) CreateLocation(ctx context.Context, req CreateLocationRequest) (*Location, error) {
	req.Short = strings.TrimSpace(req.Short)
	req.Long = strings.TrimSpace(req.Long)
	if req.Short == "" {
		return nil, fmt.Errorf("short code is required")
	}
	data, _, err := a.http.Post(ctx, "/locations", req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Location]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse create location response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateLocation updates an existing location
func (a *ApplicationAPI) UpdateLocation(ctx context.Context, id int, req CreateLocationRequest) (*Location, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid location id: %d", id)
	}
	req.Short = strings.TrimSpace(req.Short)
	req.Long = strings.TrimSpace(req.Long)
	if req.Short == "" {
		return nil, fmt.Errorf("short code is required")
	}
	data, _, err := a.http.Patch(ctx, fmt.Sprintf("/locations/%d", id), req)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Location]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse update location response: %w", err)
	}
	return &resp.Attributes, nil
}

// DeleteLocation deletes a location
func (a *ApplicationAPI) DeleteLocation(ctx context.Context, id int) error {
	if id <= 0 {
		return fmt.Errorf("invalid location id: %d", id)
	}
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/locations/%d", id))
	return err
}

// --- Nests ---

// ListNests lists all nests (legacy unpaginated helper)
func (a *ApplicationAPI) ListNests(ctx context.Context) ([]Nest, error) {
	return FetchAllPages[Nest](ctx, a.http, "/nests")
}

// ListNestsPage lists nests with server-side pagination
func (a *ApplicationAPI) ListNestsPage(ctx context.Context, opts ListOptions) (*PaginatedResult[Nest], error) {
	return FetchPage[Nest](ctx, a.http, "/nests", opts)
}

// GetNest retrieves a nest by ID
func (a *ApplicationAPI) GetNest(ctx context.Context, id int) (*Nest, error) {
	if id <= 0 {
		return nil, fmt.Errorf("invalid nest id: %d", id)
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/nests/%d", id))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Nest]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse nest response: %w", err)
	}
	return &resp.Attributes, nil
}

// --- Eggs ---

// ListEggs lists eggs for a nest (legacy unpaginated helper)
func (a *ApplicationAPI) ListEggs(ctx context.Context, nestID int) ([]Egg, error) {
	return FetchAllPages[Egg](ctx, a.http, fmt.Sprintf("/nests/%d/eggs", nestID))
}

// ListEggsPage lists eggs for a nest with pagination & includes
func (a *ApplicationAPI) ListEggsPage(ctx context.Context, nestID int, opts ListOptions) (*PaginatedResult[Egg], error) {
	if nestID <= 0 {
		return nil, fmt.Errorf("invalid nest id: %d", nestID)
	}
	return FetchPage[Egg](ctx, a.http, fmt.Sprintf("/nests/%d/eggs", nestID), opts)
}

// GetEgg retrieves an egg by ID (including variables, config, script)
func (a *ApplicationAPI) GetEgg(ctx context.Context, nestID, eggID int) (*Egg, error) {
	if nestID <= 0 || eggID <= 0 {
		return nil, fmt.Errorf("invalid nest or egg id")
	}
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/nests/%d/eggs/%d?include=variables,config,script", nestID, eggID))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Egg]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse egg response: %w", err)
	}
	return &resp.Attributes, nil
}

// TestConnection tests if the Application API is accessible
func (a *ApplicationAPI) TestConnection(ctx context.Context) error {
	_, _, err := a.http.Get(ctx, "/users?per_page=1")
	return err
}

func (a *ApplicationAPI) probeEndpoint(ctx context.Context, probeClient *HTTPClient, path string, maxAttempts int) ([]byte, PermissionProbeStatus) {
	if maxAttempts < 1 {
		maxAttempts = 1
	}
	var lastErr error
	var lastCode int

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		if attempt > 1 {
			select {
			case <-ctx.Done():
				return nil, PermissionProbeStatus{Allowed: false, StatusCode: lastCode, Error: ctx.Err().Error(), Attempts: attempt - 1}
			case <-time.After(250 * time.Millisecond):
			}
		}

		data, status, err := probeClient.Get(ctx, path)
		if err == nil {
			return data, PermissionProbeStatus{Allowed: true, StatusCode: status, Attempts: attempt}
		}

		lastErr = err
		var apiErr *APIError
		if errors.As(err, &apiErr) {
			lastCode = apiErr.StatusCode
			// Deterministic client errors (401/403/404) do not need retries
			if apiErr.StatusCode == 401 || apiErr.StatusCode == 403 || apiErr.StatusCode == 404 {
				return nil, PermissionProbeStatus{
					Allowed:    false,
					StatusCode: apiErr.StatusCode,
					Error:      apiErr.Message,
					Attempts:   attempt,
				}
			}
		}
	}

	errMsg := "connection failed"
	if lastErr != nil {
		errMsg = lastErr.Error()
	}
	return nil, PermissionProbeStatus{
		Allowed:    false,
		StatusCode: lastCode,
		Error:      errMsg,
		Attempts:   maxAttempts,
	}
}

// ProbePermissions verifies read access across Application API resources (up to 3 attempts on connection/5xx failure)
func (a *ApplicationAPI) ProbePermissions(ctx context.Context) map[string]PermissionProbeStatus {
	a.http.mu.RLock()
	cfg := a.http.config
	a.http.mu.RUnlock()

	// Use a single-attempt HTTPClient (-1 disables inner retries) so our probe loop controls exact max 3 attempts
	cfg.MaxRetries = -1
	cfg.Timeout = 8 * time.Second
	probeClient := NewHTTPClient(cfg)

	results := make(map[string]PermissionProbeStatus)

	// 1. Users
	_, results["users"] = a.probeEndpoint(ctx, probeClient, "/users?per_page=1", 3)

	// 2. Servers + Databases
	srvData, srvStatus := a.probeEndpoint(ctx, probeClient, "/servers?per_page=1", 3)
	results["servers"] = srvStatus
	if srvStatus.Allowed {
		var srvResp PaginatedResponse[AppServer]
		if err := json.Unmarshal(srvData, &srvResp); err == nil && len(srvResp.Data) > 0 {
			firstSrvID := srvResp.Data[0].Attributes.ID
			_, results["databases"] = a.probeEndpoint(ctx, probeClient, fmt.Sprintf("/servers/%d/databases?per_page=1", firstSrvID), 3)
		} else {
			results["databases"] = srvStatus
		}
	} else {
		results["databases"] = srvStatus
	}

	// 3. Nodes + Allocations
	nodeData, nodeStatus := a.probeEndpoint(ctx, probeClient, "/nodes?per_page=1", 3)
	results["nodes"] = nodeStatus
	if nodeStatus.Allowed {
		var nodeResp PaginatedResponse[Node]
		if err := json.Unmarshal(nodeData, &nodeResp); err == nil && len(nodeResp.Data) > 0 {
			firstNodeID := nodeResp.Data[0].Attributes.ID
			_, results["allocations"] = a.probeEndpoint(ctx, probeClient, fmt.Sprintf("/nodes/%d/allocations?per_page=1", firstNodeID), 3)
		} else {
			results["allocations"] = nodeStatus
		}
	} else {
		results["allocations"] = nodeStatus
	}

	// 4. Locations
	_, results["locations"] = a.probeEndpoint(ctx, probeClient, "/locations?per_page=1", 3)

	// 5. Nests & Eggs
	_, results["nests"] = a.probeEndpoint(ctx, probeClient, "/nests?per_page=1", 3)

	return results
}

// CheckNodeHealth pings a Wings node endpoint directly to measure reachability and roundtrip latency in ms
func CheckNodeHealth(ctx context.Context, node Node, transport http.RoundTripper) NodeHealthStatus {
	scheme := strings.ToLower(strings.TrimSpace(node.Scheme))
	if scheme != "http" && scheme != "https" {
		scheme = "https"
	}
	fqdn := strings.TrimSpace(node.FQDN)
	if err := security.ValidateHostOrFQDN(fqdn); err != nil {
		return NodeHealthStatus{
			NodeID:    node.ID,
			Reachable: false,
			Error:     err.Error(),
			CheckedAt: time.Now().UTC().Format(time.RFC3339),
		}
	}
	targetURL := fmt.Sprintf("%s://%s:%d/api/system", scheme, fqdn, node.DaemonListen)

	client := &http.Client{
		Timeout: 4 * time.Second,
		CheckRedirect: func(r *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	if transport != nil {
		client.Transport = transport
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return NodeHealthStatus{
			NodeID:    node.ID,
			Reachable: false,
			Error:     err.Error(),
			CheckedAt: time.Now().UTC().Format(time.RFC3339),
		}
	}

	start := time.Now()
	resp, err := client.Do(req)
	elapsedMs := time.Since(start).Milliseconds()
	if err != nil {
		return NodeHealthStatus{
			NodeID:    node.ID,
			Reachable: false,
			LatencyMs: elapsedMs,
			Error:     err.Error(),
			CheckedAt: time.Now().UTC().Format(time.RFC3339),
		}
	}
	resp.Body.Close()

	return NodeHealthStatus{
		NodeID:     node.ID,
		Reachable:  resp.StatusCode < 500,
		LatencyMs:  elapsedMs,
		StatusCode: resp.StatusCode,
		CheckedAt:  time.Now().UTC().Format(time.RFC3339),
	}
}

// CheckNodesHealth concurrently checks health & latency for a slice of nodes
func CheckNodesHealth(ctx context.Context, nodes []Node, transport http.RoundTripper) map[int]NodeHealthStatus {
	results := make(map[int]NodeHealthStatus, len(nodes))
	var mu sync.Mutex
	var wg sync.WaitGroup

	for _, n := range nodes {
		wg.Add(1)
		go func(nd Node) {
			defer wg.Done()
			st := CheckNodeHealth(ctx, nd, transport)
			mu.Lock()
			results[nd.ID] = st
			mu.Unlock()
		}(n)
	}
	wg.Wait()
	return results
}
