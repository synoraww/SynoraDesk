package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// ClientAPI wraps the Pterodactyl Client API (/api/client)
type ClientAPI struct {
	http *HTTPClient
}

// NewClientAPI creates a new Client API wrapper
func NewClientAPI(baseURL, token string) *ClientAPI {
	return &ClientAPI{
		http: NewHTTPClient(ClientConfig{
			BaseURL: fmt.Sprintf("%s/api/client", baseURL),
			Token:   token,
		}),
	}
}

// UpdateCredentials updates the API base URL and token
func (c *ClientAPI) UpdateCredentials(baseURL, token string) {
	c.http.SetBaseURL(fmt.Sprintf("%s/api/client", baseURL))
	c.http.SetToken(token)
}

// --- Account ---

// GetAccount retrieves the authenticated user's account
func (c *ClientAPI) GetAccount(ctx context.Context) (*Account, error) {
	data, _, err := c.http.Get(ctx, "/account")
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Account]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse account response: %w", err)
	}
	acc := resp.Attributes
	if acc.TwoFactor2 {
		acc.TwoFactor = true
	}
	return &acc, nil
}

// UpdateEmail updates the client account email
func (c *ClientAPI) UpdateEmail(ctx context.Context, email, password string) error {
	body := map[string]string{
		"email":    email,
		"password": password,
	}
	_, _, err := c.http.Put(ctx, "/account/email", body)
	return err
}

// UpdatePassword updates the client account password
func (c *ClientAPI) UpdatePassword(ctx context.Context, currentPassword, newPassword, confirmPassword string) error {
	body := map[string]string{
		"current_password":      currentPassword,
		"password":              newPassword,
		"password_confirmation": confirmPassword,
	}
	_, _, err := c.http.Put(ctx, "/account/password", body)
	return err
}

// GetTwoFactorDetails retrieves TOTP setup data (image_url_data and secret)
func (c *ClientAPI) GetTwoFactorDetails(ctx context.Context) (*TwoFactorDetails, error) {
	data, _, err := c.http.Get(ctx, "/account/two-factor")
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data TwoFactorDetails `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse two-factor details: %w", err)
	}
	return &resp.Data, nil
}

// EnableTwoFactor verifies TOTP code and enables 2FA, returning backup recovery tokens
func (c *ClientAPI) EnableTwoFactor(ctx context.Context, code string) ([]string, error) {
	body := map[string]string{
		"code": code,
	}
	data, _, err := c.http.Post(ctx, "/account/two-factor", body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Object     string `json:"object"`
		Attributes struct {
			Tokens []string `json:"tokens"`
		} `json:"attributes"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse recovery tokens: %w", err)
	}
	return resp.Attributes.Tokens, nil
}

// DisableTwoFactor disables 2FA using account password
func (c *ClientAPI) DisableTwoFactor(ctx context.Context, password string) error {
	body := map[string]string{
		"password": password,
	}
	_, status, err := c.http.DeleteWithBody(ctx, "/account/two-factor", body)
	if err != nil && status == 405 {
		// Fallback to POST if server/proxy rejects DELETE with body
		_, _, err = c.http.Post(ctx, "/account/two-factor", body)
	}
	return err
}

// ListAPIKeys lists client API keys
func (c *ClientAPI) ListAPIKeys(ctx context.Context) ([]AccountApiKey, error) {
	data, _, err := c.http.Get(ctx, "/account/api-keys")
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[AccountApiKey]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse api keys response: %w", err)
	}
	var keys []AccountApiKey
	for _, item := range resp.Data {
		keys = append(keys, item.Attributes)
	}
	return keys, nil
}

