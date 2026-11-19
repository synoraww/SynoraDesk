# SynoraDesk System Architecture

## Overview

**SynoraDesk** (formerly PteroDesk) is a high-performance Windows desktop client engineered for system administrators, DevOps engineers, and game server managers. The architecture strictly separates concerns between a native Go backend process and a React 19 frontend rendered inside a native Webview2 window, developed with AI assistance (Google DeepMind Antigravity / Gemini AI).

---

## 1. High-Level Architecture Diagram

```
+-------------------------------------------------------------------------+
|                              FRONTEND                                   |
|  React 19 + TypeScript + Astryx / Lucide UI + Monaco Code Editor        |
|  Zustand Stores: panelStore, serverStore, uiStore, securityStore,       |
|                  workspaceStore (Multi-tab container)                   |
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
|  +---------------------+   +---------------------+   +---------------+  |
|  | Lockout & Security  |   | Detached Manager    |   | Window State  |  |
|  | - Monotonic timer   |   | - Multi-process     |   | - Bounds X/Y  |  |
|  | - HMAC-SHA256 check |   | - Independent window|   | - W/H restore |  |
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

### A. Wails v2 Desktop Integration & Frameless Windowing
- **Framework**: Wails v2 (`github.com/wailsapp/wails/v2`).
- **Binary Format**: Native Windows PE executable (`pterodesk.exe`) compiled with Windows subsystem flags (`-H windowsgui`).
- **Frameless Dragging**: CSS `.wails-drag` (`--wails-draggable: drag`) enables direct OS window dragging from custom titlebars and lock screen overlays, while `.wails-no-drag` protects interactive elements.
- **Window State Persistence**: Automatic debounced persistence of window position (X, Y), dimensions (Width, Height), and maximized status saved to `%APPDATA%/PteroDesk/data/window_state.json`.

### B. Multi-Process Detached Windows (Cửa sổ bật ra)
- Independent window instances spawned via `OpenDetachedWindow`:
  - Passes CLI flags (`-detached=true -type=server -server=ID -subtab=ide`).
  - Spawns an isolated desktop process with its own dedicated custom draggable header.
  - Enables side-by-side server monitoring, Monaco code editing, and database query executions across multiple physical monitors.

### C. Security, DPAPI & Monotonic Anti-Tamper Lockout
- **Hardware-Bound Storage**: Uses `crypt32.dll` via `CryptProtectData` and `CryptUnprotectData` to bind secrets to the user's Windows profile.
- **Monotonic Anti-Tamper Lockout (`internal/security/lockout.go`)**:
  - Encrypted state file (`security_lockout.dat`) protected by DPAPI and HMAC-SHA256.
  - Enforces monotonic active running time so that shutting down or powering off the computer freezes rather than bypasses lockout penalties.
  - Emergency self-destruct `WipeAllData` automatically clears SQLite data on maximum brute-force violations.

### D. Interactive Wallpaper Studio & Canvas Engine
- Persistent wallpaper storage in `%APPDATA%/PteroDesk/backgrounds/`.
- Interactive viewport supporting mouse-drag panning & cropping, 9-point alignment presets, and smooth zoom (50% - 350%).
- Real-time CSS layout sync with glassmorphism blur and overlay dimming.

### E. AI-Assisted Development
- Architected and iterated with the assistance of **Google DeepMind Antigravity / Gemini AI**, covering Go backend services, React 19 UI state machines, cryptographically secure storage algorithms, and comprehensive automated test suites.
