# Pterodactyl API Coverage Report

## Coverage Summary

Every endpoint discovered in the official Pterodactyl API is tracked in our internal registry (`internal/pterodactyl/discovery/registry.go`). The status of each endpoint is categorized into:
- **TESTED**: Verified through automated mock tests or unit tests.
- **IMPLEMENTED**: Fully coded in the Go client SDK and UI bindings.
- **DOCUMENTED**: Documented from official API routes/source.
- **DISCOVERED**: Cataloged in the discovery registry.
- **UNSUPPORTED**: Specifically deprecated or omitted in target panel version.
- **PERMISSION_REQUIRED**: Requires explicit user or API role permissions.

---

## 1. Client API Coverage

| Endpoint | HTTP Method | Implementation Status | Test Status |
| :--- | :--- | :--- | :--- |
| `/api/client/account` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/account/two-factor` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/account/two-factor` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/account/two-factor` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/client/account/email` | `PUT` | IMPLEMENTED | TESTED |
| `/api/client/account/password` | `PUT` | IMPLEMENTED | TESTED |
| `/api/client/account/api-keys` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/account/api-keys` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/account/api-keys/{id}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/client/account/ssh-keys` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/account/ssh-keys` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/account/ssh-keys/remove` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/account/activity` | `GET` | IMPLEMENTED | TESTED |
| `/api/client` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/resources` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/power` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/command` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/websocket` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/list` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/contents` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/write` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/create-folder` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/delete` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/rename` | `PUT` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/upload` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/compress` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/files/decompress` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/databases` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/databases` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/databases/{id}/rotate-password` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/databases/{id}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/backups` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/backups` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/backups/{uuid}/download` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/backups/{uuid}/lock` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/backups/{uuid}/restore` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/backups/{uuid}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/users` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/users` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/users/{uuid}` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/users/{uuid}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/network/allocations` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/network/allocations/{id}/primary` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/startup` | `GET` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/startup/variable` | `PUT` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/settings/rename` | `POST` | IMPLEMENTED | TESTED |
| `/api/client/servers/{id}/settings/reinstall` | `POST` | IMPLEMENTED | TESTED |

---

## 2. Application API Coverage

| Endpoint | HTTP Method | Implementation Status | Test Status |
| :--- | :--- | :--- | :--- |
| `/api/application/servers` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/servers` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/servers/{id}` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/servers/{id}/build` | `PATCH` | IMPLEMENTED | TESTED |
| `/api/application/servers/{id}/suspend` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/servers/{id}/unsuspend` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/servers/{id}/reinstall` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/servers/{id}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/application/nodes` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/nodes` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/nodes/{id}` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/nodes/{id}/configuration` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/nodes/{id}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/application/nodes/{id}/allocations` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/nodes/{id}/allocations` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/nodes/{id}/allocations/{id}` | `DELETE` | IMPLEMENTED | TESTED |
| `/api/application/nests` | `GET` | IMPLEMENTED | TESTED (1.x only) |
| `/api/application/nests/{nest}/eggs` | `GET` | IMPLEMENTED | TESTED (1.x only) |
| `/api/application/nests/{nest}/eggs/{egg}` | `GET` | IMPLEMENTED | TESTED (1.x only) |
| `/api/application/users` | `GET` | IMPLEMENTED | TESTED |
| `/api/application/users` | `POST` | IMPLEMENTED | TESTED |
| `/api/application/users/{id}` | `DELETE` | IMPLEMENTED | TESTED |
