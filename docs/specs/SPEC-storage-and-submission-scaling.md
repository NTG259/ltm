# Spec: MinIO local và khả năng tiếp nhận bài nộp đồng thời

## Trạng thái và mục tiêu

Đặc tả quyết định kiến trúc; chưa triển khai. Ngày: 2026-10-31.

Lưu bền vững tài liệu bài giảng bằng MinIO local, tự xóa CSV sau import, và giảm ba điểm nghẽn: tiếp nhận bài gắn với điều phối, WebSocket phát rộng, nhiều worker dùng chung một sandbox. Các hạn mức mới bên dưới là mặc định thiết kế đề xuất, cần xác nhận bằng kiểm thử khi triển khai.

## Hiện trạng và phạm vi

- `CourseUnitFileController` lưu PDF trên filesystem qua `UPLOAD_DIR`, giới hạn 20 MB. UI lại quảng bá nhiều định dạng và 50 MB; cần đồng bộ.
- `ClassroomCsvImporter` và `LecturerCsvImporter` đọc CSV UTF-8 theo dòng, giới hạn 1 MB; không chủ động lưu bản gốc lâu dài.
- `JudgeMasterService.submit()` lưu DB, enqueue Redis, broadcast và gọi trực tiếp `dispatchNext()`. Dispatcher giữ khóa `synchronized` trong lúc đọc DB và gửi TCP.
- Compose mặc định có 4 worker dùng chung go-judge parallelism 4. Redis Streams chứa metadata bài nộp, không chứa toàn bộ testcase.
- Phạm vi là tài liệu đính kèm bài giảng, CSV import và luồng nộp bài. Nội dung Markdown vẫn lưu DB. Không tự động mở hỗ trợ DOCX/PPTX/ZIP cho tài liệu.

## Quyết định 1: MinIO local cho tài liệu bài giảng

### Lưu trữ và quyền truy cập

- Thêm MinIO vào cấu hình Compose full-stack và hạ tầng local; dùng named volume lưu dữ liệu qua việc tạo lại container. Volume không thay thế backup; xóa volume sẽ mất dữ liệu.
- Backend truy cập endpoint nội bộ; trình duyệt dùng endpoint có thể truy cập từ máy người dùng. Cấu hình riêng hai endpoint để URL ký không chứa hostname nội bộ Docker.
- Bucket riêng tư; credentials lấy từ môi trường, không đưa vào frontend, Git hoặc log. CORS chỉ cho phép origin frontend được cấu hình.
- Backend dùng abstraction lưu trữ tương thích S3. DB lưu bucket/object key, tên hiển thị, kích thước, loại file, checksum nếu có, unit, người upload và trạng thái; không lưu URL ký có thời hạn.
- Chỉ admin hoặc giảng viên sở hữu khóa học được upload/xóa. Đọc và tải phải kiểm tra quyền xem khóa học/chủ đề, trạng thái công khai và điều kiện mở khóa tương ứng.

### Luồng upload trực tiếp

1. Frontend xin phiên upload sau khi chọn PDF, gửi tên, kích thước và unit.
2. Backend kiểm tra quyền, hạn mức; tạo object key ngẫu nhiên và phiên `PENDING`, trả thông tin upload ký có thời hạn.
3. Trình duyệt gửi file trực tiếp lên MinIO. Ưu tiên presigned POST có policy giới hạn key và kích thước; không dùng URL PUT không ràng buộc dung lượng như cơ chế kiểm soát duy nhất.
4. Frontend gọi hoàn tất. Backend kiểm tra object tồn tại, kích thước thực tế và chữ ký nội dung PDF; chỉ sau đó chuyển sang `READY` và cho phép tải.
5. API tải kiểm tra quyền và cấp URL tải ngắn hạn. Với Bearer auth, frontend phải xin URL bằng request có Authorization rồi mới mở URL.

Mặc định đề xuất: PDF tối đa 100 MiB (104857600 byte), phiên upload 15 phút, URL tải 5 phút. Giới hạn này áp dụng đường upload storage; không nâng toàn bộ multipart backend từ 50 MB lên 100 MB. UI hiển thị đúng PDF/100 MiB và tiến trình upload.

