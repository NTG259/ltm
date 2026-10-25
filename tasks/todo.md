# Công việc: Đăng ký tài khoản sinh viên

> **Phạm vi đã đổi:** thay đăng ký tự phục vụ bằng import CSV `mssv,password` do giảng viên thực hiện khi tạo lớp. Sinh viên chỉ đăng nhập bằng hai trường này.

## Pha 1 — Hợp đồng và nền tảng

- [ ] **1. Chốt chính sách đăng ký và chuyển đổi tài khoản cũ**
  - Quyết định self-service hay chỉ roster; cách kích hoạt tài khoản đã import; chính sách mật khẩu.
  - Tiêu chí: các quyết định trong phần “Điểm cần chốt” của `tasks/plan.md` được phê duyệt.
  - Phụ thuộc: Không.

- [ ] **2. Thêm migration và mô hình trạng thái tài khoản**
  - Lưu password hash sinh viên và trạng thái kích hoạt/chuyển đổi theo chính sách đã chốt; cập nhật dữ liệu demo an toàn.
  - Tiêu chí: Flyway chạy được trên DB mới và dữ liệu cũ; không làm suy yếu ràng buộc admin.
  - Xác minh: `cd backend; .\mvnw test`.
  - Phụ thuộc: 1.

- [ ] **3. Định nghĩa contract API và bộ request kiểm thử**
  - Ghi request/response/error cho `POST /api/auth/register` và login sinh viên; thêm collection hoặc OpenAPI cục bộ.
  - Tiêu chí: contract gồm ví dụ 201, 400, 401, 409 và 429; payload không chứa bí mật trong fixture đã commit.
  - Phụ thuộc: 1.

### Checkpoint 1

- [ ] Migration, contract và chiến lược chuyển đổi được review trước khi đổi hành vi login.

## Pha 2 — Luồng backend an toàn

- [ ] **4. Cài đặt service đăng ký và login sinh viên bằng mật khẩu**
  - Validate/normalize MSSV, validate mật khẩu, bcrypt hash, tạo session và trả lỗi trung tính khi login thất bại.
  - Tiêu chí: đăng ký không được ghi đè tài khoản hiện có; login không còn tự tạo/cập nhật người dùng.
  - Xác minh: test service/controller tập trung và `cd backend; .\mvnw test`.
  - Phụ thuộc: 2, 3.

- [ ] **5. Thêm phòng vệ abuse và xử lý lỗi HTTP nhất quán**
  - Rate-limit cho register/login, `409` cho đăng ký trùng, không log request password.
  - Tiêu chí: vượt ngưỡng nhận `429`; response lỗi không làm lộ thông tin tài khoản.
  - Xác minh: test controller và collection assertions.
  - Phụ thuộc: 4.

### Checkpoint 2

- [ ] Chạy collection trên backend thật hoặc test environment; xác nhận response và hành vi bảo mật của các trường hợp lỗi.

## Pha 3 — Frontend và trải nghiệm

- [ ] **6. Cập nhật API client thật và mock cho contract mới**
  - Thêm `register`, đổi `login` sinh viên sang password và đồng bộ mock engine.
  - Tiêu chí: cả hai chế độ trả cùng session shape và báo cùng loại lỗi người dùng.
  - Xác minh: unit test nếu hạ tầng có sẵn, `cd frontend; npm.cmd run lint` và `npm.cmd run build`.
  - Phụ thuộc: 3, 4.

- [ ] **7. Thêm màn hình đăng ký và cập nhật màn hình đăng nhập**
  - Chuyển giữa Đăng nhập/Đăng ký, validation phía client, password confirmation, trạng thái đang gửi và liên kết dễ hiểu.
  - Tiêu chí: chỉ sinh viên thấy đăng ký; đăng ký thành công đăng nhập ngay; lỗi gắn với trường hoặc thông báo rõ ràng, không dùng icon thay nội dung.
  - Xác minh: lint/build, kiểm tra bàn phím và các viewport 320/768/1024/1440px.
  - Phụ thuộc: 6.

- [ ] **8. Kiểm thử end-to-end và cập nhật tài liệu vận hành**
  - Kiểm tra đăng ký, đăng xuất, đăng nhập lại, trùng MSSV, sai mật khẩu, tài khoản cũ/chưa kích hoạt và rate limit.
  - Tiêu chí: console không lỗi; contract/API test và backend/frontend build đạt; tài liệu demo credential không khuyến khích tài khoản mặc định không an toàn.
  - Phụ thuộc: 5, 7.

### Checkpoint hoàn tất

- [ ] Luồng đăng ký và đăng nhập được chủ sở hữu review, có kế hoạch rollback migration/feature flag và sẵn sàng phát hành.