// CreateAPIKey generates a new client API key
func (c *ClientAPI) CreateAPIKey(ctx context.Context, description string, allowedIPs []string) (*AccountApiKey, error) {
	if allowedIPs == nil {
		allowedIPs = []string{}
	}
	body := map[string]interface{}{
		"description": description,
		"allowed_ips": allowedIPs,
	}
	data, _, err := c.http.Post(ctx, "/account/api-keys", body)
	if err != nil {
		return nil, err
	}
	var resp struct {
		Object     string        `json:"object"`
		Attributes AccountApiKey `json:"attributes"`
		Meta       struct {
			SecretToken string `json:"secret_token"`
		} `json:"meta"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse api key creation response: %w", err)
	}
	key := resp.Attributes
	if key.SecretToken == "" && resp.Meta.SecretToken != "" {
		key.SecretToken = resp.Meta.SecretToken
	}
	return &key, nil
}

// DeleteAPIKey revokes a client API key
func (c *ClientAPI) DeleteAPIKey(ctx context.Context, identifier string) error {
	_, _, err := c.http.Delete(ctx, fmt.Sprintf("/account/api-keys/%s", identifier))
	return err
}

// ListSSHKeys lists client SSH public keys
func (c *ClientAPI) ListSSHKeys(ctx context.Context) ([]AccountSSHKey, error) {
	data, _, err := c.http.Get(ctx, "/account/ssh-keys")
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[AccountSSHKey]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse ssh keys response: %w", err)
	}
	var keys []AccountSSHKey
	for _, item := range resp.Data {
		keys = append(keys, item.Attributes)
	}
	return keys, nil
}

// CreateSSHKey adds an SSH key to the client account
func (c *ClientAPI) CreateSSHKey(ctx context.Context, name, publicKey string) (*AccountSSHKey, error) {
	body := map[string]string{
		"name":       name,
		"public_key": publicKey,
	}
	data, _, err := c.http.Post(ctx, "/account/ssh-keys", body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[AccountSSHKey]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse ssh key creation response: %w", err)
	}
	return &resp.Attributes, nil
}

// RemoveSSHKey deletes an SSH key by fingerprint
func (c *ClientAPI) RemoveSSHKey(ctx context.Context, fingerprint string) error {
	body := map[string]string{
		"fingerprint": fingerprint,
	}
	_, status, err := c.http.Post(ctx, "/account/ssh-keys/remove", body)
	if err != nil && (status == 404 || status == 405) {
		// Fallback to DELETE /account/ssh-keys/{fingerprint}
		_, _, err = c.http.Delete(ctx, fmt.Sprintf("/account/ssh-keys/%s", fingerprint))
	}
	return err
}

// GetAccountActivity retrieves activity log for the account
func (c *ClientAPI) GetAccountActivity(ctx context.Context) ([]AccountActivity, error) {
	data, _, err := c.http.Get(ctx, "/account/activity")
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[AccountActivity]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse account activity response: %w", err)
	}
	var logs []AccountActivity
	for _, item := range resp.Data {
		logs = append(logs, item.Attributes)
	}
	return logs, nil
}

// --- Servers ---

// formatEggFromDocker attempts to extract an egg or runtime name from docker image
func formatEggFromDocker(dockerImage string) string {
	lower := strings.ToLower(dockerImage)
	if strings.Contains(lower, "java_21") {
		return "Java 21"
	}
	if strings.Contains(lower, "java_17") {
		return "Java 17"
	}
	if strings.Contains(lower, "java_8") {
		return "Java 8"
	}
	if strings.Contains(lower, "java") {
		return "Java"
	}
	if strings.Contains(lower, "nodejs") || strings.Contains(lower, "node") {
		return "Node.js"
	}
	if strings.Contains(lower, "python") {
		return "Python"
	}
	if strings.Contains(lower, "rust") {
		return "Rust"
	}
	if strings.Contains(lower, "golang") || strings.Contains(lower, "go:") {
		return "Go"
	}
	if strings.Contains(lower, "minecraft") || strings.Contains(lower, "paper") {
		return "Minecraft"
	}
	parts := strings.Split(dockerImage, "/")
	last := parts[len(parts)-1]
	if idx := strings.Index(last, ":"); idx != -1 {
		last = last[:idx]
	}
	return strings.Title(strings.TrimSpace(last))
}

type serverItemResponse struct {
	Object     string `json:"object"`
	Attributes Server `json:"attributes"`
	Meta       struct {
		IsServerOwner   bool     `json:"is_server_owner"`
		UserPermissions []string `json:"user_permissions"`
	} `json:"meta"`
}

type serverListResponse struct {
	Object string               `json:"object"`
	Data   []serverItemResponse `json:"data"`
	Meta   struct {
		Pagination PaginationMeta `json:"pagination"`
	} `json:"meta"`
}

// ListServers lists all servers accessible to the user
func (c *ClientAPI) ListServers(ctx context.Context) ([]Server, error) {
	var allServers []Server
	page := 1

	for {
		pagedPath := fmt.Sprintf("?include=egg,allocations&page=%d", page)
		data, _, err := c.http.Get(ctx, pagedPath)
		if err != nil {
			return nil, err
		}

		var resp serverListResponse
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, fmt.Errorf("failed to unmarshal paginated response: %w", err)
		}

		for _, item := range resp.Data {
			srv := item.Attributes
			if srv.ServerOwner {
				srv.UserPermissions = []string{"*"}
			} else if len(item.Meta.UserPermissions) > 0 {
				srv.UserPermissions = item.Meta.UserPermissions
			}
			if srv.Relationships != nil && srv.Relationships.Egg != nil && srv.Relationships.Egg.Attributes.Name != "" {
				srv.EggName = srv.Relationships.Egg.Attributes.Name
			}
			if srv.EggName == "" && srv.DockerImage != "" {
				srv.EggName = formatEggFromDocker(srv.DockerImage)
			}
			if srv.Relationships != nil && srv.Relationships.Allocations != nil {
				for _, allocData := range srv.Relationships.Allocations.Data {
					srv.Allocations = append(srv.Allocations, allocData.Attributes)
				}
			}
			allServers = append(allServers, srv)
		}

		if page >= resp.Meta.Pagination.TotalPages || resp.Meta.Pagination.TotalPages == 0 {
			break
		}
		page++
	}

	return allServers, nil
}

// GetServer retrieves a specific server by identifier
func (c *ClientAPI) GetServer(ctx context.Context, identifier string) (*Server, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s?include=egg,allocations,subusers", identifier))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Server]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse server response: %w", err)
	}
	srv := resp.Attributes
	if srv.ServerOwner {
		srv.UserPermissions = []string{"*"}
	} else if len(resp.Meta.UserPermissions) > 0 {
		srv.UserPermissions = resp.Meta.UserPermissions
	}
	if srv.Relationships != nil && srv.Relationships.Egg != nil && srv.Relationships.Egg.Attributes.Name != "" {
		srv.EggName = srv.Relationships.Egg.Attributes.Name
	}
	if srv.EggName == "" && srv.DockerImage != "" {
		srv.EggName = formatEggFromDocker(srv.DockerImage)
	}
	if srv.Relationships != nil && srv.Relationships.Allocations != nil {
		for _, allocData := range srv.Relationships.Allocations.Data {
			srv.Allocations = append(srv.Allocations, allocData.Attributes)
		}
	}
	return &srv, nil
}

// GetServerResources retrieves current resource usage for a server
func (c *ClientAPI) GetServerResources(ctx context.Context, identifier string) (*ResourceUsage, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/resources", identifier))
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[ResourceUsage]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse resources response: %w", err)
	}
	return &resp.Attributes, nil
}

// SendPowerAction sends a power action to a server
func (c *ClientAPI) SendPowerAction(ctx context.Context, identifier string, signal string) error {
	body := map[string]string{"signal": signal}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/power", identifier), body)
	return err
}

// --- Console WebSocket ---

// WebSocketAuth represents WebSocket authentication details
type WebSocketAuth struct {
	Token  string `json:"token"`
	Socket string `json:"socket"`
}

// GetWebSocketAuth retrieves WebSocket credentials for console
func (c *ClientAPI) GetWebSocketAuth(ctx context.Context, identifier string) (*WebSocketAuth, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/websocket", identifier))
	if err != nil {
		return nil, err
	}
	var resp struct {
		Data WebSocketAuth `json:"data"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse websocket auth: %w", err)
	}
	return &resp.Data, nil
}

