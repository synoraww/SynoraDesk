# Nhật ký thay đổi

Tất cả những thay đổi đáng chú ý đối với dự án SynoraDesk (PteroDesk) sẽ được ghi lại trong tệp này.

## [1.0.4A] - 22-11-2026

### Phát trực tuyến bảng điều khiển hiệu suất cao, Clipboard tệp toàn cầu & cải tiến IDE

#### Đã thêm
- **Bộ phân tích nhật ký bảng điều khiển hiệu suất cao & Trình phân tích cú pháp ANSI**:
  - Chuyển sang phân nhóm đầu ra của bảng điều khiển được điều chỉnh phụ trợ (gỡ lỗi 20 mili giây / 256 dòng mỗi lô) để loại bỏ tắc nghẽn IPC trong nhật ký khởi động máy chủ nặng.
  - Hàng đợi `requestAnimationFrame` giao diện người dùng để ngăn chặn tình trạng đóng băng luồng chính trong quá trình phát trực tuyến bảng điều khiển thông lượng cao.
  - TrueColor RGB 24 bit đầy đủ (`38;2;r;g;b`) và bảng phân tích cú pháp ANSI 256 màu xterm với tính năng điều chỉnh độ tương phản tự động.
  - Các dòng nhật ký được tô màu `React.memo` và các lần xuất hiện có khóa duy nhất để hiển thị mượt mà, tức thì.
  - Hiệu suất cuộn xuống dưới nhanh chóng bỏ qua các truy vấn giới thiệu DOM chậm.
- **Hệ thống quản lý và bảng tạm tệp toàn cầu (`fileClipboard.ts`)**:
  - Hỗ trợ clipboard trên toàn hệ thống cho các hành động Sao chép và Cắt tệp/thư mục trên các thư mục và máy chủ.
  - Tích hợp menu ngữ cảnh và phím tắt trong Trình quản lý tệp và ServerIDE.
  - Thông báo chúc mừng xác nhận hành động sao chép/cắt/dán.
- **Các cải tiến của ServerIDE**:
  - Cây khám phá tệp nhiều tab đầy đủ tính năng với các hành động sao chép, cắt, dán, xóa và sao chép trực tiếp.
  - Bảo toàn trạng thái biên tập viên Monaco và đồng bộ hóa tập tin từ xa ngay lập tức.
- **Cập nhật trình cài đặt và điều khoản dịch vụ**:
  - Trình cài đặt WiX Toolset v7 được cập nhật với các điều khoản EULA được tinh chỉnh khẳng định Zero Telemetry và quyền riêng tư dữ liệu hoàn chỉnh.

---

## [1.0.3A] - 2026-11-19

### Bộ công cụ WiX Đường dẫn trình cài đặt MSI, Chống trùng lặp nhiều tab & Chẩn đoán thời gian chạy

#### Đã thêm
- **Gói cài đặt Windows chính thức (`.msi`)**:
  - Được xây dựng với WiX Toolset v7 (`WixUI_InstallDir`) với kiến ​​trúc Tệp chương trình 64-bit.
  - Tạo lối tắt cho Desktop và Start Menu.
  - Hộp kiểm khởi chạy ứng dụng tùy chọn sau khi cài đặt.
- **Chống trùng lặp nhiều tab và bảo vệ một phiên bản**:
  - Giao tiếp giữa các tab ngăn chặn các phiên hoạt động trùng lặp và các kết nối WebSocket xung đột.
- **Phương thức chẩn đoán hệ thống**:
  - Báo cáo kiểm tra chẩn đoán chi tiết Bản dựng Windows (`CurrentBuild.UBR`), số lõi CPU, phiên bản thời gian chạy Edge WebView2 và trạng thái SQLite WAL.
- **Đã sửa lỗi lưu trữ dữ liệu ứng dụng**:
  - Đã di dời dữ liệu người dùng và bộ đệm WebView2 sang `%APPDATA%\SynoraDesk` để ngăn chặn việc khóa thực thi.

---

## [1.0.2A] - 2026-11-19

### Cập nhật lớn: Bảo mật bằng mật mã, Studio hình nền, Điều khiển không khung & Kiến trúc được hỗ trợ bởi AI

