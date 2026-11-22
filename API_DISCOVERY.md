# Nghiên cứu điểm cuối và khám phá API Pterodactyl

## Tổng quan

Tài liệu này trình bày thông số kỹ thuật được thiết kế ngược và bản kiểm kê của API Pterodactyl REST chính thức. Phương pháp khám phá được thực hiện bằng cách kiểm tra tài liệu chính thức (`https://docs.pterodactyl.io/`), định nghĩa tuyến đường của Laravel (`routes/api-client.php`, `routes/api-application.php`), bộ điều khiển, trình xác thực yêu cầu và trình biến đổi mô hình trên cả bản phát hành Pterodactyl 1.x và 2.x sắp tới.

---

## 1. Kiến trúc xác thực

Pterodactyl sử dụng xác thực HTTP Bearer với các định dạng mã thông báo và mô hình cấp phép riêng biệt:

- **Mã thông báo API ứng dụng khách (`ptlc_...`)**:
  - Được tạo cho mỗi tài khoản người dùng thông qua giao diện máy khách hoặc `/api/client/account/api-keys`.
  - Phạm vi quyền của máy chủ riêng lẻ (hệ thống ACL).
  - Được sử dụng cho các hoạt động hàng ngày: kiểm soát nguồn điện máy chủ, truy cập WebSocket bảng điều khiển trực tiếp, quản lý tệp, người dùng phụ, bản sao lưu và cơ sở dữ liệu.
  - Tiêu đề: `Authorization: Bearer <client_api_key>`

- **Mã thông báo API ứng dụng (`ptla_...`)**:
  - Được tạo độc quyền bởi người dùng root/quản trị viên trong khu vực quản trị của bảng điều khiển.
  - Phạm vi tài nguyên quản trị (`r:servers`, `rw:servers`, `r:nodes`, `rw:nodes`, `r:allocations`, `rw:allocations`, `r:users`, `rw:users`, `r:nests`).
  - Được sử dụng để cung cấp, thiết lập cơ sở hạ tầng nút, nhóm phân bổ và quản trị người dùng.
  - Tiêu đề: `Authorization: Bearer <application_api_key>`

> **Quy tắc bảo mật**: Khóa API ứng dụng và khóa API ứng dụng được phân vùng chặt chẽ. Khóa Ứng dụng không thể thực hiện các hành động cấp nguồn ở cấp máy khách hoặc truy cập trực tiếp vào bảng điều khiển WebSocket và khóa Máy khách không thể tạo nút hoặc phân bổ nhóm IP.

---

## 2. Danh mục điểm cuối chính thức

### A. API ứng dụng khách (`/api/client`)

