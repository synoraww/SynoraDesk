package api

import (
	"bytes"
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type roundTripFunc func(req *http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
}

func jsonResponse(status int, body string, headers map[string]string) *http.Response {
	h := make(http.Header)
	h.Set("Content-Type", "application/json")
	for k, v := range headers {
		h.Set(k, v)
	}
	return &http.Response{
		StatusCode: status,
		Header:     h,
		Body:       io.NopCloser(bytes.NewBufferString(body)),
	}
}

func TestBuildQueryString(t *testing.T) {
	q := BuildQueryString(ListOptions{
		Page:    2,
		PerPage: 150, // should clamp to 100
		Filters: map[string]string{
			"username": "alice",
			"email":    "alice@example.com",
			"empty":    "   ",
		},
		Sort:    "-id",
		Include: []string{"servers", " ", "allocations"},
	})

	expectedParts := []string{
		"filter%5Bemail%5D=alice%40example.com",
		"filter%5Busername%5D=alice",
		"include=servers%2Callocations",
		"page=2",
		"per_page=100",
		"sort=-id",
	}
	for _, part := range expectedParts {
		if !strings.Contains(q, part) {
			t.Errorf("expected query %q to contain %q", q, part)
		}
	}
	if strings.Contains(q, "empty") {
		t.Errorf("expected empty filter to be omitted, got %q", q)
	}
}

func TestFetchPage_PaginationAndEmpty(t *testing.T) {
	var capturedURL string
	var capturedAuth string

	appAPI := NewApplicationAPIWithConfig(ClientConfig{
		BaseURL: "https://panel.example.com",
		Token:   "ptla_secret_token_123",
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			capturedURL = req.URL.String()
			capturedAuth = req.Header.Get("Authorization")
			return jsonResponse(http.StatusOK, `{
				"object": "list",
				"data": [
					{"object": "user", "attributes": {"id": 1, "username": "admin", "email": "admin@example.com", "first_name": "Root", "last_name": "Admin", "root_admin": true}}
				],
				"meta": {
					"pagination": {"total": 25, "count": 1, "per_page": 10, "current_page": 2, "total_pages": 3}
				}
			}`, nil), nil
		}),
	})

	res, err := FetchPage[User](context.Background(), appAPI.http, "/users", ListOptions{
		Page:    2,
		PerPage: 10,
		Filters: map[string]string{"username": "admin"},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if capturedAuth != "Bearer ptla_secret_token_123" {
		t.Errorf("unexpected auth header: %q", capturedAuth)
	}
	if !strings.Contains(capturedURL, "/api/application/users?") || !strings.Contains(capturedURL, "page=2") {
		t.Errorf("unexpected URL: %s", capturedURL)
	}
	if len(res.Items) != 1 || res.Items[0].Username != "admin" {
		t.Errorf("unexpected items: %+v", res.Items)
	}
	if res.Pagination.Total != 25 || res.Pagination.CurrentPage != 2 || res.Pagination.TotalPages != 3 {
		t.Errorf("unexpected pagination: %+v", res.Pagination)
	}
}

func TestAPIError_NormalizationAndSecurity(t *testing.T) {
	secretToken := "ptla_super_secret_do_not_leak"

	tests := []struct {
		name           string
		status         int
		body           string
		headers        map[string]string
		wantCode       string
		wantReqID      string
		wantPermHint   bool
		wantValidation bool
		wantField      string
	}{
		{
			name:         "403 Forbidden with RequestID",
			status:       http.StatusForbidden,
			body:         `{"errors":[{"code":"HttpForbiddenException","status":"403","detail":"You do not have permission to access this resource."}]}`,
			headers:      map[string]string{"X-Request-Id": "req-abc-123"},
			wantCode:     "HttpForbiddenException",
			wantReqID:    "req-abc-123",
			wantPermHint: true,
		},
		{
			name:         "401 Unauthorized",
			status:       http.StatusUnauthorized,
			body:         `{"errors":[{"code":"AuthenticationException","status":"401","detail":"Unauthenticated."}]}`,
			headers:      map[string]string{"Cf-Ray": "ray-999"},
			wantCode:     "AuthenticationException",
			wantReqID:    "ray-999",
			wantPermHint: true,
		},
		{
			name:           "422 Validation Error",
			status:         http.StatusUnprocessableEntity,
			body:           `{"errors":[{"code":"ValidationException","status":"422","detail":"The email has already been taken.","meta":{"rule":"unique","source":{"field":"email"}}}]}`,
			wantCode:       "ValidationException",
			wantValidation: true,
			wantField:      "email",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			appAPI := NewApplicationAPIWithConfig(ClientConfig{
				BaseURL:    "https://panel.example.com",
				Token:      secretToken,
				MaxRetries: 0,
				Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
					return jsonResponse(tc.status, tc.body, tc.headers), nil
				}),
			})

			err := appAPI.TestConnection(context.Background())
			if err == nil {
				t.Fatal("expected error, got nil")
			}
			if strings.Contains(err.Error(), secretToken) {
				t.Fatalf("error message leaked API token: %s", err.Error())
			}

			var apiErr *APIError
			if !errors.As(err, &apiErr) {
				t.Fatalf("expected *APIError, got %T", err)
			}
			if apiErr.StatusCode != tc.status {
				t.Errorf("status = %d, want %d", apiErr.StatusCode, tc.status)
			}
			if apiErr.Code != tc.wantCode {
				t.Errorf("code = %q, want %q", apiErr.Code, tc.wantCode)
			}
			if apiErr.RequestID != tc.wantReqID {
				t.Errorf("requestID = %q, want %q", apiErr.RequestID, tc.wantReqID)
			}
			if tc.wantPermHint && apiErr.PermissionHint == "" {
				t.Errorf("expected PermissionHint to be populated")
			}
			if tc.wantValidation {
				if !apiErr.IsValidationError() {
					t.Errorf("expected IsValidationError() == true")
				}
				if apiErr.FieldErrors[tc.wantField] == "" {
					t.Errorf("expected FieldErrors[%q] to be populated, got %+v", tc.wantField, apiErr.FieldErrors)
				}
			}
		})
	}
}