#### Đã thêm
- **Kỹ thuật được hỗ trợ bởi AI**:
  - Cải tiến, tái cấu trúc và xác minh toàn bộ cơ sở mã được hỗ trợ bởi Google DeepMind AntiGravity / Gemini AI.
- **Bảo mật bằng mật mã & Khóa chống bạo lực (`internal/security/lockout.go`)**:
  - Khóa mã PIN (4, 6, 8 chữ số) và bảo vệ mật khẩu văn bản cho ứng dụng.
  - Cơ chế khóa chống giả mạo đơn điệu gắn với phần cứng: đếm ngược hình phạt vẫn tồn tại khi khởi động lại máy mà không giảm thời gian ngoại tuyến.
  - Bộ lưu trữ trạng thái được mã hóa (`security_lockout.dat`) sử dụng Windows DPAPI (`CryptProtectData`) cùng với xác minh chữ ký HMAC-SHA256.
  - Tự động xóa khẩn cấp tự hủy (`WipeAllData`): tự động xóa cơ sở dữ liệu SQLite và tất cả thông tin xác thực đã lưu khi vượt quá số lần thử thất bại tối đa.
- **Studio hình nền tương tác nâng cao (`WallpaperCustomizerModal.tsx`)**:
  - Xoay và cắt xén bằng cách kéo chuột trực tiếp để chọn các phần tiêu điểm cụ thể của bất kỳ hình nền nào.
  - Điều khiển Thu phóng mượt mà (50% đến 350%) với thanh trượt thu phóng, nút +/- và cài đặt trước thu phóng nhanh (100%, 125%, 150%, 200%, 250%).
  - Lưới căn chỉnh nhanh 9 điểm (Trên cùng bên trái, Giữa, Dưới cùng bên phải, v.v.) với các thanh trượt tọa độ X/Y.
  - Lớp phủ bố cục theo quy tắc một phần ba với hình chữ thập tiêu điểm trực tiếp.
  - Các chế độ hiển thị Che và Chứa, với tính năng đồng bộ hóa trực tiếp theo thời gian thực để làm mờ và làm mờ lớp phủ.
- **Quản lý cửa sổ không khung và duy trì trạng thái cửa sổ**:
  - Thanh tiêu đề không khung tùy chỉnh với tính năng kéo tự nhiên (`wails-drag` / `--wails-draggable: drag`).
  - Điều khiển cửa sổ liền mạch: Thu nhỏ (`WindowMinimise`), Tối đa hóa/Khôi phục (`WindowToggleMaximise`) và Thoát (`Quit`).
  - Tự động lưu trạng thái cửa sổ: tính ổn định của vị trí cửa sổ (X, Y), kích thước (Chiều rộng, Chiều cao) và trạng thái tối đa đã được gỡ bỏ (`window_state.json`).
  - Tính di động của cửa sổ khi bị khóa: khả năng di chuyển và điều chỉnh cửa sổ một cách liền mạch từ màn hình khóa.
- **Windows bật ra tách rời (Cửa sổ phụ độc lập)**:
  - Khả năng đưa bảng điều khiển máy chủ, tab trình soạn thảo IDE của Monaco, trình khám phá SFTP và cơ sở dữ liệu vào các cửa sổ màn hình độc lập.
  - Tiêu đề có thể kéo tùy chỉnh chuyên dụng với các điều khiển thu nhỏ, phóng to và đóng độc lập cho các cửa sổ tách rời.
- **Phím nóng thu phóng trình duyệt toàn cầu**:
  - Hỗ trợ đầy đủ cho việc thu phóng `Ctrl +`, `Ctrl -`, `Ctrl 0` và `Ctrl + Wheel`.
  - Được áp dụng trực tiếp cho `document.documentElement.style.zoom`, ngăn ngừa biến dạng bố cục và tạo tác viền đen.
  - Huy hiệu thu phóng HUD nổi với tính ổn định cục bộ trong `localStorage`.
- **Giao diện người dùng/UX & Bản địa hóa**:
  - Tự động phát hiện favicon của bảng điều khiển (`/public/favicons/favicon.ico`).
  - Thiết bị đầu cuối thông minh với khả năng phân tích mã màu ANSI nâng cao.
  - Độ phân giải hiển thị mã QR 2FA trong cài đặt bảo mật tài khoản.
  - Quốc tế hóa song ngữ toàn diện (tiếng Việt và tiếng Anh).