| Phương pháp | Điểm cuối | Mô tả | Quyền cần thiết |
| :--- | :--- | :--- | :--- |
| `GET` | `/account` | Hồ sơ người dùng được xác thực | Không có |
| `GET` | `/account/two-factor` | Mã QR TOTP & bí mật | Không có |
| `POST` | `/account/two-factor` | Kích hoạt 2FA bằng mã xác minh | Không có |
| `DELETE` | `/account/two-factor` | Vô hiệu hóa 2FA bằng xác nhận mật khẩu | Không có |
| `PUT` | `/account/email` | Cập nhật email người dùng | Xác nhận mật khẩu |
| `PUT` | `/account/password` | Cập nhật mật khẩu người dùng | Xác nhận mật khẩu |
| `GET` | `/account/api-keys` | Liệt kê các khóa API ứng dụng khách | Không có |
| `POST` | `/account/api-keys` | Tạo mã thông báo khách hàng mới | Không có |
| `DELETE` | `/account/api-keys/{id}` | Thu hồi mã thông báo API của khách hàng | Không có |
| `GET` | `/account/ssh-keys` | Liệt kê các khóa công khai SSH của khách hàng | Không có |
| `POST` | `/account/ssh-keys` | Đăng ký khóa công khai SSH của khách hàng | Không có |
| `POST` | `/account/ssh-keys/remove` | Xóa khóa SSH của khách hàng bằng dấu vân tay | Không có |
| `GET` | `/account/activity` | Truy xuất nhật ký hoạt động/kiểm tra tài khoản | Không có |
| `GET` | `/` | Liệt kê các máy chủ có thể truy cập | Không có |
| `GET` | `/servers/{id}` | Tìm nạp thông tin chi tiết và giới hạn của máy chủ | Không có |
| `GET` | `/servers/{id}/resources` | Thống kê CPU, RAM, đĩa thời gian thực | Không có |
| `POST` | `/servers/{id}/power` | Công văn `start`, `stop`, `restart`, `kill` | `control.start`, `control.stop`, `control.restart` |
| `POST` | `/servers/{id}/command` | Gửi lệnh console | `control.console` |
| `GET` | `/servers/{id}/websocket` | Có được URL JWT & WS của Wings tồn tại trong thời gian ngắn | `control.console` |
| `GET` | `/servers/{id}/files/list` | Liệt kê nội dung thư mục | `file.read` |
| `GET` | `/servers/{id}/files/contents` | Đọc văn bản tập tin/luồng thô | `file.read-content` |
| `POST` | `/servers/{id}/files/write` | Viết nội dung tập tin | `file.update` |
| `POST` | `/servers/{id}/files/create-folder` | Tạo thư mục | `file.create` |
| `POST` | `/servers/{id}/files/delete` | Xóa hàng loạt tập tin/thư mục | `file.delete` |
| `PUT` | `/servers/{id}/files/rename` | Đổi tên hoặc di chuyển tập tin | `file.update` |
| `GET` | `/servers/{id}/files/upload` | Yêu cầu URL tải lên được chỉ định | `file.create` |
| `POST` | `/servers/{id}/files/compress` | Tạo kho lưu trữ `.tar.gz` | `file.archive` |
| `POST` | `/servers/{id}/files/decompress` | Trích xuất kho lưu trữ | `file.archive` |
| `GET` | `/servers/{id}/databases` | Liệt kê máy chủ cơ sở dữ liệu & cơ sở dữ liệu | `database.read` |
| `POST` | `/servers/{id}/databases` | Cung cấp cơ sở dữ liệu MySQL mới | `database.create` |
| `POST` | `/servers/{id}/databases/{db}/rotate-password` | Xoay mật khẩu cơ sở dữ liệu | `database.update` |
| `DELETE`| `/servers/{id}/databases/{db}` | Bỏ cơ sở dữ liệu | `database.delete` |
| `GET` | `/servers/{id}/backups` | Liệt kê các bản sao lưu có trạng thái khóa | `backup.read` |
| `POST` | `/servers/{id}/backups` | Tạo kho lưu trữ sao lưu mới | `backup.create` |
| `GET` | `/servers/{id}/backups/{uuid}/download` | Tìm nạp URL tải xuống bản sao lưu đã ký | `backup.download` |
| `POST` | `/servers/{id}/backups/{uuid}/lock` | Chuyển đổi khóa bảo vệ | `backup.create` |
| `POST` | `/servers/{id}/backups/{uuid}/restore` | Khôi phục tập tin máy chủ từ bản sao lưu | `backup.restore` |
| `DELETE`| `/servers/{id}/backups/{uuid}` | Xóa kho lưu trữ sao lưu | `backup.delete` |
| `GET` | `/servers/{id}/users` | Liệt kê người dùng phụ của máy chủ | `user.read` |
| `POST` | `/servers/{id}/users` | Mời người dùng phụ có quyền | `user.create` |
| `POST` | `/servers/{id}/users/{uuid}` | Cập nhật quyền của người dùng phụ | `user.update` |
| `DELETE`| `/servers/{id}/users/{uuid}` | Thu hồi quyền truy cập của người dùng phụ | `user.delete` |
| `GET` | `/servers/{id}/network/allocations` | Liệt kê phân bổ cổng | `allocation.read` |
| `POST` | `/servers/{id}/network/allocations/{alloc}/primary` | Chỉ định phân bổ chính | `allocation.update` |
| `GET` | `/servers/{id}/startup` | Xem các biến và quy tắc khởi động | `startup.read` |
| `PUT` | `/servers/{id}/startup/variable` | Cập nhật biến môi trường | `startup.update` |
| `POST` | `/servers/{id}/settings/rename` | Đổi tên nhãn máy chủ | `settings.rename` |
| `POST` | `/servers/{id}/settings/reinstall` | Kích hoạt cài đặt lại toàn bộ máy chủ | `settings.reinstall` |

