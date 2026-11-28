# Installation & User Guide

## System Requirements

- **Operating System:** Windows 10 or Windows 11 (64-bit / `x64`)
- **Runtime:** Microsoft Edge WebView2 Runtime (built into Windows 11 and most Windows 10 systems; downloadable from Microsoft if missing)
- **Pterodactyl Panel:** Access to one or more Pterodactyl Panel instances (1.x or 2.x) over HTTPS/HTTP

## Downloading and Installing

Download the latest release from [GitHub Releases](https://github.com/synoraww/SynoraDesk/releases):

- **MSI Installer (`SynoraDesk-Installer-*.msi`):**
  1. Run the `.msi` package.
  2. Accept the license agreement and choose the installation folder (defaults to `C:\Program Files\SynoraDesk`).
  3. Complete installation. Desktop and Start Menu shortcuts are created automatically, with an option to launch SynoraDesk immediately.
- **Portable Executable (`*.exe`):**
  1. Place the executable in any folder of your choice.
  2. Double-click to run. Application data is stored in `%APPDATA%\SynoraDesk`, so renaming or moving the executable preserves your configuration.

## Initial Configuration

1. On first launch, review and accept the Welcome / Terms dialog.
2. *(Optional)* Configure **App Lock** in **Settings → Security**:
   - Enable PIN or Password lock.
   - Configure whether to lock on launch, auto-lock timeout, and anti-brute-force lockout thresholds.
   - Optionally enable auto-wipe if maximum failed attempts are exceeded (disabled by default).

## Connecting a Pterodactyl Panel

### 1. Generate API Keys in Pterodactyl
- **Client API Key** *(required for server console, files, backups, databases, and account management)*:
  In your Pterodactyl Panel web UI, go to **Account → API Credentials**, create a new API key, and copy the token.
- **Application API Key** *(optional, required for Admin section)*:
  In your Pterodactyl Panel Admin area, go to **Application API**, create a key with the required Read/Write permissions, and copy the token.

### 2. Add the Panel in SynoraDesk
1. Open **Account Manager** from the sidebar (or click **Add Panel** on the Dashboard).
2. Click **Add Panel** and enter:
   - **Panel Name** (display label)
   - **Panel URL** (e.g. `https://panel.example.com`)
   - **Client API Key** and/or **Application API Key**
3. Save the panel, click **Test Connection** to verify reachability, and set it as **Active**.

## Basic Usage

- **Switching Panels:** Use the Panel Manager or top/status bar controls to switch between saved panels.
- **Managing Servers:** Open **Servers** from the sidebar and select any server to access Console, Files, Server IDE, Databases, Network, Startup, Backups, Subusers, and Settings.
- **Detached Windows:** Pop out server consoles or editor views into standalone windows (up to 5 concurrent detached windows).
- **Zoom Controls:** Use `Ctrl +`, `Ctrl -`, `Ctrl 0`, or `Ctrl + Mouse Wheel` to adjust UI zoom between 50% and 200%.
- **Reload / Re-probe:** Press `F5` to refresh panel latency and re-probe Application API permissions.

## Troubleshooting

- **Application fails to start or shows a blank window:**
  Ensure the **Microsoft Edge WebView2 Runtime** is installed on Windows.
- **Admin tabs show as locked or unavailable:**
  Verify that your panel entry includes a valid **Application API Key** with read permissions for the corresponding Pterodactyl resource, then press `F5` to re-probe permissions.
- **API errors (`401 Unauthorized` / `403 Forbidden` / `429 Too Many Requests`):**
  Check that your API key has not been revoked, your IP is allowed (if IP restrictions were set on the key), and wait briefly if panel rate limits were triggered.
- **WebSocket console fails to connect:**
  Confirm that your Client API key is valid and that the Wings node's WebSocket endpoint is reachable from your machine.
- **Forgotten App Lock passcode or corrupted local state:**
  Close SynoraDesk and remove `%APPDATA%\SynoraDesk\data` to reset all local panels and settings. (Encrypted credentials are tied to your current Windows user account via DPAPI.)
