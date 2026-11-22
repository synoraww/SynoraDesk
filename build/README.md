# Xây dựng thư mục

Thư mục bản dựng được sử dụng để chứa tất cả các tệp bản dựng và nội dung cho ứng dụng của bạn.

Cấu trúc là:

* bin - Thư mục đầu ra
* darwin - tập tin cụ thể của macOS
* windows - Các tập tin cụ thể của Windows

## macOS

Thư mục `darwin` chứa các tệp dành riêng cho bản dựng Mac.
Chúng có thể được tùy chỉnh và sử dụng như một phần của bản dựng. Để đưa các tệp này về trạng thái mặc định, chỉ cần xóa chúng
xong
xây dựng với `wails build`.

Thư mục chứa các tập tin sau:

- `Info.plist` - tệp plist chính được sử dụng cho các bản dựng Mac. Nó được sử dụng khi xây dựng bằng `wails build`.
- `Info.dev.plist` - giống như tệp plist chính nhưng được sử dụng khi xây dựng bằng `wails dev`.

## Windows

Thư mục `windows` chứa tệp kê khai và tệp rc được sử dụng khi xây dựng với `wails build`.
Đây có thể được tùy chỉnh cho ứng dụng của bạn. Để đưa các tệp này về trạng thái mặc định, chỉ cần xóa chúng và
xây dựng với `wails build`.

- `icon.ico` - Biểu tượng được sử dụng cho ứng dụng. Điều này được sử dụng khi xây dựng bằng `wails build`. Nếu bạn muốn
  sử dụng một biểu tượng khác, chỉ cần thay thế tệp này bằng tệp của riêng bạn. Nếu nó bị thiếu, một tệp `icon.ico` mới
  sẽ được tạo bằng tệp `appicon.png` trong thư mục bản dựng.
- `installer/*` - Các tệp được sử dụng để tạo trình cài đặt Windows. Chúng được sử dụng khi xây dựng bằng `wails build`.
- `info.json` - Chi tiết ứng dụng được sử dụng cho các bản dựng Windows. Dữ liệu ở đây sẽ được trình cài đặt Windows sử dụng,
  cũng như chính ứng dụng (nhấp chuột phải vào exe -> thuộc tính -> chi tiết)
- `wails.exe.manifest` - Tệp kê khai ứng dụng chính.