// --- Files ---

// ListFiles lists files in a directory
func (c *ClientAPI) ListFiles(ctx context.Context, identifier, directory string) ([]FileObject, error) {
	path := fmt.Sprintf("/servers/%s/files/list?directory=%s", identifier, directory)
	data, _, err := c.http.Get(ctx, path)
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[FileObject]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse files response: %w", err)
	}
	var files []FileObject
	for _, item := range resp.Data {
		files = append(files, item.Attributes)
	}
	return files, nil
}

// GetFileContents retrieves file contents
func (c *ClientAPI) GetFileContents(ctx context.Context, identifier, filePath string) (string, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/files/contents?file=%s", identifier, filePath))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// WriteFile writes content to a file
func (c *ClientAPI) WriteFile(ctx context.Context, identifier, filePath, content string) error {
	path := fmt.Sprintf("/servers/%s/files/write?file=%s", identifier, url.QueryEscape(filePath))
	_, _, err := c.http.Post(ctx, path, content)
	return err
}

// CreateFile creates a new file
func (c *ClientAPI) CreateFile(ctx context.Context, identifier, root, name string) error {
	body := map[string]string{"root": root, "name": name}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/create-folder", identifier), body)
	return err
}

// DeleteFiles deletes files/folders
func (c *ClientAPI) DeleteFiles(ctx context.Context, identifier, root string, files []string) error {
	body := map[string]interface{}{"root": root, "files": files}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/delete", identifier), body)
	return err
}

// RenameFile renames a file
func (c *ClientAPI) RenameFile(ctx context.Context, identifier, root string, files []map[string]string) error {
	body := map[string]interface{}{"root": root, "files": files}
	_, _, err := c.http.Put(ctx, fmt.Sprintf("/servers/%s/files/rename", identifier), body)
	return err
}

// GetFileDownloadURL retrieves a temporary presigned download URL for a file
func (c *ClientAPI) GetFileDownloadURL(ctx context.Context, identifier, filePath string) (string, error) {
	path := fmt.Sprintf("/servers/%s/files/download?file=%s", identifier, url.QueryEscape(filePath))
	data, _, err := c.http.Get(ctx, path)
	if err != nil {
		return "", err
	}
	var resp struct {
		Attributes struct {
			URL string `json:"url"`
		} `json:"attributes"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("failed to parse download URL response: %w", err)
	}
	return resp.Attributes.URL, nil
}

// GetFileUploadURL retrieves a presigned upload URL from Wings for file uploads
func (c *ClientAPI) GetFileUploadURL(ctx context.Context, identifier string) (string, error) {
	path := fmt.Sprintf("/servers/%s/files/upload", identifier)
	data, _, err := c.http.Get(ctx, path)
	if err != nil {
		return "", err
	}
	var resp struct {
		Attributes struct {
			URL string `json:"url"`
		} `json:"attributes"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("failed to parse upload URL response: %w", err)
	}
	return resp.Attributes.URL, nil
}

// ChmodFiles modifies file permissions
func (c *ClientAPI) ChmodFiles(ctx context.Context, identifier, root string, files []ChmodFileEntry) error {
	body := map[string]interface{}{
		"root":  root,
		"files": files,
	}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/chmod", identifier), body)
	return err
}

// CompressFiles compresses one or more files into a tar.gz archive
func (c *ClientAPI) CompressFiles(ctx context.Context, identifier, root string, files []string) (*FileObject, error) {
	body := map[string]interface{}{
		"root":  root,
		"files": files,
	}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/compress", identifier), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[FileObject]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse compress response: %w", err)
	}
	return &resp.Attributes, nil
}

