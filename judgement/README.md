# judgement – Judge Worker

Judge Worker của hệ thống chấm bài C++ phân tán (xem `../README.md`). Worker kết nối TCP
tới Master (cổng `9000`), nhận bài qua giao thức nhị phân `>BBI`, quét bảo mật tĩnh, biên dịch
bằng `g++`, chạy từng test trong sandbox giới hạn thời gian/bộ nhớ và trả về một trong 7 nhãn
`AC WA TLE MLE RTE CE SEC`.

Chỉ dùng thư viện chuẩn Python (≥ 3.10) + `g++`. Không cần `pip install`.

## Kiến trúc (tham khảo go-judge)

| go-judge | judgement | Vai trò |
| --- | --- | --- |
| Transport (HTTP/WS/gRPC) | `worker.py` + `protocol.py` | TCP nhị phân `>BBI` tới Master, heartbeat, tự kết nối lại |
| `worker/` (request → cmd) | `judge.py` | Quét tĩnh → biên dịch → chạy từng test → so output → tổng hợp nhãn |
| `envexec/` (`Cmd`, `Result`, `Status`) | `sandbox.py` | Mô hình `Cmd`/`Limits`/`Result`, ánh xạ trạng thái giống `envexec.Status` |
| `worker/waiter.go` | vòng chờ trong `launcher.c` | Mỗi 5 ms kiểm tra thời gian thực, CPU và RSS; vượt thì giết cả group |
| cgroup `memory.max` | watchdog RSS trong `launcher.c` | Giới hạn bộ nhớ **thực dùng**, không giới hạn không gian địa chỉ |
| go-sandbox runner (cgroup, seccomp, namespace) | `launcher.c` (rlimit) + `scanner.py` | fork → `setrlimit` → `execvp`, đo bằng `wait4`; quét tĩnh thay seccomp |

```
judgement/
├── judgement/
│   ├── protocol.py   # header 6B >BBI, recv_exact, FrameDecoder, lỗi magic/payload
│   ├── worker.py     # TCP client: REGISTER, PING/PONG, TASK_ASSIGN/STATUS/RESULT
│   ├── judge.py      # quy trình chấm + quy đổi 7 nhãn
│   ├── sandbox.py    # chạy tiến trình có giới hạn (gọi launcher)
│   ├── launcher.c    # runner nhỏ: rlimit + đo CPU/RSS chính xác bằng wait4
│   ├── scanner.py    # quét bảo mật tĩnh (SEC)
│   └── checker.py    # so sánh output: lines (mặc định) / tokens / exact
├── samples/          # ac/wa/tle/mle/ce/rte/sec.cpp + aplusb.json
└── tests/            # unittest: protocol, judge, worker (Master giả)
```

## Chạy

```bash
cd judgement

# Worker kết nối Master
python -m judgement worker --id worker-1 --master-host 127.0.0.1 --master-port 9000

# Chấm thử một file tại chỗ, không cần Master
python -m judgement judge samples/ac.cpp --problem samples/aplusb.json

# Chỉ quét bảo mật
python -m judgement scan samples/sec.cpp

# Kiểm thử (≈ 1 phút)
python -m unittest discover -s tests -t .
```

Tùy chọn hữu ích: `--compiler`, `--work-dir`, `--keep-files` (giữ thư mục chấm để gỡ lỗi),
`--no-static`, `--master-timeout` (mặc định 20s không nhận được gì từ Master thì kết nối lại), `-v`.

## Giao thức với Master

Frame: `[0xAA][opcode][uint32 big-endian length][JSON UTF-8]`, payload tối đa 10 MB. Sai magic
byte, opcode lạ hoặc payload vượt trần thì đóng kết nối ngay.

| Opcode | Chiều | Payload |
| --- | --- | --- |
| `0x02` REGISTER | W → M | `{workerId, hostname, pid, version, platform, languages:["cpp17"], compiler, sandbox, parallelism:1, startedAt}` |
| `0x01` HEARTBEAT | M → W | `{type:"PING", ts}` |
| `0x01` HEARTBEAT | W → M | `{type:"PONG", ts (lặp lại), workerId, busy, currentTask, completed}` |
| `0x03` TASK_ASSIGN | M → W | xem dưới |
| `0x04` TASK_STATUS | W → M | `{submissionId, attempt, workerId, status:"COMPILING"}`<br>`{…, status:"TESTING", progress:{current,total}, running}` trước mỗi test<br>`{…, status:"TESTING", progress, test:{…}}` sau mỗi test |
| `0x05` TASK_RESULT | W → M | xem dưới |