func TestApplicationAPI_UsersCRUD(t *testing.T) {
	t.Run("ListUsersPage", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method != http.MethodGet || !strings.HasPrefix(req.URL.Path, "/api/application/users") {
					t.Fatalf("unexpected request: %s %s", req.Method, req.URL.String())
				}
				return jsonResponse(http.StatusOK, `{
					"object": "list",
					"data": [
						{"object": "user", "attributes": {"id": 5, "username": "jdoe", "email": "jdoe@example.com", "first_name": "John", "last_name": "Doe", "root_admin": false}}
					],
					"meta": {"pagination": {"total": 1, "count": 1, "per_page": 25, "current_page": 1, "total_pages": 1}}
				}`, nil), nil
			}),
		})

		res, err := appAPI.ListUsersPage(context.Background(), ListOptions{
			Page:    1,
			PerPage: 25,
			Filters: map[string]string{"username": "jdoe"},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(res.Items) != 1 || res.Items[0].ID != 5 {
			t.Fatalf("unexpected users: %+v", res.Items)
		}
	})

	t.Run("CreateUser_Validation", func(t *testing.T) {
		called := false
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				called = true
				return nil, nil
			}),
		})

		_, err := appAPI.CreateUser(context.Background(), CreateUserRequest{
			Email:     "invalid-email",
			Username:  "jdoe",
			FirstName: "John",
			LastName:  "Doe",
		})
		if err == nil {
			t.Fatal("expected validation error, got nil")
		}
		if called {
			t.Fatal("expected HTTP call not to be made when validation fails")
		}
	})

	t.Run("CreateUser_Success", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method != http.MethodPost || req.URL.Path != "/api/application/users" {
					t.Fatalf("unexpected request: %s %s", req.Method, req.URL.Path)
				}
				return jsonResponse(http.StatusCreated, `{
					"object": "user",
					"attributes": {"id": 10, "username": "alice", "email": "alice@example.com", "first_name": "Alice", "last_name": "Smith", "language": "en", "root_admin": true}
				}`, nil), nil
			}),
		})

		user, err := appAPI.CreateUser(context.Background(), CreateUserRequest{
			Email:     "alice@example.com",
			Username:  "alice",
			FirstName: "Alice",
			LastName:  "Smith",
			RootAdmin: true,
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.ID != 10 || !user.RootAdmin {
			t.Fatalf("unexpected user: %+v", user)
		}
	})

	t.Run("UpdateUser_Success", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method != http.MethodPatch || req.URL.Path != "/api/application/users/10" {
					t.Fatalf("unexpected request: %s %s", req.Method, req.URL.Path)
				}
				bodyBytes, _ := io.ReadAll(req.Body)
				if strings.Contains(string(bodyBytes), `"password"`) {
					t.Errorf("expected empty password to be omitted from PATCH body, got %s", string(bodyBytes))
				}
				return jsonResponse(http.StatusOK, `{
					"object": "user",
					"attributes": {"id": 10, "username": "alice", "email": "alice@example.com", "first_name": "Alice", "last_name": "Updated", "language": "en", "root_admin": false}
				}`, nil), nil
			}),
		})

		user, err := appAPI.UpdateUser(context.Background(), 10, UpdateUserRequest{
			Email:     "alice@example.com",
			Username:  "alice",
			FirstName: "Alice",
			LastName:  "Updated",
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if user.LastName != "Updated" {
			t.Fatalf("unexpected user: %+v", user)
		}
	})

	t.Run("DeleteUser_SuccessAndForbidden", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL:    "https://panel.example.com",
			Token:      "ptla_test",
			MaxRetries: 0,
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method != http.MethodDelete {
					t.Fatalf("expected DELETE, got %s", req.Method)
				}
				if req.URL.Path == "/api/application/users/99" {
					return jsonResponse(http.StatusForbidden, `{"errors":[{"code":"HttpForbiddenException","detail":"Forbidden"}]}`, nil), nil
				}
				return jsonResponse(http.StatusNoContent, "", nil), nil
			}),
		})

		if err := appAPI.DeleteUser(context.Background(), 10); err != nil {
			t.Fatalf("expected delete to succeed, got %v", err)
		}
		err := appAPI.DeleteUser(context.Background(), 99)
		var apiErr *APIError
		if !errors.As(err, &apiErr) || !apiErr.IsForbidden() {
			t.Fatalf("expected 403 APIError, got %v", err)
		}
	})
}