---

## [1.0.0] - 2026-11-16

### Bản phát hành đầu tiên: Máy khách Windows gốc sẵn sàng sản xuất

#### Đã thêm
- **Nền tảng cốt lõi**:
  - Thực thi Windows x64 gốc được cung cấp bởi Wails v2 và Go.
  - Giao diện người dùng React 19 hiện đại được tạo kiểu bằng Hệ thống thiết kế Meta Astryx và CSS Tailwind.
  - Cơ sở dữ liệu Pure Go SQLite chạy ở chế độ WAL với quá trình di chuyển tự động.
  - Mã hóa Windows DPAPI thông qua `crypt32.dll` để lưu trữ thông tin xác thực an toàn.
  - Trình ghi nhật ký nhiều trình ghi có cấu trúc Zerolog với tính năng chỉnh sửa mã thông báo.

- **Trình quản lý đa bảng**:
  - Quản lý nhiều bảng Pterodactyl độc lập với thông tin xác thực Ứng dụng và Khách hàng riêng biệt.
  - Kiểm tra kết nối trực tiếp và phát hiện phiên bản ngữ nghĩa.
  - Chuyển đổi bảng điều khiển hoạt động với lưu trữ phiên liên tục.

- **Công cụ khám phá và khả năng API**:
  - Sổ đăng ký được thiết kế ngược bao gồm tất cả các điểm cuối chính thức từ Pterodactyl 1.x và 2.x sắp tới.
  - Ma trận khả năng động điều chỉnh chế độ xem giao diện người dùng dựa trên các phiên bản bảng điều khiển được phát hiện và phạm vi khóa API đang hoạt động.
  - Danh mục quyền ACL chính thức dành cho các quyền chi tiết của người dùng phụ.

- **Hoạt động máy chủ & Bảng điều khiển thời gian thực**:
  - Bảng điều khiển quản lý máy chủ toàn diện với tính năng tìm kiếm, lọc và theo dõi tài nguyên.
  - Các tín hiệu điều khiển nguồn (`start`, `stop`, `restart`, `kill`) được bảo vệ bằng hộp thoại xác nhận.
  - Phát trực tuyến Wings WebSocket theo thời gian thực cho nhật ký bảng điều khiển trực tiếp và số liệu tài nguyên dưới giây.
  - Thanh đầu vào bảng điều khiển tương tác để thực thi lệnh.

- **Trình quản lý tệp động cơ kép & SFTP trực tiếp**:
  - Được tích hợp trực tiếp bên trong chế độ xem Chi tiết máy chủ.
  - Chuyển đổi liền mạch giữa API tệp Pterodactyl REST và SFTP tốc độ cao trực tiếp (`pkg/sftp`).
  - Thông tin đăng nhập kết nối máy chủ được điền sẵn với IP nút và cổng.
  - Trình chỉnh sửa tệp văn bản tích hợp với chức năng lưu trực tiếp.
  - Điều hướng thư mục, đường dẫn đường dẫn, tải tệp lên, tạo và xóa thư mục.

- **Quản lý cơ sở dữ liệu & Máy khách MySQL**:
  - Tạo cơ sở dữ liệu Pterodactyl, xoay mật khẩu và xóa.
  - Công cụ thực thi truy vấn MySQL/MariaDB tích hợp với lưới kết quả và thời gian thực hiện.
  - Trình duyệt lược đồ bảng tương tác.

- **Sao lưu và người dùng phụ**:
  - Bộ sao lưu đầy đủ: tạo bản sao lưu với cách đặt tên tùy chỉnh, bảo vệ khóa/mở khóa, khôi phục, xóa và tải xuống qua các URL được chỉ định.
  - Quản lý quyền truy cập của người dùng phụ: liệt kê người dùng phụ, mời người dùng bằng các hộp kiểm cấp quyền chi tiết và thu hồi quyền truy cập.

- **Bộ tài liệu**:
  - Bộ đầy đủ các thông số kỹ thuật và tài liệu kiểm tra.
