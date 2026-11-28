package panel

import (
	"testing"
	"time"

	"pterodesk/internal/database"
	"pterodesk/internal/security"
)

func TestManagerAutoActivatesFirstPanel(t *testing.T) {
	dir := t.TempDir()
	db, err := database.New(dir)
	if err != nil {
		t.Fatalf("database.New failed: %v", err)
	}
	defer db.Close()

	creds := security.NewCredentialStore()
	mgr := NewManager(db, creds)

	// 1. AddPanel on empty DB should auto-activate the first panel
	added, err := mgr.AddPanel(PanelInput{
		Name:         "Main Panel",
		URL:          "https://panel.example.com",
		ClientAPIKey: "ptlc_test_key_123456",
	})
	if err != nil {
		t.Fatalf("AddPanel failed: %v", err)
	}
	if !added.IsActive {
		t.Fatal("expected first added panel to be auto-activated")
	}

	active, err := mgr.GetActivePanel()
	if err != nil || active == nil || active.ID != added.ID {
		t.Fatalf("expected active panel %q, got %+v (err=%v)", added.ID, active, err)
	}

	// 2. Initialize when DB has panel with IsActive=false should still auto-activate it
	err = db.SavePanel(database.PanelRecord{
		ID:        "panel-inactive",
		Name:      "Fallback Panel",
		URL:       "https://fallback.example.com",
		IsActive:  false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	})
	if err != nil {
		t.Fatalf("SavePanel failed: %v", err)
	}
	_ = db.DeletePanel(added.ID)

	mgr2 := NewManager(db, creds)
	if err := mgr2.Initialize(); err != nil {
		t.Fatalf("Initialize failed: %v", err)
	}
	active2, err := mgr2.GetActivePanel()
	if err != nil || active2 == nil || active2.ID != "panel-inactive" {
		t.Fatalf("expected Initialize to auto-activate remaining panel, got %+v (err=%v)", active2, err)
	}
}