// DecompressFile extracts an archive file into the specified directory
func (c *ClientAPI) DecompressFile(ctx context.Context, identifier, root, file string) error {
	body := map[string]string{
		"root": root,
		"file": file,
	}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/decompress", identifier), body)
	return err
}

// CopyFile creates a copy of a file or folder
func (c *ClientAPI) CopyFile(ctx context.Context, identifier, location string) error {
	body := map[string]string{
		"location": location,
	}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/copy", identifier), body)
	return err
}

// PullFile requests the Wings daemon to download a remote file directly from a URL
func (c *ClientAPI) PullFile(ctx context.Context, identifier, directory, remoteURL, filename string, useHeader, foreground bool) error {
	body := PullFileRequest{
		URL:        remoteURL,
		Directory:  directory,
		Filename:   filename,
		UseHeader:  useHeader,
		Foreground: foreground,
	}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/files/pull", identifier), body)
	return err
}

// UploadFileDirect performs a multipart/form-data upload to Wings using the presigned upload URL
func (c *ClientAPI) UploadFileDirect(ctx context.Context, identifier, directory, filename string, data []byte) error {
	uploadURL, err := c.GetFileUploadURL(ctx, identifier)
	if err != nil {
		return fmt.Errorf("failed to get upload URL: %w", err)
	}

	targetURL := uploadURL
	if directory != "" && directory != "/" {
		if parsed, err := url.Parse(uploadURL); err == nil {
			q := parsed.Query()
			q.Set("directory", directory)
			parsed.RawQuery = q.Encode()
			targetURL = parsed.String()
		}
	}

	var buf bytes.Buffer
	writer := multipart.NewWriter(&buf)
	part, err := writer.CreateFormFile("files", filename)
	if err != nil {
		return fmt.Errorf("failed to create multipart form: %w", err)
	}
	if _, err := part.Write(data); err != nil {
		return fmt.Errorf("failed to write multipart payload: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("failed to close multipart writer: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, targetURL, &buf)
	if err != nil {
		return fmt.Errorf("failed to create upload request: %w", err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	httpClient := &http.Client{Timeout: 60 * time.Second}
	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("file upload request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("upload returned status %d: %s", resp.StatusCode, string(respBody))
	}

	return nil
}

// --- Databases ---

// ListDatabases lists server databases
func (c *ClientAPI) ListDatabases(ctx context.Context, identifier string) ([]Database, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/databases", identifier))
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[Database]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse databases response: %w", err)
	}
	var dbs []Database
	for _, item := range resp.Data {
		dbs = append(dbs, item.Attributes)
	}
	return dbs, nil
}

// CreateDatabase creates a new database for a server
func (c *ClientAPI) CreateDatabase(ctx context.Context, identifier string, database, remote string) (*Database, error) {
	body := map[string]string{"database": database, "remote": remote}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/databases", identifier), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Database]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse database creation response: %w", err)
	}
	return &resp.Attributes, nil
}

