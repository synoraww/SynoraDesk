package api

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientAPI_GetAccount(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/client/account" {
			t.Errorf("unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Header.Get("Authorization") != "Bearer test-token" {
			t.Errorf("missing or invalid authorization header")
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		resp := SingleResponse[Account]{
			Object: "user",
			Attributes: Account{
				ID:        1,
				Admin:     true,
				Username:  "admin",
				Email:     "admin@example.com",
				FirstName: "Root",
				LastName:  "Admin",
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClientAPI(server.URL, "test-token")
	acc, err := client.GetAccount(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if acc.Username != "admin" || !acc.Admin {
		t.Errorf("unexpected account data: %+v", acc)
	}
}

func TestClientAPI_SendPowerAction(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/client/servers/srv-123/power" {
			t.Errorf("unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.Method != http.MethodPost {
			t.Errorf("expected POST, got %s", r.Method)
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		var body map[string]string
		_ = json.NewDecoder(r.Body).Decode(&body)
		if body["signal"] != "restart" {
			t.Errorf("expected signal restart, got %s", body["signal"])
		}

		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	client := NewClientAPI(server.URL, "test-token")
	err := client.SendPowerAction(context.Background(), "srv-123", "restart")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestClientAPI_ListBackups(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/api/client/servers/srv-abc/backups" {
			t.Errorf("unexpected path: %s", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}

		resp := PaginatedResponse[Backup]{
			Object: "list",
			Data: []struct {
				Object     string `json:"object"`
				Attributes Backup `json:"attributes"`
			}{
				{
					Object: "backup",
					Attributes: Backup{
						UUID:         "bak-1",
						Name:         "Daily Auto Backup",
						Bytes:        1048576,
						IsSuccessful: true,
						IsLocked:     true,
					},
				},
			},
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClientAPI(server.URL, "test-token")
	backups, err := client.ListBackups(context.Background(), "srv-abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(backups) != 1 || backups[0].Name != "Daily Auto Backup" {
		t.Errorf("unexpected backups result: %+v", backups)
	}
}

func TestClientAPI_RateLimitHandling(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts < 2 {
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"errors":[{"code":"TooManyRequestsHttpException","detail":"Too Many Requests"}]}`))
			return
		}

		resp := SingleResponse[Account]{
			Object: "user",
			Attributes: Account{
				Username: "rate_limited_user",
			},
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewClientAPI(server.URL, "test-token")
	acc, err := client.GetAccount(context.Background())
	if err != nil {
		t.Fatalf("expected retry to succeed, got error: %v", err)
	}
	if acc.Username != "rate_limited_user" {
		t.Errorf("unexpected username: %s", acc.Username)
	}
	if attempts < 2 {
		t.Errorf("expected at least 2 attempts due to 429 retry, got %d", attempts)
	}
}

func TestClientAPI_AccountEndpoints(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/api/client/account/email" && r.Method == http.MethodPut:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["email"] != "new@example.com" || body["password"] != "secret" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case r.URL.Path == "/api/client/account/password" && r.Method == http.MethodPut:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["current_password"] != "old" || body["password"] != "newpassword" {
				w.WriteHeader(http.StatusBadRequest)
				return
			}
			w.WriteHeader(http.StatusNoContent)

		case r.URL.Path == "/api/client/account/two-factor" && r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"data": map[string]string{
					"image_url_data": "data:image/svg+xml;base64,mock",
					"secret":         "MOCKSECRET123",
				},
			})

		case r.URL.Path == "/api/client/account/two-factor" && r.Method == http.MethodPost:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["code"] == "123456" {
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"object": "recovery_tokens",
					"attributes": map[string]interface{}{
						"tokens": []string{"tok-1", "tok-2"},
					},
				})
			} else {
				w.WriteHeader(http.StatusBadRequest)
			}

		case r.URL.Path == "/api/client/account/two-factor" && r.Method == http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)

		case r.URL.Path == "/api/client/account/api-keys" && r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(PaginatedResponse[AccountApiKey]{
				Object: "list",
				Data: []struct {
					Object     string        `json:"object"`
					Attributes AccountApiKey `json:"attributes"`
				}{
					{
						Object: "api_key",
						Attributes: AccountApiKey{
							Identifier:  "key-1",
							Description: "Test Key",
						},
					},
				},
			})

		case r.URL.Path == "/api/client/account/api-keys" && r.Method == http.MethodPost:
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"object": "api_key",
				"attributes": AccountApiKey{
					Identifier:  "key-new",
					Description: "Created Key",
				},
				"meta": map[string]string{
					"secret_token": "ptlc_secret123",
				},
			})

		case r.URL.Path == "/api/client/account/api-keys/key-1" && r.Method == http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)

		case r.URL.Path == "/api/client/account/ssh-keys" && r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(PaginatedResponse[AccountSSHKey]{
				Object: "list",
				Data: []struct {
					Object     string        `json:"object"`
					Attributes AccountSSHKey `json:"attributes"`
				}{
					{
						Object: "ssh_key",
						Attributes: AccountSSHKey{
							Name:        "My Laptop",
							Fingerprint: "SHA256:abc",
						},
					},
				},
			})

		case r.URL.Path == "/api/client/account/ssh-keys" && r.Method == http.MethodPost:
			_ = json.NewEncoder(w).Encode(SingleResponse[AccountSSHKey]{
				Object: "ssh_key",
				Attributes: AccountSSHKey{
					Name:        "New SSH Key",
					Fingerprint: "SHA256:new",
				},
			})

		case r.URL.Path == "/api/client/account/ssh-keys/remove" && r.Method == http.MethodPost:
			w.WriteHeader(http.StatusNoContent)

		case r.URL.Path == "/api/client/account/activity" && r.Method == http.MethodGet:
			_ = json.NewEncoder(w).Encode(PaginatedResponse[AccountActivity]{
				Object: "list",
				Data: []struct {
					Object     string          `json:"object"`
					Attributes AccountActivity `json:"attributes"`
				}{
					{
						Object: "activity_log",
						Attributes: AccountActivity{
							ID:    "act-1",
							Event: "account:email.update",
							IP:    "127.0.0.1",
						},
					},
				},
			})

		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	ctx := context.Background()
	client := NewClientAPI(server.URL, "test-token")

	// 1. Update Email
	if err := client.UpdateEmail(ctx, "new@example.com", "secret"); err != nil {
		t.Fatalf("UpdateEmail failed: %v", err)
	}

	// 2. Update Password
	if err := client.UpdatePassword(ctx, "old", "newpassword", "newpassword"); err != nil {
		t.Fatalf("UpdatePassword failed: %v", err)
	}

	// 3. 2FA Details
	t2fa, err := client.GetTwoFactorDetails(ctx)
	if err != nil || t2fa.Secret != "MOCKSECRET123" {
		t.Fatalf("GetTwoFactorDetails failed: %v, %+v", err, t2fa)
	}

	// 4. Enable 2FA
	tokens, err := client.EnableTwoFactor(ctx, "123456")
	if err != nil || len(tokens) != 2 {
		t.Fatalf("EnableTwoFactor failed: %v, tokens: %+v", err, tokens)
	}

	// 5. Disable 2FA
	if err := client.DisableTwoFactor(ctx, "pass"); err != nil {
		t.Fatalf("DisableTwoFactor failed: %v", err)
	}

	// 6. List API keys
	keys, err := client.ListAPIKeys(ctx)
	if err != nil || len(keys) != 1 || keys[0].Identifier != "key-1" {
		t.Fatalf("ListAPIKeys failed: %v, keys: %+v", err, keys)
	}

	// 7. Create API key
	createdKey, err := client.CreateAPIKey(ctx, "Created Key", []string{"1.1.1.1"})
	if err != nil || createdKey.SecretToken != "ptlc_secret123" {
		t.Fatalf("CreateAPIKey failed: %v, createdKey: %+v", err, createdKey)
	}

	// 8. Delete API key
	if err := client.DeleteAPIKey(ctx, "key-1"); err != nil {
		t.Fatalf("DeleteAPIKey failed: %v", err)
	}

	// 9. List SSH keys
	sshList, err := client.ListSSHKeys(ctx)
	if err != nil || len(sshList) != 1 || sshList[0].Name != "My Laptop" {
		t.Fatalf("ListSSHKeys failed: %v, sshList: %+v", err, sshList)
	}

	// 10. Create SSH key
	createdSSH, err := client.CreateSSHKey(ctx, "New SSH Key", "ssh-ed25519 AAA...")
	if err != nil || createdSSH.Fingerprint != "SHA256:new" {
		t.Fatalf("CreateSSHKey failed: %v, createdSSH: %+v", err, createdSSH)
	}

	// 11. Remove SSH key
	if err := client.RemoveSSHKey(ctx, "SHA256:abc"); err != nil {
		t.Fatalf("RemoveSSHKey failed: %v", err)
	}

	// 12. Account activity
	acts, err := client.GetAccountActivity(ctx)
	if err != nil || len(acts) != 1 || acts[0].Event != "account:email.update" {
		t.Fatalf("GetAccountActivity failed: %v, acts: %+v", err, acts)
	}
}