func TestApplicationAPI_ServersCRUD(t *testing.T) {
	t.Run("ListServersPage_WithNumericEnv", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method != http.MethodGet || !strings.HasPrefix(req.URL.Path, "/api/application/servers") {
					t.Fatalf("unexpected request: %s %s", req.Method, req.URL.String())
				}
				return jsonResponse(http.StatusOK, `{
					"object": "list",
					"data": [{
						"object": "server",
						"attributes": {
							"id": 12,
							"uuid": "srv-uuid-12",
							"identifier": "abcd1234",
							"name": "Survival SMP",
							"description": "Main server",
							"suspended": false,
							"limits": {"memory": 4096, "swap": 0, "disk": 20480, "io": 500, "cpu": 200},
							"feature_limits": {"databases": 2, "allocations": 3, "backups": 5},
							"user": 1, "node": 1, "allocation": 10, "nest": 1, "egg": 1,
							"container": {
								"startup_command": "java -jar server.jar",
								"image": "ghcr.io/pterodactyl/yolks:java_21",
								"installed": 1,
								"environment": {"SERVER_PORT": 25565, "EULA": true, "SERVER_JARFILE": "server.jar"}
							}
						}
					}],
					"meta": {"pagination": {"total": 1, "count": 1, "per_page": 25, "current_page": 1, "total_pages": 1}}
				}`, nil), nil
			}),
		})

		res, err := appAPI.ListServersPage(context.Background(), ListOptions{Page: 1, PerPage: 25})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(res.Items) != 1 || res.Items[0].Name != "Survival SMP" {
			t.Fatalf("unexpected servers: %+v", res.Items)
		}
	})

	t.Run("CreateServer_Validation", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				t.Fatal("should not send HTTP request on invalid input")
				return nil, nil
			}),
		})
		_, err := appAPI.CreateServer(context.Background(), CreateServerRequest{Name: ""})
		if err == nil {
			t.Fatal("expected validation error")
		}
	})

	t.Run("UpdateServerBuildAndStartup", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/application/servers/12/build":
					if req.Method != http.MethodPatch {
						t.Fatalf("expected PATCH, got %s", req.Method)
					}
					bodyBytes, _ := io.ReadAll(req.Body)
					if !strings.Contains(string(bodyBytes), `"memory":8192`) {
						t.Errorf("expected top-level memory field in build PATCH, got %s", string(bodyBytes))
					}
					return jsonResponse(http.StatusOK, `{"object":"server","attributes":{"id":12,"name":"Survival SMP"}}`, nil), nil
				case "/api/application/servers/12/startup":
					if req.Method != http.MethodPatch {
						t.Fatalf("expected PATCH, got %s", req.Method)
					}
					return jsonResponse(http.StatusOK, `{"object":"server","attributes":{"id":12,"name":"Survival SMP"}}`, nil), nil
				default:
					return jsonResponse(http.StatusNotFound, "", nil), nil
				}
			}),
		})

		_, err := appAPI.UpdateServerBuild(context.Background(), 12, UpdateServerBuildRequest{
			Allocation:    10,
			Memory:        8192,
			Disk:          20480,
			IO:            500,
			CPU:           200,
			FeatureLimits: FeatureLimits{Databases: 2, Allocations: 3, Backups: 5},
		})
		if err != nil {
			t.Fatalf("UpdateServerBuild failed: %v", err)
		}

		_, err = appAPI.UpdateServerStartup(context.Background(), 12, UpdateServerStartupRequest{
			Startup:     "java -Xms128M -jar server.jar",
			Environment: map[string]interface{}{"EULA": "TRUE"},
			Egg:         1,
			Image:       "ghcr.io/pterodactyl/yolks:java_21",
		})
		if err != nil {
			t.Fatalf("UpdateServerStartup failed: %v", err)
		}
	})

	t.Run("LifecycleActions", func(t *testing.T) {
		var paths []string
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				paths = append(paths, req.Method+" "+req.URL.Path)
				return jsonResponse(http.StatusNoContent, "", nil), nil
			}),
		})

		ctx := context.Background()
		if err := appAPI.SuspendServer(ctx, 12); err != nil {
			t.Fatal(err)
		}
		if err := appAPI.UnsuspendServer(ctx, 12); err != nil {
			t.Fatal(err)
		}
		if err := appAPI.ReinstallServer(ctx, 12); err != nil {
			t.Fatal(err)
		}
		if err := appAPI.DeleteServer(ctx, 12); err != nil {
			t.Fatal(err)
		}
		if err := appAPI.ForceDeleteServer(ctx, 12); err != nil {
			t.Fatal(err)
		}
		if len(paths) != 5 {
			t.Fatalf("expected 5 lifecycle calls, got %d: %v", len(paths), paths)
		}
	})
}

