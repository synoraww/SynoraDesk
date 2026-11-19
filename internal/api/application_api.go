package api

import (
	"context"
	"encoding/json"
	"fmt"
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

// UpdateCredentials updates the API base URL and token
func (a *ApplicationAPI) UpdateCredentials(baseURL, token string) {
	a.http.SetBaseURL(fmt.Sprintf("%s/api/application", baseURL))
	a.http.SetToken(token)
}

// --- Users ---

// ListUsers lists all panel users
func (a *ApplicationAPI) ListUsers(ctx context.Context) ([]User, error) {
	return FetchAllPages[User](ctx, a.http, "/users")
}

// GetUser retrieves a user by ID
func (a *ApplicationAPI) GetUser(ctx context.Context, id int) (*User, error) {
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

// --- Servers ---

// ListServers lists all servers
func (a *ApplicationAPI) ListServers(ctx context.Context) ([]AppServer, error) {
	return FetchAllPages[AppServer](ctx, a.http, "/servers")
}

// GetServer retrieves a server by internal ID
func (a *ApplicationAPI) GetServer(ctx context.Context, id int) (*AppServer, error) {
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

// CreateServer creates a new server
func (a *ApplicationAPI) CreateServer(ctx context.Context, req CreateServerRequest) (*AppServer, error) {
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

// UpdateServerDetails updates server details (name, description, owner)
func (a *ApplicationAPI) UpdateServerDetails(ctx context.Context, id int, req UpdateServerDetailsRequest) (*AppServer, error) {
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

// SuspendServer suspends a server
func (a *ApplicationAPI) SuspendServer(ctx context.Context, id int) error {
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/suspend", id), nil)
	return err
}

// UnsuspendServer unsuspends a server
func (a *ApplicationAPI) UnsuspendServer(ctx context.Context, id int) error {
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/unsuspend", id), nil)
	return err
}

// ReinstallServer reinstalls a server
func (a *ApplicationAPI) ReinstallServer(ctx context.Context, id int) error {
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/servers/%d/reinstall", id), nil)
	return err
}

// DeleteServer deletes a server
func (a *ApplicationAPI) DeleteServer(ctx context.Context, id int) error {
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/servers/%d", id))
	return err
}

// ForceDeleteServer force-deletes a server
func (a *ApplicationAPI) ForceDeleteServer(ctx context.Context, id int) error {
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/servers/%d/force", id))
	return err
}

// --- Nodes ---

// ListNodes lists all nodes
func (a *ApplicationAPI) ListNodes(ctx context.Context) ([]Node, error) {
	return FetchAllPages[Node](ctx, a.http, "/nodes")
}

// GetNode retrieves a node by ID
func (a *ApplicationAPI) GetNode(ctx context.Context, id int) (*Node, error) {
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

// CreateNode creates a new node
func (a *ApplicationAPI) CreateNode(ctx context.Context, req CreateNodeRequest) (*Node, error) {
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
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/nodes/%d", id))
	return err
}

// --- Node Allocations ---

// ListNodeAllocations lists allocations for a node
func (a *ApplicationAPI) ListNodeAllocations(ctx context.Context, nodeID int) ([]NodeAllocation, error) {
	return FetchAllPages[NodeAllocation](ctx, a.http, fmt.Sprintf("/nodes/%d/allocations", nodeID))
}

// CreateNodeAllocations creates allocations for a node
func (a *ApplicationAPI) CreateNodeAllocations(ctx context.Context, nodeID int, req CreateAllocationRequest) error {
	_, _, err := a.http.Post(ctx, fmt.Sprintf("/nodes/%d/allocations", nodeID), req)
	return err
}

// DeleteNodeAllocation deletes an allocation from a node
func (a *ApplicationAPI) DeleteNodeAllocation(ctx context.Context, nodeID, allocationID int) error {
	_, _, err := a.http.Delete(ctx, fmt.Sprintf("/nodes/%d/allocations/%d", nodeID, allocationID))
	return err
}

// --- Locations ---

// ListLocations lists all locations
func (a *ApplicationAPI) ListLocations(ctx context.Context) ([]Location, error) {
	return FetchAllPages[Location](ctx, a.http, "/locations")
}

// --- Nests ---

// ListNests lists all nests
func (a *ApplicationAPI) ListNests(ctx context.Context) ([]Nest, error) {
	return FetchAllPages[Nest](ctx, a.http, "/nests")
}

// GetNest retrieves a nest by ID
func (a *ApplicationAPI) GetNest(ctx context.Context, id int) (*Nest, error) {
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

// ListEggs lists eggs for a nest
func (a *ApplicationAPI) ListEggs(ctx context.Context, nestID int) ([]Egg, error) {
	return FetchAllPages[Egg](ctx, a.http, fmt.Sprintf("/nests/%d/eggs", nestID))
}

// GetEgg retrieves an egg by ID
func (a *ApplicationAPI) GetEgg(ctx context.Context, nestID, eggID int) (*Egg, error) {
	data, _, err := a.http.Get(ctx, fmt.Sprintf("/nests/%d/eggs/%d", nestID, eggID))
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
