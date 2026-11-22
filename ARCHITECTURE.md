# Kiến trúc hệ thống SynoraDesk

## Tổng quan

**SynoraDesk** (trước đây là PteroDesk) là ứng dụng khách máy tính để bàn Windows hiệu suất cao được thiết kế dành cho quản trị viên hệ thống, kỹ sư DevOps và người quản lý máy chủ trò chơi. Kiến trúc này phân tách chặt chẽ các mối quan tâm giữa quy trình phụ trợ Go gốc và giao diện người dùng React 19 được hiển thị bên trong cửa sổ WebView2 gốc, được phát triển với sự hỗ trợ của AI (Google DeepMind Antigravity / Gemini AI).

---

## 1. Sơ đồ kiến ​​trúc cấp cao

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

## 2. Hệ thống con cốt lõi

### A. Tích hợp máy tính để bàn và cửa sổ không khung Wails v2
- **Khung**: Wails v2 (`github.com/wailsapp/wails/v2`).
- **Định dạng nhị phân**: Tệp thực thi Windows PE gốc (`pterodesk.exe`) được biên dịch bằng cờ hệ thống con Windows (`-H windowsgui`).
- **Kéo không khung**: CSS `.wails-drag` (`--wails-draggable: drag`) cho phép kéo cửa sổ hệ điều hành trực tiếp từ thanh tiêu đề tùy chỉnh và lớp phủ màn hình khóa, trong khi `.wails-no-drag` bảo vệ các yếu tố tương tác.
- **Lưu trạng thái cửa sổ**: Vị trí cửa sổ (X, Y), kích thước (Chiều rộng, Chiều cao) và trạng thái phóng to được tự động lưu có độ trễ vào `%APPDATA%/PteroDesk/data/window_state.json`.

### B. Windows tách rời đa tiến trình (Cửa sổ bật ra)
- Các phiên bản cửa sổ độc lập được sinh ra thông qua `OpenDetachedWindow`:
  - Vượt qua cờ CLI (`-detached=true -type=server -server=ID -subtab=ide`).
  - Tạo ra một quy trình máy tính để bàn bị cô lập với tiêu đề có thể kéo tùy chỉnh chuyên dụng của riêng nó.
  - Cho phép giám sát máy chủ song song, chỉnh sửa mã Monaco và thực thi truy vấn cơ sở dữ liệu trên nhiều màn hình vật lý.

### C. Bảo mật, DPAPI & Khóa chống giả mạo đơn điệu
- **Bộ lưu trữ giới hạn phần cứng**: Sử dụng `crypt32.dll` thông qua `CryptProtectData` và `CryptUnprotectData` để liên kết các bí mật với hồ sơ Windows của người dùng.
- **Khóa chống giả mạo đơn điệu (`internal/security/lockout.go`)**:
  - Tệp trạng thái được mã hóa (`security_lockout.dat`) được bảo vệ bởi DPAPI và HMAC-SHA256.
  - Thực thi thời gian chạy hoạt động đơn điệu để việc tắt hoặc tắt nguồn máy tính sẽ bị treo thay vì bỏ qua các hình phạt khóa máy.
  - `WipeAllData` tự hủy khẩn cấp tự động xóa dữ liệu SQLite đối với các vi phạm bạo lực ở mức tối đa.

### D. Studio hình nền tương tác & Canvas Engine
- Lưu trữ hình nền liên tục trong `%APPDATA%/PteroDesk/backgrounds/`.
- Khung nhìn tương tác hỗ trợ xoay và cắt xén bằng cách kéo chuột, cài đặt trước căn chỉnh 9 điểm và thu phóng mượt mà (50% - 350%).
- Đồng bộ hóa bố cục CSS theo thời gian thực với tính năng làm mờ hình thái thủy tinh và làm mờ lớp phủ.

### E. Phát triển được hỗ trợ bởi AI
- Được thiết kế và lặp lại với sự hỗ trợ của **Google DeepMind Antigravity / Gemini AI**, bao gồm các dịch vụ phụ trợ Go, máy trạng thái giao diện người dùng React 19, thuật toán lưu trữ bảo mật bằng mật mã và bộ thử nghiệm tự động toàn diện.
