# SynoraDesk (PteroDesk) Ma trận trạng thái dự án và sản phẩm bàn giao

## Trạng thái dự án: ĐÃ HOÀN THÀNH, XÁC MINH & HOẠT ĐỘNG (v1.05A)

### Bản tóm tắt
SynoraDesk là một ứng dụng máy tính để bàn Windows gốc hoàn chỉnh, cấp sản xuất để quản lý một hoặc nhiều Bảng điều khiển Pterodactyl thông qua API REST chính thức, Wings WebSockets trực tiếp và đường hầm SSH/SFTP gốc. Được thiết kế với Go, Wails v2, React 19 và được phát triển với sự hỗ trợ của AI (Google DeepMind AntiGravity / Gemini AI).

---

## Danh sách kiểm tra sản phẩm bàn giao

### 1. Công nghệ & Nền tảng
- [x] Đi 1.25+ Phần phụ trợ với Wails v2
- [x] Thực thi Windows x64 gốc (`pterodesk.exe`)
- [x] React 19 + Giao diện TypeScript
- [x] Tích hợp hệ thống thiết kế Meta Astryx (`@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@stylexjs/stylex`)
- [x] Bộ biểu tượng Lucide React & Inter Typography
- [x] Mã hóa giới hạn phần cứng Windows DPAPI (`crypt32.dll`)
- [x] Cơ sở dữ liệu SQLite Pure Go ở chế độ WAL (`modernc.org/sqlite`)
- [x] Ghi nhật ký có cấu trúc Zerolog với tính năng biên tập bí mật tự động
- [x] Tuyên bố về Kiến trúc & Phát triển được hỗ trợ bởi AI

### 2. Bảo mật, Khóa mật mã & Chống bạo lực
- [x] Khóa mật mã (mã PIN 4, 6, 8 chữ số hoặc mật khẩu văn bản)
- [x] Tự động khóa sau khi hẹn giờ không hoạt động (1, 5, 15, 30 phút) & khóa khi khởi chạy
- [x] Khóa chống giả mạo đơn điệu gắn với phần cứng (`internal/security/lockout.go`)
- [x] Xác minh chữ ký DPAPI + HMAC-SHA256 cho tệp trạng thái khóa
- [x] Thực thi thời gian offline (tắt máy không bỏ qua hình phạt)
- [x] Xóa dữ liệu tự hủy khẩn cấp (`WipeAllData`) khi thử thất bại quá nhiều lần
- [x] Khả năng kéo và điều khiển toàn bộ cửa sổ khi ở trên màn hình khóa

### 3. Quản lý cửa sổ & Thiết kế không khung
- [x] Thanh tiêu đề không khung tùy chỉnh với tính năng kéo tự nhiên (`wails-drag` / `--wails-draggable: drag`)
- [x] Hành động điều khiển cửa sổ (Thu nhỏ, Tối đa hóa/Khôi phục, Đóng)
- [x] Kích thước cửa sổ, tọa độ (X, Y) và độ bền trạng thái tối đa (`window_state.json`)
- [x] Windows bật ra tách rời (`main.DetachedWindowConfig`) với tiêu đề tùy chỉnh độc lập
- [x] Phím nóng thu phóng trình duyệt (`Ctrl +`, `Ctrl -`, `Ctrl 0`, `Ctrl + Wheel`) không có tạo tác viền đen
- [x] Huy hiệu mức thu phóng HUD nổi

### 4. Studio hình nền tùy chỉnh
- [x] Lưu trữ hình nền tùy chỉnh liên tục trong `%APPDATA%/PteroDesk/backgrounds/`
- [x] Tương tác Pan & Crop bằng cách kéo chuột trực tiếp
- [x] Lưới bố cục quy tắc một phần ba có dấu chữ thập tiêu điểm
- [x] Thanh trượt thu phóng mượt mà (50% đến 350%) và cài đặt trước nhanh (100%, 125%, 150%, 200%, 250%)
- [x] Lưới căn chỉnh tiêu cự 9 điểm (↖, ⬆, ↗, ⬅, ⏺, ➡, ↙, ⬇, ↘)
- [x] Chế độ hiển thị Che và Chứa
- [x] Đồng bộ hóa trực tiếp theo thời gian thực để làm mờ lớp phủ (30% - 95%) và làm mờ (0 - 20px)