// RotateDatabasePassword rotates a database password
func (c *ClientAPI) RotateDatabasePassword(ctx context.Context, identifier, databaseID string) (*Database, error) {
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/databases/%s/rotate-password", identifier, databaseID), nil)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Database]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse database response: %w", err)
	}
	return &resp.Attributes, nil
}

// DeleteDatabase deletes a database
func (c *ClientAPI) DeleteDatabase(ctx context.Context, identifier, databaseID string) error {
	_, _, err := c.http.Delete(ctx, fmt.Sprintf("/servers/%s/databases/%s", identifier, databaseID))
	return err
}

// --- Network/Allocations ---

// ListAllocations lists server network allocations
func (c *ClientAPI) ListAllocations(ctx context.Context, identifier string) ([]Allocation, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/network/allocations", identifier))
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[Allocation]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse allocations response: %w", err)
	}
	var allocs []Allocation
	for _, item := range resp.Data {
		allocs = append(allocs, item.Attributes)
	}
	return allocs, nil
}

// AssignAllocation auto-assigns an available allocation to the server
func (c *ClientAPI) AssignAllocation(ctx context.Context, identifier string) (*Allocation, error) {
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/network/allocations", identifier), nil)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Allocation]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse assigned allocation response: %w", err)
	}
	return &resp.Attributes, nil
}

// SetAllocationNote sets custom notes for an allocation
func (c *ClientAPI) SetAllocationNote(ctx context.Context, identifier string, allocationID int, notes string) (*Allocation, error) {
	body := map[string]string{"notes": notes}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/network/allocations/%d", identifier, allocationID), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Allocation]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse allocation response: %w", err)
	}
	return &resp.Attributes, nil
}

// SetPrimaryAllocation sets an allocation as primary
func (c *ClientAPI) SetPrimaryAllocation(ctx context.Context, identifier string, allocationID int) error {
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/network/allocations/%d/primary", identifier, allocationID), nil)
	return err
}

// UnassignAllocation deletes/unassigns an allocation from the server
func (c *ClientAPI) UnassignAllocation(ctx context.Context, identifier string, allocationID int) error {
	_, _, err := c.http.Delete(ctx, fmt.Sprintf("/servers/%s/network/allocations/%d", identifier, allocationID))
	return err
}

// --- Startup ---

