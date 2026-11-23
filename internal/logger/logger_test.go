package logger

import (
	"bytes"
	"strings"
	"testing"

	"github.com/rs/zerolog"
)

func TestRedactingWriter(t *testing.T) {
	var out bytes.Buffer
	log := zerolog.New(redactingWriter{target: &out})
	log.Info().Str("token", "secret123").Str("user", "alice").Msg("test")
	if strings.Contains(out.String(), "secret123") || !strings.Contains(out.String(), "[REDACTED]") || !strings.Contains(out.String(), "alice") {
		t.Fatalf("log not redacted: %s", out.String())
	}
}
