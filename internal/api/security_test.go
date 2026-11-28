package api

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func TestHTTPClientBlocksCrossHostRedirect(t *testing.T) {
	client := NewHTTPClient(ClientConfig{
		BaseURL:    "https://panel.example.com",
		Token:      "ptlc_testtoken123456",
		MaxRetries: -1,
		Timeout:    5 * time.Second,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusFound,
				Header:     http.Header{"Location": []string{"https://evil.example.net/steal"}},
				Body:       io.NopCloser(strings.NewReader("")),
				Request:    r,
			}, nil
		}),
	})

	_, _, err := client.Get(context.Background(), "/account")
	if err == nil {
		t.Fatal("expected error when redirecting cross-host, got nil")
	}
	if !strings.Contains(err.Error(), "cross-host") {
		t.Fatalf("expected cross-host redirect error, got: %v", err)
	}
}

func TestHTTPClientBlocksHTTPSDowngradeRedirect(t *testing.T) {
	client := NewHTTPClient(ClientConfig{
		BaseURL:    "https://panel.example.com",
		Token:      "ptlc_testtoken123456",
		MaxRetries: -1,
		Timeout:    5 * time.Second,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusMovedPermanently,
				Header:     http.Header{"Location": []string{"http://panel.example.com/api/client/account"}},
				Body:       io.NopCloser(strings.NewReader("")),
				Request:    r,
			}, nil
		}),
	})

	_, _, err := client.Get(context.Background(), "/account")
	if err == nil {
		t.Fatal("expected error on HTTPS->HTTP downgrade redirect, got nil")
	}
	if !strings.Contains(err.Error(), "downgrade") {
		t.Fatalf("expected downgrade error, got: %v", err)
	}
}

func TestHTTPClientRejectsOversizedResponse(t *testing.T) {
	oversized := bytes.Repeat([]byte("A"), maxAPIResponseBytes+10)
	client := NewHTTPClient(ClientConfig{
		BaseURL:    "https://panel.example.com",
		Token:      "ptlc_testtoken123456",
		MaxRetries: -1,
		Timeout:    5 * time.Second,
		Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
			return &http.Response{
				StatusCode: http.StatusOK,
				Body:       io.NopCloser(bytes.NewReader(oversized)),
				Request:    r,
			}, nil
		}),
	})

	_, _, err := client.Get(context.Background(), "/account")
	if err == nil {
		t.Fatal("expected error for oversized response, got nil")
	}
	if !strings.Contains(err.Error(), "exceeded maximum allowed size") {
		t.Fatalf("expected size limit error, got: %v", err)
	}
}

func TestClientAPIRejectsPathTraversalIdentifier(t *testing.T) {
	c := NewClientAPI("https://panel.example.com", "ptlc_testtoken123456")
	_, err := c.GetServer(context.Background(), "../../account/api-keys")
	if err == nil {
		t.Fatal("expected error for path traversal server identifier, got nil")
	}
}