// GetStartupConfiguration retrieves startup command, raw command, docker images, and variables
func (c *ClientAPI) GetStartupConfiguration(ctx context.Context, identifier string) (*ServerStartupConfig, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/startup", identifier))
	if err != nil {
		return nil, err
	}
	var resp StartupResponse
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse startup configuration: %w", err)
	}
	var vars []StartupVariable
	for _, item := range resp.Data {
		vars = append(vars, item.Attributes)
	}
	if resp.Meta.DockerImages == nil {
		resp.Meta.DockerImages = make(map[string]string)
	}
	return &ServerStartupConfig{
		StartupCommand:    resp.Meta.StartupCommand,
		RawStartupCommand: resp.Meta.RawStartupCommand,
		DockerImages:      resp.Meta.DockerImages,
		Variables:         vars,
	}, nil
}

// ListStartupVariables lists startup variables
func (c *ClientAPI) ListStartupVariables(ctx context.Context, identifier string) ([]StartupVariable, error) {
	cfg, err := c.GetStartupConfiguration(ctx, identifier)
	if err != nil {
		return nil, err
	}
	return cfg.Variables, nil
}

// UpdateStartupVariable updates a startup variable and returns the updated variable representation
func (c *ClientAPI) UpdateStartupVariable(ctx context.Context, identifier, key, value string) (*StartupVariable, error) {
	body := map[string]string{"key": key, "value": value}
	data, _, err := c.http.Put(ctx, fmt.Sprintf("/servers/%s/startup/variable", identifier), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[StartupVariable]
	if err := json.Unmarshal(data, &resp); err == nil && resp.Attributes.EnvVariable != "" {
		return &resp.Attributes, nil
	}
	return &StartupVariable{EnvVariable: key, ServerValue: value}, nil
}

// UpdateDockerImage updates the server's Docker image
func (c *ClientAPI) UpdateDockerImage(ctx context.Context, identifier, dockerImage string) error {
	body := map[string]string{"docker_image": dockerImage}
	_, _, err := c.http.Put(ctx, fmt.Sprintf("/servers/%s/settings/docker-image", identifier), body)
	return err
}

// --- Settings ---

// RenameServer renames a server and optionally updates description
func (c *ClientAPI) RenameServer(ctx context.Context, identifier, name, description string) error {
	body := map[string]string{"name": name}
	if description != "" {
		body["description"] = description
	}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/settings/rename", identifier), body)
	return err
}

// ReinstallServer triggers a server reinstall
func (c *ClientAPI) ReinstallServer(ctx context.Context, identifier string) error {
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/settings/reinstall", identifier), nil)
	return err
}

// --- Backups ---

// ListBackups lists server backups
func (c *ClientAPI) ListBackups(ctx context.Context, identifier string) ([]Backup, error) {
	return FetchAllPages[Backup](ctx, c.http, fmt.Sprintf("/servers/%s/backups", identifier))
}

// CreateBackup creates a new backup
func (c *ClientAPI) CreateBackup(ctx context.Context, identifier string) (*Backup, error) {
	return c.CreateBackupWithOptions(ctx, identifier, "", false, "")
}

// CreateBackupWithOptions creates a new backup with custom name, lock and ignore rules
func (c *ClientAPI) CreateBackupWithOptions(ctx context.Context, identifier, name string, isLocked bool, ignored string) (*Backup, error) {
	body := map[string]interface{}{
		"name":      name,
		"is_locked": isLocked,
		"ignored":   ignored,
	}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/backups", identifier), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Backup]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse backup response: %w", err)
	}
	return &resp.Attributes, nil
}

// GetBackupDownloadURL retrieves a signed temporary download URL for a backup
func (c *ClientAPI) GetBackupDownloadURL(ctx context.Context, identifier, backupUUID string) (string, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/backups/%s/download", identifier, backupUUID))
	if err != nil {
		return "", err
	}
	var resp struct {
		Attributes struct {
			URL string `json:"url"`
		} `json:"attributes"`
	}
	if err := json.Unmarshal(data, &resp); err != nil {
		return "", fmt.Errorf("failed to parse download url response: %w", err)
	}
	return resp.Attributes.URL, nil
}

// ToggleBackupLock toggles the locked status of a backup
func (c *ClientAPI) ToggleBackupLock(ctx context.Context, identifier, backupUUID string) (*Backup, error) {
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/backups/%s/lock", identifier, backupUUID), nil)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Backup]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse backup lock response: %w", err)
	}
	return &resp.Attributes, nil
}

