# Báo cáo phạm vi bảo hiểm API Pterodactyl

## Tóm tắt bảo hiểm

Mọi điểm cuối được phát hiện trong API Pterodactyl chính thức đều được theo dõi trong sổ đăng ký nội bộ của chúng tôi (`internal/pterodactyl/discovery/registry.go`). Trạng thái của mỗi điểm cuối được phân loại thành:
- **ĐÃ KIỂM TRA**: Đã xác minh thông qua các bài kiểm tra mô phỏng hoặc bài kiểm tra đơn vị tự động.
- **ĐÃ TRIỂN KHAI**: Được mã hóa đầy đủ trong các liên kết giao diện người dùng và SDK máy khách Go.
- **ĐÃ ĐƯỢC TÀI LIỆU**: Được ghi lại từ các tuyến/nguồn API chính thức.
- **ĐÃ KHÁM PHÁ**: Được liệt kê trong sổ đăng ký khám phá.
- **KHÔNG ĐƯỢC HỖ TRỢ**: Cụ thể là không được dùng nữa hoặc bị bỏ qua trong phiên bản bảng điều khiển đích.
- **PERMISSION_REQUIRED**: Yêu cầu quyền rõ ràng của người dùng hoặc vai trò API.

---

## 1. Phạm vi API ứng dụng khách

| Điểm cuối | Phương thức HTTP | Tình trạng thực hiện | Trạng thái kiểm tra |
| :--- | :--- | :--- | :--- |
| `/api/client/account` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/two-factor` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/two-factor` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/two-factor` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/email` | `PUT` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/password` | `PUT` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/api-keys` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/api-keys` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/api-keys/{id}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/ssh-keys` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/ssh-keys` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/ssh-keys/remove` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/account/activity` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/resources` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/power` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/command` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/websocket` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/list` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/contents` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/write` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/create-folder` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/delete` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/rename` | `PUT` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/upload` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/compress` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/files/decompress` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/databases` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/databases` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/databases/{id}/rotate-password` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/databases/{id}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/backups` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/backups` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/backups/{uuid}/download` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/backups/{uuid}/lock` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/backups/{uuid}/restore` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/backups/{uuid}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/users` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/users` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/users/{uuid}` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/users/{uuid}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/network/allocations` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/network/allocations/{id}/primary` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/startup` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/startup/variable` | `PUT` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/settings/rename` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/client/servers/{id}/settings/reinstall` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |

---

## 2. Phạm vi API ứng dụng

| Điểm cuối | Phương thức HTTP | Tình trạng thực hiện | Trạng thái kiểm tra |
| :--- | :--- | :--- | :--- |
| `/api/application/servers` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers/{id}` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers/{id}/build` | `PATCH` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers/{id}/suspend` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers/{id}/unsuspend` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers/{id}/reinstall` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/servers/{id}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes/{id}` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes/{id}/configuration` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes/{id}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes/{id}/allocations` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes/{id}/allocations` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nodes/{id}/allocations/{id}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/nests` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA (chỉ 1.x) |
| `/api/application/nests/{nest}/eggs` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA (chỉ 1.x) |
| `/api/application/nests/{nest}/eggs/{egg}` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA (chỉ 1.x) |
| `/api/application/users` | `GET` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/users` | `POST` | ĐÃ THỰC HIỆN | KIỂM TRA |
| `/api/application/users/{id}` | `DELETE` | ĐÃ THỰC HIỆN | KIỂM TRA |
