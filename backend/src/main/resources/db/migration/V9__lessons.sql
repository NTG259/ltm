-- ============================================================
-- V9: Quản lý bài giảng chi tiết (Lessons) cho từng Unit
-- ============================================================

CREATE TABLE IF NOT EXISTS course_lessons (
    id             BIGSERIAL PRIMARY KEY,
    unit_id        BIGINT       NOT NULL UNIQUE REFERENCES course_units(id) ON DELETE CASCADE,
    theory_content TEXT         NOT NULL,
    sample_code    TEXT,
    sample_input   TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_course_lessons_unit ON course_lessons(unit_id);

-- Seed dữ liệu bài giảng thực tế cho các Unit của Khóa 1 (C++ Cơ bản)
-- Unit 1: Cấu trúc chương trình C++ và Nhập xuất
INSERT INTO course_lessons (unit_id, theory_content, sample_code, sample_input, created_at, updated_at)
SELECT u.id,
'### 1. Cấu trúc cơ bản của một chương trình C++
Mọi chương trình C++ đều bắt đầu thực thi từ hàm `main()`. Khối lệnh được bao bọc trong cặp ngoặc nhọn `{}`.

### 2. Luồng nhập xuất iostream
Thư viện `<iostream>` cung cấp các đối tượng chuẩn:
- `std::cout`: Dòng xuất chuẩn (Output), kết hợp với toán tử `<<`.
- `std::cin`: Dòng nhập chuẩn (Input), kết hợp với toán tử `>>`.
- `std::endl`: Xuất ký tự xuống dòng và xóa bộ đệm (flush buffer).

> [!TIP]
> Trong thi đấu lập trình (Competitive Programming), hãy thêm `ios_base::sync_with_stdio(false); cin.tie(NULL);` ở đầu hàm `main()` để tăng tốc độ I/O lên gấp 5-10 lần.',
'#include <iostream>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    long long a, b;
    if (cin >> a >> b) {
        cout << "Tong 2 so la: " << (a + b) << "\n";
    }
    return 0;
}',
'15 35',
NOW(), NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 1
ON CONFLICT (unit_id) DO NOTHING;

-- Unit 2: Biến và kiểu dữ liệu
INSERT INTO course_lessons (unit_id, theory_content, sample_code, sample_input, created_at, updated_at)
SELECT u.id,
'### 1. Kiểu dữ liệu nguyên thủy trong C++
- `int`: Số nguyên 32-bit (khoảng từ -2x10^9 đến 2x10^9).
- `long long`: Số nguyên 64-bit (khoảng từ -9x10^18 đến 9x10^18). Dùng khi giá trị vượt quá giới hạn của `int`.
- `double`, `float`: Số thực dấu phẩy động. Khuyến khích dùng `double` để đảm bảo độ chính xác cao hơn.
- `char`: Ký tự đơn (kích thước 1 byte, mã ASCII).
- `bool`: Giá trị logic (`true` hoặc `false`).

### 2. Ép kiểu (Type Casting)
- Ép kiểu ngầm định (Implicit): Tự động mở rộng từ kiểu nhỏ sang kiểu lớn.
- Ép kiểu tường minh (Explicit): `static_cast<double>(a) / b`.',
'#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    int a = 7;
    int b = 2;

    // Ep kieu tuong minh de tinh ket qua so thuc chinh xac
    double thuong = static_cast<double>(a) / b;

    cout << "Phep chia nguyen: " << (a / b) << "\n";
    cout << "Phep chia thuc: " << fixed << setprecision(2) << thuong << "\n";
    return 0;
}',
'',
NOW(), NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 2
ON CONFLICT (unit_id) DO NOTHING;

