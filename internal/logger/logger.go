package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var Logger zerolog.Logger

type RedactHook struct{}

func (h RedactHook) Run(e *zerolog.Event, level zerolog.Level, msg string) {
	// Redaction is performed by redactingWriter after event serialization.
}

type redactingWriter struct{ target io.Writer }

func (w redactingWriter) Write(p []byte) (int, error) {
	var fields map[string]interface{}
	if err := json.Unmarshal(p, &fields); err == nil {
		for key := range fields {
			if IsSensitiveField(key) {
				fields[key] = "[REDACTED]"
			}
		}
		if clean, err := json.Marshal(fields); err == nil {
			clean = append(clean, '\n')
			if _, err := w.target.Write(clean); err != nil {
				return 0, err
			}
			return len(p), nil
		}
	}
	// Fail closed: never write unparseable data which might contain secrets.
	if _, err := w.target.Write([]byte("{\"error\":\"log event omitted\"}\n")); err != nil {
		return 0, err
	}
	return len(p), nil
}

type redactedValue struct{}

func (r redactedValue) String() string { return "[REDACTED]" }

// sensitiveFields contains field names that should never appear in logs
var sensitiveFields = []string{"token", "password", "key", "secret", "authorization", "credential", "api_key", "apikey"}

// IsSensitiveField checks if a field name should be redacted
func IsSensitiveField(name string) bool {
	lower := strings.ToLower(name)
	for _, sf := range sensitiveFields {
		if strings.Contains(lower, sf) {
			return true
		}
	}
	return false
}

// Init initializes the global logger
func Init(appDataDir string, debug bool) error {
	logDir := filepath.Join(appDataDir, "logs")
	if err := os.MkdirAll(logDir, 0700); err != nil {
		return fmt.Errorf("failed to create log directory: %w", err)
	}

	// Create log file with date-based naming
	logFile := filepath.Join(logDir, fmt.Sprintf("pterodesk_%s.log", time.Now().Format("2006-01-02")))
	f, err := os.OpenFile(logFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("failed to open log file: %w", err)
	}

	// Console writer for development
	consoleWriter := zerolog.ConsoleWriter{
		Out:        os.Stderr,
		TimeFormat: "15:04:05",
	}

	// Multi-writer: console + file
	multi := redactingWriter{target: io.MultiWriter(consoleWriter, f)}

	level := zerolog.InfoLevel
	if debug {
		level = zerolog.DebugLevel
	}

	Logger = zerolog.New(multi).
		Level(level).
		With().
		Timestamp().
		Caller().
		Str("app", "pterodesk").
		Logger()

	log.Logger = Logger
	return nil
}

// CleanOldLogs removes log files older than maxDays
func CleanOldLogs(appDataDir string, maxDays int) {
	logDir := filepath.Join(appDataDir, "logs")
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return
	}
	cutoff := time.Now().AddDate(0, 0, -maxDays)
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			os.Remove(filepath.Join(logDir, entry.Name()))
		}
	}
}
