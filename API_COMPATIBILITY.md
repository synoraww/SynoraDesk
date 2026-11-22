# Ma trận tương thích phiên bản Pterodactyl

## Tổng quan

PteroDesk hỗ trợ cài đặt Pterodactyl 1.x đồng thời cung cấp khả năng tương thích về phía trước cho các phát triển Pterodactyl 2.x.

---

## 1. Phát hiện phiên bản và đánh giá khả năng

PteroDesk có công cụ phát hiện khả năng tự động (`internal/pterodactyl/discovery/capability.go`).
Khi lưu hoặc chuyển sang cấu hình Bảng điều khiển, hệ thống sẽ thực hiện kiểm tra ping và đánh giá:
1. Thông tin xác thực API có sẵn (Khóa API ứng dụng khách, khóa API ứng dụng hoặc cả hai).
2. Chuỗi phiên bản bảng điều khiển được báo cáo bởi tiêu đề máy chủ hoặc điểm cuối hệ thống.
3. Các tính năng được kích hoạt và các tab giao diện người dùng hiển thị.

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

## 2. Sự khác biệt chính: 1.x và 2.x

| Khu vực đặc trưng | Pterodactyl 1.x | Pterodactyl 2.x | Thích ứng PteroDesk |
| :--- | :--- | :--- | :--- |
| **API tổ** | `/api/application/nests` | Không được dùng nữa/Đã xóa | Chuyển đổi khả năng động (`CanManageNests`); ẩn trên 2.x |
| **Bản thiết kế máy chủ** | Có trong định nghĩa Trứng | Hệ thống bản thiết kế mô-đun | Được xử lý một cách khéo léo thông qua các lược đồ dự phòng |
| **API quản trị** | Được kết hợp trong API ứng dụng | Không gian tên `/api/admin` chuyên dụng | Trình phân giải tuyến đường động trong `internal/api` |
| **Bảng điều khiển WebSocket** | Mã thông báo tồn tại trong thời gian ngắn qua `/websocket` | Xoay JWT nâng cao | Được xử lý thông qua lệnh gọi lại `TokenRefresher` trong `internal/api/websocket.go` |
| **Xác thực SFTP** | Thông tin xác thực SFTP của máy chủ với user.id | Xác thực daemon thống nhất | Được xử lý liền mạch bởi `internal/sftp/client.go` |

---

## 3. Hành vi giao diện người dùng động

Khi điểm cuối hoặc tính năng không được hỗ trợ cho bảng điều khiển:
- **Thiếu Khóa API ứng dụng**: Các tab Quản trị (Nút, Quản lý người dùng, Cung cấp máy chủ) hiển thị huy hiệu khả năng cung cấp thông tin nhắc người dùng cung cấp mã thông báo API ứng dụng trong Cài đặt bảng điều khiển.
- **Đã phát hiện phiên bản 2.x**: Quản lý tổ được thay thế bằng cấu hình Trứng/Bản thiết kế trực tiếp, ngăn ngừa lỗi tuyến đường 404.
- **Thiếu quyền chi tiết**: Phản hồi lỗi API máy khách (`403 Forbidden` / `HttpForbiddenException`) được ánh xạ tới các thông báo thân thiện với người dùng nêu chi tiết khóa cấp phép bị thiếu (ví dụ: `file.delete` hoặc `control.restart`).