func TestApplicationAPI_NodesCRUD(t *testing.T) {
	t.Run("ListAndGetConfig", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				switch req.URL.Path {
				case "/api/application/nodes":
					return jsonResponse(http.StatusOK, `{
						"object":"list",
						"data":[{"object":"node","attributes":{"id":1,"name":"Node-01","fqdn":"node1.example.com","scheme":"https","memory":16384,"disk":102400,"daemon_listen":8080,"daemon_sftp":2022,"location_id":1,"public":true}}],
						"meta":{"pagination":{"total":1,"count":1,"per_page":25,"current_page":1,"total_pages":1}}
					}`, nil), nil
				case "/api/application/nodes/1/configuration":
					return jsonResponse(http.StatusOK, `{"debug":false,"uuid":"node-uuid-1","token_id":"tok1","token":"secret-node-token","api":{"host":"0.0.0.0","port":8080,"upload_limit":100,"ssl":{"enabled":true,"cert":"/etc/ssl/cert.pem","key":"/etc/ssl/key.pem"}},"system":{"data":"/var/lib/pterodactyl/volumes","sftp":{"bind_port":2022}},"allowed_mounts":[],"remote":"https://panel.example.com"}`, nil), nil
				default:
					return jsonResponse(http.StatusNotFound, "", nil), nil
				}
			}),
		})

		list, err := appAPI.ListNodesPage(context.Background(), ListOptions{Page: 1, PerPage: 25})
		if err != nil || len(list.Items) != 1 || list.Items[0].Name != "Node-01" {
			t.Fatalf("ListNodesPage failed: %v, %+v", err, list)
		}

		cfg, err := appAPI.GetNodeConfiguration(context.Background(), 1)
		if err != nil || cfg.UUID != "node-uuid-1" || cfg.API.Port != 8080 {
			t.Fatalf("GetNodeConfiguration failed: %v, %+v", err, cfg)
		}
	})

	t.Run("CreateAndUpdateNode_Validation", func(t *testing.T) {
		appAPI := NewApplicationAPIWithConfig(ClientConfig{
			BaseURL: "https://panel.example.com",
			Token:   "ptla_test",
			Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.Method == http.MethodPost {
					return jsonResponse(http.StatusCreated, `{"object":"node","attributes":{"id":2,"name":"Node-02","fqdn":"node2.example.com"}}`, nil), nil
				}
				if req.Method == http.MethodPatch {
					return jsonResponse(http.StatusOK, `{"object":"node","attributes":{"id":2,"name":"Node-02-Updated","fqdn":"node2.example.com"}}`, nil), nil
				}
				return jsonResponse(http.StatusNoContent, "", nil), nil
			}),
		})

		if _, err := appAPI.CreateNode(context.Background(), CreateNodeRequest{Name: ""}); err == nil {
			t.Fatal("expected validation error for empty node")
		}

		validReq := CreateNodeRequest{
			Name:         "Node-02",
			LocationID:   1,
			FQDN:         "node2.example.com",
			Scheme:       "https",
			Public:       true,
			Memory:       8192,
			Disk:         51200,
			UploadSize:   100,
			DaemonListen: 8080,
			DaemonSFTP:   2022,
		}
		created, err := appAPI.CreateNode(context.Background(), validReq)
		if err != nil || created.ID != 2 {
			t.Fatalf("CreateNode failed: %v", err)
		}
		validReq.Name = "Node-02-Updated"
		updated, err := appAPI.UpdateNode(context.Background(), 2, validReq)
		if err != nil || updated.Name != "Node-02-Updated" {
			t.Fatalf("UpdateNode failed: %v", err)
		}
		if err := appAPI.DeleteNode(context.Background(), 2); err != nil {
			t.Fatalf("DeleteNode failed: %v", err)
		}
	})
}

