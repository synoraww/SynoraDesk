package security

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const (
	lockoutHmacSecret = "synoradesk_lockout_hmac_secret_v1_secure"
)

// LockoutConfig holds customizable settings for anti-brute-force lock
type LockoutConfig struct {
	EnableLockout          bool `json:"enable_lockout"`
	MaxAttempts            int  `json:"max_attempts"`             // 3, 5, 10
	LockoutDurationMinutes int  `json:"lockout_duration_minutes"` // 1, 5, 15, 30, 60
	EnableAutoWipe         bool `json:"enable_auto_wipe"`         // optional self-destruct
	WipeAttempts           int  `json:"wipe_attempts"`            // 10
}

// LockoutState represents the persisted state
type LockoutState struct {
	FailedAttempts          int           `json:"failed_attempts"`
	ConsecutiveFails        int           `json:"consecutive_fails"`
	RemainingLockoutSeconds int           `json:"remaining_lockout_seconds"`
	IsLockedOut             bool          `json:"is_locked_out"`
	Config                  LockoutConfig `json:"config"`
	Checksum                string        `json:"checksum"`
}

// LockoutStatus is returned to UI
type LockoutStatus struct {
	IsLockedOut             bool          `json:"is_locked_out"`
	RemainingLockoutSeconds int           `json:"remaining_lockout_seconds"`
	FailedAttempts          int           `json:"failed_attempts"`
	ConsecutiveFails        int           `json:"consecutive_fails"`
	MaxAttempts             int           `json:"max_attempts"`
	LockoutDurationMinutes int           `json:"lockout_duration_minutes"`
	EnableLockout          bool          `json:"enable_lockout"`
	EnableAutoWipe         bool          `json:"enable_auto_wipe"`
	WipeAttempts           int           `json:"wipe_attempts"`
	DataWiped               bool          `json:"data_wiped"`
}

// LockoutManager handles tamper-proof persistent local lockout countdown
type LockoutManager struct {
	mu             sync.Mutex
	filePath       string
	creds          *CredentialStore
	state          LockoutState
	onWipeCallback func()
	stopTicker     chan struct{}
}

// DefaultLockoutConfig returns the default configuration where auto-wipe is explicitly disabled
func DefaultLockoutConfig() LockoutConfig {
	return LockoutConfig{
		EnableLockout:          true,
		MaxAttempts:            5,
		LockoutDurationMinutes: 15,
		EnableAutoWipe:         false, // Explicitly false by default: only timed lockout is triggered
		WipeAttempts:           10,
	}
}

// NewLockoutManager initializes the lockout manager
func NewLockoutManager(dataDir string, creds *CredentialStore, onWipeCallback func()) *LockoutManager {
	filePath := filepath.Join(dataDir, "security_lockout.dat")
	lm := &LockoutManager{
		filePath:       filePath,
		creds:          creds,
		onWipeCallback: onWipeCallback,
		stopTicker:     make(chan struct{}),
		state: LockoutState{
			Config: DefaultLockoutConfig(),
		},
	}

	lm.loadState()
	go lm.startLocalMonotonicCountdown()

	return lm
}

func (lm *LockoutManager) computeChecksum(s *LockoutState) string {
	mac := hmac.New(sha256.New, []byte(lockoutHmacSecret))
	data := fmt.Sprintf("%d:%d:%d:%v:%v:%d:%d:%v:%d",
		s.FailedAttempts,
		s.ConsecutiveFails,
		s.RemainingLockoutSeconds,
		s.IsLockedOut,
		s.Config.EnableLockout,
		s.Config.MaxAttempts,
		s.Config.LockoutDurationMinutes,
		s.Config.EnableAutoWipe,
		s.Config.WipeAttempts,
	)
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

func (lm *LockoutManager) loadState() {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	raw, err := os.ReadFile(lm.filePath)
	if err != nil {
		// New file or missing -> save initial default
		lm.saveStateLocked()
		return
	}

	// 1. Decrypt using Windows DPAPI
	decrypted, err := Decrypt(raw)
	if err != nil {
		// Tampered or invalid DPAPI!
		// If someone edited the file, penalize with lockout to prevent bypass!
		lm.state.IsLockedOut = true
		lm.state.RemainingLockoutSeconds = 15 * 60
		lm.saveStateLocked()
		return
	}

	var loaded LockoutState
	if err := json.Unmarshal(decrypted, &loaded); err != nil {
		lm.state.IsLockedOut = true
		lm.state.RemainingLockoutSeconds = 15 * 60
		lm.saveStateLocked()
		return
	}

	// 2. Validate HMAC Checksum
	expected := lm.computeChecksum(&loaded)
	if loaded.Checksum != expected {
		// Checksum mismatch -> Tampered!
		lm.state.IsLockedOut = true
		lm.state.RemainingLockoutSeconds = 15 * 60
		lm.saveStateLocked()
		return
	}

	lm.state = loaded

	// If remaining seconds > 0, ensure IsLockedOut is true
	if lm.state.RemainingLockoutSeconds > 0 {
		lm.state.IsLockedOut = true
	} else {
		lm.state.IsLockedOut = false
		lm.state.RemainingLockoutSeconds = 0
	}
}

func (lm *LockoutManager) saveStateLocked() {
	lm.state.Checksum = lm.computeChecksum(&lm.state)
	data, err := json.Marshal(lm.state)
	if err != nil {
		return
	}

	// Encrypt using DPAPI
	encrypted, err := Encrypt(data)
	if err != nil {
		return
	}

	_ = os.MkdirAll(filepath.Dir(lm.filePath), 0755)
	_ = os.WriteFile(lm.filePath, encrypted, 0600)
}

// Local monotonic countdown: Decrements strictly while the app is running!
// Time spent powered-off is NOT counted towards reducing the lockout.
func (lm *LockoutManager) startLocalMonotonicCountdown() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	saveCounter := 0
	for {
		select {
		case <-lm.stopTicker:
			return
		case <-ticker.C:
			lm.mu.Lock()
			if lm.state.RemainingLockoutSeconds > 0 {
				lm.state.RemainingLockoutSeconds--
				if lm.state.RemainingLockoutSeconds <= 0 {
					lm.state.RemainingLockoutSeconds = 0
					lm.state.IsLockedOut = false
					lm.state.FailedAttempts = 0
					lm.saveStateLocked()
				} else {
					saveCounter++
					// Save state to disk every 5 seconds or when changed
					if saveCounter >= 5 {
						saveCounter = 0
						lm.saveStateLocked()
					}
				}
			}
			lm.mu.Unlock()
		}
	}
}

