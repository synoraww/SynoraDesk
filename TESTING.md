# PteroDesk Testing & Verification Guide

## Testing Strategy

PteroDesk features a layered testing architecture covering unit tests, cryptographic tests, mock HTTP server tests, and build artifact verification.

---

## 1. Automated Test Suites

### A. Mock HTTP Server Tests (`internal/api/client_test.go`)
Uses `net/http/httptest` to simulate official Pterodactyl REST endpoints and Wings behaviors:
- `TestClientAPI_GetAccount`: Verifies Bearer authentication header validation and JSON parsing.
- `TestClientAPI_SendPowerAction`: Validates power signal dispatch payloads (`start`, `stop`, `restart`, `kill`).
- `TestClientAPI_ListBackups`: Verifies paginated backups list parsing and checksum fields.
- `TestClientAPI_RateLimitHandling`: Simulates HTTP `429 Too Many Requests` responses, tests exponential backoff retry behavior, and ensures transparent recovery.

### B. SQLite Database & Migration Tests (`internal/database/sqlite_test.go`)
- `TestSQLite_MigrationsAndPanelCRUD`: Initializes in-memory/temp SQLite database in WAL mode, runs table creation migrations, and validates CRUD operations for panel profiles.

### C. DPAPI & Security Tests (`internal/security/credentials_test.go`)
- `TestCredentialStore_MaskCredential`: Verifies secret masking formatting for tokens of various lengths.
- `TestCredentialStore_EncryptDecrypt`: Tests Windows DPAPI encryption roundtrip via `CryptProtectData` and `CryptUnprotectData`.

### D. API Discovery & Capabilities Tests (`internal/pterodactyl/discovery/discovery_test.go`)
- `TestParseVersion`: Verifies semver parsing across standard, pre-release, and v2 formats.
- `TestRegistryStats`: Verifies completeness and integrity of default endpoint inventory.
- `TestEvaluateCapabilities`: Tests dynamic feature disabling on Pterodactyl 2.x (e.g. legacy Nests).

---

## 2. Running Test Commands

Execute all Go backend tests:
```powershell
cd c:\Users\Synora\Desktop\pterodactyl\pterodesk
go test -v ./internal/...
```

Execute frontend TypeScript checking and Vite production build:
```powershell
cd c:\Users\Synora\Desktop\pterodactyl\pterodesk\frontend
npm run build
```

Compile complete desktop binary using Wails:
```powershell
cd c:\Users\Synora\Desktop\pterodactyl\pterodesk
wails build -clean
```
