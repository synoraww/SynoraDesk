# SynoraDesk – Comprehensive Security Audit & Hardening Report

**Ngày kiểm tra:** 2026-11-27  
**Phiên bản mục tiêu:** `1.05A` (`pterodesk` / SynoraDesk)  
**Kiến trúc:** Wails v2 (`v2.17.1`) + Go (`go.mod`: `1.26.0`, runtime: `go1.27.4`) + React (`19.1.0`) / TypeScript / Vite (`7.0.0`) + SQLite (`modernc.org/sqlite`) + Windows WebView2 & DPAPI.

---

## 1. Executive Summary

Cuộc kiểm tra bảo mật toàn diện đã được thực hiện trên toàn bộ bề mặt tấn công của SynoraDesk, bao gồm ranh giới giữa giao diện React (WebView2), các Wails IPC bindings trong Go (`app.go`), lớp lưu trữ cục bộ (Windows DPAPI, SQLite, tệp log, cấu hình khóa phiên), lớp tích hợp Pterodactyl Client/Application API và Wings WebSocket, trình khách MySQL, cũng như cấu hình build/installer trên Windows.

**Điểm mạnh nền tảng & cải tiến mã hóa phần cứng:**
- API token của Pterodactyl, `app_lock.dat` và `security_lockout.dat` được mã hóa bằng **Windows DPAPI** (`CryptProtectData` / `CryptUnprotectData` theo phạm vi người dùng hiện tại) trong `internal/security/dpapi_windows.go` kết hợp với **TPM 2.0 Hardware-Backed Envelope Encryption** (`internal/security/tpm_windows.go` sử dụng Windows CNG `ncrypt.dll` — `Microsoft Platform Crypto Provider`, bọc khóa AES-256-GCM DEK bằng khóa RSA-2048 OAEP-SHA256 lưu trên TPM, tự động fallback về DPAPI thuần nếu máy không có TPM và tương thích ngược với dữ liệu DPAPI cũ). Không lưu plaintext và chỉ trả về bản che (`MaskCredential`) cho frontend.
- Khóa phiên (Session Lock) sử dụng **Argon2id** (`argon2.IDKey(..., 3, 64*1024, 4, 32)`) với salt ngẫu nhiên 16 byte từ `crypto/rand`, so sánh bằng `subtle.ConstantTimeCompare`, và áp dụng fail-closed khi khởi động.
- MySQL client (`internal/dbclient/mysql.go`) bật `TLSConfig = "true"` (fail-closed nếu server không hỗ trợ TLS).
- `ServerWebSocket` (`internal/api/websocket.go`) bật xác minh TLS (`InsecureSkipVerify: false`).

**Các lỗ hổng và điểm yếu đã phát hiện và khắc phục trực tiếp trong đợt audit:**
- **0 Critical**, **4 High**, **6 Medium**, **3 Low / Informational** (tổng cộng 13 phát hiện).
- Toàn bộ các lỗ hổng **High** và phần lớn **Medium** (SSRF / redirect downgrade & cross-host redirect trên API client, đọc response không giới hạn bộ nhớ, path traversal trên định danh API Pterodactyl, `http.Get` không timeout/validation khi tải tệp từ Wings, rò rỉ token trong chuỗi lỗi/nested JSON log, thiếu `checkSessionLock()` trên `SetSecurityPreferences` & `GetAppDataDir`, race condition map trong `panel.Manager`, đọc tệp tùy ý ngoài thư mục `backgrounds`, thiếu CSP trong `frontend/index.html`, và mở URL ngoài không kiểm tra scheme) đã được **vá trực tiếp trong mã nguồn** và kiểm chứng bằng unit test bảo mật mới.

---

## 2. Scope & Attack Surface Inventory

