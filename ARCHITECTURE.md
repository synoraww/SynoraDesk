# PteroDesk System Architecture

## Overview

PteroDesk is a high-performance Windows desktop client designed specifically for system administrators, DevOps engineers, and game server managers. The architecture strictly separates concerns between a native Go backend process and a React 19 frontend rendered inside a native Webview2 window.

---

## 1. High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              FRONTEND                                   |
|  React 19 + TypeScript + Meta Astryx Design System + Lucide Icons       |
|  Zustand Stores (panelStore, serverStore, uiStore)                      |
+-------------------------------------------------------------------------+
                                    |
                        Wails v2 IPC Bindings & Events
                                    |
+-------------------------------------------------------------------------+
|                             GO BACKEND                                  |
|                                                                         |
|  +---------------------+   +---------------------+   +---------------+  |
|  | Panel Manager       |   | API Client Engine   |   | Wings WS      |  |
|  | - Multi-panel state |   | - Rate limiter 429  |   | - Live logs   |  |
|  | - Active profile    |   | - Auto pagination   |   | - Stats push  |  |
|  +---------------------+   +---------------------+   +---------------+  |
|                                                                         |
|  +---------------------+   +---------------------+   +---------------+  |
|  | Windows DPAPI       |   | SFTP Session Pool   |   | MySQL Client  |  |
|  | - CryptProtectData  |   | - pkg/sftp engine   |   | - Query exec  |  |
|  | - Token masking     |   | - Concurrent xfers  |   | - Schema view |  |
|  +---------------------+   +---------------------+   +---------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Local SQLite WAL Database (modernc.org/sqlite - Pure Go)          |  |
|  | - panels, activity_logs, recent_servers, application_settings     |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  +-------------------------------------------------------------------+  |
|  | Zerolog Structured Logger with automatic sensitive data redact    |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+
```

---

## 2. Core Subsystems

### A. Wails v2 Desktop Integration
- **Framework**: Wails v2 (`github.com/wailsapp/wails/v2`).
- **Binary Format**: Native Windows PE executable (`.exe`) compiled with Windows subsystem flags (no flashing terminal console).
- **Subsystem Communication**: Two-way asynchronous bindings:
  - Frontend invokes Go methods (`window.go.main.App.*`) returning typed promises.
  - Go emits asynchronous event streams (`runtime.EventsEmit`) for live console log lines and real-time CPU/RAM metrics.

### B. Security & Credential Storage (Windows DPAPI)
- Uses `crypt32.dll` via `CryptProtectData` and `CryptUnprotectData`.
- Tokens are encrypted with the local Windows user credentials. Encrypted payloads cannot be decrypted on other machines or by other Windows user accounts.
- Sensitive credentials in memory are redacted and masked before being exposed to the UI (`ptlc••••••••7890`).

### C. Pure Go SQLite Database (WAL Mode)
- Engine: `modernc.org/sqlite` (CGO-free pure Go).
- Configured with `PRAGMA journal_mode=WAL` and `PRAGMA synchronous=NORMAL` to prevent file locking and ensure concurrent read/write performance.
- Tables:
  - `panels`: Configured panel hosts, encrypted tokens, and active profile flag.
  - `activities`: Audit log of user actions (power signals, file operations, backups).
  - `recent_servers`: Access history for quick navigation.
  - `settings`: Application preferences and UI parameters.

### D. Direct SFTP Engine (`github.com/pkg/sftp`)
- Integrated directly into the server file manager view.
- Provides high-throughput file transfers without intermediate web proxy hops.
- Handles directory listings, text file preview/editing, uploads, downloads, recursive deletes, and permission modifications.

### E. Remote MySQL / MariaDB Client
- Driver: `github.com/go-sql-driver/mysql`.
- Connects directly to server MySQL hosts provisioned through Pterodactyl.
- Enables executing queries, viewing table structures, and inspecting database records directly within PteroDesk.
