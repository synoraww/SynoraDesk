package api

import (
	"fmt"
	"strings"
)

// APIError represents a structured error from the Pterodactyl API
type APIError struct {
	StatusCode int      `json:"statusCode"`
	Code       string   `json:"code"`
	Message    string   `json:"message"`
	Detail     string   `json:"detail"`
	Errors     []string `json:"errors,omitempty"`
}

func (e *APIError) Error() string {
	if len(e.Errors) > 0 {
		return fmt.Sprintf("API error %d (%s): %s [%s]", e.StatusCode, e.Code, e.Message, strings.Join(e.Errors, "; "))
	}
	return fmt.Sprintf("API error %d (%s): %s", e.StatusCode, e.Code, e.Message)
}

// IsNotFound returns true if the error is a 404
func (e *APIError) IsNotFound() bool {
	return e.StatusCode == 404
}

// IsForbidden returns true if the error is a 403
func (e *APIError) IsForbidden() bool {
	return e.StatusCode == 403
}

// IsUnauthorized returns true if the error is a 401
func (e *APIError) IsUnauthorized() bool {
	return e.StatusCode == 401
}

// IsRateLimited returns true if the error is a 429
func (e *APIError) IsRateLimited() bool {
	return e.StatusCode == 429
}

// IsServerError returns true if the error is a 5xx
func (e *APIError) IsServerError() bool {
	return e.StatusCode >= 500
}

// ErrConnectionFailed represents a connection failure
type ErrConnectionFailed struct {
	URL string
	Err error
}

func (e *ErrConnectionFailed) Error() string {
	return fmt.Sprintf("failed to connect to %s: %v", e.URL, e.Err)
}

func (e *ErrConnectionFailed) Unwrap() error {
	return e.Err
}

// ErrTimeout represents a request timeout
type ErrTimeout struct {
	URL string
}

func (e *ErrTimeout) Error() string {
	return fmt.Sprintf("request to %s timed out", e.URL)
}
