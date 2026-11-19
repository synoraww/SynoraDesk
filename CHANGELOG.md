# Changelog

All notable changes to the PteroDesk project will be documented in this file.

## [1.0.0] - 2026-11-16

### Initial Release: Production-Ready Native Windows Desktop Client

#### Added
- **Core Platform**:
  - Native Windows x64 executable powered by Wails v2 and Go.
  - Modern React 19 UI styled with Meta Astryx Design System and Tailwind CSS.
  - Pure Go SQLite database running in WAL mode with automated migrations.
  - Windows DPAPI encryption via `crypt32.dll` for secure credential storage.
  - Zerolog structured multi-writer logger with token redaction.

- **Multi-Panel Manager**:
  - Manage multiple independent Pterodactyl panels with separate Client & Application credentials.
  - Live connectivity testing and semantic version detection.
  - Active panel switching with persistent session storage.

- **API Discovery & Capability Engine**:
  - Reverse-engineered registry covering all official endpoints from Pterodactyl 1.x and upcoming 2.x.
  - Dynamic capability matrix that adapts UI views based on detected panel versions and active API key scopes.
  - Official ACL permission catalogue for granular subuser permissions.

- **Server Operations & Real-Time Console**:
  - Comprehensive server management dashboard with search, filtering, and resource tracking.
  - Power control signals (`start`, `stop`, `restart`, `kill`) protected with confirmation dialogs.
  - Real-time Wings WebSocket streaming for live console logs and sub-second resource metrics.
  - Interactive console input bar for command execution.

- **Dual-Engine File Manager & Direct SFTP**:
  - Integrated directly inside the Server Detail view.
  - Seamless toggle between Pterodactyl REST File API and direct high-speed SFTP (`pkg/sftp`).
  - Pre-filled server connection credentials with node IP and port.
  - Built-in text file editor with live save functionality.
  - Directory navigation, breadcrumb pathing, file upload, directory creation, and deletion.

- **Database Management & MySQL Client**:
  - Pterodactyl database creation, password rotation, and deletion.
  - Integrated MySQL/MariaDB query execution engine with results grid and execution timing.
  - Interactive table schema browser.

- **Backups & Subusers**:
  - Full backup suite: create backups with custom naming, lock/unlock protection, restore, delete, and download via presigned URLs.
  - Subuser access management: list subusers, invite users with granular permission checkboxes, and revoke access.

- **Documentation Suite**:
  - `API_DISCOVERY.md`: Full endpoint catalog and protocol research.
  - `API_COVERAGE.md`: Explicit status checklist for every endpoint.
  - `API_COMPATIBILITY.md`: Version compatibility rules (1.x vs 2.x).
  - `ARCHITECTURE.md`: Subsystem overview and concurrency architecture.
  - `SECURITY.md`: DPAPI, in-memory masking, and network safety specifications.
  - `TESTING.md`: Mock tests and verification documentation.
  - `PROJECT_STATUS.md`: Feature verification matrix.
