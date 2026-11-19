package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

// ClientConfig configures the HTTP client
type ClientConfig struct {
	BaseURL    string
	Token      string
	Timeout    time.Duration
	MaxRetries int
	UserAgent  string
}

// HTTPClient is a reusable HTTP client for Pterodactyl API requests
type HTTPClient struct {
	config         ClientConfig
	httpClient     *http.Client
	mu             sync.RWMutex
	rateLimitReset time.Time
	lastLatencyMs  int64
}

// NewHTTPClient creates a new HTTP client with connection pooling
func NewHTTPClient(config ClientConfig) *HTTPClient {
	if config.Timeout == 0 {
		config.Timeout = 30 * time.Second
	}
	if config.MaxRetries == 0 {
		config.MaxRetries = 3
	}
	if config.UserAgent == "" {
		config.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36 SynoraDesk/1.02A"
	}

	transport := &http.Transport{
		MaxIdleConns:        20,
		MaxIdleConnsPerHost: 10,
		IdleConnTimeout:     90 * time.Second,
		TLSHandshakeTimeout: 10 * time.Second,
	}

	return &HTTPClient{
		config: config,
		httpClient: &http.Client{
			Timeout:   config.Timeout,
			Transport: transport,
		},
	}
}

// SetToken updates the API token
func (c *HTTPClient) SetToken(token string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.config.Token = token
}

// SetBaseURL updates the base URL
func (c *HTTPClient) SetBaseURL(url string) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.config.BaseURL = strings.TrimRight(url, "/")
}

// GetLastLatencyMs returns the roundtrip latency in milliseconds of the last completed request
func (c *HTTPClient) GetLastLatencyMs() int64 {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.lastLatencyMs
}

// Request performs an HTTP request with retry and rate-limit handling
func (c *HTTPClient) Request(ctx context.Context, method, path string, body interface{}) ([]byte, int, error) {
	c.mu.RLock()
	baseURL := c.config.BaseURL
	token := c.config.Token
	maxRetries := c.config.MaxRetries
	userAgent := c.config.UserAgent
	c.mu.RUnlock()

	url := baseURL + path

	var lastErr error
	for attempt := 0; attempt <= maxRetries; attempt++ {
		if attempt > 0 {
			// Exponential backoff: 1s, 2s, 4s...
			backoff := time.Duration(1<<uint(attempt-1)) * time.Second
			select {
			case <-ctx.Done():
				return nil, 0, ctx.Err()
			case <-time.After(backoff):
			}
		}

		// Check rate limit
		c.mu.RLock()
		resetTime := c.rateLimitReset
		c.mu.RUnlock()
		if time.Now().Before(resetTime) {
			waitDuration := time.Until(resetTime)
			select {
			case <-ctx.Done():
				return nil, 0, ctx.Err()
			case <-time.After(waitDuration):
			}
		}

		var reqBody io.Reader
		contentType := "application/json"

		if body != nil {
			switch b := body.(type) {
			case string:
				reqBody = strings.NewReader(b)
				contentType = "text/plain"
			case []byte:
				reqBody = bytes.NewReader(b)
				contentType = "text/plain"
			case io.Reader:
				reqBody = b
				contentType = "text/plain"
			default:
				jsonBytes, err := json.Marshal(body)
				if err != nil {
					return nil, 0, fmt.Errorf("failed to marshal request body: %w", err)
				}
				reqBody = bytes.NewReader(jsonBytes)
				contentType = "application/json"
			}
		}

		req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to create request: %w", err)
		}

		cleanToken := strings.TrimSpace(token)
		if strings.HasPrefix(strings.ToLower(cleanToken), "bearer ") {
			cleanToken = strings.TrimSpace(cleanToken[7:])
		}
		req.Header.Set("Authorization", "Bearer "+cleanToken)
		req.Header.Set("Accept", "application/json, text/plain, */*")
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("User-Agent", userAgent)

		start := time.Now()
		resp, err := c.httpClient.Do(req)
		elapsed := time.Since(start).Milliseconds()
		c.mu.Lock()
		c.lastLatencyMs = elapsed
		c.mu.Unlock()

		if err != nil {
			lastErr = &ErrConnectionFailed{URL: url, Err: err}
			if ctx.Err() != nil {
				return nil, 0, ctx.Err()
			}
			continue
		}

		respBody, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read response body: %w", err)
			continue
		}

		// Handle rate limiting
		if resp.StatusCode == 429 {
			retryAfter := resp.Header.Get("Retry-After")
			waitSecs := 60 // default wait
			if retryAfter != "" {
				if secs, err := strconv.Atoi(retryAfter); err == nil {
					waitSecs = secs
				}
			}
			c.mu.Lock()
			c.rateLimitReset = time.Now().Add(time.Duration(waitSecs) * time.Second)
			c.mu.Unlock()
			lastErr = &APIError{StatusCode: 429, Code: "RateLimited", Message: "Rate limit exceeded"}
			continue
		}

		// Handle server errors (retry)
		if resp.StatusCode >= 500 {
			lastErr = &APIError{StatusCode: resp.StatusCode, Code: "ServerError", Message: string(respBody)}
			continue
		}

		// Handle client errors (don't retry)
		if resp.StatusCode >= 400 {
			apiErr := parseAPIError(resp.StatusCode, respBody)
			return nil, resp.StatusCode, apiErr
		}

		return respBody, resp.StatusCode, nil
	}

	return nil, 0, fmt.Errorf("request failed after %d attempts: %w", maxRetries+1, lastErr)
}

