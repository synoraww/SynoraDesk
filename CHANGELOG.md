# Changelog

All notable changes to the SynoraDesk (PteroDesk) project will be documented in this file.

## [1.0.2A] - 2026-11-19

### Major Update: Passcode Security, Wallpaper Studio, Frameless Controls & AI-Assisted Architecture

#### Added
- **AI-Assisted Engineering**:
  - Full codebase enhancement, refactoring, and verification assisted by Google DeepMind Antigravity / Gemini AI.
- **Passcode Security & Anti-Brute-Force Lockout (`internal/security/lockout.go`)**:
  - PIN lock (4, 6, 8 digits) and text password protection for the application.
  - Hardware-bound monotonic anti-tamper lockout mechanism: penalty countdown survives machine reboot without decrementing offline time.
  - Encrypted state storage (`security_lockout.dat`) using Windows DPAPI (`CryptProtectData`) plus HMAC-SHA256 signature verification.
  - Emergency self-destruct auto-wipe (`WipeAllData`): automatically cleanses the SQLite database and all saved credentials upon exceeding maximum failed attempts.
- **Advanced Interactive Wallpaper Studio (`WallpaperCustomizerModal.tsx`)**:
  - Direct mouse-drag panning & cropping to select specific focal sections of any wallpaper image.
  - Smooth Zoom controls (50% to 350%) with zoom slider, +/- buttons, and quick zoom presets (100%, 125%, 150%, 200%, 250%).
  - 9-Point quick alignment grid (Top-Left, Center, Bottom-Right, etc.) with X/Y coordinate sliders.
  - Rule-of-thirds composition overlay with live focal crosshairs.
  - Cover and Contain display modes, with real-time live sync for blur and dimming overlays.
- **Frameless Window Management & Window State Persistence**:
  - Custom frameless title bar with native dragging (`wails-drag` / `--wails-draggable: drag`).
  - Seamless window controls: Minimize (`WindowMinimise`), Maximize/Restore (`WindowToggleMaximise`), and Quit (`Quit`).
  - Window state auto-save: debounced persistence of window position (X, Y), dimensions (Width, Height), and maximized state (`window_state.json`).
  - Window mobility while locked: ability to move and adjust the window seamlessly from the lock screen.
- **Detached Pop-Out Windows (Cửa sổ phụ độc lập)**:
  - Ability to pop out server consoles, Monaco IDE editor tabs, SFTP explorer, and databases into independent desktop windows.
  - Dedicated custom draggable header with independent minimize, maximize, and close controls for detached windows.
- **Global Browser Zoom Hotkeys**:
  - Full support for `Ctrl +`, `Ctrl -`, `Ctrl 0`, and `Ctrl + Wheel` zooming.
  - Applied directly to `document.documentElement.style.zoom`, preventing layout distortion and black border artifacts.
  - Floating HUD zoom badge with local persistence in `localStorage`.
- **UI/UX & Localization**:
  - Auto-detection of panel favicons (`/public/favicons/favicon.ico`).
  - Smart terminal with enhanced ANSI color code parsing.
  - 2FA QR code display resolution in account security settings.
  - Comprehensive bilingual internationalization (Vietnamese and English).

---

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
  - Full suite of technical specifications and test documents.