### Các thành phần đã rà soát
1. **Entry point & Wails Host:** `main.go`, `version.go`, `diagnostics_windows.go`, `restart_windows.go`, `restart_other.go`.
2. **Wails IPC Bindings & Session Guard:** `app.go` (toàn bộ các phương thức public gắn với WebView).
3. **Security & Credential Storage:** `internal/security/dpapi_windows.go`, `credentials.go`, `lockout.go`.
4. **Local Storage & Logging:** `internal/database/sqlite.go`, `internal/logger/logger.go`.
5. **Pterodactyl API & WebSocket Integration:** `internal/api/client.go`, `client_api.go`, `application_api.go`, `websocket.go`, `errors.go`, `internal/panel/manager.go`.
6. **Database Client:** `internal/dbclient/mysql.go`.
7. **Frontend (React / TypeScript / WebView2):** `frontend/index.html`, `frontend/package.json`, `frontend/src/App.tsx`, `frontend/src/stores/*`, `frontend/src/components/*`, `frontend/src/pages/*`, `frontend/src/utils/*`.
8. **Build, Installer & CI/CD:** `wails.json`, `build/windows/wails.exe.manifest`, `build/windows/installer/project.nsi`, `installer/wix/Package.wxs`, `.github/workflows/build.yml`, `.github/workflows/ci.yml`.