Phiên hoàn tất phải idempotent, ràng buộc người upload và unit. Ngăn object `READY` bị ghi đè bằng URL upload cũ: dùng staging key rồi chuyển sang key chính thức sau xác minh, hoặc khóa phiên bản object được xác minh. Người dùng không được tự chỉ định key tùy ý.

### Dọn dẹp và chuyển dữ liệu cũ

- File chưa hoàn tất hoặc không hợp lệ không xuất hiện trong danh sách tài liệu. Job dọn staging quá 24 giờ; cấu hình dọn multipart upload bỏ dở nếu sử dụng multipart S3.
- Xóa tài liệu chuyển trạng thái `DELETING`, ngừng cấp URL mới và retry xóa object khi storage lỗi. URL đã cấp có thể còn hiệu lực tới khi hết hạn hoặc object bị xóa.
- Di chuyển file filesystem hiện có sang MinIO theo lô, kiểm tra kích thước/checksum, cập nhật metadata; giữ bản cũ cho tới khi xác minh và hoàn thành thời hạn rollback. Không sửa migration đã áp dụng.
- Sửa đồng thời tên trường `filename`/`fileName` và liên kết tải thiếu `/download` trong UI hiện tại.

## Quyết định 2: CSV là dữ liệu tạm, tự xóa sau import

- Giữ upload CSV qua backend với giới hạn 1 MB và đọc từng dòng; không cần đưa CSV lên MinIO. CSV không trở thành tài liệu đính kèm.
- “Tự xóa sau upload” nghĩa là sau khi xử lý thành công hoặc thất bại, không xóa trước khi importer đọc xong. Không tác động tới file gốc trên máy người dùng.
- Đóng stream trong mọi nhánh; bảo đảm multipart temp được dọn cuối request. Nếu tạo file tạm riêng, xóa trong `finally`; bổ sung dọn file tạm quá hạn sau crash, chỉ trong thư mục riêng do ứng dụng quản lý.
- Chỉ giữ dữ liệu nghiệp vụ đã import và báo cáo số dòng thành công/bỏ qua/lỗi; không lưu nguyên CSV hoặc nội dung mật khẩu trong log, báo cáo hay lịch sử upload.
- Không giữ bản CSV trong bucket/version/backup. Nếu sau này chuyển import sang bất đồng bộ, phải có staging riêng, xóa khi job kết thúc và TTL dự phòng.
- Việc xóa CSV không xóa dữ liệu đã nhập. Hiện importer còn lưu `initialPassword`; đây là tồn lưu dữ liệu độc lập cần xử lý trong thay đổi quản lý tài khoản, không được coi là đã giải quyết bằng xóa file.

## Quyết định 3: Tách tiếp nhận bài khỏi điều phối

- API xác thực, kiểm tra bài/contest, giới hạn mã nguồn và lưu submission cùng outbox event trong một transaction PostgreSQL; trả `202 Accepted` với `submissionId` và trạng thái `IN_QUEUE`.
- Không đọc testcase, gửi TCP hoặc broadcast đồng bộ trong đường trả lời submit. Publisher nền chuyển outbox sang Redis Streams và retry có backoff khi Redis lỗi.
- Chỉ đánh dấu outbox đã gửi sau khi enqueue thành công. Có thể gửi trùng khi crash giữa hai bước; dùng event ID và xử lý idempotent, không tuyên bố exactly-once.
- Dispatcher nền giới hạn concurrency, nhận tín hiệu có việc/worker rảnh và quét dự phòng để tránh mất wakeup. Giữ ưu tiên contest > practice > custom.
- Giành quyền xử lý submission và worker bằng cập nhật trạng thái nguyên tử; không giữ khóa toàn cục khi truy vấn testcase hoặc gửi mạng. Có timeout và thu hồi assignment thất bại; tiếp tục dùng attempt token để loại kết quả cũ.
- Chống submit trùng do retry bằng idempotency key gắn với người dùng và hash nội dung yêu cầu. Cùng key/cùng nội dung trả lại submission cũ; cùng key/khác nội dung trả lỗi conflict.
- Có hạn mức kích thước mã nguồn, tần suất và số bài đang chờ theo tài khoản; cấu hình cụ thể qua đo tải. Khi từ chối tải mới trả lỗi rõ ràng, không trả “đã nhận” cho giao dịch chưa commit.

