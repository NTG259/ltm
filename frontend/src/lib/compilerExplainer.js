/**
 * Trợ lý phân tích & giải thích lỗi biên dịch g++ sang tiếng Việt.
 * Giúp sinh viên nhanh chóng nắm bắt nguyên nhân và cách khắc phục lỗi.
 */

// Danh sách các quy tắc nhận diện lỗi g++ phổ biến
const ERROR_RULES = [
  // 1. Quên thư viện chuẩn iostream / cin / cout
  {
    pattern: /'cin' was not declared in this scope|'cout' was not declared in this scope|'endl' was not declared in this scope/i,
    title: 'Chưa khai báo cin / cout / endl',
    explanation: 'Trình biên dịch không nhận diện được lệnh nhập xuất dữ liệu chuẩn của C++.',
    suggestion: 'Hãy thêm `#include <iostream>` ở đầu tệp và khai báo `using namespace std;` trước hàm `main()`.',
  },
  // 2. Quên thư viện vector
  {
    pattern: /'vector' was not declared in this scope|'vector' does not name a type/i,
    title: 'Chưa khai báo kiểu dữ liệu vector',
    explanation: 'Trình biên dịch không tìm thấy thư viện mảng động `vector`.',
    suggestion: 'Hãy thêm `#include <vector>` và `using namespace std;` ở đầu chương trình.',
  },
  // 3. Quên thư viện algorithm (sort, reverse, max, min)
  {
    pattern: /'sort' was not declared in this scope|'reverse' was not declared in this scope/i,
    title: 'Chưa khai báo hàm thuật toán sort / reverse',
    explanation: 'Các hàm sắp xếp và đảo ngược nằm trong thư viện thuật toán của C++.',
    suggestion: 'Hãy thêm `#include <algorithm>` ở đầu chương trình.',
  },
  // 4. Quên thư viện string
  {
    pattern: /'string' was not declared in this scope|'string' does not name a type/i,
    title: 'Chưa khai báo kiểu xâu string',
    explanation: 'Trình biên dịch không nhận diện được kiểu xâu ký tự `string`.',
    suggestion: 'Hãy thêm `#include <string>` và `using namespace std;` ở đầu tệp.',
  },
  // 5. Quên thư viện cmath (sqrt, abs, pow)
  {
    pattern: /'sqrt' was not declared in this scope|'pow' was not declared in this scope/i,
    title: 'Chưa khai báo hàm toán học (sqrt, pow)',
    explanation: 'Hàm căn bậc hai `sqrt()` hoặc lũy thừa `pow()` nằm trong thư viện toán học.',
    suggestion: 'Hãy thêm `#include <cmath>` ở đầu chương trình.',
  },
  // 6. Quên thư viện cstring (memset, strlen, strcmp)
  {
    pattern: /'memset' was not declared in this scope|'strlen' was not declared in this scope/i,
    title: 'Chưa khai báo hàm xử lý bộ nhớ / chuỗi C (memset)',
    explanation: 'Hàm khởi tạo bộ nhớ `memset()` cần thư viện chuỗi kiểu C.',
    suggestion: 'Hãy thêm `#include <cstring>` ở đầu chương trình.',
  },
  // 7. Thiếu dấu chấm phẩy ';'
  {
    pattern: /expected ';' before '(.*)'|expected ';' at end of member declaration|expected ';' after/i,
    title: 'Thiếu dấu chấm phẩy (;)',
    explanation: 'Một câu lệnh phía trước dòng này bị thiếu dấu chấm phẩy `;` kết thúc.',
    suggestion: 'Hãy kiểm tra cuối dòng được báo lỗi hoặc ngay dòng trước đó và thêm dấu `;`.',
  },
  // 8. Biến hoặc hàm chưa khai báo
  {
    pattern: /'([^']+)' was not declared in this scope/i,
    title: (m) => `Biến hoặc hàm '${m[1]}' chưa được khai báo`,
    explanation: (m) => `Trình biên dịch không tìm thấy tên '${m[1]}' trong phạm vi hiện tại.`,
    suggestion: (m) => `Kiểm tra lại xem bạn đã khai báo biến '${m[1]}' (ví dụ: int ${m[1]};) chưa, hoặc có bị gõ sai chính tả hoa/thường không.`,
  },
  // 9. Toán tử nhập xuất sai chiều (cin << hoặc cout >>)
  {
    pattern: /no match for 'operator<<'.*basic_istream|no match for 'operator>>'.*basic_ostream/i,
    title: 'Viết ngược chiều mũi tên nhập / xuất',
    explanation: 'Toán tử nhập/xuất bị dùng sai chiều (`cin <<` hoặc `cout >>`).',
    suggestion: 'Nhớ quy tắc: `cin >> biến` (mũi tên hướng vào biến) và `cout << giá trị` (mũi tên hướng ra màn hình).',
  },
  // 10. Thiếu dấu ngoặc nhọn đóng '}' hoặc mở '{'
  {
    pattern: /expected '\}' at end of input|expected '\}' before/i,
    title: 'Thiếu dấu đóng ngoặc nhọn (})',
    explanation: 'Số lượng dấu mở ngoặc `{` và đóng ngoặc `}` trong mã nguồn chưa bằng nhau.',
    suggestion: 'Kiểm tra lại các khối lệnh của hàm main(), vòng lặp for/while hoặc if/else để đóng đủ các dấu `}`.',
  },
  // 11. Thiếu dấu ngoặc đơn ')'
  {
    pattern: /expected '\)' before/i,
    title: 'Thiếu dấu đóng ngoặc đơn ())',
    explanation: 'Một biểu thức điều kiện hoặc lời gọi hàm bị thiếu dấu đóng ngoặc đơn `)`.',
    suggestion: 'Kiểm tra lại biểu thức điều kiện trong `if (...)`, `for (...)` hoặc danh sách tham số hàm.',
  },
  // 12. Hàm main không trả về int hoặc sai định dạng
  {
    pattern: /'::main' must return 'int'|undefined reference to `main'|undefined reference to 'main'/i,
    title: 'Hàm main() sai định dạng hoặc thiếu',
    explanation: 'Chương trình C++ bắt buộc phải có hàm `int main()` làm điểm chạy đầu tiên.',
    suggestion: 'Đảm bảo cấu trúc chuẩn: `int main() { ... return 0; }` (không dùng `void main()`).',
  },
  // 13. Khai báo trùng lặp (redefinition / redeclaration)
  {
    pattern: /redefinition of '([^']+)'|redeclaration of '([^']+)'/i,
    title: (m) => `Khai báo trùng lặp '${m[1]}'`,
    explanation: (m) => `Tên biến hoặc hàm '${m[1]}' đã được định nghĩa ở một dòng trước đó trong cùng phạm vi.`,
    suggestion: (m) => `Đổi tên biến '${m[1]}' sang một tên khác, hoặc bỏ từ khóa kiểu dữ liệu nếu chỉ muốn gán lại giá trị.`,
  },
  // 14. Nhầm phép gán '=' với so sánh '=='
  {
    pattern: /lvalue required as left operand of assignment/i,
    title: 'Phép gán không hợp lệ (nhầm = với ==)',
    explanation: 'Vế trái của phép gán `=` phải là một biến có thể ghi giá trị.',
    suggestion: 'Nếu bạn đang viết điều kiện so sánh trong câu lệnh `if`, hãy đổi `=` thành `==` (ví dụ: `if (a == b)`).',
  },
  // 15. Dùng dấu chấm '.' trên biến thường
  {
    pattern: /request for member '([^']+)' in '.*', which is of non-class type/i,
    title: (m) => `Dùng dấu chấm '.' trên biến không phải struct/class ('${m[1]}')`,
    explanation: (m) => `Chỉ có cấu trúc dữ liệu (struct, class, vector, string) mới có thuộc tính hoặc phương thức con '${m[1]}'.`,
    suggestion: 'Kiểm tra lại xem biến phía trước dấu `.` có phải là số nguyên (int, long) thông thường hay không.',
  },
  // 16. Chuyển đổi kiểu không hợp lệ
  {
    pattern: /cannot convert '([^']+)' to '([^']+)'/i,
    title: (m) => `Không thể chuyển đổi từ kiểu '${m[1]}' sang '${m[2]}'`,
    explanation: 'Hai kiểu dữ liệu không tương thích với nhau khi thực hiện phép gán hoặc truyền tham số.',
    suggestion: 'Kiểm tra lại kiểu dữ liệu giữa biến nhận và giá trị được gán.',
  },
  // 17. Tràn chỉ số mảng hoặc khởi tạo sai kích thước
  {
    pattern: /size of array '([^']+)' is not an integral constant-expression/i,
    title: (m) => `Kích thước mảng '${m[1]}' không hợp lệ`,
    explanation: 'Kích thước mảng tĩnh trong C++ chuẩn cần là hằng số hoặc khai báo sau khi đã nhập N.',
    suggestion: 'Nếu mảng có kích thước N thay đổi, hãy dùng `vector<int> a(n);` hoặc cấp phát động.',
  },
]

/**
 * Phân tích log g++ và trích xuất từng dòng lỗi kèm giải thích tiếng Việt.
 */
export function explainCompileLog(log) {
  if (!log || typeof log !== 'string' || !log.trim()) {
    return {
      hasExplanation: false,
      errors: [],
      rawLog: log || '',
    }
  }

  const lines = log.split('\n')
  const errors = []
  const seenMessages = new Set()

  // Regex bắt dòng lỗi chuẩn của g++:
  // Ví dụ: solution.cpp:12:5: error: expected ';' before 'return'
  const errorHeaderRegex = /^(?:solution\.cpp|main\.cpp|source\.cpp|[^:]+):(\d+):(?:(\d+):)?\s*(error|warning):\s*(.*)$/i

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const match = line.match(errorHeaderRegex)

    if (match) {
      const lineNum = parseInt(match[1], 10)
      const colNum = match[2] ? parseInt(match[2], 10) : null
      const severity = match[3].toLowerCase()
      const rawMessage = match[4].trim()

      // Tránh trùng lặp các lỗi giống hệt nhau
      const key = `${lineNum}:${rawMessage}`
      if (seenMessages.has(key)) continue
      seenMessages.add(key)

      // Đối chiếu với bộ quy tắc tiếng Việt
      let matchedRule = null
      let ruleMatch = null

      for (const rule of ERROR_RULES) {
        const m = rawMessage.match(rule.pattern)
        if (m) {
          matchedRule = rule
          ruleMatch = m
          break
        }
      }

      if (matchedRule) {
        errors.push({
          line: lineNum,
          column: colNum,
          severity,
          rawMessage,
          titleVi: typeof matchedRule.title === 'function' ? matchedRule.title(ruleMatch) : matchedRule.title,
          explanationVi: typeof matchedRule.explanation === 'function' ? matchedRule.explanation(ruleMatch) : matchedRule.explanation,
          suggestionVi: typeof matchedRule.suggestion === 'function' ? matchedRule.suggestion(ruleMatch) : matchedRule.suggestion,
        })
      } else {
        // Fallback cho lỗi chưa có trong rule: dịch nhanh các thuật ngữ g++
        errors.push({
          line: lineNum,
          column: colNum,
          severity,
          rawMessage,
          titleVi: `Lỗi biên dịch tại dòng ${lineNum}`,
          explanationVi: `Trình biên dịch g++ báo: "${rawMessage}"`,
          suggestionVi: 'Hãy kiểm tra lại cú pháp ở vị trí dòng trên và các dòng liền trước.',
        })
      }
    }
  }

  return {
    hasExplanation: errors.length > 0,
    errors,
    rawLog: log,
  }
}