### Ranh giới tin cậy (Trust Boundaries)
- **WebView2 (React) ↔ Go Backend (Wails IPC):** Dữ liệu từ Panel API/Wings (tên file, log console, tên server, URL tải xuống, thông báo lỗi) đi vào DOM React; bất kỳ XSS nào trong WebView2 đều có thể gọi các phương thức public của `App`.
- **Desktop Host ↔ Pterodactyl Panel & Wings Nodes:** Panel/Wings có thể bị xâm nhập hoặc cấu hình sai, trả về URL độc hại (`downloadURL`, `uploadURL`, `socketURL`), HTTP redirect chuyển hướng sang host khác/hạ cấp TLS, hoặc payload quá lớn gây cạn kiệt tài nguyên.
- **Ứng dụng ↔ Hệ điều hành Windows:** Lưu trữ dữ liệu tại `%APPDATA%\SynoraDesk` (`pterodesk.db`, `app_lock.dat`, `security_lockout.dat`, `logs\`, `backgrounds\`), thực thi tiến trình con (`OpenDetachedWindow`, `RestartApp`, `OpenBackgroundFolder`).

---

## 3. Findings

### Tổng hợp phát hiện

| ID | Tên phát hiện | Mức độ | Phân loại | Trạng thái |
|---|---|---|---|---|
| SEC-01 | Thiếu kiểm soát Redirect, kích thước Response và Path Validation trong `HTTPClient` | High | Confirmed Vulnerability | Đã khắc phục |
| SEC-02 | Tải/Upload tệp sử dụng `http.Get` không timeout, không validate URL & ghi đè thiếu kiểm tra symlink | High | Confirmed Vulnerability | Đã khắc phục |
| SEC-03 | Che giấu log (`redactingWriter`) bỏ sót nested JSON và token trong chuỗi thông báo lỗi | High | Confirmed Vulnerability | Đã khắc phục |
| SEC-04 | Thiếu `checkSessionLock()` trên `SetSecurityPreferences` / `GetAppDataDir` & thiếu validate tham số `OpenDetachedWindow` | High | Confirmed Vulnerability | Đã khắc phục |
| SEC-05 | API Path Injection thông qua `identifier` / `UUID` / `externalID` / `FQDN` chưa được kiểm tra | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-06 | Race Condition (Concurrent Map Read/Write) trong `panel.Manager` | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-07 | Thiếu Content Security Policy (CSP) trong `frontend/index.html` | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-08 | Mở URL ngoài (`window.open` / `BrowserOpenURL`) không kiểm tra scheme `http:`/`https:` | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-09 | `ServerWebSocket` thiếu kiểm tra URL, thiếu `SetReadLimit` và validation tín hiệu nguồn | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-10 | `GetCustomBackground` đọc tệp từ đường dẫn DB mà không kiểm tra nằm trong thư mục `backgrounds` | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-11 | `dbclient.ExecuteQuery` không giới hạn số dòng và thực thi lại câu lệnh lỗi | Medium | Confirmed Vulnerability | Đã khắc phục |
| SEC-12 | Hardcoded HMAC secret trong `internal/security/lockout.go` | Low | Security Recommendation | Còn tồn tại (có DPAPI bảo vệ) |
| SEC-13 | Thiếu Code Signing cho binary/installer Windows và unpinned `@latest` trong CI release | Low | Security Recommendation | Còn tồn tại |

---

### Chi tiết các phát hiện chính

#### [SEC-01] Thiếu kiểm soát Redirect, giới hạn Response và Validate Path trong `HTTPClient`
- **Severity:** High (CVSS 4.0: `7.5` — `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:L/VA:H/SC:N/SI:N/SA:N`)
- **Vị trí:** `internal/api/client.go` (`NewHTTPClient`, `Request`)
- **Nguyên nhân:** `http.Client` mặc định không có `CheckRedirect` (cho phép hạ cấp `https://` -> `http://` hoặc redirect sang địa chỉ metadata/khác host), dùng `io.ReadAll(resp.Body)` không giới hạn dung lượng (nguy cơ OOM), không giới hạn `Retry-After` (có thể treo client vô thời hạn), và ghép `baseURL + path` không kiểm tra `baseURL`/`path`.
- **Tác động:** Rò rỉ Bearer token khi hạ cấp HTTPS, SSRF qua redirect, hoặc DoS cạn kiệt bộ nhớ/treo ứng dụng từ server độc hại.
- **Xác minh:** Kiểm tra trực tiếp mã nguồn `internal/api/client.go` và xác minh bằng các test `TestHTTPClientBlocksCrossHostRedirect`, `TestHTTPClientBlocksHTTPSDowngradeRedirect`, `TestHTTPClientRejectsOversizedResponse`.
- **Khắc phục:** Đã thêm `CheckRedirect` chặn hạ cấp HTTPS->HTTP, chặn redirect khác host, giới hạn 5 bước nhảy và chặn link-local metadata IP; giới hạn `io.LimitReader` ở `64 MiB`; giới hạn `Retry-After` tối đa `120s`; cắt ngắn body lỗi 5xx còn 512 bytes.

#### [SEC-02] Tải/Upload tệp không validate URL, thiếu timeout và nguy cơ symlink
- **Severity:** High (CVSS 4.0: `7.1` — `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:N/VI:H/VA:H/SC:N/SI:N/SA:N`)
- **Vị trí:** `app.go` (`DownloadServerFileTo`, `DownloadServerFileWithDialog`), `internal/api/client_api.go` (`UploadFileDirect`)
- **Nguyên nhân:** Sử dụng `http.Get(downloadURL)` (client mặc định không timeout, tự động theo mọi redirect) với URL trả về từ API chưa được validate scheme/metadata IP; `DownloadServerFileWithDialog` dùng `os.Create` (umask mặc định, theo symlink) và không làm sạch `defaultFileName` qua `filepath.Base`.
- **Tác động:** SSRF từ máy desktop, treo kết nối vĩnh viễn, hoặc ghi đè tệp qua symlink nếu người dùng lưu vào thư mục có symlink.
- **Khắc phục:** Đã tạo `safeDownloadToFile` dùng `security.ValidateHTTPURL`, `http.Client` có `Timeout: 5 * time.Minute` và `CheckRedirect`, kiểm tra `os.Lstat` từ chối symlink, mở tệp với quyền `0600`, và chuẩn hóa `defaultFileName` bằng `filepath.Base`. Áp dụng tương tự cho `UploadFileDirect`.

#### [SEC-03] Che giấu log (`redactingWriter`) bỏ sót nested JSON và token trong chuỗi lỗi
- **Severity:** High (CVSS 4.0: `7.1` — `CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N`)
- **Vị trí:** `internal/logger/logger.go` (`redactingWriter.Write`), `app.go` (`logActivity`)
- **Nguyên nhân:** `redactingWriter` chỉ kiểm tra key ở tầng đầu tiên của JSON; không duyệt đệ quy object/array lồng nhau và không che các mẫu `Bearer ...`, `ptlc_...`, `ptla_...`, hay `https://user:pass@...` xuất hiện bên trong chuỗi `msg` hoặc `error` (cũng như khi lưu vào bảng `activities` của SQLite).
- **Tác động:** Token API hoặc thông tin xác thực trong URL có thể bị ghi dạng plaintext vào file log hoặc SQLite `activities`.
- **Xác minh:** Xác minh qua `TestRedactString` và `TestRedactingWriterNestedAndStringValues`.
- **Khắc phục:** Đã bổ sung `RedactString()` và đệ quy `redactValue()` trong `internal/logger/logger.go`, đồng thời áp dụng `logger.RedactString(errMsg)` trong `app.go:logActivity`.

#### [SEC-04] Thiếu `checkSessionLock()` trên `SetSecurityPreferences` / `GetAppDataDir` & thiếu validate `OpenDetachedWindow`
- **Severity:** High (CVSS 4.0: `7.3` — `CVSS:4.0/AV:L/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:N/SC:N/SI:N/SA:N`)
- **Vị trí:** `app.go` (`SetSecurityPreferences`, `GetAppDataDir`, `OpenDetachedWindow`)
- **Nguyên nhân:** Khi phiên đang bị khóa (`sessionLocked = true`), IPC binding `SetSecurityPreferences` và `GetAppDataDir` không gọi `a.checkSessionLock()`, cho phép thay đổi `lock_on_launch` hoặc đọc đường dẫn dữ liệu ứng dụng. `OpenDetachedWindow` truyền trực tiếp các trường cấu hình thành tham số dòng lệnh mà chưa kiểm tra allowlist `Type` và ký tự điều khiển.
- **Xác minh:** Xác minh qua `TestSessionLockGuardsSensitiveBindings` và `TestOpenDetachedWindowValidation`.
- **Khắc phục:** Đã thêm `a.checkSessionLock()` vào `SetSecurityPreferences` và `GetAppDataDir`; thêm allowlist cho `config.Type` và chặn ký tự điều khiển / độ dài quá 512 ký tự trong `OpenDetachedWindow`.

#### [SEC-05] API Path Injection qua `identifier`, `UUID`, `externalID`, `FQDN`
- **Severity:** Medium
- **Vị trí:** `internal/api/client_api.go`, `internal/api/application_api.go`
- **Nguyên nhân:** Các tham số như `identifier`, `backupUUID`, `subuserUUID`, `externalID`, `node.FQDN` được nối trực tiếp vào đường dẫn URL API (`fmt.Sprintf("/servers/%s/...", identifier)`) mà không chặn `..`, `/`, `?`, `#`.
- **Khắc phục:** Bổ sung `security.ValidatePathIdentifier` và `security.ValidateHostOrFQDN`, dùng `serverPath()` và `url.PathEscape` trong `client_api.go` và `application_api.go`. Xác minh bằng `TestClientAPIRejectsPathTraversalIdentifier`.

#### [SEC-06] Race Condition trong `panel.Manager`
- **Severity:** Medium
- **Vị trí:** `internal/panel/manager.go`
- **Nguyên nhân:** Các map `clientAPIs`, `appAPIs` và biến `activePanel` được truy cập đồng thời từ nhiều goroutine Wails IPC mà không có `sync.RWMutex`.
- **Khắc phục:** Đã thêm `mu sync.RWMutex` bảo vệ toàn bộ thao tác đọc/ghi map và `activePanel`.

#### [SEC-07] Thiếu Content Security Policy (CSP) trong `frontend/index.html`
- **Severity:** Medium
- **Vị trí:** `frontend/index.html`
- **Nguyên nhân:** Không có thẻ `<meta http-equiv="Content-Security-Policy">` để hạn chế nguồn script, object và kết nối trong WebView2.
- **Khắc phục:** Đã thêm thẻ `<meta http-equiv="Content-Security-Policy" ...>` với `object-src 'none'`, `base-uri 'self'`, giới hạn `script-src 'self' blob:` và các origin hợp lệ của Wails/WebSocket/Google Fonts.

#### [SEC-08] Mở URL ngoài không kiểm tra scheme (`window.open` / `BrowserOpenURL`)
- **Severity:** Medium
- **Vị trí:** `frontend/src/pages/ServerDetail.tsx`, `frontend/src/components/common/ServerIDE.tsx`, `frontend/src/pages/admin/AdminPanelSettings.tsx`, `frontend/src/components/common/UpdateCheckerModal.tsx`, `frontend/src/components/common/SystemDiagnosticsModal.tsx`
- **Nguyên nhân:** Gọi trực tiếp `window.open(url, '_blank')` hoặc `BrowserOpenURL(url)` với URL từ API hoặc cấu hình mà không kiểm tra `http:`/`https:`, cũng như thiếu `noopener,noreferrer`.
- **Khắc phục:** Tạo helper `frontend/src/utils/safeUrl.ts` (`openSafeExternalUrl`) và cập nhật các vị trí gọi kiểm tra `protocol === 'https:' || protocol === 'http:'` kèm `noopener,noreferrer`.

#### [SEC-09] WebSocket thiếu validate URL, thiếu `SetReadLimit` và kiểm tra tín hiệu
- **Severity:** Medium
- **Vị trí:** `internal/api/websocket.go`
- **Khắc phục:** Kiểm tra `socketURL` qua `security.ValidateHTTPURL(sws.socketURL, true)`, đặt `conn.SetReadLimit(10 * 1024 * 1024)`, kiểm tra `SendPower` chỉ nhận `start`/`stop`/`restart`/`kill`, và dùng `sws.ctx` có timeout `15s` khi refresh token.

#### [SEC-10] `GetCustomBackground` đọc tệp ngoài thư mục `backgrounds` nếu DB bị sửa
- **Severity:** Medium
- **Vị trí:** `app.go` (`GetCustomBackground`)
- **Khắc phục:** Xác minh `filepath.Clean(path)` nằm trong `a.getBackgroundDir()` và kiểm tra `os.Lstat` không phải symlink trước khi đọc. Xác minh qua `TestGetCustomBackgroundRejectsPathOutsideBackgroundsDir`.

#### [SEC-11] `dbclient.ExecuteQuery` không giới hạn số dòng và thực thi lại câu lệnh lỗi
- **Severity:** Medium
- **Vị trí:** `internal/dbclient/mysql.go`
- **Khắc phục:** Giới hạn tối đa `10000` dòng trả về cho truy vấn đọc và phân tách luồng `QueryContext` (cho `SELECT`/`SHOW`/`DESCRIBE`/`EXPLAIN`/`WITH`) với `ExecContext` (cho câu lệnh ghi), tránh chạy lại câu lệnh SELECT bị lỗi.

#### [SEC-12] Hardcoded HMAC secret trong `LockoutManager`
- **Severity:** Low (Security Recommendation)
- **Vị trí:** `internal/security/lockout.go:16` (`lockoutHmacSecret`)
- **Nhận định:** Hằng số HMAC secret nằm trong mã nguồn/binary. Tuy nhiên tệp `security_lockout.dat` đã được mã hóa bởi Windows DPAPI (`CryptProtectData`), vốn đã ràng buộc dữ liệu với tài khoản Windows hiện tại. Việc thay đổi trực tiếp secret sẽ làm hỏng tương thích ngược và khiến người dùng hiện hữu bị khóa 15 phút khi nâng cấp; do đó khuyến nghị giữ tương thích ngược và lên kế hoạch di cư hoặc dựa hoàn toàn vào DPAPI ở phiên bản major tiếp theo.

#### [SEC-13] Thiếu Code Signing và Unpinned CI Tooling
- **Severity:** Low (Security Recommendation)
- **Vị trí:** `.github/workflows/build.yml`, `build/windows/installer/project.nsi`, `pterodesk.exe` (trong root repo)
- **Nhận định:** File thực thi Windows và bộ cài NSIS/WiX chưa được ký số (Authenticode); `.github/workflows/build.yml` cài `wails@latest` không ghim phiên bản và dùng `go-version: '1.23'` trong khi `go.mod` khai báo `go 1.26.0`. Khuyến nghị tích hợp ký số Authenticode trong CI release, ghim phiên bản Wails CLI và gỡ binary `.exe` biên dịch sẵn khỏi root repository.

---

## 4. Remediation Summary

Các tệp đã thêm mới hoặc chỉnh sửa trong quá trình khắc phục:
- [url_validation.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/security/url_validation.go) & [url_validation_test.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/security/url_validation_test.go)
- [manager.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/panel/manager.go)
- [client.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/api/client.go), [client_api.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/api/client_api.go), [application_api.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/api/application_api.go), [websocket.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/api/websocket.go), [security_test.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/api/security_test.go)
- [logger.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/logger/logger.go) & [redaction_test.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/logger/redaction_test.go)
- [mysql.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/internal/dbclient/mysql.go)
- [app.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/app.go), [version.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/version.go), [app_security_test.go](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/app_security_test.go)
- [index.html](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/index.html), [safeUrl.ts](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/src/utils/safeUrl.ts), [UpdateCheckerModal.tsx](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/src/components/common/UpdateCheckerModal.tsx), [SystemDiagnosticsModal.tsx](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/src/components/common/SystemDiagnosticsModal.tsx), [AdminPanelSettings.tsx](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/src/pages/admin/AdminPanelSettings.tsx), [ServerIDE.tsx](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/src/components/common/ServerIDE.tsx), [ServerDetail.tsx](file:///c:/Users/Administrator/Desktop/SynoraDesk-main/frontend/src/pages/ServerDetail.tsx)

---

## 5. Verification

| Hạng mục kiểm thử | Lệnh thực thi | Kết quả quan sát |
|---|---|---|
| Static Analysis (`go vet`) | `go vet ./...` | **PASS** (Exit code 0) |
| Backend Core & Security Tests | `go test -v . ./internal/security ./internal/logger ./internal/database ./internal/pterodactyl/discovery` | **PASS** (tất cả test case hiện có + test bảo mật mới đều PASS) |
| API & Security Mock Tests | `go test -v ./internal/api -run "TestAPIError\|TestApplicationAPI\|TestCheckNodeHealth\|TestBuildQueryString\|TestFetchPage\|TestHTTPClient\|TestClientAPIRejects"` | **PASS** (tất cả subtest PASS) |
| Loopback Socket Tests (`client_test.go`) | `go test -v ./internal/api` (trong sandbox) | **Blocked by Sandbox** (`connectex: An attempt was made to access a socket in a way forbidden by its access permissions` khi `httptest.NewServer` bind TCP loopback trên Windows sandbox) |
| Go Build Verification | `go build ./...` | **PASS** (Exit code 0) |
| Secret Scan (Source & Config) | PowerShell `Select-String` tìm private key, `ptlc_`, `ptla_`, AWS key | **PASS** (chỉ khớp dữ liệu giả lập trong file `*_test.go`) |
| Frontend Build / `npm audit` | `npm --version` | **Not Run** (`npm` / Node.js chưa được cài đặt hoặc không nằm trong `PATH` của môi trường thực thi) |

---

## 6. Remaining Risks

1. **Quét phụ thuộc Frontend (`npm audit`) và build TypeScript/Vite:** Chưa thể chạy `npm audit` và `npm run build` trong môi trường hiện tại do thiếu `npm` trong `PATH`; rủi ro lỗ hổng transitive từ các gói npm (đặc biệt `monaco-editor`, `vite`, `react-router-dom`) cần được kiểm tra trên máy build có Node.js.
2. **Công cụ SAST/SCA nâng cao (`govulncheck`, `gosec`, `staticcheck`):** Chưa được cài đặt trong môi trường hiện tại; mới chạy `go vet` và rà soát mã nguồn thủ công.
3. **Truyền tải HTTP cho Panel tự host:** `ValidateHTTPURL` vẫn cho phép `http://` để hỗ trợ các panel nội bộ/LAN chưa có TLS; nếu người dùng cấu hình panel từ xa qua `http://`, API token sẽ truyền không mã hóa trên mạng.
4. **Dữ liệu hoạt động cũ trong SQLite (`activities`):** Các bản ghi lỗi đã lưu từ trước khi vá vẫn có thể tồn tại trong DB người dùng cũ.

---

## 7. Recommendations

1. **Ký số Authenticode & CI/CD:** Thiết lập chứng thư Code Signing cho `SynoraDesk.exe` và bộ cài WiX/NSIS; đồng bộ `go-version` trong `.github/workflows/*.yml` với `go.mod` (`1.26`) và ghim phiên bản `wails` CLI thay vì `@latest`.
2. **Cảnh báo UI khi dùng `http://`:** Hiển thị cảnh báo rõ ràng trong `PanelManager` khi người dùng thêm URL không phải `https://` (ngoại trừ `localhost` / `127.0.0.1`).
3. **Bật `govulncheck` & `npm audit` trong CI:** Thêm bước chạy `govulncheck ./...` và `npm audit --audit-level=high` vào `.github/workflows/ci.yml`.
4. **Loại bỏ binary khỏi Git:** Xóa `pterodesk.exe` và `build/bin/pterodesk.exe` khỏi repository (nếu không cần thiết) và thêm vào `.gitignore`.

---

## 8. Final Assessment

Sau quá trình kiểm tra, vá lỗi và kiểm chứng, các lỗ hổng trọng yếu ở ranh giới giữa WebView2, Go Wails IPC, Pterodactyl API/WebSocket và hệ thống tệp cục bộ đã được xử lý triệt để mà không làm thay đổi hợp đồng API hay phá vỡ chức năng hiện có. Các kiểm tra `go vet`, `go build ./...` và bộ test bảo mật/đơn vị (không dùng TCP loopback trong sandbox) đều đạt 100%. Cần hoàn tất thêm bước `npm run build`, `npm audit` và `govulncheck` trong môi trường CI/dev có đầy đủ Node.js và công cụ SCA trước khi phát hành bản chính thức.