// GetStatus returns the current lockout status
func (lm *LockoutManager) GetStatus() LockoutStatus {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	return LockoutStatus{
		IsLockedOut:             lm.state.IsLockedOut && lm.state.RemainingLockoutSeconds > 0,
		RemainingLockoutSeconds: lm.state.RemainingLockoutSeconds,
		FailedAttempts:          lm.state.FailedAttempts,
		ConsecutiveFails:        lm.state.ConsecutiveFails,
		MaxAttempts:             lm.state.Config.MaxAttempts,
		LockoutDurationMinutes: lm.state.Config.LockoutDurationMinutes,
		EnableLockout:          lm.state.Config.EnableLockout,
		EnableAutoWipe:         lm.state.Config.EnableAutoWipe,
		WipeAttempts:           lm.state.Config.WipeAttempts,
		DataWiped:               false,
	}
}

// RecordFailedAttempt registers a failed passcode/PIN attempt
func (lm *LockoutManager) RecordFailedAttempt() (LockoutStatus, error) {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	lm.state.FailedAttempts++
	lm.state.ConsecutiveFails++

	cfg := lm.state.Config

	// 1. Check Auto-Wipe trigger (if enabled)
	if cfg.EnableAutoWipe && cfg.WipeAttempts > 0 && lm.state.ConsecutiveFails >= cfg.WipeAttempts {
		lm.saveStateLocked()
		if lm.onWipeCallback != nil {
			go lm.onWipeCallback()
		}
		return LockoutStatus{
			IsLockedOut:             true,
			RemainingLockoutSeconds: 0,
			FailedAttempts:          lm.state.FailedAttempts,
			ConsecutiveFails:        lm.state.ConsecutiveFails,
			MaxAttempts:             cfg.MaxAttempts,
			LockoutDurationMinutes: cfg.LockoutDurationMinutes,
			EnableLockout:          cfg.EnableLockout,
			EnableAutoWipe:         cfg.EnableAutoWipe,
			WipeAttempts:           cfg.WipeAttempts,
			DataWiped:               true,
		}, nil
	}

	// 2. Check Lockout trigger
	if cfg.EnableLockout && cfg.MaxAttempts > 0 && lm.state.FailedAttempts >= cfg.MaxAttempts {
		durationSecs := cfg.LockoutDurationMinutes * 60
		if durationSecs <= 0 {
			durationSecs = 15 * 60
		}
		lm.state.IsLockedOut = true
		lm.state.RemainingLockoutSeconds = durationSecs
	}

	lm.saveStateLocked()

	return LockoutStatus{
		IsLockedOut:             lm.state.IsLockedOut && lm.state.RemainingLockoutSeconds > 0,
		RemainingLockoutSeconds: lm.state.RemainingLockoutSeconds,
		FailedAttempts:          lm.state.FailedAttempts,
		ConsecutiveFails:        lm.state.ConsecutiveFails,
		MaxAttempts:             cfg.MaxAttempts,
		LockoutDurationMinutes: cfg.LockoutDurationMinutes,
		EnableLockout:          cfg.EnableLockout,
		EnableAutoWipe:         cfg.EnableAutoWipe,
		WipeAttempts:           cfg.WipeAttempts,
		DataWiped:               false,
	}, nil
}

// RecordSuccess resets failed attempts after successful unlock
func (lm *LockoutManager) RecordSuccess() error {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	if lm.state.IsLockedOut && lm.state.RemainingLockoutSeconds > 0 {
		return fmt.Errorf("app is currently locked out")
	}

	lm.state.FailedAttempts = 0
	lm.state.ConsecutiveFails = 0
	lm.state.RemainingLockoutSeconds = 0
	lm.state.IsLockedOut = false
	lm.saveStateLocked()
	return nil
}

// UpdateConfig updates lockout settings
func (lm *LockoutManager) UpdateConfig(cfg LockoutConfig) error {
	lm.mu.Lock()
	defer lm.mu.Unlock()

	if cfg.MaxAttempts <= 0 {
		cfg.MaxAttempts = 5
	}
	if cfg.LockoutDurationMinutes <= 0 {
		cfg.LockoutDurationMinutes = 15
	}
	if cfg.WipeAttempts <= 0 {
		cfg.WipeAttempts = 10
	}

	lm.state.Config = cfg
	lm.saveStateLocked()
	return nil
}

// Close gracefully stops the countdown ticker and saves final state
func (lm *LockoutManager) Close() {
	close(lm.stopTicker)
	lm.mu.Lock()
	defer lm.mu.Unlock()
	lm.saveStateLocked()
}
