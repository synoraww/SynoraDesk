package discovery

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// PanelVersion represents a structured Pterodactyl Panel version
type PanelVersion struct {
	Raw        string `json:"raw"`
	Major      int    `json:"major"`
	Minor      int    `json:"minor"`
	Patch      int    `json:"patch"`
	PreRelease string `json:"pre_release"`
	IsV2       bool   `json:"is_v2"`
	Detected   bool   `json:"detected"`
}

var versionRegex = regexp.MustCompile(`^v?(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$`)

// ParseVersion parses a version string (e.g., "1.11.7", "v1.11.3", "2.0.0-alpha.1")
func ParseVersion(raw string) PanelVersion {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return PanelVersion{
			Raw:      "1.x (Default)",
			Major:    1,
			Minor:    11,
			Patch:    0,
			IsV2:     false,
			Detected: false,
		}
	}

	matches := versionRegex.FindStringSubmatch(raw)
	if matches == nil {
		// Fallback for non-semver strings
		isV2 := strings.HasPrefix(raw, "2.") || strings.HasPrefix(raw, "v2.")
		major := 1
		if isV2 {
			major = 2
		}
		return PanelVersion{
			Raw:      raw,
			Major:    major,
			IsV2:     isV2,
			Detected: true,
		}
	}

	major, _ := strconv.Atoi(matches[1])
	minor, _ := strconv.Atoi(matches[2])
	patch := 0
	if matches[3] != "" {
		patch, _ = strconv.Atoi(matches[3])
	}
	preRelease := matches[4]

	return PanelVersion{
		Raw:        raw,
		Major:      major,
		Minor:      minor,
		Patch:      patch,
		PreRelease: preRelease,
		IsV2:       major >= 2,
		Detected:   true,
	}
}

// String formats the PanelVersion
func (pv PanelVersion) String() string {
	if !pv.Detected {
		return pv.Raw
	}
	v := fmt.Sprintf("v%d.%d.%d", pv.Major, pv.Minor, pv.Patch)
	if pv.PreRelease != "" {
		v += "-" + pv.PreRelease
	}
	return v
}
