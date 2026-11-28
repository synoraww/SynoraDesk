package security

import "testing"

func TestValidateHTTPURL(t *testing.T) {
	valid := []struct {
		url     string
		allowWS bool
	}{
		{"https://panel.example.com", false},
		{"http://192.168.1.50:8080", false},
		{"http://localhost:8000", false},
		{"wss://wings.example.com:8080/api/servers/abc/ws", true},
		{"ws://127.0.0.1:8080/ws", true},
	}
	for _, tc := range valid {
		if _, err := ValidateHTTPURL(tc.url, tc.allowWS); err != nil {
			t.Errorf("expected valid URL %q (allowWS=%v), got error: %v", tc.url, tc.allowWS, err)
		}
	}

	invalid := []struct {
		url     string
		allowWS bool
	}{
		{"", false},
		{"javascript:alert(1)", false},
		{"file:///C:/Windows/win.ini", false},
		{"wss://wings.example.com/ws", false},
		{"https://user:pass@panel.example.com", false},
		{"http://169.254.169.254/latest/meta-data/", false},
		{"http://[fe80::1]/", false},
		{"http://0.0.0.0:8080/", false},
		{"https://panel.example.com\r\nInjected: header", false},
	}
	for _, tc := range invalid {
		if _, err := ValidateHTTPURL(tc.url, tc.allowWS); err == nil {
			t.Errorf("expected error for invalid/unsafe URL %q (allowWS=%v), got nil", tc.url, tc.allowWS)
		}
	}
}

func TestValidatePathIdentifier(t *testing.T) {
	for _, id := range []string{"a1b2c3d4", "srv_123-abc", "SHA256:abc123"} {
		if err := ValidatePathIdentifier(id); err != nil {
			t.Errorf("expected valid identifier %q, got %v", id, err)
		}
	}

	for _, id := range []string{"", "../account", "abc/def", "abc\\def", "abc?x=1", "abc#frag", "abc%2f", "abc def", "abc\x00"} {
		if err := ValidatePathIdentifier(id); err == nil {
			t.Errorf("expected error for unsafe identifier %q, got nil", id)
		}
	}
}

func TestValidateHostOrFQDN(t *testing.T) {
	for _, h := range []string{"node1.example.com", "192.168.1.10", "localhost"} {
		if err := ValidateHostOrFQDN(h); err != nil {
			t.Errorf("expected valid host %q, got %v", h, err)
		}
	}
	for _, h := range []string{"", "node.com/evil", "node.com?x=1", "user@node.com", "169.254.169.254"} {
		if err := ValidateHostOrFQDN(h); err == nil {
			t.Errorf("expected error for unsafe host %q, got nil", h)
		}
	}
}
