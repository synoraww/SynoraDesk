# SynoraDesk Security Specification

## Security Model

SynoraDesk (PteroDesk) is built following defense-in-depth principles. Because the application handles administrative API tokens, SSH/SFTP credentials, and remote database connections, strict security safeguards are implemented at every layer.

---

## 1. Credential Encryption at Rest (Windows DPAPI)

All sensitive secrets—including Client API keys, Application API keys, SFTP passwords, and private keys—are protected on disk using the **Windows Data Protection API (DPAPI)**.

- **System Call**: `CryptProtectData` and `CryptUnprotectData` via `crypt32.dll`.
- **Entropy**: Cryptographic machine and user salt.
- **Key Hierarchy**: Keys are derived directly from the active Windows user login credentials via Windows LSA.
- **Portability Guard**: If the SQLite database file (`pterodesk.db`) is copied to another computer or accessed by a different Windows user profile, the encrypted tokens cannot be decrypted.

---

## 2. In-Memory Sanitization & Masking

1. **Token Masking**:
   - In UI state and diagnostic displays, API tokens are masked with non-reversible truncation:
     ```
     Raw:   ptlc_9a8b7c6d5e4f3a2b1c0d9e8f
     Mask:  ptlc••••••••9e8f
     ```
2. **Log Redaction**:
   - Zerolog structured logging enforces a redaction hook (`internal/logger/logger.go`). Any log field labeled `token`, `password`, `secret`, `authorization`, or `api_key` is replaced with `[REDACTED]` before writing to console or disk.

---

## 3. Network & Transport Security

- **Enforced TLS/HTTPS**: All Pterodactyl REST communication and Wings WebSocket streams enforce TLS encryption (`https://` and `wss://`).
- **Connection Isolation**: Each configured Pterodactyl Panel uses an independent `http.Client` with its own cookie jar, connection pool, and transport settings. Credentials are never mixed across panels.
- **No Embedded Browsers or Iframes**: SynoraDesk does not embed web panel iframes. All data is transferred strictly as structured JSON or SSH binary packets, eliminating DOM-based cross-site scripting (XSS) vectors.

---

## 4. SSH & SFTP Host Verification

- SFTP connections authenticate via password or SSH private key authentication.
- Cryptographic handshakes verify cipher integrity (`chacha20-poly1305`, `aes128-gcm`, `aes256-gcm`).
- File uploads are validated with buffer integrity checks and streamed in chunks to prevent memory exhaustion attacks.

---

## 5. Passcode Lock, Monotonic Lockout & Emergency Self-Destruct

### A. Application Passcode Lock
- Configurable as a 4-digit, 6-digit, 8-digit numeric PIN or an alphanumeric password.
- Passcode is hashed using salted SHA-256 with an independent random 32-byte salt stored locally.
- Inactivity auto-lock triggers after 1, 5, 15, or 30 minutes of no mouse/keyboard interaction.

### B. Hardware-Bound Monotonic Anti-Tamper Lockout (`internal/security/lockout.go`)
- **Tamper Resistance**: State is stored in `%APPDATA%/PteroDesk/data/security_lockout.dat`, encrypted via **Windows DPAPI** and signed with an **HMAC-SHA256** checksum. Any manual file modification immediately invalidates the state and enforces maximum lockout penalties.
- **Monotonic Time Verification**: The lockout countdown timer measures continuous active running time. Shutting down or rebooting the machine freezes the remaining penalty duration rather than decrementing it.
- **Configurable Thresholds**: 3, 5, or 10 failed attempts trigger a safety lockout penalty of 1, 5, 15, 30, or 60 minutes.

### C. Emergency Self-Destruct Wipe (`WipeAllData`)
- When enabled by the administrator, exceeding the allowable threshold of failed attempts triggers an automated cryptographic self-destruct.
- The SQLite database, WAL files, credential profiles, and security keys are immediately purged from local disk, rendering any physical forensic extraction impossible.
