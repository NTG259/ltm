// Dữ liệu mẫu khớp với src/seed_problems.py trong README gốc (§13.2): 10 bài thuật toán.

export const PROBLEMS = [
  {
    id: 1,
    title: 'A + B Problem',
    difficulty: 'easy',
    tags: ['I/O cơ bản'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement:
      'Cho hai số nguyên `a` và `b`. Hãy tính và in ra tổng `a + b`.\n\nĐây là bài khởi động giúp thí sinh làm quen với cách đọc dữ liệu từ `stdin` và ghi kết quả ra `stdout`.',
    inputSpec: 'Một dòng duy nhất chứa hai số nguyên `a`, `b` (|a|, |b| ≤ 10^9).',
    outputSpec: 'In ra một số nguyên duy nhất là `a + b`.',
    samples: [
      { input: '3 5', output: '8' },
      { input: '-7 10', output: '3' },
    ],
    tests: [
      { input: '3 5', output: '8' },
      { input: '-7 10', output: '3' },
      { input: '1000000000 1000000000', output: '2000000000' },
      { input: '0 0', output: '0' },
    ],
  },
  {
    id: 2,
    title: 'Dãy số Fibonacci Modulo 10^9+7',
    difficulty: 'easy',
    tags: ['Số học', 'Quy hoạch động'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement:
      'Dãy Fibonacci được định nghĩa: `F(0) = 0`, `F(1) = 1`, `F(n) = F(n-1) + F(n-2)` với `n ≥ 2`.\n\nCho số nguyên `n`, hãy tính `F(n) mod (10^9 + 7)`.',
    inputSpec: 'Một số nguyên `n` (0 ≤ n ≤ 10^6).',
    outputSpec: 'In ra `F(n) mod (10^9 + 7)`.',
    samples: [
      { input: '10', output: '55' },
      { input: '1', output: '1' },
    ],
    tests: [
      { input: '10', output: '55' },
      { input: '1', output: '1' },
      { input: '50', output: '586268941' },
      { input: '1000000', output: '918091266' },
    ],
  },
  {
    id: 3,
    title: 'Kiểm tra số nguyên tố',
    difficulty: 'easy',
    tags: ['Lý thuyết số'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement:
      'Cho số nguyên dương `n`. Hãy kiểm tra `n` có phải là số nguyên tố hay không.\n\nLưu ý `n` có thể lớn tới `10^12`, cần thuật toán duyệt đến `√n`.',
    inputSpec: 'Một số nguyên `n` (1 ≤ n ≤ 10^12).',
    outputSpec: 'In `YES` nếu `n` là số nguyên tố, ngược lại in `NO`.',
    samples: [
      { input: '17', output: 'YES' },
      { input: '1', output: 'NO' },
    ],
    tests: [
      { input: '17', output: 'YES' },
      { input: '1', output: 'NO' },
      { input: '999999999989', output: 'YES' },
      { input: '1000000000000', output: 'NO' },
      { input: '2', output: 'YES' },
    ],
  },
  {
    id: 4,
    title: 'Tìm Min/Max & Đảo ngược mảng',
    difficulty: 'easy',
    tags: ['Mảng'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement: 'Cho mảng gồm `n` số nguyên. Hãy in ra giá trị nhỏ nhất, giá trị lớn nhất và mảng sau khi đảo ngược.',
    inputSpec: 'Dòng 1: số nguyên `n` (1 ≤ n ≤ 10^5).\nDòng 2: `n` số nguyên `a_i` (|a_i| ≤ 10^9).',
    outputSpec: 'Dòng 1: `min max`.\nDòng 2: mảng đảo ngược.',
    samples: [{ input: '5\n3 1 4 1 5', output: '1 5\n5 1 4 1 3' }],
    tests: [
      { input: '5\n3 1 4 1 5', output: '1 5\n5 1 4 1 3' },
      { input: '1\n42', output: '42 42\n42' },
      { input: '4\n-1 -2 -3 -4', output: '-4 -1\n-4 -3 -2 -1' },
    ],
  },
  {
    id: 5,
    title: 'Chuỗi đối xứng Palindrome',
    difficulty: 'easy',
    tags: ['Xâu'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement: 'Cho xâu `s` chỉ gồm chữ cái thường. Kiểm tra `s` có phải xâu đối xứng (palindrome) hay không.',
    inputSpec: 'Một xâu `s` (1 ≤ |s| ≤ 10^6).',
    outputSpec: 'In `YES` hoặc `NO`.',
    samples: [
      { input: 'abcba', output: 'YES' },
      { input: 'abca', output: 'NO' },
    ],
    tests: [
      { input: 'abcba', output: 'YES' },
      { input: 'abca', output: 'NO' },
      { input: 'a', output: 'YES' },
      { input: 'abccba', output: 'YES' },
    ],
  },
  {
    id: 6,
    title: 'Sắp xếp dãy số',
    difficulty: 'easy',
    tags: ['Sắp xếp'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement: 'Cho dãy `n` số nguyên, hãy sắp xếp dãy theo thứ tự không giảm. Yêu cầu độ phức tạp `O(N log N)`.',
    inputSpec: 'Dòng 1: `n` (1 ≤ n ≤ 2·10^5).\nDòng 2: `n` số nguyên.',
    outputSpec: 'Dãy sau khi sắp xếp, các số cách nhau một dấu cách.',
    samples: [{ input: '5\n5 2 9 1 3', output: '1 2 3 5 9' }],
    tests: [
      { input: '5\n5 2 9 1 3', output: '1 2 3 5 9' },
      { input: '3\n1 1 1', output: '1 1 1' },
      { input: '4\n10 -5 0 7', output: '-5 0 7 10' },
    ],
  },
  {
    id: 7,
    title: 'Tìm kiếm nhị phân',
    difficulty: 'medium',
    tags: ['Tìm kiếm nhị phân'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement:
      'Cho dãy `n` số nguyên đã sắp xếp tăng dần và `q` truy vấn. Mỗi truy vấn gồm số `x`, hãy in ra vị trí (đánh số từ 1) của `x` trong dãy, hoặc `-1` nếu không tồn tại. Yêu cầu `O(Q log N)`.',
    inputSpec: 'Dòng 1: `n q` (1 ≤ n, q ≤ 2·10^5).\nDòng 2: dãy `a`.\n`q` dòng tiếp theo: mỗi dòng một số `x`.',
    outputSpec: 'In `q` dòng, mỗi dòng là kết quả truy vấn.',
    samples: [{ input: '5 3\n1 3 5 7 9\n7\n2\n1', output: '4\n-1\n1' }],
    tests: [
      { input: '5 3\n1 3 5 7 9\n7\n2\n1', output: '4\n-1\n1' },
      { input: '1 1\n5\n5', output: '1' },
      { input: '3 2\n2 4 6\n6\n7', output: '3\n-1' },
    ],
  },
  {
    id: 8,
    title: 'Dãy con tăng dài nhất LIS',
    difficulty: 'medium',
    tags: ['Quy hoạch động', 'Tìm kiếm nhị phân'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement: 'Cho dãy `n` số nguyên. Tìm độ dài dãy con tăng nghiêm ngặt dài nhất (không cần liên tiếp).',
    inputSpec: 'Dòng 1: `n` (1 ≤ n ≤ 2·10^5).\nDòng 2: dãy `a`.',
    outputSpec: 'Độ dài LIS.',
    samples: [{ input: '8\n10 9 2 5 3 7 101 18', output: '4' }],
    tests: [
      { input: '8\n10 9 2 5 3 7 101 18', output: '4' },
      { input: '5\n5 4 3 2 1', output: '1' },
      { input: '6\n1 2 3 4 5 6', output: '6' },
    ],
  },
  {
    id: 9,
    title: 'Bài toán cái túi 0/1 Knapsack',
    difficulty: 'medium',
    tags: ['Quy hoạch động'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement:
      'Có `n` đồ vật, đồ vật thứ `i` có khối lượng `w_i` và giá trị `v_i`. Chọn một tập đồ vật có tổng khối lượng không vượt quá `W` sao cho tổng giá trị lớn nhất.',
    inputSpec: 'Dòng 1: `n W` (1 ≤ n ≤ 100, 1 ≤ W ≤ 10^5).\n`n` dòng tiếp: `w_i v_i`.',
    outputSpec: 'Tổng giá trị lớn nhất.',
    samples: [{ input: '3 8\n3 30\n4 50\n5 60', output: '90' }],
    tests: [
      { input: '3 8\n3 30\n4 50\n5 60', output: '90' },
      { input: '1 1\n2 100', output: '0' },
      { input: '4 10\n5 10\n4 40\n6 30\n3 50', output: '90' },
    ],
  },
  {
    id: 10,
    title: 'Cộng 2 số nguyên lớn BigInt',
    difficulty: 'hard',
    tags: ['Xâu', 'Số lớn'],
    timeLimitMs: 1000,
    memoryLimitMb: 256,
    statement:
      'Cho hai số nguyên không âm `a` và `b` có thể dài tới `10^5` chữ số. Hãy tính `a + b`.\n\nKhông thể dùng kiểu `long long`, cần cài đặt phép cộng trên xâu.',
    inputSpec: 'Hai dòng, mỗi dòng một số nguyên không âm (không có số 0 thừa ở đầu).',
    outputSpec: 'Tổng `a + b`.',
    samples: [{ input: '99999999999999999999\n1', output: '100000000000000000000' }],
    tests: [
      { input: '99999999999999999999\n1', output: '100000000000000000000' },
      { input: '0\n0', output: '0' },
      { input: '123456789123456789\n987654321987654321', output: '1111111111111111110' },
    ],
  },
]

export const STUDENTS = [
  { id: 'B20DCCN001', name: 'Nguyễn Văn An' },
  { id: 'B20DCCN014', name: 'Trần Thị Bình' },
  { id: 'B20DCCN027', name: 'Lê Hoàng Cường' },
  { id: 'B20DCCN033', name: 'Phạm Minh Dũng' },
  { id: 'B20DCCN048', name: 'Hoàng Thu Hà' },
  { id: 'B20DCCN052', name: 'Vũ Quốc Huy' },
  { id: 'B20DCCN069', name: 'Đỗ Khánh Linh' },
  { id: 'B20DCCN075', name: 'Bùi Đức Mạnh' },
]

export const STARTER_CODE = `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    // TODO: Viết lời giải thuật toán tại đây

    return 0;
}
`

// Bộ mã nguồn mẫu tương ứng thư mục samples/ (README §8) để demo nhanh 7 nhãn.
export const SAMPLE_SOURCES = {
  'ac.cpp': `#include <bits/stdc++.h>
using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(nullptr);

    long long a, b;
    cin >> a >> b;
    cout << a + b << "\\n";
    return 0;
}
`,
  'wa.cpp': `#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    cout << a - b << endl; // WRONG_ANSWER: dùng sai phép trừ
    return 0;
}
`,
  'tle.cpp': `#include <iostream>
using namespace std;

int main() {
    long long a, b;
    cin >> a >> b;
    while (true) { }   // lặp vô tận
    cout << a + b;
}
`,
  'mle.cpp': `#include <vector>
#include <iostream>
using namespace std;

int main() {
    vector<long long> v(400000000LL, 1); // ~3.2 GB > 256 MB
    cout << v[0];
}
`,
  'ce.cpp': `#include <iostream>
using namespace std;

int main() {
    int a, b
    cin >> a >> b;
    cout << a + b;
}
`,
  'rte.cpp': `#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    int zero = 0;
    cout << a / zero;   // chia cho 0
}
`,
  'sec.cpp': `#include <windows.h>
#include <iostream>

int main() {
    system("shutdown /s /t 0");
    return 0;
}
`,
}