---

### B. API ứng dụng (`/api/application`)

| Phương pháp | Điểm cuối | Mô tả | Phạm vi bắt buộc |
| :--- | :--- | :--- | :--- |
| `GET` | `/servers` | Liệt kê tất cả các máy chủ (chế độ xem quản trị) | `r:servers` |
| `POST` | `/servers` | Triển khai phiên bản máy chủ mới | `rw:servers` |
| `GET` | `/servers/{id}` | Kiểm tra cấu hình và giới hạn máy chủ | `r:servers` |
| `PATCH`| `/servers/{id}/build` | Cập nhật giới hạn CPU, bộ nhớ, ổ đĩa | `rw:servers` |
| `POST` | `/servers/{id}/suspend` | Đình chỉ hành chính | `rw:servers` |
| `POST` | `/servers/{id}/unsuspend` | Giải phóng hệ thống treo | `rw:servers` |
| `POST` | `/servers/{id}/reinstall` | Buộc cài đặt lại container | `rw:servers` |
| `DELETE`| `/servers/{id}` | Phá hủy phiên bản máy chủ (`?force=true`) | `rw:servers` |
| `GET` | `/nodes` | Liệt kê tất cả các nút daemon của Wings | `r:nodes` |
| `POST` | `/nodes` | Đăng ký nút máy chủ Wings mới | `rw:nodes` |
| `GET` | `/nodes/{id}` | Thông tin nút và cổng chi tiết | `r:nodes` |
| `GET` | `/nodes/{id}/configuration` | Mã thông báo thiết lập Wings & khối YAML | `r:nodes` |
| `DELETE`| `/nodes/{id}` | Xóa nút (phải có 0 máy chủ) | `rw:nodes` |
| `GET` | `/nodes/{id}/allocations` | Liệt kê phân bổ cổng trên nút | `r:allocations` |
| `POST` | `/nodes/{id}/allocations` | Chỉ định hàng loạt dãy IP và cổng | `rw:allocations` |
| `DELETE`| `/nodes/{id}/allocations/{alloc}` | Xóa phân bổ không sử dụng | `rw:allocations` |
| `GET` | `/nests` | List game tổ yến (1.x Legacy) | `r:nests` |
| `GET` | `/nests/{nest}/eggs` | Liệt kê trứng trong tổ | `r:nests` |
| `GET` | `/nests/{nest}/eggs/{egg}` | Kiểm tra cấu hình trứng & vars | `r:nests` |
| `GET` | `/users` | Danh sách tài khoản người dùng bảng điều khiển | `r:users` |
| `POST` | `/users` | Tạo tài khoản người dùng bảng điều khiển | `rw:users` |
| `DELETE`| `/users/{id}` | Xóa tài khoản người dùng | `rw:users` |

---

## 3. Giao thức WebSocket Wings thời gian thực

Khi tương tác với bảng điều khiển máy chủ trực tiếp:
1. Khách hàng yêu cầu `GET /api/client/servers/{server}/websocket`.
2. Phản hồi cung cấp JWT xác thực và URI WebSocket của Wings (`wss://node.example.com:8080/api/servers/{uuid}/ws`).
3. Máy khách thiết lập kết nối TLS với URI WebSocket.
4. Khách hàng ngay lập tức xác thực bằng tin nhắn:
   ```json
   {"event": "auth", "args": ["<jwt_token>"]}
   ```
5. Wings daemon truyền phát các gói sự kiện:
   - `console output`: dòng văn bản đầu cuối thô.
   - `stats`: tải trọng JSON thời gian thực chứa phần trăm CPU, byte bộ nhớ, byte ổ đĩa, byte rx/tx mạng và thời gian hoạt động.
   - `status`: trạng thái hoạt động của container (`starting`, `running`, `stopping`, `offline`).
   - `token expiring`: báo hiệu JWT hết hạn trong vòng 3 phút; khách hàng phải yêu cầu mã thông báo mới từ Bảng điều khiển và gửi xác thực lại.
