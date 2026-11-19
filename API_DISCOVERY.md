# Pterodactyl API Discovery & Endpoint Research

## Overview

This document presents the reverse-engineered technical specification and inventory of the official Pterodactyl REST API. The discovery methodology was performed by inspecting official documentation (`https://docs.pterodactyl.io/`), Laravel route definitions (`routes/api-client.php`, `routes/api-application.php`), controllers, request validators, and model transformers across both Pterodactyl 1.x and upcoming 2.x releases.

---

## 1. Authentication Architecture

Pterodactyl utilizes HTTP Bearer authentication with distinct token formats and permission models:

- **Client API Tokens (`ptlc_...`)**:
  - Generated per user account via the client interface or `/api/client/account/api-keys`.
  - Scoped to individual server permissions (ACL system).
  - Used for day-to-day operations: server power control, live console WebSocket access, file management, subusers, backups, and databases.
  - Header: `Authorization: Bearer <client_api_key>`

- **Application API Tokens (`ptla_...`)**:
  - Generated exclusively by root/administrative users in the panel admin area.
  - Scoped to administrative resources (`r:servers`, `rw:servers`, `r:nodes`, `rw:nodes`, `r:allocations`, `rw:allocations`, `r:users`, `rw:users`, `r:nests`).
  - Used for provisioning, node infrastructure setup, allocation pools, and user administration.
  - Header: `Authorization: Bearer <application_api_key>`

> **Security Rule**: Client API keys and Application API keys are strictly partitioned. An Application key cannot perform client-level power actions or access the console WebSocket directly, and a Client key cannot create nodes or allocate IP pools.

---

## 2. Official Endpoint Catalog

### A. Client API (`/api/client`)

| Method | Endpoint | Description | Required Permissions |
| :--- | :--- | :--- | :--- |
| `GET` | `/account` | Authenticated user profile | None |
| `GET` | `/account/two-factor` | TOTP QR code & secret | None |
| `POST` | `/account/two-factor` | Enable 2FA with verification code | None |
| `DELETE` | `/account/two-factor` | Disable 2FA with password confirmation | None |
| `PUT` | `/account/email` | Update user email | Password confirmation |
| `PUT` | `/account/password` | Update user password | Password confirmation |
| `GET` | `/account/api-keys` | List client API keys | None |
| `POST` | `/account/api-keys` | Generate new client token | None |
| `DELETE` | `/account/api-keys/{id}` | Revoke client API token | None |
| `GET` | `/account/ssh-keys` | List client SSH public keys | None |
| `POST` | `/account/ssh-keys` | Register client SSH public key | None |
| `POST` | `/account/ssh-keys/remove` | Delete client SSH key by fingerprint | None |
| `GET` | `/account/activity` | Retrieve account audit/activity log | None |
| `GET` | `/` | List accessible servers | None |
| `GET` | `/servers/{id}` | Fetch server details & limits | None |
| `GET` | `/servers/{id}/resources` | Real-time CPU, RAM, Disk stats | None |
| `POST` | `/servers/{id}/power` | Dispatch `start`, `stop`, `restart`, `kill` | `control.start`, `control.stop`, `control.restart` |
| `POST` | `/servers/{id}/command` | Send console command | `control.console` |
| `GET` | `/servers/{id}/websocket` | Acquire short-lived Wings JWT & WS URL | `control.console` |
| `GET` | `/servers/{id}/files/list` | List directory contents | `file.read` |
| `GET` | `/servers/{id}/files/contents` | Read file text/raw stream | `file.read-content` |
| `POST` | `/servers/{id}/files/write` | Write file content | `file.update` |
| `POST` | `/servers/{id}/files/create-folder` | Create directory | `file.create` |
| `POST` | `/servers/{id}/files/delete` | Batch delete files/folders | `file.delete` |
| `PUT` | `/servers/{id}/files/rename` | Rename or move files | `file.update` |
| `GET` | `/servers/{id}/files/upload` | Request presigned upload URL | `file.create` |
| `POST` | `/servers/{id}/files/compress` | Create `.tar.gz` archive | `file.archive` |
| `POST` | `/servers/{id}/files/decompress` | Extract archive | `file.archive` |
| `GET` | `/servers/{id}/databases` | List database hosts & databases | `database.read` |
| `POST` | `/servers/{id}/databases` | Provision new MySQL database | `database.create` |
| `POST` | `/servers/{id}/databases/{db}/rotate-password` | Rotate database password | `database.update` |
| `DELETE`| `/servers/{id}/databases/{db}` | Drop database | `database.delete` |
| `GET` | `/servers/{id}/backups` | List backups with lock status | `backup.read` |
| `POST` | `/servers/{id}/backups` | Create new backup archive | `backup.create` |
| `GET` | `/servers/{id}/backups/{uuid}/download` | Fetch signed backup download URL | `backup.download` |
| `POST` | `/servers/{id}/backups/{uuid}/lock` | Toggle lock protection | `backup.create` |
| `POST` | `/servers/{id}/backups/{uuid}/restore` | Restore server files from backup | `backup.restore` |
| `DELETE`| `/servers/{id}/backups/{uuid}` | Delete backup archive | `backup.delete` |
| `GET` | `/servers/{id}/users` | List server subusers | `user.read` |
| `POST` | `/servers/{id}/users` | Invite subuser with permissions | `user.create` |
| `POST` | `/servers/{id}/users/{uuid}` | Update subuser permissions | `user.update` |
| `DELETE`| `/servers/{id}/users/{uuid}` | Revoke subuser access | `user.delete` |
| `GET` | `/servers/{id}/network/allocations` | List port allocations | `allocation.read` |
| `POST` | `/servers/{id}/network/allocations/{alloc}/primary` | Assign primary allocation | `allocation.update` |
| `GET` | `/servers/{id}/startup` | View startup variables & rules | `startup.read` |
| `PUT` | `/servers/{id}/startup/variable` | Update environment variable | `startup.update` |
| `POST` | `/servers/{id}/settings/rename` | Rename server label | `settings.rename` |
| `POST` | `/servers/{id}/settings/reinstall` | Trigger full server reinstall | `settings.reinstall` |