func TestApplicationAPI_LocationsCRUD(t *testing.T) {
	appAPI := NewApplicationAPIWithConfig(ClientConfig{
		BaseURL: "https://panel.example.com",
		Token:   "ptla_test",
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.Method == http.MethodGet && req.URL.Path == "/api/application/locations":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"location","attributes":{"id":1,"short":"us.nyc","long":"New York, USA"}}],"meta":{"pagination":{"total":1,"count":1,"per_page":25,"current_page":1,"total_pages":1}}}`, nil), nil
			case req.Method == http.MethodPost && req.URL.Path == "/api/application/locations":
				return jsonResponse(http.StatusCreated, `{"object":"location","attributes":{"id":2,"short":"sg.sin","long":"Singapore"}}`, nil), nil
			case req.Method == http.MethodPatch && req.URL.Path == "/api/application/locations/2":
				return jsonResponse(http.StatusOK, `{"object":"location","attributes":{"id":2,"short":"sg.sin1","long":"Singapore DC1"}}`, nil), nil
			case req.Method == http.MethodDelete && req.URL.Path == "/api/application/locations/2":
				return jsonResponse(http.StatusNoContent, "", nil), nil
			default:
				return jsonResponse(http.StatusNotFound, "", nil), nil
			}
		}),
	})

	ctx := context.Background()
	if _, err := appAPI.CreateLocation(ctx, CreateLocationRequest{Short: ""}); err == nil {
		t.Fatal("expected validation error for empty short code")
	}
	list, err := appAPI.ListLocationsPage(ctx, ListOptions{Page: 1, PerPage: 25})
	if err != nil || len(list.Items) != 1 || list.Items[0].Short != "us.nyc" {
		t.Fatalf("ListLocationsPage failed: %v", err)
	}
	created, err := appAPI.CreateLocation(ctx, CreateLocationRequest{Short: "sg.sin", Long: "Singapore"})
	if err != nil || created.ID != 2 {
		t.Fatalf("CreateLocation failed: %v", err)
	}
	updated, err := appAPI.UpdateLocation(ctx, 2, CreateLocationRequest{Short: "sg.sin1", Long: "Singapore DC1"})
	if err != nil || updated.Short != "sg.sin1" {
		t.Fatalf("UpdateLocation failed: %v", err)
	}
	if err := appAPI.DeleteLocation(ctx, 2); err != nil {
		t.Fatalf("DeleteLocation failed: %v", err)
	}
}

func TestApplicationAPI_NestsAndEggs(t *testing.T) {
	appAPI := NewApplicationAPIWithConfig(ClientConfig{
		BaseURL: "https://panel.example.com",
		Token:   "ptla_test",
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/api/application/nests":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"nest","attributes":{"id":1,"name":"Minecraft","author":"support@pterodactyl.io","description":"Minecraft Servers"}}],"meta":{"pagination":{"total":1,"count":1,"per_page":25,"current_page":1,"total_pages":1}}}`, nil), nil
			case "/api/application/nests/1/eggs":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"egg","attributes":{"id":1,"nest":1,"name":"Paper","docker_image":"ghcr.io/pterodactyl/yolks:java_21","startup":"java -jar server.jar"}}],"meta":{"pagination":{"total":1,"count":1,"per_page":25,"current_page":1,"total_pages":1}}}`, nil), nil
			case "/api/application/nests/1/eggs/1":
				return jsonResponse(http.StatusOK, `{"object":"egg","attributes":{"id":1,"nest":1,"name":"Paper","docker_image":"ghcr.io/pterodactyl/yolks:java_21","startup":"java -jar server.jar","config":{"stop":"stop"},"script":{"privileged":false,"install":"#!/bin/bash\necho ok","entry":"bash","container":"alpine:3.4"}}}`, nil), nil
			default:
				return jsonResponse(http.StatusNotFound, "", nil), nil
			}
		}),
	})

	ctx := context.Background()
	nests, err := appAPI.ListNestsPage(ctx, ListOptions{Page: 1, PerPage: 25})
	if err != nil || len(nests.Items) != 1 || nests.Items[0].Name != "Minecraft" {
		t.Fatalf("ListNestsPage failed: %v", err)
	}
	eggs, err := appAPI.ListEggsPage(ctx, 1, ListOptions{Page: 1, PerPage: 25})
	if err != nil || len(eggs.Items) != 1 || eggs.Items[0].Name != "Paper" {
		t.Fatalf("ListEggsPage failed: %v", err)
	}
	egg, err := appAPI.GetEgg(ctx, 1, 1)
	if err != nil || egg.Script == nil || egg.Config == nil {
		t.Fatalf("GetEgg failed: %v", err)
	}
}

func TestApplicationAPI_AllocationsAndDatabases(t *testing.T) {
	appAPI := NewApplicationAPIWithConfig(ClientConfig{
		BaseURL: "https://panel.example.com",
		Token:   "ptla_test",
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.Method == http.MethodGet && req.URL.Path == "/api/application/nodes/1/allocations":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"allocation","attributes":{"id":10,"ip":"192.168.1.10","port":25565,"assigned":true}}],"meta":{"pagination":{"total":1,"count":1,"per_page":25,"current_page":1,"total_pages":1}}}`, nil), nil
			case req.Method == http.MethodPost && req.URL.Path == "/api/application/nodes/1/allocations":
				return jsonResponse(http.StatusNoContent, "", nil), nil
			case req.Method == http.MethodDelete && req.URL.Path == "/api/application/nodes/1/allocations/10":
				return jsonResponse(http.StatusNoContent, "", nil), nil
			case req.Method == http.MethodGet && req.URL.Path == "/api/application/servers/5/databases":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"server_database","attributes":{"id":3,"server":5,"host":1,"database":"s5_main","username":"u5_main","remote":"%","max_connections":0}}],"meta":{"pagination":{"total":1,"count":1,"per_page":25,"current_page":1,"total_pages":1}}}`, nil), nil
			case req.Method == http.MethodPost && req.URL.Path == "/api/application/servers/5/databases":
				return jsonResponse(http.StatusCreated, `{"object":"server_database","attributes":{"id":4,"server":5,"host":1,"database":"s5_new","username":"u5_new","remote":"%"}}`, nil), nil
			case req.Method == http.MethodPost && req.URL.Path == "/api/application/servers/5/databases/4/reset-password":
				return jsonResponse(http.StatusNoContent, "", nil), nil
			case req.Method == http.MethodDelete && req.URL.Path == "/api/application/servers/5/databases/4":
				return jsonResponse(http.StatusNoContent, "", nil), nil
			default:
				return jsonResponse(http.StatusNotFound, "", nil), nil
			}
		}),
	})

	ctx := context.Background()
	allocs, err := appAPI.ListNodeAllocationsPage(ctx, 1, ListOptions{Page: 1, PerPage: 25})
	if err != nil || len(allocs.Items) != 1 || allocs.Items[0].Port != 25565 {
		t.Fatalf("ListNodeAllocationsPage failed: %v", err)
	}
	if err := appAPI.CreateNodeAllocations(ctx, 1, CreateAllocationRequest{IP: "192.168.1.10", Ports: []string{"25566-25568"}}); err != nil {
		t.Fatalf("CreateNodeAllocations failed: %v", err)
	}
	if err := appAPI.DeleteNodeAllocation(ctx, 1, 10); err != nil {
		t.Fatalf("DeleteNodeAllocation failed: %v", err)
	}

	dbs, err := appAPI.ListServerDatabases(ctx, 5, ListOptions{Page: 1, PerPage: 25})
	if err != nil || len(dbs.Items) != 1 || dbs.Items[0].Database != "s5_main" {
		t.Fatalf("ListServerDatabases failed: %v", err)
	}
	db, err := appAPI.CreateServerDatabase(ctx, 5, CreateAppDatabaseRequest{Database: "new", Remote: "%", Host: 1})
	if err != nil || db.ID != 4 {
		t.Fatalf("CreateServerDatabase failed: %v", err)
	}
	if err := appAPI.ResetServerDatabasePassword(ctx, 5, 4); err != nil {
		t.Fatalf("ResetServerDatabasePassword failed: %v", err)
	}
	if err := appAPI.DeleteServerDatabase(ctx, 5, 4); err != nil {
		t.Fatalf("DeleteServerDatabase failed: %v", err)
	}
}

func TestApplicationAPI_ProbePermissions(t *testing.T) {
	locationAttempts := 0
	appAPI := NewApplicationAPIWithConfig(ClientConfig{
		BaseURL: "https://panel.example.com",
		Token:   "ptla_test",
		Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			switch req.URL.Path {
			case "/api/application/users":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[],"meta":{"pagination":{"total":0}}}`, nil), nil
			case "/api/application/servers":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"server","attributes":{"id":7,"name":"srv"}}],"meta":{"pagination":{"total":1}}}`, nil), nil
			case "/api/application/servers/7/databases":
				return jsonResponse(http.StatusForbidden, `{"errors":[{"code":"HttpForbiddenException","detail":"Forbidden"}]}`, nil), nil
			case "/api/application/nodes":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[{"object":"node","attributes":{"id":2,"name":"n1"}}],"meta":{"pagination":{"total":1}}}`, nil), nil
			case "/api/application/nodes/2/allocations":
				return jsonResponse(http.StatusOK, `{"object":"list","data":[],"meta":{"pagination":{"total":0}}}`, nil), nil
			case "/api/application/locations":
				locationAttempts++
				return nil, errors.New("dial timeout")
			case "/api/application/nests":
				return jsonResponse(http.StatusNotFound, `{"errors":[{"code":"NotFoundHttpException","detail":"Not found"}]}`, nil), nil
			default:
				return jsonResponse(http.StatusNotFound, "", nil), nil
			}
		}),
	})

	res := appAPI.ProbePermissions(context.Background())
	if !res["users"].Allowed || !res["servers"].Allowed || !res["nodes"].Allowed || !res["allocations"].Allowed {
		t.Fatalf("expected users/servers/nodes/allocations to be allowed: %+v", res)
	}
	if res["databases"].Allowed || res["databases"].StatusCode != 403 || res["databases"].Attempts != 1 {
		t.Fatalf("expected databases 403 with 1 attempt, got %+v", res["databases"])
	}
	if res["locations"].Allowed || res["locations"].Attempts != 3 || locationAttempts != 3 {
		t.Fatalf("expected locations to retry 3 times and fail, got %+v (calls=%d)", res["locations"], locationAttempts)
	}
	if res["nests"].Allowed || res["nests"].StatusCode != 404 {
		t.Fatalf("expected nests 404, got %+v", res["nests"])
	}
}

func TestCheckNodeHealth(t *testing.T) {
	nodes := []Node{
		{ID: 1, FQDN: "node1.example.com", Scheme: "https", DaemonListen: 8080},
		{ID: 2, FQDN: "node2.example.com", Scheme: "http", DaemonListen: 8080},
	}

	results := CheckNodesHealth(context.Background(), nodes, roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.Host == "node1.example.com:8080" {
			return jsonResponse(http.StatusUnauthorized, `{"error":"unauthorized"}`, nil), nil
		}
		return nil, errors.New("connection refused")
	}))

	if !results[1].Reachable || results[1].StatusCode != 401 {
		t.Fatalf("expected node 1 to be reachable (401 from Wings), got %+v", results[1])
	}
	if results[2].Reachable || results[2].Error == "" {
		t.Fatalf("expected node 2 to be unreachable, got %+v", results[2])
	}
}
