package security

import (
	"fmt"
	"net"
	"net/url"
	"strings"
)

// ValidateHTTPURL validates that rawURL is a well-formed HTTP(S) (or WS(S) when allowWS is true)
// URL without embedded credentials or link-local metadata IP targets.
func ValidateHTTPURL(rawURL string, allowWS bool) (*url.URL, error) {
	trimmed := strings.TrimSpace(rawURL)
	if trimmed == "" {
		return nil, fmt.Errorf("URL is required")
	}
	if strings.ContainsAny(trimmed, "\r\n\x00") {
		return nil, fmt.Errorf("URL contains invalid control characters")
	}

	parsed, err := url.Parse(trimmed)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}

	scheme := strings.ToLower(parsed.Scheme)
	validScheme := scheme == "https" || scheme == "http"
	if allowWS {
		validScheme = validScheme || scheme == "wss" || scheme == "ws"
	}
	if !validScheme {
		if allowWS {
			return nil, fmt.Errorf("URL must use http, https, ws, or wss scheme")
		}
		return nil, fmt.Errorf("URL must use http or https scheme")
	}

	if parsed.User != nil {
		return nil, fmt.Errorf("URL must not contain embedded credentials")
	}

	host := parsed.Hostname()
	if host == "" {
		return nil, fmt.Errorf("URL must have a valid host")
	}

	if isBlockedMetadataIP(host) {
		return nil, fmt.Errorf("access to link-local or unspecified address %q is blocked", host)
	}

	return parsed, nil
}

// isBlockedMetadataIP returns true for link-local (169.254.0.0/16, fe80::/10) and unspecified IPs
// to prevent cloud metadata SSRF while permitting legitimate self-hosted LAN/localhost panels.
func isBlockedMetadataIP(host string) bool {
	ip := net.ParseIP(host)
	if ip == nil {
		return false
	}
	return ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified()
}

// ValidatePathIdentifier ensures an API path parameter (e.g. server ID, UUID, fingerprint)
// cannot traverse or inject query/fragment components into API paths.
func ValidatePathIdentifier(id string) error {
	if id == "" {
		return fmt.Errorf("identifier is required")
	}
	if strings.Contains(id, "..") {
		return fmt.Errorf("identifier contains invalid path traversal sequence")
	}
	if strings.ContainsAny(id, "/\\?#% \t\r\n\x00") {
		return fmt.Errorf("identifier contains invalid characters")
	}
	return nil
}

// ValidateHostOrFQDN validates a Wings node FQDN/host string against URL injection.
func ValidateHostOrFQDN(fqdn string) error {
	trimmed := strings.TrimSpace(fqdn)
	if trimmed == "" {
		return fmt.Errorf("fqdn is required")
	}
	if strings.ContainsAny(trimmed, "/\\?#@ \t\r\n\x00") {
		return fmt.Errorf("fqdn contains invalid characters")
	}
	if isBlockedMetadataIP(trimmed) {
		return fmt.Errorf("fqdn points to blocked link-local or unspecified address")
	}
	return nil
}