// RestoreBackup restores a server from an existing backup
func (c *ClientAPI) RestoreBackup(ctx context.Context, identifier, backupUUID string, truncate bool) error {
	body := map[string]bool{"truncate_dir": truncate}
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/backups/%s/restore", identifier, backupUUID), body)
	return err
}

// DeleteBackup deletes a backup
func (c *ClientAPI) DeleteBackup(ctx context.Context, identifier, backupUUID string) error {
	_, _, err := c.http.Delete(ctx, fmt.Sprintf("/servers/%s/backups/%s", identifier, backupUUID))
	return err
}

// --- Subusers ---

// ListSubusers lists server subusers
func (c *ClientAPI) ListSubusers(ctx context.Context, identifier string) ([]Subuser, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/users", identifier))
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[Subuser]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse subusers response: %w", err)
	}
	var users []Subuser
	for _, item := range resp.Data {
		users = append(users, item.Attributes)
	}
	return users, nil
}

// CreateSubuser grants access to a new subuser
func (c *ClientAPI) CreateSubuser(ctx context.Context, identifier, email string, permissions []string) (*Subuser, error) {
	body := map[string]interface{}{
		"email":       email,
		"permissions": permissions,
	}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/users", identifier), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Subuser]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse subuser response: %w", err)
	}
	return &resp.Attributes, nil
}

// UpdateSubuser updates permissions for an existing subuser
func (c *ClientAPI) UpdateSubuser(ctx context.Context, identifier, subuserUUID string, permissions []string) (*Subuser, error) {
	body := map[string]interface{}{
		"permissions": permissions,
	}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/users/%s", identifier, subuserUUID), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Subuser]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse subuser response: %w", err)
	}
	return &resp.Attributes, nil
}

// DeleteSubuser revokes access for a subuser
func (c *ClientAPI) DeleteSubuser(ctx context.Context, identifier, subuserUUID string) error {
	_, _, err := c.http.Delete(ctx, fmt.Sprintf("/servers/%s/users/%s", identifier, subuserUUID))
	return err
}

// --- Schedules ---

// ListSchedules lists schedules configured on the server
func (c *ClientAPI) ListSchedules(ctx context.Context, identifier string) ([]Schedule, error) {
	data, _, err := c.http.Get(ctx, fmt.Sprintf("/servers/%s/schedules", identifier))
	if err != nil {
		return nil, err
	}
	var resp PaginatedResponse[Schedule]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse schedules response: %w", err)
	}
	var list []Schedule
	for _, item := range resp.Data {
		list = append(list, item.Attributes)
	}
	return list, nil
}

// CreateSchedule registers a new schedule
func (c *ClientAPI) CreateSchedule(ctx context.Context, identifier, name string, cron CronExpression, isActive, onlyWhenOnline bool) (*Schedule, error) {
	body := map[string]interface{}{
		"name":             name,
		"minute":           cron.Minute,
		"hour":             cron.Hour,
		"day_of_month":     cron.DayOfMonth,
		"month":            cron.Month,
		"day_of_week":      cron.DayOfWeek,
		"is_active":        isActive,
		"only_when_online": onlyWhenOnline,
	}
	data, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/schedules", identifier), body)
	if err != nil {
		return nil, err
	}
	var resp SingleResponse[Schedule]
	if err := json.Unmarshal(data, &resp); err != nil {
		return nil, fmt.Errorf("failed to parse schedule response: %w", err)
	}
	return &resp.Attributes, nil
}

// TriggerSchedule immediately queues execution of a schedule
func (c *ClientAPI) TriggerSchedule(ctx context.Context, identifier string, scheduleID int) error {
	_, _, err := c.http.Post(ctx, fmt.Sprintf("/servers/%s/schedules/%d/execute", identifier, scheduleID), nil)
	return err
}

// DeleteSchedule deletes a schedule
func (c *ClientAPI) DeleteSchedule(ctx context.Context, identifier string, scheduleID int) error {
	_, _, err := c.http.Delete(ctx, fmt.Sprintf("/servers/%s/schedules/%d", identifier, scheduleID))
	return err
}


// TestConnection tests if the Client API is accessible
func (c *ClientAPI) TestConnection(ctx context.Context) error {
	_, err := c.GetAccount(ctx)
	return err
}
