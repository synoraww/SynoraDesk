# Development Guide

## Tech Stack & Dependencies

- **Backend (`go.mod`):**
  - Module: `pterodesk` (Go `1.26.0` in `go.mod`; CI runs on Go `1.23+`)
  - Desktop framework: `github.com/wailsapp/wails/v2 v2.17.1`
  - SQLite driver: `modernc.org/sqlite` (pure Go, WAL mode)
  - WebSocket: `github.com/gorilla/websocket`
  - Logging: `github.com/rs/zerolog`
  - Crypto & Windows APIs: `golang.org/x/crypto` (Argon2), `golang.org/x/sys`
- **Frontend (`frontend/package.json`):**
  - React `19.1.0`, TypeScript `5.6.3`, Vite `7.0.0`
  - State: `zustand`
  - Editor & UI: `@monaco-editor/react`, `monaco-editor`, `@astryxdesign/core`, `@stylexjs/stylex`, `lucide-react`, `qrcode.react`, `@tanstack/react-virtual`

## Development Environment Setup

Because `internal/security/dpapi_windows.go`, `diagnostics_windows.go`, and `restart_windows.go` target Windows APIs, backend compilation and desktop runs require **Windows (x64)**.

1. **Install prerequisites:**
   - [Go](https://go.dev/dl/) (1.23+)
   - [Node.js](https://nodejs.org/) (24+, matching `.github/workflows/ci.yml`)
   - Microsoft Edge WebView2 Runtime
   - Wails CLI v2:
     ```powershell
     go install github.com/wailsapp/wails/v2/cmd/wails@latest
     ```
2. **Install project dependencies:**
   ```powershell
   go mod download
   cd frontend
   npm ci
   cd ..
   ```

## Running in Development Mode

From the repository root, start Wails with live frontend hot-reload:

```powershell
wails dev
```

`wails.json` is configured to run `npm run dev` in `frontend/` and watch Go changes automatically.

To run only the Vite dev server for UI work (without Go IPC):

```powershell
cd frontend
npm run dev
```

## Building the Application

### 1. Build Frontend Assets
```powershell
cd frontend
npm run build
cd ..
```
This runs `tsc && vite build` and outputs to `frontend/dist/`, which Go embeds via `//go:embed all:frontend/dist` in `main.go`.

### 2. Build the Desktop Executable
```powershell
wails build -platform windows/amd64 -s
```
Output binary is written to `build/bin/pterodesk.exe` (configured via `outputfilename` in `wails.json`).

### 3. Build the Windows MSI Installer (Optional)
Requires **WiX Toolset v7**:

```powershell
powershell -ExecutionPolicy Bypass -File .\installer\wix\build-msi.ps1
```
This packages `build/bin/pterodesk.exe` into `build/bin/SynoraDesk-Installer-v1.05A-x64.msi`.

## Running Tests

### Backend Tests
```powershell
go test -v ./...
```
Note: `main.go` embeds `frontend/dist`. If `frontend/dist` does not exist yet (such as in a clean CI checkout), build the frontend first or create a placeholder `frontend/dist/index.html` as done in `.github/workflows/ci.yml`.

### Frontend Typecheck & Build Verification
```powershell
cd frontend
npm run build
```

## Source Code Layout

- **Root (`*.go`):** Entry point (`main.go`), Wails IPC methods (`app.go`), app constants and `%APPDATA%\SynoraDesk` paths (`version.go`), Windows diagnostics (`diagnostics_windows.go`), and restart helpers (`restart_windows.go`, `restart_other.go`).
- **`internal/api/`:** `HTTPClient`, `ClientAPI`, `ApplicationAPI`, `ServerWebSocket`, error types, and API models.
- **`internal/panel/`:** Panel CRUD, credential encryption wiring, and connection testing.
- **`internal/database/`:** SQLite schema migrations, panel/activity/recent-server/settings queries.
- **`internal/pterodactyl/discovery/`:** Panel version parsing, capability evaluation, compatibility report, and permission registry.
- **`internal/security/`:** `CredentialStore`, Windows DPAPI wrapper, and `LockoutManager`.
- **`internal/logger/`:** Zerolog initialization and sensitive-field redaction.
- **`frontend/src/`:** React pages, components, Zustand stores, i18n bundles, and generated `wailsjs/` bindings.

## Debugging and Troubleshooting

- **Application Logs:** Written to `%APPDATA%\SynoraDesk\logs\pterodesk_YYYY-MM-DD.log`. Sensitive fields are automatically redacted by `redactingWriter`.
- **In-App Diagnostics:** Open **Settings → System Diagnostics** to inspect Windows build/UBR, CPU count, WebView2 runtime version, and SQLite WAL status.
- **WebView2 DevTools:** In `wails dev`, right-click inside the window and select **Inspect** (or press `F12` / `Ctrl+Shift+I`) to open Edge DevTools for frontend debugging.
- **Resetting Local State:** Delete `%APPDATA%\SynoraDesk\data` while the app is closed to clear the SQLite database, app lock verifier, and lockout state.
