-- Additive, repeatable LMS sample lessons. Run after Flyway migrations.
-- Existing lesson content and learner progress are preserved.
BEGIN;

WITH lesson(course_id, order_index, theory_content, sample_code, sample_input) AS (
  VALUES
  (1, 6, $lms$### Hàm và tham số
Hàm giúp tách chương trình thành các phần dễ tái sử dụng. Truyền tham trị tạo bản sao; truyền tham chiếu (`&`) cho phép cập nhật biến gốc.

**Thử:** đổi tham chiếu sang tham trị và quan sát kết quả.$lms$, $lms$#include <iostream>
using namespace std;
void swapValues(int &a, int &b) { int t=a; a=b; b=t; }
int main() { int a,b; cin>>a>>b; swapValues(a,b); cout<<a<<' '<<b<<'\n'; }$lms$, $lms$3 8$lms$),
  (1, 7, $lms$### Mảng và chuỗi
Mảng lưu nhiều giá trị cùng kiểu; chỉ số bắt đầu từ 0. `std::string` có thể truy cập ký tự và lấy độ dài bằng `size()`.

**Lưu ý:** chỉ duyệt từ 0 đến `n-1`; dùng `getline` nếu chuỗi có dấu cách.$lms$, $lms$#include <bits/stdc++.h>
using namespace std;
int main() { int n; cin>>n; vector<int>a(n); for(int &x:a)cin>>x; cout<<*max_element(a.begin(),a.end())<<'\n'; }$lms$, $lms$4 2 9 -1 5$lms$),
  (2, 1, $lms$### `vector` và `pair`
`vector` là mảng động, còn `pair` gom hai giá trị. `sort` sắp cặp theo phần tử thứ nhất, rồi phần tử thứ hai.

**Thực hành:** đọc các cặp tọa độ, sắp xếp và in từng cặp.$lms$, $lms$#include <bits/stdc++.h>
using namespace std;
int main(){int n;cin>>n;vector<pair<int,int>>a(n);for(auto &[x,y]:a)cin>>x>>y;sort(a.begin(),a.end());for(auto [x,y]:a)cout<<x<<' '<<y<<'\n';}$lms$, $lms$3 2 5 1 9 2 1$lms$),
  (2, 2, $lms$### Stack, Queue và Priority Queue
Stack xử lý vào sau ra trước; queue xử lý vào trước ra trước. `priority_queue` trả về phần tử ưu tiên cao nhất.

**Ứng dụng:** stack kiểm tra dấu ngoặc; queue duyệt theo chiều rộng.$lms$, $lms$#include <bits/stdc++.h>
using namespace std;
int main(){int n,x;cin>>n;stack<int>s;while(n--){cin>>x;s.push(x);}while(!s.empty()){cout<<s.top()<<' ';s.pop();}}$lms$, $lms$4 1 2 3 4$lms$),
  (2, 3, $lms$### Set và Map
`set` lưu khóa không trùng. `map` ánh xạ khóa đến giá trị và duyệt theo thứ tự khóa; `unordered_map` dùng bảng băm.

**Thực hành:** đếm số phần tử khác nhau trong dãy.$lms$, $lms$#include <bits/stdc++.h>
using namespace std;
int main(){int n,x;cin>>n;set<int>s;while(n--){cin>>x;s.insert(x);}cout<<s.size()<<'\n';}$lms$, $lms$6 3 1 3 2 1 5$lms$),
  (2, 4, $lms$### Đệ quy và quay lui
Đệ quy cần điểm dừng và một bước tiến đến bài toán nhỏ hơn. Quay lui thử lựa chọn, đi sâu rồi hoàn tác.

**Lưu ý:** kiểm tra độ sâu để tránh tràn stack.$lms$, $lms$#include <iostream>
using namespace std;
long long fact(int n){return n<=1?1:n*fact(n-1);}int main(){int n;cin>>n;cout<<fact(n)<<'\n';}$lms$, $lms$5$lms$),
  (2, 5, $lms$### Sắp xếp và tìm kiếm nhị phân
`sort` sắp dãy tăng dần. Trên dãy đã sắp xếp, `binary_search` kiểm tra phần tử trong O(log n), còn `lower_bound` tìm vị trí đầu tiên không nhỏ hơn khóa.

**Lưu ý:** phải sắp xếp trước khi tìm nhị phân.$lms$, $lms$#include <bits/stdc++.h>
using namespace std;
int main(){int n,x;cin>>n>>x;vector<int>a(n);for(int &v:a)cin>>v;sort(a.begin(),a.end());cout<<(binary_search(a.begin(),a.end(),x)?"YES":"NO")<<'\n';}$lms$, $lms$5 7 1 7 3 9 2$lms$),
  (2, 6, $lms$### Quy hoạch động một chiều
Xác định trạng thái, công thức chuyển và giá trị khởi tạo. Lưu lời giải bài toán con để tránh tính lặp.

**Ví dụ:** Fibonacci dùng `dp[i] = dp[i-1] + dp[i-2]`; chỉ cần giữ hai giá trị gần nhất.$lms$, $lms$#include <iostream>
using namespace std;
int main(){int n;cin>>n;long long a=0,b=1;for(int i=0;i<n;i++){long long c=a+b;a=b;b=c;}cout<<a<<'\n';}$lms$, $lms$8$lms$),
  (3, 1, $lms$### Class và Object
Class gom dữ liệu cùng hành vi. Thuộc tính `private` chỉ được truy cập trong class; phương thức `public` là giao diện cho bên ngoài.

**Thực hành:** tạo class `Rectangle` có constructor và hàm tính diện tích.$lms$, $lms$#include <iostream>
using namespace std;
class Rectangle{int w,h;public:Rectangle(int a,int b):w(a),h(b){}int area()const{return w*h;}};int main(){int w,h;cin>>w>>h;cout<<Rectangle(w,h).area()<<'\n';}$lms$, $lms$3 7$lms$),
  (3, 2, $lms$### Constructor và Destructor
Constructor khởi tạo đối tượng khi tạo; danh sách khởi tạo `: value(x)` phù hợp với thành viên `const` và tham chiếu. Destructor chạy khi đối tượng kết thúc vòng đời.

**Thực hành:** tạo class `Counter` có giá trị ban đầu.$lms$, $lms$#include <iostream>
using namespace std;
class Counter{int value;public:explicit Counter(int x):value(x){}int get()const{return value;}};int main(){int n;cin>>n;cout<<Counter(n).get()<<'\n';}$lms$, $lms$12$lms$),
  (3, 3, $lms$### Đóng gói và kế thừa
Đóng gói bảo vệ trạng thái bằng dữ liệu riêng tư và phương thức công khai. Kế thừa phù hợp khi class con thực sự là một dạng của class cha.

**Thực hành:** mở rộng `Shape` bằng class `Square`.$lms$, $lms$#include <iostream>
using namespace std;
class Shape{protected:int size;public:explicit Shape(int n):size(n){}};class Square:public Shape{public:using Shape::Shape;int area()const{return size*size;}};int main(){int n;cin>>n;cout<<Square(n).area()<<'\n';}$lms$, $lms$6$lms$),
  (3, 4, $lms$### Đa hình và hàm ảo
Hàm `virtual` gọi đúng phiên bản của class con qua con trỏ hoặc tham chiếu class cha. Dùng `override` để kiểm tra chữ ký; destructor của class cha nên là `virtual`.

**Thực hành:** định nghĩa hàm thuần ảo rồi triển khai trong class con.$lms$, $lms$#include <iostream>
using namespace std;
struct Base{virtual ~Base()=default;virtual int value()const=0;};struct Number:Base{int n;explicit Number(int x):n(x){}int value()const override{return n;}};int main(){int n;cin>>n;Number x(n);Base& b=x;cout<<b.value()<<'\n';}$lms$, $lms$42$lms$),
  (3, 5, $lms$### Nạp chồng toán tử
Operator overloading cho phép kiểu tự định nghĩa dùng cú pháp quen thuộc. Hãy giữ ý nghĩa dễ đoán, ví dụ `+` cộng hai tọa độ.

**Thực hành:** cộng hai đối tượng `Point`.$lms$, $lms$#include <iostream>
using namespace std;
struct Point{int x,y;Point operator+(const Point&o)const{return{x+o.x,y+o.y};}};int main(){Point a,b;cin>>a.x>>a.y>>b.x>>b.y;Point c=a+b;cout<<c.x<<' '<<c.y<<'\n';}$lms$, $lms$1 2 3 4$lms$),
  (4, 1, $lms$### Con trỏ và bộ nhớ Heap
Con trỏ lưu địa chỉ. `&x` lấy địa chỉ và `*p` truy cập giá trị. `new` cần đi cùng `delete`; code hiện đại nên ưu tiên container và smart pointer.

**Thực hành:** thay đổi giá trị một biến qua con trỏ.$lms$, $lms$#include <iostream>
using namespace std;
int main(){int n;cin>>n;int* p=&n;*p+=1;cout<<n<<'\n';}$lms$, $lms$9$lms$),
  (4, 2, $lms$### Smart Pointers
`unique_ptr` sở hữu duy nhất; `shared_ptr` chia sẻ quyền sở hữu; `weak_ptr` không kéo dài vòng đời. Dùng `make_unique` và `make_shared` để tạo an toàn.

**Thực hành:** tạo một số nguyên bằng `unique_ptr` và quan sát việc tự giải phóng.$lms$, $lms$#include <iostream>
#include <memory>
using namespace std;
int main(){int n;cin>>n;auto p=make_unique<int>(n);cout<<*p<<'\n';}$lms$, $lms$17$lms$)
)
INSERT INTO course_lessons (unit_id, theory_content, sample_code, sample_input)
SELECT u.id, l.theory_content, l.sample_code, l.sample_input
FROM lesson l JOIN course_units u ON u.course_id = l.course_id AND u.order_index = l.order_index
WHERE NOT EXISTS (SELECT 1 FROM course_lessons existing WHERE existing.unit_id = u.id);

COMMIT;
