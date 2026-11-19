package database

import (
	"os"
	"testing"
	"time"
)

func TestSQLite_MigrationsAndPanelCRUD(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "pterodesk_test_*")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	db, err := New(tempDir)
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	// 1. Create a Panel
	record := PanelRecord{
		ID:           "test-panel-1",
		Name:         "Production Panel",
		URL:          "https://panel.example.com",
		ClientAPIKey: "enc_client_key",
		AppAPIKey:    "enc_app_key",
		Version:      "1.11.0",
		IsActive:     true,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}

	if err := db.SavePanel(record); err != nil {
		t.Fatalf("SavePanel failed: %v", err)
	}

	// 2. Retrieve Panel
	p, err := db.GetPanel("test-panel-1")
	if err != nil {
		t.Fatalf("GetPanel failed: %v", err)
	}

	if p.Name != "Production Panel" || p.URL != "https://panel.example.com" {
		t.Errorf("Retrieved panel data mismatch: %+v", p)
	}

	// 3. Activity Logging
	act := ActivityRecord{
		PanelID:   "test-panel-1",
		PanelName: "Production Panel",
		ServerID:  "srv-1",
		Action:    "server.power.start",
		Result:    "success",
		Timestamp: time.Now(),
	}

	if err := db.SaveActivity(act); err != nil {
		t.Fatalf("SaveActivity failed: %v", err)
	}

	activities, err := db.GetActivities(10)
	if err != nil {
		t.Fatalf("GetActivities failed: %v", err)
	}
	if len(activities) == 0 {
		t.Fatalf("Expected at least 1 activity record")
	}

	// 4. Delete Panel
	if err := db.DeletePanel("test-panel-1"); err != nil {
		t.Fatalf("DeletePanel failed: %v", err)
	}

	_, err = db.GetPanel("test-panel-1")
	if err == nil {
		t.Fatalf("Expected error getting deleted panel, got nil")
	}
}