// Get performs a GET request
func (c *HTTPClient) Get(ctx context.Context, path string) ([]byte, int, error) {
	return c.Request(ctx, http.MethodGet, path, nil)
}

// Post performs a POST request
func (c *HTTPClient) Post(ctx context.Context, path string, body interface{}) ([]byte, int, error) {
	return c.Request(ctx, http.MethodPost, path, body)
}

// Patch performs a PATCH request
func (c *HTTPClient) Patch(ctx context.Context, path string, body interface{}) ([]byte, int, error) {
	return c.Request(ctx, http.MethodPatch, path, body)
}

// Put performs a PUT request
func (c *HTTPClient) Put(ctx context.Context, path string, body interface{}) ([]byte, int, error) {
	return c.Request(ctx, http.MethodPut, path, body)
}

// Delete performs a DELETE request
func (c *HTTPClient) Delete(ctx context.Context, path string) ([]byte, int, error) {
	return c.Request(ctx, http.MethodDelete, path, nil)
}

// DeleteWithBody performs a DELETE request with a body
func (c *HTTPClient) DeleteWithBody(ctx context.Context, path string, body interface{}) ([]byte, int, error) {
	return c.Request(ctx, http.MethodDelete, path, body)
}

// TestConnection tests if the API is reachable and the token is valid
func (c *HTTPClient) TestConnection(ctx context.Context) error {
	_, status, err := c.Get(ctx, "")
	if err != nil {
		return err
	}
	if status == 401 {
		return &APIError{StatusCode: 401, Code: "Unauthorized", Message: "Invalid API token"}
	}
	return nil
}

func parseAPIError(statusCode int, body []byte) *APIError {
	statusText := http.StatusText(statusCode)
	if statusText == "" {
		statusText = fmt.Sprintf("HTTP_%d", statusCode)
	}

	apiErr := &APIError{
		StatusCode: statusCode,
		Code:       statusText,
		Message:    statusText,
	}

	trimmedBody := strings.TrimSpace(string(body))
	if len(trimmedBody) == 0 {
		return apiErr
	}

	// 1. Try standard Pterodactyl error response: {"errors": [{"code": "...", "detail": "..."}]}
	var errResp APIErrorResponse
	if err := json.Unmarshal(body, &errResp); err == nil && len(errResp.Errors) > 0 {
		apiErr.Code = errResp.Errors[0].Code
		apiErr.Detail = errResp.Errors[0].Detail
		apiErr.Message = errResp.Errors[0].Detail
		for _, e := range errResp.Errors {
			apiErr.Errors = append(apiErr.Errors, e.Detail)
		}
		return apiErr
	}

	// 2. Try generic JSON with message or error fields
	var genericMap map[string]interface{}
	if err := json.Unmarshal(body, &genericMap); err == nil {
		if msg, ok := genericMap["message"].(string); ok && msg != "" {
			apiErr.Message = msg
			apiErr.Detail = msg
			return apiErr
		}
		if errMsg, ok := genericMap["error"].(string); ok && errMsg != "" {
			apiErr.Message = errMsg
			apiErr.Detail = errMsg
			return apiErr
		}
	}

	// 3. Check for Cloudflare / WAF block in HTML
	if strings.Contains(trimmedBody, "Attention Required! | Cloudflare") || strings.Contains(trimmedBody, "cf-error-details") {
		apiErr.Code = "CloudflareBlocked"
		apiErr.Message = "Bị Cloudflare WAF chặn hoặc yêu cầu xác thực bảo mật"
		apiErr.Detail = apiErr.Message
		return apiErr
	}

	// 4. Fallback to clean snippet of response body if short
	if len(trimmedBody) > 0 && len(trimmedBody) < 300 && !strings.Contains(trimmedBody, "<html") {
		apiErr.Message = trimmedBody
		apiErr.Detail = trimmedBody
	}

	return apiErr
}

// FetchAllPages fetches all pages of a paginated endpoint
func FetchAllPages[T any](ctx context.Context, client *HTTPClient, path string) ([]T, error) {
	var allItems []T
	page := 1

	for {
		separator := "?"
		if strings.Contains(path, "?") {
			separator = "&"
		}
		pagedPath := fmt.Sprintf("%s%spage=%d", path, separator, page)

		data, _, err := client.Get(ctx, pagedPath)
		if err != nil {
			return nil, err
		}

		var resp PaginatedResponse[T]
		if err := json.Unmarshal(data, &resp); err != nil {
			return nil, fmt.Errorf("failed to unmarshal paginated response: %w", err)
		}

		for _, item := range resp.Data {
			allItems = append(allItems, item.Attributes)
		}

		if page >= resp.Meta.Pagination.TotalPages {
			break
		}
		page++
	}

	return allItems, nil
}
