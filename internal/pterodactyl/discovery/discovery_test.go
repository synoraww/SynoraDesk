package discovery

import (
	"testing"
)

func TestParseVersion(t *testing.T) {
	tests := []struct {
		input       string
		wantMajor   int
		wantMinor   int
		wantPatch   int
		wantIsV2    bool
		wantDetected bool
	}{
		{"1.11.7", 1, 11, 7, false, true},
		{"v1.11.3", 1, 11, 3, false, true},
		{"2.0.0-beta.1", 2, 0, 0, true, true},
		{"2.1.0", 2, 1, 0, true, true},
		{"", 1, 11, 0, false, false},
	}

	for _, tt := range tests {
		got := ParseVersion(tt.input)
		if got.Major != tt.wantMajor || got.IsV2 != tt.wantIsV2 || got.Detected != tt.wantDetected {
			t.Errorf("ParseVersion(%q) = %+v, want major=%d, isV2=%v, detected=%v",
				tt.input, got, tt.wantMajor, tt.wantIsV2, tt.wantDetected)
		}
	}
}

func TestRegistryStats(t *testing.T) {
	reg := DefaultRegistry()
	if len(reg.Endpoints) == 0 {
		t.Fatal("expected registry to have endpoints, got 0")
	}

	stats := reg.Stats()
	if stats[StatusTested]+stats[StatusImplemented] == 0 {
		t.Errorf("expected tested or implemented endpoints, got stats: %+v", stats)
	}
}

func TestEvaluateCapabilities(t *testing.T) {
	v1 := ParseVersion("1.11.7")
	capsV1 := EvaluateCapabilities(true, true, v1)
	if !capsV1.CanManageNests {
		t.Error("v1 with app key should allow managing nests")
	}

	v2 := ParseVersion("2.0.0")
	capsV2 := EvaluateCapabilities(true, true, v2)
	if capsV2.CanManageNests {
		t.Error("v2 should disable legacy nests")
	}
	if !capsV2.IsV2 {
		t.Error("expected IsV2=true for v2.0.0")
	}
}
