package logger

import (
	"bytes"
	"strings"
	"testing"
)

func TestRedactString(t *testing.T) {
	cases := []struct {
		in       string
		contains string
		absent   string
	}{
		{"Authorization: Bearer super_secret_token_123", "[REDACTED]", "super_secret_token_123"},
		{"failed with key ptlc_abcdefghijklmnopqrstuvwxyz1234", "ptlc_[REDACTED]", "abcdefghijklmnopqrstuvwxyz1234"},
		{"failed with key ptla_abcdefghijklmnopqrstuvwxyz1234", "ptla_[REDACTED]", "abcdefghijklmnopqrstuvwxyz1234"},
		{"connect https://admin:s3cr3tpass@panel.example.com/api", "[REDACTED]:[REDACTED]@", "s3cr3tpass"},
	}

	for _, tc := range cases {
		out := RedactString(tc.in)
		if !strings.Contains(out, tc.contains) {
			t.Errorf("expected %q to contain %q, got %q", tc.in, tc.contains, out)
		}
		if strings.Contains(out, tc.absent) {
			t.Errorf("expected %q to redact %q, got %q", tc.in, tc.absent, out)
		}
	}
}

func TestRedactingWriterNestedAndStringValues(t *testing.T) {
	var buf bytes.Buffer
	w := redactingWriter{target: &buf}

	input := `{"level":"error","msg":"Bearer my_secret_jwt_token","nested":{"api_key":"ptlc_1234567890abcdef","ok":"value"}}`
	if _, err := w.Write([]byte(input)); err != nil {
		t.Fatalf("unexpected write error: %v", err)
	}
	got := buf.String()
	if strings.Contains(got, "my_secret_jwt_token") || strings.Contains(got, "ptlc_1234567890abcdef") {
		t.Fatalf("secrets leaked in log output: %s", got)
	}
	if !strings.Contains(got, "[REDACTED]") {
		t.Fatalf("expected [REDACTED] in log output: %s", got)
	}
}
