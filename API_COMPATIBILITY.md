# Pterodactyl Version Compatibility Matrix

## Overview

PteroDesk supports Pterodactyl 1.x installations while providing forward compatibility for Pterodactyl 2.x developments.

---

## 1. Version Detection & Capability Evaluation

PteroDesk features an automated capability detection engine (`internal/pterodactyl/discovery/capability.go`).
Upon saving or switching to a Panel profile, the system performs a ping test and evaluates:
1. Available API credentials (Client API key, Application API key, or both).
2. Panel version string reported by the server header or system endpoint.
3. Enabled features and visible UI tabs.

```
                      +-----------------------+
                      |   Pterodactyl Panel   |
                      +-----------+-----------+
                                  |
                                  v
                   +-----------------------------+
                   |  Panel Version & Key Check  |
                   +--------------+--------------+
                                  |
                  +---------------+---------------+
                  |                               |
                  v                               v
           Pterodactyl 1.x                 Pterodactyl 2.x
   +-----------------------------+ +-----------------------------+
   | - Nests & Eggs Active       | | - Legacy Nests Disabled     |
   | - Standard Client API       | | - Modern Blueprint System   |
   | - Application API Routes    | | - Dedicated Admin API       |
   | - Classic Wings WS Auth     | | - Updated Wings Auth        |
   +-----------------------------+ +-----------------------------+
```

---

## 2. Key Differences: 1.x vs 2.x

| Feature Area | Pterodactyl 1.x | Pterodactyl 2.x | PteroDesk Adaptation |
| :--- | :--- | :--- | :--- |
| **Nests API** | `/api/application/nests` | Deprecated / Removed | Dynamic capability toggle (`CanManageNests`); hidden on 2.x |
| **Server Blueprints** | Contained in Egg definitions | Modular Blueprints system | Handled gracefully via fallback schemas |
| **Admin API** | Mixed within Application API | Dedicated `/api/admin` namespace | Dynamic route resolver in `internal/api` |
| **Console WebSocket** | Short-lived token via `/websocket` | Enhanced JWT rotation | Handled via `TokenRefresher` callback in `internal/api/websocket.go` |
| **SFTP Authentication** | Server SFTP credentials with user.id | Unified daemon auth | Handled seamlessly by `internal/sftp/client.go` |

---

## 3. Dynamic UI Behavior

When an endpoint or feature is unsupported for a panel:
- **Missing Application API Key**: Administrative tabs (Nodes, User Management, Server Provisioning) show an informative capability badge prompting the user to supply an Application API token in Panel Settings.
- **2.x Version Detected**: Nests management is replaced with direct Egg/Blueprint configurations, preventing 404 route errors.
- **Missing Granular Permissions**: Client API error responses (`403 Forbidden` / `HttpForbiddenException`) are mapped to user-friendly notifications detailing the missing permission key (e.g. `file.delete` or `control.restart`).