-- Unit 3: Các phép toán
INSERT INTO course_lessons (unit_id, theory_content, sample_code, sample_input, created_at, updated_at)
SELECT u.id,
'### 1. Các nhóm toán tử trong C++
- **Toán tử số học**: `+`, `-`, `*`, `/`, `%` (chia lấy phần dư, chỉ dùng cho số nguyên).
- **Toán tử so sánh**: `==`, `!=`, `<`, `>`, `<=`, `>=`.
- **Toán tử logic**: `&&` (AND), `||` (OR), `!` (NOT).
- **Toán tử Bitwise**: `&`, `|`, `^` (XOR), `~`, `<<` (dịch trái), `>>` (dịch phải).

> [!NOTE]
> Phép chia số nguyên trong C++ sẽ tự động cắt phần thập phân (vd: `5 / 2 = 2`). Hãy cẩn thận khi tính giá trị trung bình!',
'#include <iostream>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        // Kiem tra chan le bang phep bitwise AND
        if (n & 1) {
            cout << n << " la so LE (Bit cuoi cung = 1)\n";
        } else {
            cout << n << " la so CHAN (Bit cuoi cung = 0)\n";
        }
    }
    return 0;
}',
'42',
NOW(), NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 3
ON CONFLICT (unit_id) DO NOTHING;

-- Unit 4: Cấu trúc rẽ nhánh if - else và switch - case
INSERT INTO course_lessons (unit_id, theory_content, sample_code, sample_input, created_at, updated_at)
SELECT u.id,
'### 1. Cấu trúc rẽ nhánh if - else
Cho phép phân luồng thực thi dựa trên điều kiện logic.
```cpp
if (condition) {
    // Thuc thi khi dieu kien dung
} else if (another_condition) {
    // Dieu kien phu
} else {
    // Mac dinh
}
```

### 2. Cấu trúc switch - case
Áp dụng tối ưu khi so sánh một biến kiểu số nguyên hoặc ký tự với nhiều hằng số rời rạc. Nhớ sử dụng lệnh `break` ở cuối mỗi case để tránh hiệu ứng trôi lệnh (fall-through).',
'#include <iostream>
using namespace std;

int main() {
    int score;
    if (cin >> score) {
        if (score >= 90) {
            cout << "Xep loai: Xuat sac (A+)\n";
        } else if (score >= 80) {
            cout << "Xep loai: Gioi (A)\n";
        } else if (score >= 65) {
            cout << "Xep loai: Kha (B)\n";
        } else if (score >= 50) {
            cout << "Xep loai: Trung binh (C)\n";
        } else {
            cout << "Xep loai: Yeu (D/F)\n";
        }
    }
    return 0;
}',
'85',
NOW(), NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 4
ON CONFLICT (unit_id) DO NOTHING;

-- Unit 5: Vòng lặp
INSERT INTO course_lessons (unit_id, theory_content, sample_code, sample_input, created_at, updated_at)
SELECT u.id,
'### 1. Các loại vòng lặp trong C++
- `for`: Sử dụng khi đã biết trước số bước lặp (vd: duyệt mảng $0 \dots N-1$).
- `while`: Lặp chừng nào điều kiện còn thỏa mãn (kiểm tra điều kiện trước).
- `do-while`: Thực thi thân vòng lặp ít nhất 1 lần trước khi kiểm tra điều kiện.

### 2. Lệnh điều khiển luồng
- `break`: Dừng và thoát ngay lập tức khỏi vòng lặp gần nhất.
- `continue`: Bỏ qua các dòng lệnh còn lại trong vòng lặp hiện tại để nhảy thẳng tới bước lặp kế tiếp.',
'#include <iostream>
using namespace std;

int main() {
    int n;
    if (cin >> n) {
        long long sum = 0;
        for (int i = 1; i <= n; i++) {
            sum += i;
        }
        cout << "Tong cac so tu 1 den " << n << " la: " << sum << "\n";
    }
    return 0;
}',
'100',
NOW(), NOW()
FROM course_units u
WHERE u.course_id = 1 AND u.order_index = 5
ON CONFLICT (unit_id) DO NOTHING;
