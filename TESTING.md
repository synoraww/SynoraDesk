# Hướng dẫn kiểm tra và xác minh PteroDesk

## Chiến lược thử nghiệm

PteroDesk có kiến ​​trúc thử nghiệm phân lớp bao gồm các thử nghiệm đơn vị, thử nghiệm mật mã, thử nghiệm máy chủ HTTP mô phỏng và xác minh giả tạo bản dựng.

---

## 1. Bộ thử nghiệm tự động

### A. Thử nghiệm máy chủ HTTP mô phỏng (`internal/api/client_test.go`)
Sử dụng `net/http/httptest` để mô phỏng các hành vi và điểm cuối Pterodactyl REST chính thức:
- `TestClientAPI_GetAccount`: Xác minh xác thực tiêu đề xác thực Bearer và phân tích cú pháp JSON.
- `TestClientAPI_SendPowerAction`: Xác thực tải trọng gửi tín hiệu nguồn (`start`, `stop`, `restart`, `kill`).
- `TestClientAPI_ListBackups`: Xác minh các trường phân tích cú pháp và tổng kiểm tra danh sách sao lưu được phân trang.
- `TestClientAPI_RateLimitHandling`: Mô phỏng phản hồi HTTP `429 Too Many Requests`, kiểm tra hành vi thử lại chờ theo cấp số nhân và đảm bảo khôi phục minh bạch.

### B. Kiểm tra di chuyển và cơ sở dữ liệu SQLite (`internal/database/sqlite_test.go`)
- `TestSQLite_MigrationsAndPanelCRUD`: Khởi tạo cơ sở dữ liệu SQLite trong bộ nhớ/tạm thời ở chế độ WAL, chạy di chuyển tạo bảng và xác thực các hoạt động CRUD cho cấu hình bảng điều khiển.

### C. Kiểm tra DPAPI & Bảo mật (`internal/security/credentials_test.go`)
- `TestCredentialStore_MaskCredential`: Xác minh định dạng mặt nạ bí mật cho các mã thông báo có độ dài khác nhau.
- `TestCredentialStore_EncryptDecrypt`: Kiểm tra vòng quay mã hóa Windows DPAPI thông qua `CryptProtectData` và `CryptUnprotectData`.

### D. Kiểm tra khả năng và khám phá API (`internal/pterodactyl/discovery/discovery_test.go`)
- `TestParseVersion`: Xác minh phân tích cú pháp ngữ nghĩa trên các định dạng tiêu chuẩn, tiền phát hành và v2.
- `TestRegistryStats`: Xác minh tính đầy đủ và toàn vẹn của kho lưu trữ điểm cuối mặc định.
- `TestEvaluateCapabilities`: Kiểm tra việc tắt tính năng động trên Pterodactyl 2.x (ví dụ: Nest cũ).

---

## 2. Chạy lệnh kiểm tra

Thực hiện tất cả các bài kiểm tra phụ trợ của Go:
```powershell
cd c:\Users\Synora\Desktop\pterodactyl\pterodesk
go test -v ./internal/...
```

Thực hiện kiểm tra TypeScript giao diện người dùng và xây dựng sản xuất Vite:
```powershell
cd c:\Users\Synora\Desktop\pterodactyl\pterodesk\frontend
npm run build
```

Biên dịch nhị phân máy tính để bàn hoàn chỉnh bằng cách sử dụng Wails:
```powershell
cd c:\Users\Synora\Desktop\pterodactyl\pterodesk
wails build -clean
```
