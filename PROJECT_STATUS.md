# SynoraDesk (PteroDesk) Project Status & Deliverables Matrix

## Project Status: COMPLETED, VERIFIED & OPERATIONAL (v1.04A)

### Summary
SynoraDesk is a complete, production-grade native Windows desktop application for managing single or multiple Pterodactyl Panels via official REST APIs, direct Wings WebSockets, and native SSH/SFTP tunnels. Engineered with Go, Wails v2, React 19, and developed with AI assistance (Google DeepMind Antigravity / Gemini AI).

---

## Deliverables Checklist

### 1. Technology & Foundations
- [x] Go 1.25+ Backend with Wails v2
- [x] Native Windows x64 executable (`pterodesk.exe`)
- [x] React 19 + TypeScript Frontend
- [x] Meta Astryx Design System integration (`@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex`)
- [x] Lucide React icon suite & Inter Typography
- [x] Windows DPAPI hardware-bound encryption (`crypt32.dll`)
- [x] Pure Go SQLite database in WAL mode (`modernc.org/sqlite`)
- [x] Zerolog structured logging with automatic secret redaction
- [x] AI-Assisted Architecture & Development declaration

### 2. Security, Passcode Lock & Anti-Brute-Force
- [x] Passcode Lock (4, 6, 8-digit PIN or text password)
- [x] Auto-lock after inactivity timer (1, 5, 15, 30 mins) & lock on launch
- [x] Hardware-bound monotonic anti-tamper lockout (`internal/security/lockout.go`)
- [x] DPAPI + HMAC-SHA256 signature verification for lockout state file
- [x] Offline time enforcement (machine shutdown does not bypass penalty)
- [x] Emergency Self-Destruct Data Wipe (`WipeAllData`) on excessive failed attempts
- [x] Full window dragging and control available while on lock screen

### 3. Window Management & Frameless Design
- [x] Custom Frameless Titlebar with native dragging (`wails-drag` / `--wails-draggable: drag`)
- [x] Window control actions (Minimize, Maximize/Restore, Close)
- [x] Window dimensions, coordinates (X, Y), and maximized state persistence (`window_state.json`)
- [x] Detached Pop-out Windows (`main.DetachedWindowConfig`) with independent custom header
- [x] Browser zoom hotkeys (`Ctrl +`, `Ctrl -`, `Ctrl 0`, `Ctrl + Wheel`) without black border artifacts
- [x] Floating HUD zoom level badge

### 4. Custom Wallpaper Studio
- [x] Persistent custom wallpaper storage in `%APPDATA%/PteroDesk/backgrounds/`
- [x] Interactive Pan & Crop with direct mouse dragging
- [x] Rule-of-thirds composition grid with focal crosshairs
- [x] Smooth zoom slider (50% to 350%) and quick presets (100%, 125%, 150%, 200%, 250%)
- [x] 9-Point focal alignment grid (↖, ⬆, ↗, ⬅, ⏺, ➡, ↙, ⬇, ↘)
- [x] Cover and Contain display modes
- [x] Live real-time sync for overlay dimming (30% - 95%) and blur (0 - 20px)

### 5. Multi-Panel Management
- [x] Unlimited panel profiles
- [x] Profile switching with active state persistence
- [x] Independent Client & Application API credentials
- [x] Automatic website favicon detection (`/public/favicons/favicon.ico`)
- [x] Live API connectivity ping and health checking
- [x] Masked credential storage and DPAPI encryption

### 6. API Discovery & Capability Engine
- [x] Reverse-engineered endpoint catalog (`internal/pterodactyl/discovery/registry.go`)
- [x] Panel version detection (1.x vs 2.x)
- [x] Dynamic capability reporting & UI feature toggling
- [x] Official ACL permission catalog (`internal/pterodactyl/discovery/permissions.go`)

### 7. Server Operations & Real-Time Console
- [x] Server list with search, filter, and state badges
- [x] Live metrics banner (CPU %, Memory MB, Disk MB, Node, Allocation)
- [x] Power control signals (`start`, `stop`, `restart`, `kill`) protected with confirmation dialogs
- [x] Real-time console streaming via Wings WebSocket protocol
- [x] Smart terminal with ANSI color code parsing
- [x] Command history and interactive command input bar

### 8. Integrated File Manager & Direct SFTP
- [x] Dual-engine file manager (Client REST API & Direct SFTP)
- [x] Direct SFTP connection dialog pre-filled with server node credentials
- [x] Directory navigation and breadcrumb bar
- [x] Integrated Monaco Code Editor with syntax highlighting & instant saving
- [x] File and folder creation, deletion, and uploading

### 9. Database Manager
- [x] Remote database listing from Pterodactyl API
- [x] Database creation & password rotation
- [x] Direct MySQL / MariaDB query runner
- [x] Table browser and structure inspector

### 10. Backups & Subusers
- [x] Backups listing with lock badges and size calculations
- [x] Backup creation modal with custom naming and lock protection
- [x] Backup download with presigned URL generation
- [x] Backup lock/unlock toggling and server restoration
- [x] Subuser management (listing, invitation modal with granular permissions, revocation)
- [x] 2FA QR code display resolution in account security settings

### 11. Internationalization & Themes
- [x] Comprehensive bilingual i18n support (Vietnamese & English)
- [x] Clean dark and light mode themes
- [x] 5 Accent color palettes (Blue, Green, Purple, Amber, Rose)

### 12. Documentation Suite
- [x] `README.md`
- [x] `CHANGELOG.md`
- [x] `PROJECT_STATUS.md`
- [x] `ARCHITECTURE.md`
- [x] `SECURITY.md`
- [x] `TESTING.md`
- [x] `API_DISCOVERY.md`
- [x] `API_COVERAGE.md`
- [x] `API_COMPATIBILITY.md`
