package sftp

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// SFTPConfig holds connection parameters
type SFTPConfig struct {
	Host           string        `json:"host"`
	Port           int           `json:"port"`
	Username       string        `json:"username"`
	Password       string        `json:"password"`
	Timeout        time.Duration `json:"timeout"`
	KnownHostsPath string        `json:"-"`
}

// FileEntry represents a file or directory over SFTP
type FileEntry struct {
	Name         string    `json:"name"`
	Size         int64     `json:"size"`
	Mode         string    `json:"mode"`
	ModifiedTime time.Time `json:"modifiedTime"`
	IsDir        bool      `json:"isDir"`
}

// Client manages an SFTP session
type Client struct {
	sshClient  *ssh.Client
	sftpClient *sftp.Client
	config     SFTPConfig
	mu         sync.Mutex
}

// NewClient establishes an SFTP session
func NewClient(config SFTPConfig) (*Client, error) {
	if config.KnownHostsPath == "" {
		return nil, fmt.Errorf("SFTP known hosts storage is required")
	}
	if config.Timeout == 0 {
		config.Timeout = 15 * time.Second
	}

	sshConfig := &ssh.ClientConfig{
		User: config.Username,
		Auth: []ssh.AuthMethod{
			ssh.Password(config.Password),
		},
		HostKeyCallback: func(hostname string, remote net.Addr, key ssh.PublicKey) error {
			return verifyHostKey(config.KnownHostsPath, hostname, key)
		},
		Timeout: config.Timeout,
	}

	addr := net.JoinHostPort(config.Host, fmt.Sprintf("%d", config.Port))
	sshConn, err := ssh.Dial("tcp", addr, sshConfig)
	if err != nil {
		return nil, fmt.Errorf("ssh connection failed: %w", err)
	}

	sftpCli, err := sftp.NewClient(sshConn)
	if err != nil {
		sshConn.Close()
		return nil, fmt.Errorf("sftp subsystem failed: %w", err)
	}

	return &Client{
		sshClient:  sshConn,
		sftpClient: sftpCli,
		config:     config,
	}, nil
}

var knownHostsMu sync.Mutex

func verifyHostKey(path, host string, key ssh.PublicKey) error {
	knownHostsMu.Lock()
	defer knownHostsMu.Unlock()
	known := make(map[string]string)
	if raw, err := os.ReadFile(path); err == nil {
		if err := json.Unmarshal(raw, &known); err != nil {
			return fmt.Errorf("invalid known hosts file: %w", err)
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	fingerprint := ssh.FingerprintSHA256(key)
	if pinned, ok := known[host]; ok {
		if pinned != fingerprint {
			return fmt.Errorf("SECURITY WARNING: host key mismatch for %s", host)
		}
		return nil
	}
	known[host] = fingerprint
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	data, err := json.Marshal(known)
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".known-hosts-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Chmod(0600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(data); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmp.Name(), path)
}

// Close terminates the SFTP and SSH connections
func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()

	var errs []error
	if c.sftpClient != nil {
		if err := c.sftpClient.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if c.sshClient != nil {
		if err := c.sshClient.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if len(errs) > 0 {
		return fmt.Errorf("errors closing sftp: %v", errs)
	}
	return nil
}

// ListDirectory lists files in remote directory
func (c *Client) ListDirectory(remotePath string) ([]FileEntry, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if remotePath == "" {
		remotePath = "/"
	}

	files, err := c.sftpClient.ReadDir(remotePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read remote directory %s: %w", remotePath, err)
	}

	entries := make([]FileEntry, 0, len(files))
	for _, f := range files {
		entries = append(entries, FileEntry{
			Name:         f.Name(),
			Size:         f.Size(),
			Mode:         f.Mode().String(),
			ModifiedTime: f.ModTime(),
			IsDir:        f.IsDir(),
		})
	}
	return entries, nil
}

// ReadFile reads a remote text file
func (c *Client) ReadFile(remotePath string) (string, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	file, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	content, err := io.ReadAll(file)
	if err != nil {
		return "", err
	}
	return string(content), nil
}

// WriteFile writes string content to a remote file
func (c *Client) WriteFile(remotePath, content string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	file, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write([]byte(content))
	return err
}

// UploadBytes writes byte slice to a remote file
func (c *Client) UploadBytes(remotePath string, data []byte) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	file, err := c.sftpClient.Create(remotePath)
	if err != nil {
		return err
	}
	defer file.Close()

	_, err = file.Write(data)
	return err
}

// CreateDirectory creates a remote directory
func (c *Client) CreateDirectory(remotePath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sftpClient.MkdirAll(remotePath)
}

// Remove removes a remote file or empty directory
func (c *Client) Remove(remotePath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sftpClient.Remove(remotePath)
}

// Rename renames a remote file or directory
func (c *Client) Rename(oldPath, newPath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sftpClient.Rename(oldPath, newPath)
}

// Chmod changes file permissions
func (c *Client) Chmod(remotePath string, mode os.FileMode) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.sftpClient.Chmod(remotePath, mode)
}

// DownloadFile downloads a remote file to a local destination
func (c *Client) DownloadFile(remotePath, localPath string) error {
	c.mu.Lock()
	defer c.mu.Unlock()

	srcFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		return err
	}

	dstFile, err := os.Create(localPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

// SessionManager manages active SFTP sessions per server identifier
type SessionManager struct {
	sessions map[string]*Client
	mu       sync.RWMutex
}

// NewSessionManager creates a new session manager
func NewSessionManager() *SessionManager {
	return &SessionManager{
		sessions: make(map[string]*Client),
	}
}

// Connect starts or replaces an SFTP session for a server
func (sm *SessionManager) Connect(serverID string, cfg SFTPConfig) (*Client, error) {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if existing, ok := sm.sessions[serverID]; ok {
		existing.Close()
		delete(sm.sessions, serverID)
	}

	cli, err := NewClient(cfg)
	if err != nil {
		return nil, err
	}

	sm.sessions[serverID] = cli
	return cli, nil
}

// Get returns the active SFTP client for a server
func (sm *SessionManager) Get(serverID string) (*Client, error) {
	sm.mu.RLock()
	defer sm.mu.RUnlock()

	cli, ok := sm.sessions[serverID]
	if !ok || cli == nil {
		return nil, fmt.Errorf("no active SFTP session for server %s", serverID)
	}
	return cli, nil
}

// IsConnected checks if a server has an active session
func (sm *SessionManager) IsConnected(serverID string) bool {
	sm.mu.RLock()
	defer sm.mu.RUnlock()
	_, ok := sm.sessions[serverID]
	return ok
}

// Disconnect closes and removes the session for a server
func (sm *SessionManager) Disconnect(serverID string) error {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	if cli, ok := sm.sessions[serverID]; ok {
		err := cli.Close()
		delete(sm.sessions, serverID)
		return err
	}
	return nil
}

// CloseAll closes all active sessions
func (sm *SessionManager) CloseAll() {
	sm.mu.Lock()
	defer sm.mu.Unlock()

	for id, cli := range sm.sessions {
		cli.Close()
		delete(sm.sessions, id)
	}
}

// Base64ToBytes helper
func Base64ToBytes(b64 string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(b64)
}
