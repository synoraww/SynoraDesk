# PteroDesk

**Modern Native Windows Desktop Client for Pterodactyl Panels**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20x64-0078D4?logo=windows)](https://microsoft.com)
[![Framework](https://img.shields.io/badge/Framework-Wails%20v2-DF1A29)](https://wails.io)
[![Backend](https://img.shields.io/badge/Backend-Go%201.25+-00ADD8?logo=go)](https://golang.org)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20Meta%20Astryx-61DAFB?logo=react)](https://react.dev)
[![Security](https://img.shields.io/badge/Security-Windows%20DPAPI-4CAF50)](SECURITY.md)

---

## Overview

**PteroDesk** is a native Windows desktop application engineered for system administrators, DevOps teams, and server managers who remotely administer one or multiple Pterodactyl Panels. 

Unlike web wrappers or Electron apps, PteroDesk runs as a lean, memory-efficient native Go binary powered by Wails v2 and Meta Astryx Design System, communicating directly with Pterodactyl via its official REST APIs, direct Wings WebSockets, and native SSH/SFTP tunnels.

---

## Key Features

- **Multi-Panel Manager**: Connect and switch between unlimited Pterodactyl panels with isolated credential profiles and live connectivity health testing.
- **Hardware-Bound Security**: API tokens, SFTP keys, and database passwords are encrypted at rest using native **Windows DPAPI** (`CryptProtectData`), ensuring tokens cannot be stolen even if data files are copied.
- **Real-Time Wings Console**: Live streaming console terminal and resource telemetry over the official Pterodactyl Wings WebSocket protocol.
- **Dual-Engine File Manager**: Built-in REST API file operations combined with a high-speed direct **SFTP client** (`pkg/sftp`) right inside the server view.
- **Integrated Database Client**: Provision MySQL/MariaDB databases and run queries directly inside an integrated SQL editor.
- **Backups & Subusers**: Complete snapshot management (create, lock, restore, download) and granular subuser access control.
- **Infrastructure & Nodes**: Administrative inspection of Wings nodes, daemon ports, and IP/port allocation pools.
- **Local SQLite Storage**: Pure Go embedded SQLite database running in WAL mode for persistent settings and activity logs.

---

## Documentation Suite

- 📖 [**Architecture Plan & System Design**](ARCHITECTURE.md)
- 🔍 [**API Discovery & Reverse Research**](API_DISCOVERY.md)
- 📊 [**API Coverage Matrix**](API_COVERAGE.md)
- 🔄 [**Version Compatibility (1.x vs 2.x)**](API_COMPATIBILITY.md)
- 🛡️ [**Security & DPAPI Specification**](SECURITY.md)
- 🧪 [**Testing & Mock Verification**](TESTING.md)
- 📋 [**Project Status & Deliverables**](PROJECT_STATUS.md)
- 📝 [**Changelog**](CHANGELOG.md)

---

## Building from Source

### Prerequisites
- **OS**: Windows 10/11 x64
- **Go**: 1.25+
- **Node.js**: 20+ with npm
- **Wails CLI**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Run Backend & Mock Tests
```powershell
go test -v ./internal/...
```

### Build Desktop Binary
```powershell
wails build -clean
```
The compiled native executable will be located at `build/bin/pterodesk.exe`.
