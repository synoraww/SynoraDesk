# PteroDesk Project Status & Deliverables Matrix

## Project Status: COMPLETED & OPERATIONAL

### Summary
PteroDesk is a complete, production-ready native Windows desktop application for managing single or multiple Pterodactyl Panels via official REST APIs.

---

## Deliverables Checklist

### 1. Technology & Foundations
- [x] Go 1.25+ Backend with Wails v2
- [x] Native Windows x64 executable (`pterodesk.exe`)
- [x] React 19 + TypeScript Frontend
- [x] Meta Astryx Design System integration (`@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex`)
- [x] Lucide React icon suite
- [x] Windows DPAPI hardware-bound encryption (`crypt32.dll`)
- [x] Pure Go SQLite database in WAL mode (`modernc.org/sqlite`)
- [x] Zerolog structured logging with automatic secret redaction

### 2. Multi-Panel Management
- [x] Unlimited panel profiles
- [x] Profile switching with active state persistence
- [x] Independent Client & Application API credentials
- [x] Live API connectivity ping and health checking
- [x] Masked credential storage and DPAPI encryption

### 3. API Discovery & Capability Engine
- [x] Reverse-engineered endpoint catalog (`internal/pterodactyl/discovery/registry.go`)
- [x] Panel version detection (1.x vs 2.x)
- [x] Dynamic capability reporting & UI feature toggling
- [x] Official ACL permission catalog (`internal/pterodactyl/discovery/permissions.go`)

### 4. Server Management
- [x] Server list with search, filter, and state badges
- [x] Live metrics banner (CPU %, Memory MB, Disk MB, Node)
- [x] Power control actions with safety confirmation dialogs (`start`, `stop`, `restart`, `kill`)
- [x] Real-time console streaming via Wings WebSocket protocol
- [x] Console command dispatch

### 5. Integrated File Manager & Direct SFTP
- [x] Dual-engine file manager (Client REST API & Direct SFTP)
- [x] Direct SFTP connection dialog pre-filled with server node credentials
- [x] Directory navigation and breadcrumb bar
- [x] In-app text file editor with save & preview
- [x] File and folder creation
- [x] Recursive deletion with confirmation dialog
- [x] Multi-format file uploading

### 6. Database Manager
- [x] Remote database listing from Pterodactyl API
- [x] Database creation & password rotation
- [x] Direct MySQL / MariaDB query runner
- [x] Table browser and structure inspector

### 7. Backups & Subusers
- [x] Backups listing with lock badges and size calculations
- [x] Backup creation modal with custom naming and lock protection
- [x] Backup download with presigned URL generation
- [x] Backup lock/unlock toggling
- [x] Full server restoration from backup archive
- [x] Backup deletion
- [x] Subuser management (listing, invitation modal with granular permissions, revocation)

### 8. Node & Infrastructure Management
- [x] Node listing across all locations
- [x] Node resource allocation stats (Memory, Disk, Daemon port, SFTP port)
- [x] Allocation pool inspector

### 9. Documentation Suite
- [x] `API_DISCOVERY.md`
- [x] `API_COVERAGE.md`
- [x] `API_COMPATIBILITY.md`
- [x] `ARCHITECTURE.md`
- [x] `SECURITY.md`
- [x] `TESTING.md`
- [x] `PROJECT_STATUS.md`
- [x] `CHANGELOG.md`
- [x] `README.md`
