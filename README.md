# SynoraDesk (PteroDesk) v1.02A

**Modern Native Windows Desktop Client for Pterodactyl Panels**

[![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11%20x64-0078D4?logo=windows)](https://microsoft.com)
[![Framework](https://img.shields.io/badge/Framework-Wails%20v2-DF1A29)](https://wails.io)
[![Backend](https://img.shields.io/badge/Backend-Go%201.25+-00ADD8?logo=go)](https://golang.org)
[![Frontend](https://img.shields.io/badge/Frontend-React%2019%20%2B%20TypeScript-61DAFB?logo=react)](https://react.dev)
[![Security](https://img.shields.io/badge/Security-Windows%20DPAPI%20%2B%20HMAC-4CAF50)](SECURITY.md)
[![AI Assisted](https://img.shields.io/badge/AI%20Assisted-Google%20DeepMind%20Antigravity-8E24AA)](README.md#ai-assisted-development)

---

## 🤖 AI-Assisted Development / Tuyên bố phát triển cùng AI

> **Dự án SynoraDesk (PteroDesk) được phát triển và tối ưu hóa toàn diện với sự hỗ trợ của Trí tuệ nhân tạo (AI-Assisted Development)**, sử dụng hệ thống **Google DeepMind Antigravity / Gemini AI Agent**.
> 
> Từ kiến trúc Go backend đa tiến trình (multi-process Wails architecture), hệ thống bảo mật phần cứng Windows DPAPI, cơ chế chống tấn công dò mã (monotonic anti-brute-force lockout), cho đến giao diện người dùng React 19 glassmorphism, bộ công cụ xử lý hình nền trực quan, và các bài kiểm thử tự động—tất cả đều được thiết kế, lập trình và tinh chỉnh thông qua quy trình hợp tác liên tục giữa nhà phát triển và AI.

---

## Overview

**SynoraDesk** (tiền thân là PteroDesk) là ứng dụng desktop native chuyên biệt trên Windows dành cho các quản trị viên hệ thống, DevOps, và người vận hành máy chủ Pterodactyl.

Khác biệt với các ứng dụng bọc web hay Electron nặng nề, SynoraDesk được biên dịch thành một file nhị phân Go duy nhất, siêu nhẹ, tiết kiệm RAM nhờ **Wails v2** kết hợp WebView2 và React 19. Ứng dụng giao tiếp trực tiếp với Pterodactyl qua REST API chính thức, Wings WebSockets thời gian thực, và đường truyền bảo mật SFTP/SSH.

---

## Key Features

### 🛡️ Bảo mật đa tầng & Khóa ứng dụng (Security & Passcode Lock)
- **Mã hóa phần cứng Windows DPAPI**: Toàn bộ API token (Client & Application), mật khẩu database, SSH key được mã hóa tại chỗ bằng `CryptProtectData` (`crypt32.dll`), gắn chặt với tài khoản Windows của người dùng.
- **Cơ chế Khóa mật mã (App Passcode Lock)**: Hỗ trợ mã PIN 4 số, 6 số, 8 số hoặc Mật khẩu văn bản phức tạp, tự động khóa khi không sử dụng hoặc khi khởi động.
- **Bộ đếm chống dò mã chống giả mạo (Monotonic Anti-Tamper Lockout)**: Khóa tạm thời 1–60 phút sau nhiều lần nhập sai. Tệp trạng thái được mã hóa bằng DPAPI + chữ ký HMAC-SHA256; thời gian tắt máy không làm giảm thời gian phạt (monotonic clock verification).
- **Tự hủy dữ liệu an toàn (Emergency Self-Destruct Wipe)**: Tự động xóa sạch toàn bộ cơ sở dữ liệu SQLite và khóa API nếu số lần nhập sai vượt quá ngưỡng an toàn.

### 🖼️ Bộ công cụ Hình nền tùy chỉnh (Interactive Wallpaper Studio)
- **Căn góc & Chọn phần ảnh (Interactive Pan & Crop)**: Kéo rê chuột trực tiếp trên khung ảnh để chọn góc hiển thị đẹp nhất.
- **Lưới chia bố cục 1/3 (Rule of Thirds)** kèm hồng tâm định vị tọa độ X% - Y%.
- **Phóng to / Thu nhỏ (Smooth Zoom)**: Thanh trượt Zoom mượt từ 50% đến 350%, phím tắt zoom nhanh (100%, 125%, 150%, 200%, 250%) và lăn chuột trực tiếp.
- **Căn nhanh 9 góc (9-Point Grid Alignment)**: Phím tắt chọn nhanh 9 vị trí tiêu điểm.
- **Chế độ hiển thị (Cover / Contain)**, điều chỉnh độ mờ kính (Blur) và độ tối phủ nền (Opacity) cập nhật thời gian thực.

### 🪟 Cửa sổ không viền & Cửa sổ phụ độc lập (Frameless & Detached Windows)
- **Custom Frameless Titlebar**: Thanh tiêu đề kéo thả native (`wails-drag`), nút Thu nhỏ, Phóng to/Khôi phục, Đóng, và hiển thị trạng thái tài liệu.
- **Khôi phục kích thước cửa sổ**: Tự động lưu và khôi phục tọa độ (X, Y), kích thước (Width, Height) và trạng thái phóng to cực đại (`window_state.json`).
- **Cửa sổ bật ra độc lập (Detached Pop-out Windows)**: Cho phép tách tab Server Console, trình soạn thảo Monaco IDE, SFTP hoặc Database sang cửa sổ riêng với thanh điều khiển độc lập.
- **Phím tắt thu phóng trình duyệt (Browser Zoom Hotkeys)**: `Ctrl +`, `Ctrl -`, `Ctrl 0` và `Ctrl + Wheel` thu phóng mượt mà, không méo hình, không viền đen thừa, kèm huy hiệu thông báo mức Zoom nổi.

### ⚡ Vận hành máy chủ & Quản lý tập trung
- **Multi-Panel Manager**: Quản lý không giới hạn các cụm Panel Pterodactyl, tự động lấy favicon website và kiểm tra kết nối live.
- **Wings WebSocket Real-time Console**: Bảng điều khiển dòng lệnh trực tiếp với bộ phân tích màu ANSI thông minh và biểu đồ tài nguyên (CPU, RAM, Disk).
- **Trình soạn thảo mã nguồn Monaco IDE**: Tích hợp công nghệ VS Code Monaco Editor với highlight cú pháp cho hàng chục ngôn ngữ lập trình và cấu hình server.
- **Dual-Engine File Manager & Direct SFTP**: Chuyển đổi linh hoạt giữa Pterodactyl REST API và giao thức SFTP trực tiếp tốc độ cao.
- **MySQL / MariaDB Client tích hợp**: Chạy truy vấn SQL, duyệt danh sách bảng và tạo database ngay trong app.
- **Sao lưu & Phân quyền Subusers**: Quản lý snapshot máy chủ (tạo, khóa, khôi phục, tải về) và phân quyền subuser chi tiết từng quyền hạn.
- **Đa ngôn ngữ & Giao diện (i18n & Themes)**: Hỗ trợ tiếng Việt và tiếng Anh; chế độ Tối (Dark) / Sáng (Light); 5 bảng màu chủ đạo (Xanh dương, Xanh lá, Tím, Cam, Đỏ).

---

## Documentation Suite

- 📖 [**Architecture Plan & System Design**](ARCHITECTURE.md) - Kiến trúc hệ thống và đa tiến trình Wails
- 🛡️ [**Security & DPAPI Specification**](SECURITY.md) - Đặc tả mã hóa phần cứng, Lockout chống giả mạo và Tự hủy an toàn
- 🔍 [**API Discovery & Reverse Research**](API_DISCOVERY.md) - Danh mục API đảo ngược Pterodactyl 1.x & 2.x
- 📊 [**API Coverage Matrix**](API_COVERAGE.md) - Bảng theo dõi mức độ hỗ trợ endpoint
- 🔄 [**Version Compatibility (1.x vs 2.x)**](API_COMPATIBILITY.md) - Quy tắc tương thích phiên bản panel
- 🧪 [**Testing & Mock Verification**](TESTING.md) - Hướng dẫn kiểm thử và Mock API
- 📋 [**Project Status & Deliverables**](PROJECT_STATUS.md) - Bảng ma trận nghiệm thu tính năng
- 📝 [**Changelog**](CHANGELOG.md) - Lịch sử cập nhật chi tiết từng phiên bản

---

## Building from Source

### Prerequisites
- **OS**: Windows 10/11 x64
- **Go**: 1.25+
- **Node.js**: 20+ with npm
- **Wails CLI v2**: `go install github.com/wailsapp/wails/v2/cmd/wails@latest`

### Run Backend Tests
```powershell
go test -v ./internal/...
```

### Build Frontend
```powershell
npm --prefix frontend run build
```

### Build Native Desktop Binary
```powershell
wails build -s
```
File thực thi cuối cùng sẽ nằm tại: `build/bin/pterodesk.exe`.