### 5. Quản lý đa bảng
- [x] Hồ sơ bảng điều khiển không giới hạn
- [x] Chuyển đổi hồ sơ với trạng thái hoạt động bền bỉ
- [x] Thông tin xác thực API ứng dụng và ứng dụng khách độc lập
- [x] Tự động phát hiện favicon trang web (`/public/favicons/favicon.ico`)
- [x] Kiểm tra tình trạng và ping kết nối API trực tiếp
- [x] Lưu trữ thông tin xác thực được che giấu và mã hóa DPAPI

### 6. Công cụ khám phá và khả năng API
- [x] Danh mục điểm cuối được thiết kế ngược (`internal/pterodactyl/discovery/registry.go`)
- [x] Phát hiện phiên bản bảng điều khiển (1.x so với 2.x)
- [x] Chuyển đổi tính năng giao diện người dùng và báo cáo khả năng động
- [x] Danh mục quyền ACL chính thức (`internal/pterodactyl/discovery/permissions.go`)

### 7. Vận hành máy chủ & Bảng điều khiển thời gian thực
- [x] Danh sách máy chủ có huy hiệu tìm kiếm, bộ lọc và trạng thái
- [x] Biểu ngữ số liệu trực tiếp (% CPU, MB bộ nhớ, MB đĩa, Nút, Phân bổ)
- [x] Tín hiệu điều khiển nguồn (`start`, `stop`, `restart`, `kill`) được bảo vệ bằng hộp thoại xác nhận
- [x] Truyền trực tuyến bảng điều khiển thời gian thực qua giao thức Wings WebSocket
- [x] Thiết bị đầu cuối thông minh với khả năng phân tích mã màu ANSI
- [x] Lịch sử lệnh và thanh nhập lệnh tương tác

### 8. Trình quản lý tệp tích hợp & SFTP trực tiếp
- [x] Trình quản lý tệp công cụ kép (API REST của khách hàng & SFTP trực tiếp)
- [x] Hộp thoại kết nối SFTP trực tiếp được điền sẵn bằng thông tin xác thực nút máy chủ
- [x] Thanh điều hướng thư mục và đường dẫn
- [x] Trình soạn thảo mã Monaco tích hợp với tính năng tô sáng cú pháp và lưu ngay lập tức
- [x] Tạo, xóa và tải lên tập tin và thư mục

### 9. Trình quản lý cơ sở dữ liệu
- [x] Danh sách cơ sở dữ liệu từ xa từ API Pterodactyl
- [x] Tạo cơ sở dữ liệu và xoay mật khẩu
- [x] Trình chạy truy vấn MySQL / MariaDB trực tiếp
- [x] Trình duyệt bảng và thanh tra cấu trúc

### 10. Sao lưu & Người dùng phụ
- [x] Sao lưu danh sách với huy hiệu khóa và tính toán kích thước
- [x] Phương thức tạo bản sao lưu với cách đặt tên tùy chỉnh và bảo vệ khóa
- [x] Tải xuống bản sao lưu với việc tạo URL được chỉ định
- [x] Chuyển đổi khóa/mở khóa dự phòng và khôi phục máy chủ
- [x] Quản lý người dùng phụ (liệt kê, phương thức mời với quyền chi tiết, thu hồi)
- [x] Độ phân giải hiển thị mã QR 2FA trong cài đặt bảo mật tài khoản

### 11. Quốc tế hóa & Chủ đề
- [x] Hỗ trợ i18n song ngữ toàn diện (tiếng Việt & tiếng Anh)
- [x] Làm sạch các chủ đề ở chế độ tối và sáng
- [x] 5 bảng màu nhấn (Xanh dương, Xanh lục, Tím, Hổ phách, Hồng)

### 12. Bộ tài liệu
- [x] `README.md`
- [x] `CHANGELOG.md`
- [x] `PROJECT_STATUS.md`
- [x] `ARCHITECTURE.md`
- [x] `SECURITY.md`
- [x] `TESTING.md`
- [x] `API_DISCOVERY.md`
- [x] `API_COVERAGE.md`
- [x] `API_COMPATIBILITY.md`