---

### B. Application API (`/api/application`)

| Method | Endpoint | Description | Scope Required |
| :--- | :--- | :--- | :--- |
| `GET` | `/servers` | List all servers (administrative view) | `r:servers` |
| `POST` | `/servers` | Deploy new server instance | `rw:servers` |
| `GET` | `/servers/{id}` | Inspect server configuration & limits | `r:servers` |
| `PATCH`| `/servers/{id}/build` | Update CPU, memory, disk limits | `rw:servers` |
| `POST` | `/servers/{id}/suspend` | Administrative suspension | `rw:servers` |
| `POST` | `/servers/{id}/unsuspend` | Release suspension | `rw:servers` |
| `POST` | `/servers/{id}/reinstall` | Force container reinstall | `rw:servers` |
| `DELETE`| `/servers/{id}` | Destroy server instance (`?force=true`) | `rw:servers` |
| `GET` | `/nodes` | List all Wings daemon nodes | `r:nodes` |
| `POST` | `/nodes` | Register new Wings host node | `rw:nodes` |
| `GET` | `/nodes/{id}` | Detailed node info & ports | `r:nodes` |
| `GET` | `/nodes/{id}/configuration` | Wings setup token & YAML block | `r:nodes` |
| `DELETE`| `/nodes/{id}` | Delete node (must have 0 servers) | `rw:nodes` |
| `GET` | `/nodes/{id}/allocations` | List port allocations on node | `r:allocations` |
| `POST` | `/nodes/{id}/allocations` | Batch assign IP & port ranges | `rw:allocations` |
| `DELETE`| `/nodes/{id}/allocations/{alloc}` | Delete unused allocation | `rw:allocations` |
| `GET` | `/nests` | List game nests (1.x Legacy) | `r:nests` |
| `GET` | `/nests/{nest}/eggs` | List eggs within a nest | `r:nests` |
| `GET` | `/nests/{nest}/eggs/{egg}` | Inspect egg configuration & vars | `r:nests` |
| `GET` | `/users` | List panel user accounts | `r:users` |
| `POST` | `/users` | Create panel user account | `rw:users` |
| `DELETE`| `/users/{id}` | Delete user account | `rw:users` |

---

## 3. Real-Time Wings WebSocket Protocol

When interacting with the live server console:
1. Client requests `GET /api/client/servers/{server}/websocket`.
2. The response supplies an authentication JWT and the Wings WebSocket URI (`wss://node.example.com:8080/api/servers/{uuid}/ws`).
3. Client establishes TLS connection to the WebSocket URI.
4. Client immediately authenticates with message:
   ```json
   {"event": "auth", "args": ["<jwt_token>"]}
   ```
5. Wings daemon streams event packets:
   - `console output`: raw terminal text line.
   - `stats`: real-time JSON payload containing CPU percent, memory bytes, disk bytes, network rx/tx bytes, and uptime.
   - `status`: container operational state (`starting`, `running`, `stopping`, `offline`).
   - `token expiring`: signal that JWT expires within 3 minutes; client must request fresh token from Panel and send re-auth.
