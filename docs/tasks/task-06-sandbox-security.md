# Task 06 — Sandbox & Security

**Dependency:** Task 01 (biết Worker chạy trên OS nào), Task 03 (biết TASK_ASSIGN payload có gì).

## Objective

Thiết kế môi trường cô lập cho code C++ của thí sinh: giới hạn tài nguyên (cgroups v2), lọc syscall nguy hiểm (seccomp), cách ly namespace, và đo lường chính xác CPU/memory.

## Research areas

- **cgroups v2**: hierarchy, `memory.max`, `cpu.max`, `pids.max` — cách tạo và dọn dẹp programmatically
- **seccomp BPF**: `libseccomp` vs viết BPF filter thủ công, allowlist vs denylist
- **Linux namespaces**: `CLONE_NEWPID`, `CLONE_NEWNS`, `CLONE_NEWNET` — mức cô lập mỗi namespace
- **go-judge** (https://github.com/criyle/go-judge): kiến trúc, giao thức REST, so sánh với launcher.c hiện tại
- **`/proc/[pid]/status`** vs `wait4(RUSAGE_CHILDREN)`: cách đo RSS chính xác
- **Static linking**: tại sao `g++ -static` giảm rủi ro nhưng không đủ một mình

## Design deliverables

### 1. Kiến trúc sandbox (2 lựa chọn — chọn 1)

**Option A: go-judge** (khuyến nghị cho production)
```
Worker (Python)
  → POST http://localhost:5050/run (go-judge REST API)
  → go-judge: cgroups + seccomp + namespace + mount
  → Trả về: exitCode, cpu_time_ms, memory_kb, stdout, stderr
```
Ưu điểm: battle-tested, xử lý đầy đủ edge case, có sẵn Docker image.
Nhược điểm: thêm dependency, cần hiểu config.

**Option B: launcher.c cải tiến** (tự viết, phù hợp báo cáo hơn)
```
Worker (Python) → subprocess launcher.c
  launcher.c:
    1. fork()
    2. child: setup cgroups v2, seccomp filter, unshare(namespaces)
    3. child: execvp(binary, args)
    4. parent: wait4() + RSS watchdog thread mỗi 50ms
    5. parent: cleanup cgroup
```
Ưu điểm: tự viết → hiểu rõ → có thể giải thích khi bảo vệ.
Nhược điểm: nhiều edge case phải xử lý thủ công.

### 2. cgroups v2 design

**Hierarchy:**
```
/sys/fs/cgroup/judge/
  submission-{id}/
    memory.max        = {memoryLimitMb}M
    memory.swap.max   = 0              (không dùng swap)
    cpu.max           = {quota} {period}  (e.g., "100000 100000" = 1 CPU)
    pids.max          = 10             (không fork bomb)
```

**Cleanup:** xóa cgroup sau khi process kết thúc — dùng `rmdir` sau `wait4()`.

**Đo memory peak:**
```
# Đọc peak RSS từ cgroup
cat /sys/fs/cgroup/judge/submission-{id}/memory.peak
```

### 3. seccomp allowlist

Chỉ cho phép các syscall cần thiết cho C++ console program:
```
read, write, open (readonly), close, fstat, mmap, mprotect, munmap,
brk, access, execve (1 lần đầu), exit, exit_group, getpid,
clock_gettime, gettimeofday, lseek, pread64, pwrite64
```

Block (SCMP_ACT_KILL_PROCESS):
```
fork, clone, vfork, execve (sau exec đầu tiên), socket, connect,
bind, listen, open (write mode), creat, unlink, rename, chmod,
kill (với pid != self), ptrace, mount, setuid, setgid
```

### 4. Namespace isolation

```c
unshare(CLONE_NEWPID   // PID namespace: không thấy process ngoài
      | CLONE_NEWNET   // Network namespace: không có network interface
      | CLONE_NEWNS    // Mount namespace: filesystem riêng
      | CLONE_NEWUTS); // UTS namespace: hostname riêng
```

### 5. Static security scan (giữ lại từ codebase hiện tại)

Scanner chạy TRƯỚC khi tạo sandbox — fail fast với SEC verdict:
```python
BANNED_IDENTIFIERS = [
    'windows.h', 'system', 'fork', 'exec', 'popen',
    'socket', 'connect', 'kill', 'signal', 'ptrace',
    'dlopen', 'dlsym', '__asm__', 'asm volatile'
]
```

### 6. Verdict mapping từ sandbox output

| Condition | Verdict |
|-----------|---------|
| exit_code == 0 AND output matches | AC |
| exit_code == 0 AND output mismatch | WA |
| cpu_time > time_limit | TLE |
| memory_kb > memory_limit_kb | MLE |
| signaled (SIGSEGV, SIGFPE, etc.) | RTE |
| exit_code != 0 AND not signaled | RTE |
| Banned identifier found | SEC |
| Compilation failed | CE |

### 7. Resource limits summary

| Resource | Limit | Mechanism |
|----------|-------|-----------|
| CPU time | `timeLimitMs × 2` | cgroup `cpu.max` + SIGXCPU |
| Wall clock | `timeLimitMs × 3 + 1000ms` | watchdog thread |
| Memory RSS | `memoryLimitMb` MB | cgroup `memory.max` |
| Swap | 0 | cgroup `memory.swap.max=0` |
| File descriptors | 3 (stdin/stdout/stderr) | `setrlimit(RLIMIT_NOFILE, 3)` |
| Processes | 10 | cgroup `pids.max=10` |
| File size output | 64 KB | `setrlimit(RLIMIT_FSIZE)` |

## Quality checklist

- [ ] Chọn rõ Option A (go-judge) hay Option B (launcher.c) — và giải thích lý do
- [ ] cgroups v2 path, field names, cleanup procedure đều được spec
- [ ] seccomp allowlist đủ cho C++ console program nhưng block được network/fork
- [ ] Namespace: ít nhất 3 loại (PID, NET, MNT) được dùng và giải thích
- [ ] Bảng resource limits đầy đủ với mechanism cụ thể
- [ ] Verdict mapping: mọi exit condition đều có verdict tương ứng
- [ ] Giải thích tại sao static scan (SEC) không thay thế được sandbox
- [ ] Memory đo bằng cách nào — RSS peak hay `wait4` ru_maxrss
- [ ] Cleanup cgroup được xử lý kể cả khi process bị kill đột ngột
- [ ] Tài liệu này đủ để giải thích cho giảng viên trong buổi bảo vệ

## Mapping báo cáo

- §8.5 Background → "tại sao cần sandbox, launcher.c hiện tại có gì thiếu"
- §8.7 Proposed Approach → Sandbox design
- §8.10 Implementation → Security mechanism
- §8.14 Novelty → cgroups v2 + seccomp + namespace isolation
- §8.19 Appendix → seccomp syscall list
