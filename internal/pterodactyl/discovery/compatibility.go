package discovery

import "fmt"

// CompatibilityReport describes operational compatibility for a specific panel version
type CompatibilityReport struct {
	Version             PanelVersion      `json:"version"`
	SupportedFeatures   []string          `json:"supported_features"`
	DeprecatedFeatures  []string          `json:"deprecated_features"`
	UnavailableFeatures []string          `json:"unavailable_features"`
	MigrationNotes      []string          `json:"migration_notes"`
	Capabilities        PanelCapabilities `json:"capabilities"`
}

// GenerateCompatibilityReport builds a complete compatibility report
func GenerateCompatibilityReport(version PanelVersion, hasClientKey, hasAppKey bool) CompatibilityReport {
	caps := EvaluateCapabilities(hasClientKey, hasAppKey, version)

	var supported []string
	var deprecated []string
	var unavailable []string
	var notes []string

	if caps.HasClientAPI {
		supported = append(supported, "Server Console & WebSocket Streaming", "Power Controls", "File Manager & SFTP", "Backups Management", "Database Management", "Schedules & Crons", "Subuser Access")
	} else {
		unavailable = append(unavailable, "All Client-side server operations (Missing Client API Key)")
	}

	if caps.HasApplicationAPI {
		supported = append(supported, "Application Server Provisioning", "Node Management & Configuration", "IP & Port Allocation Pools")
		if !version.IsV2 {
			supported = append(supported, "Nests & Eggs Management (1.x Legacy)")
		} else {
			deprecated = append(deprecated, "Legacy Nests API (/api/application/nests)")
			notes = append(notes, "Pterodactyl 2.x replaces Nests with modular Blueprints/Server Configurations.")
		}
	} else {
		unavailable = append(unavailable, "Node Management, Server Provisioning, Allocations (Missing Application API Key)")
	}

	if version.IsV2 {
		notes = append(notes, "Panel version 2.x detected. Native admin routes and updated JWT auth protocols enabled.")
	} else {
		notes = append(notes, fmt.Sprintf("Panel version %s active (Pterodactyl 1.x line). All 1.x standard endpoints fully operational.", version.String()))
	}

	return CompatibilityReport{
		Version:             version,
		SupportedFeatures:   supported,
		DeprecatedFeatures:  deprecated,
		UnavailableFeatures: unavailable,
		MigrationNotes:      notes,
		Capabilities:        caps,
	}
}
