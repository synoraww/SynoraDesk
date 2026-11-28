# Changelog

All notable changes to **SynoraDesk** are documented in this file.

## [1.06A] - 2026-11-28

### Added
- Starting Screen (`SplashScreen`) with progress bar and protective backdrop overlay while initializing security, panels, and accounts.
- Admin Panel management views (`frontend/src/pages/admin/*`) for Nodes, Locations, Nests, Eggs, Allocations, Databases, Servers, Users, and Panel Settings.
- Passcode-bound AES-256-GCM encryption (`SDPASS1\x00`) derived via Argon2id (`DerivePasscodeKey`) wrapping TPM 2.0 + Windows DPAPI (`SDTPM2`) for sensitive panel credentials.
- Debug-only lock reset flag (`-debug-reset-lock`) and local debug recovery key (`//go:build debug`), completely excluded from production builds (`//go:build !debug`).
- URL validation (`url_validation.go`, `safeUrl.ts`) and security audit documentation (`SECURITY_AUDIT.md`).

### Changed
- Optimized TPM 2.0 KEK warm-up caching and panel/account startup loading latency.
- Separated `EncryptSystem` (DPAPI + TPM 2.0 only) for boot-time metadata (`app_lock.dat`, `security_lockout.dat`) so lockout and lock state remain readable before unlock.
- Updated WiX v7 installer configuration (`Package.wxs`, `build-msi.ps1`) to version `1.06A` (`1.0.6`).

### Security
- Cleared in-memory passcode-derived AES keys (`ClearPasscodeKey`) on `LockSession` and `shutdown`; deleting `app_lock.dat` in production builds no longer allows decrypting `SDPASS1` panel credentials without the passcode.
- Restricted **Debug Manager** tab and `Debug*` backend controls (`DebugSetTPMEnabled`, `DebugTestCryptoRoundtrip`, `DebugToggleDBConnection`) strictly to `//go:build debug` builds.
- Enforced fail-closed `AppLockScreen` rendering whenever `isLocked` is true (defaulting to password mode if lock type is not yet resolved).

### Fixed
- Fixed startup race condition where `GetLockType`, `GetPanels`, `GetActivePanel`, and `checkSessionLock` could run before `startup()` finished initializing SQLite and `panelManager`, causing empty panel/DB views or hidden lock screen until reload.
- Added silent upgrade migration on startup/unlock: legacy `SDPASS1`-sealed `security_lockout.dat` files no longer trigger a false 15-minute lockout, and pre-`SDPASS1` `app_lock.dat` configurations automatically migrate panel keys on first unlock.
- Fixed unstyled current-passcode input and surfaced backend lockout/passcode error messages in `SecuritySettingsCard.tsx`.
- Added missing `security.lockedOutInputBlocked` and `security.lockedOutInputBlockedDesc` keys to `en.json` and `vi.json`.

---

## [1.05A] - 2026-11-24

### Added
- `ErrorBoundary` wrapper around workspace tabs and detached windows to prevent blank-screen crashes on render errors.
- Backend security preference endpoints (`GetSecurityPreferences`, `SetSecurityPreferences`) to persist `security_lock_on_launch` and `security_autolock_minutes`.

### Changed
- Improved console log line wrapping (`word-break: break-all`) for long output lines.
- Completed English and Vietnamese (`en`/`vi`) translations for Server Detail and Server IDE views.

### Fixed
- Fixed a `ReferenceError` when opening Server Detail caused by accessing the translation helper before hook initialization.
- Fixed App Lock settings being lost on reinstall by backing up DPAPI-encrypted `app_lock` and `app_lock_type` in SQLite `settings` and restoring `app_lock.dat` automatically on startup.
- Refined missing-lockout-file detection so fresh installations without an app lock are not falsely locked out.

### Removed
- Removed standalone SFTP Explorer and MySQL Database Manager navigation entry points from the active workspace UI.

---

## [1.04A] - 2026-11-22

### Added
- Batched backend console streaming and `requestAnimationFrame` frontend flushing for high-throughput Wings console logs.
- Full 24-bit TrueColor RGB and 256-color xterm ANSI parsing with memoized console lines.
- Global file clipboard (`fileClipboard.ts`) supporting Copy, Cut, and Paste across directories and servers in File Manager and `ServerIDE`.
- Multi-tab `ServerIDE` file tree and synchronized Monaco editor state.

### Security
- Restricted `DownloadServerFileTo` destination directories to prevent arbitrary writes to system or Windows Startup paths.
- Enforced `checkSessionLock()` across backend IPC methods and required current passcode verification before changing lock settings.
- Removed `dangerouslySetInnerHTML` in `TwoFactorQRCode.tsx` to prevent Stored XSS from panel-supplied SVG payloads.
- Removed plaintext password/hash storage from `localStorage`, moving all passcode verification and storage to Windows DPAPI-protected files.
- Added tamper detection when `security_lockout.dat` is missing on locked installations.
- Configured MySQL client TLS (`TLSConfig = "true"`) and structured `mysql.Config` DSN construction.
- Capped concurrent detached windows at 5 to prevent resource exhaustion.
- Added `url.QueryEscape` for file and directory query parameters in Pterodactyl REST requests.
- Added `redactingWriter` in `internal/logger` to redact sensitive fields (`token`, `password`, `key`, `secret`, `authorization`, `credential`, `api_key`, `apikey`) from logs.

---

## [1.03A] - 2026-11-19

### Added
- WiX Toolset v7 `.msi` installer pipeline (`installer/wix/Package.wxs` and `installer/wix/build-msi.ps1`).
- Multi-tab guard (`multiTabGuard.ts`) and single-instance lock (`SingleInstanceLock`) to prevent conflicting sessions.
- System Diagnostics modal (`GetSystemDiagnostics`) reporting Windows build/UBR, CPU count, WebView2 runtime version, and SQLite WAL status.

### Fixed
- Fixed application data and WebView2 cache directory path to `%APPDATA%\SynoraDesk` with automatic migration from legacy `%APPDATA%\PteroDesk` and cleanup of `.exe`-named WebView2 folders.

---

## [1.02A] - 2026-11-19

### Added
- Cryptographic App Lock (PIN or password) with Argon2 hashing and persistent anti-brute-force `LockoutManager` (`security_lockout.dat` protected by DPAPI + HMAC-SHA256) and optional `WipeAllData`.
- Wallpaper Customizer Studio (`WallpaperCustomizerModal.tsx`) with zoom, 9-point positioning, blur, opacity, and cover/contain modes.
- Frameless custom title bar, window geometry persistence (`window_state.json`), and detached standalone windows.
- Global zoom hotkeys (`Ctrl +`, `Ctrl -`, `Ctrl 0`, `Ctrl + Wheel`) persisted in `localStorage`.
- Panel favicon detection, 2FA QR code display, and bilingual (`en`/`vi`) i18n support.

---

## [1.0.0] - 2026-11-16

### Added
- Initial Windows x64 desktop application built with Wails v2, Go, and React 19.
- Pure-Go SQLite database (`modernc.org/sqlite`) with WAL mode and automatic schema migrations.
- Multi-panel manager with Windows DPAPI credential encryption and connection testing.
- Pterodactyl API discovery registry and compatibility reporting for 1.x and 2.x panels.
- Server console (Wings WebSocket), power controls, file manager, backups, databases, allocations, startup, and subuser management.
- Application API admin views for users, servers, nodes, locations, nests, eggs, allocations, and databases.