## Quyết định 4: WebSocket theo người nhận và gộp cập nhật

- Sự kiện bài nộp gửi cho người nộp và người giám sát có quyền; backend kiểm tra quyền khi subscribe và khi quyền thay đổi. Không chỉ lọc tại frontend.
- Gộp trạng thái trung gian/dashboard theo cửa sổ 0,5–1 giây. Kết quả cuối gửi ngay; dùng phiên bản sự kiện để tránh cập nhật cũ ghi đè trạng thái cuối.
- Giới hạn bộ đệm từng kết nối. Client chậm được gộp/bỏ sự kiện trung gian hoặc ngắt để kết nối lại, không giữ hàng đợi RAM vô hạn.
- Khi reconnect, frontend lấy snapshot trạng thái từ API. DB là nguồn xác thực; WebSocket hỗ trợ cập nhật nhanh, không phải nơi lưu kết quả duy nhất.

## Quyết định 5: Mở rộng worker và sandbox theo tài nguyên

- Một nhóm worker được gắn với sandbox và ngân sách CPU/RAM xác định. Tăng worker phải đi cùng năng lực sandbox; không mặc định 20 worker trên sandbox parallelism 4 sẽ nhanh hơn.
- Trên một máy: đo rồi chọn số tác vụ đồng thời, giữ tài nguyên cho DB/Redis/backend. Khi cần thêm năng lực: triển khai thêm nhóm worker–sandbox trên máy khác, cùng kết nối master.
- Giữ cách ly mạng và giới hạn chạy mã không tin cậy. Có heartbeat, timeout, retry hữu hạn, theo dõi worker mất kết nối và bài chạy quá lâu.
- Tách khỏi phạm vi MinIO tài liệu: bộ testcase lớn cần cơ chế storage/cache riêng theo phiên bản/checksum. Hiện payload TCP chứa toàn bộ testcase và có giới hạn 10 MB; phải thiết kế tham chiếu bộ test và cache worker trước khi hỗ trợ bộ test vượt giới hạn này.

## Trình tự triển khai và nghiệm thu

1. MinIO + volume + adapter + kiểm thử quyền, upload hoàn tất, tải và xóa; chuyển file cũ có rollback.
2. Đồng bộ UI và hạn mức; kiểm thử CSV thành công, sai định dạng, lỗi DB và request gián đoạn đều không để lại bản gốc sau thời hạn dọn.
3. Outbox và dispatcher; kiểm thử Redis mất kết nối sau DB commit, publisher crash, message trùng, worker chết và client retry. Bài đã được xác nhận phải có thể truy vết tới trạng thái cuối hoặc lỗi rõ ràng.
4. WebSocket có phạm vi và giới hạn bộ đệm; kiểm thử người dùng không nhận sự kiện ngoài quyền, reconnect khôi phục đúng kết quả.
5. Đo tải tăng dần 100 → 500 → 1.000 lượt nộp. Ghi rõ phần cứng, số kết nối, kích thước mã/bộ test, khoảng thời gian gửi và tải nền.

Theo dõi p95/p99 thời gian API nhận bài, lỗi/timeout, tuổi outbox, độ dài và thời gian chờ queue, thời gian chấm, CPU/RAM/GC, DB pool, lưu lượng WebSocket, dung lượng storage và số file tạm tồn đọng. Chưa cam kết SLA hoặc khả năng chấm 1.000 bài đồng thời trước khi đo; tiếp nhận 1.000 bài và chấm xong 1.000 bài là hai tiêu chí riêng.

Kiểm thử storage phải bao gồm PDF 100 MiB hợp lệ, vượt hạn mức, giả MIME, URL hết hạn, complete lặp, upload bỏ dở, MinIO ngừng hoạt động và tạo lại container với volume còn nguyên. Chọn số Flyway migration mới theo trạng thái repository lúc triển khai để tránh trùng với các spec khác.
