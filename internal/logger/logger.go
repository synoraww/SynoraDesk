package logger

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

var Logger zerolog.Logger

var (
	reBearerToken = regexp.MustCompile(`(?i)(Bearer\s+)[A-Za-z0-9._\-~+/=]+`)
	rePteroToken  = regexp.MustCompile(`\b(ptlc|ptla)_[A-Za-z0-9]{12,}\b`)
	reURLCreds    = regexp.MustCompile(`(https?://)([^:/@\s]+):([^/@\s]+)@`)
)

// RedactString masks bearer tokens, Pterodactyl API keys, and embedded URL credentials.
func RedactString(s string) string {
	if s == "" {
		return s
	}
	s = reBearerToken.ReplaceAllString(s, "${1}[REDACTED]")
	s = rePteroToken.ReplaceAllString(s, "${1}_[REDACTED]")
	s = reURLCreds.ReplaceAllString(s, "${1}[REDACTED]:[REDACTED]@")
	return s
}

type RedactHook struct{}

func (h RedactHook) Run(e *zerolog.Event, level zerolog.Level, msg string) {
	// Redaction is performed by redactingWriter after event serialization.
}

type redactingWriter struct{ target io.Writer }

func redactValue(v interface{}) interface{} {
	switch val := v.(type) {
	case map[string]interface{}:
		for k, child := range val {
			if IsSensitiveField(k) {
				val[k] = "[REDACTED]"
			} else {
				val[k] = redactValue(child)
			}
		}
		return val
	case []interface{}:
		for i, item := range val {
			val[i] = redactValue(item)
		}
		return val
	case string:
		return RedactString(val)
	default:
		return v
	}
}

func (w redactingWriter) Write(p []byte) (int, error) {
	var fields map[string]interface{}
	if err := json.Unmarshal(p, &fields); err == nil {
		redactValue(fields)
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

// SetDebugLevel toggles the global logger level between Debug and Info at runtime.
func SetDebugLevel(debug bool) {
	if debug {
		Logger = Logger.Level(zerolog.DebugLevel)
	} else {
		Logger = Logger.Level(zerolog.InfoLevel)
	}
	log.Logger = Logger
}

// IsDebugLevel reports whether the logger is currently at DebugLevel.
func IsDebugLevel() bool {
	return Logger.GetLevel() == zerolog.DebugLevel
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

// GetLogStats returns the number of log files and their total size in bytes.
func GetLogStats(appDataDir string) (count int, totalBytes int64) {
	logDir := filepath.Join(appDataDir, "logs")
	entries, err := os.ReadDir(logDir)
	if err != nil {
		return 0, 0
	}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		if info, err := entry.Info(); err == nil {
			count++
			totalBytes += info.Size()
		}
	}
	return count, totalBytes
}

// ReadRecentErrors returns up to maxLines redacted warn/error lines from today's log file.
func ReadRecentErrors(appDataDir string, maxLines int) []string {
	if maxLines <= 0 {
		maxLines = 20
	}
	logFile := filepath.Join(appDataDir, "logs", fmt.Sprintf("pterodesk_%s.log", time.Now().Format("2006-01-02")))
	data, err := os.ReadFile(logFile)
	if err != nil {
		return nil
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	var matched []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		lower := strings.ToLower(line)
		if strings.Contains(lower, `"level":"error"`) || strings.Contains(lower, `"level":"warn"`) || strings.Contains(lower, `"level":"fatal"`) {
			matched = append(matched, RedactString(line))
		}
	}
	if len(matched) > maxLines {
		matched = matched[len(matched)-maxLines:]
	}
	return matched
}