PING được trả lời ngay cả khi đang chấm, vì luồng đọc socket tách khỏi luồng chấm.

**TASK_ASSIGN**

```jsonc
{
  "submissionId": 1045,
  "attempt": 1,                 // lần giao thứ mấy (Failover tăng lên), được gửi lại nguyên vẹn
  "language": "cpp17",
  "sourceCode": "#include <bits/stdc++.h> ...",
  "timeLimitMs": 1000,
  "memoryLimitMb": 256,
  "tests": [{ "input": "3 5", "output": "8" }],
  "checker": "lines",           // tùy chọn: lines | tokens | exact
  "stopOnFirstFailure": true    // tùy chọn: dừng ở test sai đầu tiên, các test sau là SKIPPED
}
```

**TASK_RESULT** (khớp kiểu `Submission` trong `frontend/README.md`)

```jsonc
{
  "submissionId": 1045, "attempt": 1, "workerId": "worker-1",
  "status": "FINISHED",
  "verdict": "WA",              // AC WA TLE MLE RTE CE SEC
  "score": 75,                  // round(100 * passed / total)
  "timeMs": 12, "memoryKb": 1640, "passed": 3, "total": 4, "judgeTimeMs": 980,
  "tests": [
    { "index": 1, "status": "AC", "timeMs": 1, "memoryKb": 1600, "output": "8\n" },
    { "index": 2, "status": "WA", "timeMs": 1, "memoryKb": 1640, "output": "-17\n", "detail": "Đầu ra không khớp đáp án" },
    { "index": 3, "status": "RTE", "signal": "SIGFPE", "detail": "Signalled (SIGFPE)" },
    { "index": 4, "status": "SKIPPED" }
  ],
  "compileLog": "solution.cpp:6:5: error: ...",   // chỉ khi CE (hoặc cảnh báo khi biên dịch được)
  "securityMessage": "dòng 1: thư viện hệ điều hành bị cấm – `#include <windows.h>`"  // chỉ khi SEC
}
```

Khi máy chấm không chấm được thì trả `{submissionId, attempt, workerId, status, verdict:null, error}`:

- `status:"ERROR"`: lỗi phía máy chấm (payload sai, thiếu g++, …). Master nên giao lại bài cho Worker khác.
- `status:"REJECTED"`: Worker đang bận chấm bài khác. Master đưa bài về hàng đợi.

Nếu mất kết nối giữa chừng, Worker giết ngay tiến trình đang chạy, hủy bài và **không** gửi
kết quả. Sau khi kết nối lại, Worker gửi lại REGISTER. Master Failover theo trường `attempt`.

## Quy đổi nhãn

| Tình huống | Nhãn | Cách phát hiện |
| --- | --- | --- |
| Quét tĩnh thấy mã nguy hiểm | `SEC` | `scanner.py`, chặn trước khi biên dịch |
| `g++` lỗi / quá 20s | `CE` | mã thoát của g++, log đã bỏ đường dẫn tạm |
| CPU > TL, hoặc thời gian thực > 3·TL + 1s | `TLE` | vòng chờ của launcher, `SIGXCPU` |
| RSS vượt ML khi đang chạy | `MLE` | watchdog đọc `/proc/<pid>/statm` mỗi 5 ms rồi giết tiến trình |
| RSS đỉnh > ML lúc kết thúc | `MLE` | `ru_maxrss` từ `wait4` (bắt các lần vượt ngắn giữa hai lần kiểm tra) |
| Cấp phát quá lớn bị kernel từ chối | `MLE` | `std::bad_alloc` → SIGABRT |
| Tín hiệu (SIGSEGV, SIGFPE, …) / mã thoát ≠ 0 | `RTE` | `detail` ghi rõ tín hiệu / mã thoát |
| Output > 64 MB | `WA` | `RLIMIT_FSIZE` → `SIGXFSZ` |
| Output khác đáp án | `WA` | checker `lines`: bỏ khoảng trắng cuối dòng và dòng trống cuối file |

## Đối chiếu với go-judge

Đã chạy cùng một bộ 24 chương trình (cùng binary, cùng giới hạn CPU 1s / RAM 256 MB /
stack 256 MB) trên go-judge v1.13.0 (cgroup v2) và trên `judgement`: **cả 24 cho cùng nhãn**.
Bộ này gồm AC, chạy sát giới hạn, lặp vô tận, `sleep`, đa luồng, `fork`, các kiểu MLE (vector
lớn, tăng dần, mảng tĩnh có/không dùng tới, `reserve`/`malloc` không chạm tới), stack 100 MB,
SIGSEGV/SIGFPE/abort, mã thoát ≠ 0, output 10 MB / 100 MB, mở file, tạo socket.

Những chỗ vẫn khác (không làm đổi nhãn với chương trình thi bình thường):

| Khía cạnh | go-judge | judgement |
| --- | --- | --- |
| Số bộ nhớ báo cáo | đỉnh của cgroup | RSS đỉnh, cao hơn khoảng 1,3 MB vì tính cả trang của file thực thi |
| Lúc vượt bộ nhớ | kernel chặn đúng ở ML + 16 KB | có thể vượt thêm vài chục MB trong 5 ms trước khi bị giết |
| Thời gian báo khi TLE | khoảng TL + 100 ms (kiểm tra mỗi 100 ms) | khoảng TL + 15 ms (kiểm tra mỗi 5 ms) |
| Clock limit khi không truyền | = CPU limit | = 3 × TL + 1 s |
| Tiến trình con | CPU/RAM tính cho cả cgroup, `procLimit` | chỉ tính con đã được `wait`; không giới hạn số tiến trình (`fork` bị quét tĩnh chặn) |
| Cô lập | namespace + seccomp (profile Moby), không có mạng | không cô lập; `RLIMIT_NOFILE = 3` nên không mở được file hay socket nào |
| Mã nguy hiểm | vẫn biên dịch và chạy trong container | chặn trước khi biên dịch (`SEC`) |
| Output lớn | tính vào bộ nhớ cgroup (pipe/tmpfs) | không tính vào bộ nhớ |

## Sandbox và giới hạn

- Chương trình được **link tĩnh** (`-static`) và chạy với `RLIMIT_NOFILE = 3`, nên chỉ có
  stdin/stdout/stderr: `fopen`, `ifstream`, `socket` đều thất bại. Nếu máy không link tĩnh được,
  Worker in cảnh báo và nới lỏng giới hạn này.
- `launcher.c` được biên dịch tự động lần đầu vào `$TMPDIR/judgement-<uid>/`. Launcher tồn tại
  vì `ru_maxrss` được giữ qua `execve`: nếu Python spawn trực tiếp, mọi bài sẽ bị cộng thêm
  khoảng 12 MB RSS của trình thông dịch.
- Bộ nhớ được giới hạn theo **RSS**, không phải `RLIMIT_AS`. Lý do: glibc lấy `RLIMIT_STACK`
  (= ML) làm stack mặc định cho mỗi luồng mới, nên giới hạn không gian địa chỉ khiến chương trình
  chỉ cần tạo 2 luồng là đã bị abort. `RLIMIT_AS` chỉ còn dùng khi biên dịch (để chặn `cc1plus`).
- **Chưa bằng go-judge:** không có namespace/cgroup/seccomp. Chương trình vẫn chạy dưới cùng
  user với Worker, nên phải chạy Worker bằng một user riêng không có quyền gì. Không giới hạn
  số tiến trình, vì `RLIMIT_NPROC` tính theo user; `fork`/`clone` bị chặn bằng quét tĩnh. Muốn
  cô lập thật thì cần chạy Worker trong container, hoặc dùng go-judge làm backend.
- Quét tĩnh cấm theo **tên định danh**, vì `<bits/stdc++.h>` đã kéo theo khai báo `fork`,
  `execv`, `unlink`, `kill`, … Vì vậy biến hay hàm tự đặt trùng các tên này (ví dụ `kill`)
  sẽ bị báo `SEC`, kèm số dòng.
- Windows: chỉ giới hạn thời gian thực, không đo được bộ nhớ, không có rlimit. Chỉ dùng để demo.
