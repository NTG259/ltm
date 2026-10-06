"""Quét tĩnh mã nguồn C++ trước khi biên dịch (nhãn ``SEC``).

go-judge chặn hành vi nguy hiểm bằng namespace + seccomp. Ở đây quét tĩnh là
lớp chặn đầu tiên, kết hợp với rlimit trong ``sandbox`` (binary link tĩnh và
``RLIMIT_NOFILE = 3`` nên chương trình không mở được file/socket nào).

Mã nguồn được chuẩn hóa giống các pha đầu của trình biên dịch trước khi so khớp:
nối dòng ``\\``-newline, bỏ comment, làm rỗng chuỗi/ký tự. Nhờ vậy không lách
được bằng cách xuống dòng giữa tên hàm, và không báo nhầm khi tên hàm nằm trong
comment hay chuỗi.

Lưu ý: ``<bits/stdc++.h>`` đã kéo theo khai báo ``fork``, ``execv``, ``unlink``,
``kill``... nên phải cấm theo tên định danh chứ không chỉ theo header.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

_HEADERS = (
    r"windows|winsock2?|ws2tcpip|winbase|process|direct|io|conio"
    r"|unistd|fcntl|dirent|dlfcn|spawn|pwd|grp|termios|poll|ucontext|setjmp"
    r"|sys/[\w/.]+|netinet/[\w/.]+|arpa/[\w/.]+|linux/[\w/.]+|asm/[\w/.]+|netdb"
)

# Tên cấm khi là định danh độc lập (thành viên a.x / a->x vẫn hợp lệ). Có thể báo nhầm
# nếu thí sinh tự đặt tên biến trùng (vd. `kill`), thông báo SEC sẽ chỉ rõ dòng.
_FORBIDDEN_CALLS = {
    "lời gọi hệ thống system()": r"system",
    "tạo tiến trình": r"v?fork|clone3?|posix_spawnp?|daemon",
    "thực thi chương trình ngoài": r"_?popen|exec(?:l|lp|le|v|vp|ve|vpe)|fexecve|CreateProcess\w*|ShellExecute\w*|WinExec",
    "lời gọi hệ thống cấp thấp": r"syscall|ptrace|kill|killpg|prctl|setrlimit|dlopen|dlsym",
    "thao tác file hệ thống": r"unlink(?:at)?|rmdir|rename(?:at)?|chdir|chroot|chmod|chown|symlink|truncate|mkdir|mkfifo|mknod",
}

_RULES: list[tuple[re.Pattern[str], str]] = [
    (re.compile(rf"^[ \t]*#[ \t]*include[ \t]*<[ \t]*(?:{_HEADERS})(?:\.h)?[ \t]*>", re.M), "thư viện hệ điều hành bị cấm"),
    (re.compile(r'^[ \t]*#[ \t]*include[ \t]*"', re.M), '#include "..." bị cấm, chỉ dùng thư viện chuẩn <...>'),
    (re.compile(r"^[ \t]*#[ \t]*include[ \t]*<[ \t]*(?:/|[^>\n]*\.\.)", re.M), "#include theo đường dẫn file bị cấm"),
    (re.compile(r"^[ \t]*#[ \t]*include[ \t]*[^<\"\s]", re.M), "#include qua macro bị cấm"),
    (re.compile(r"^[ \t]*#[ \t]*(?:include_next|import|pragma[ \t]+comment)\b", re.M), "chỉ thị tiền xử lý bị cấm"),
    (re.compile(r'\bextern[ \t\n]*"'), 'extern "C" bị cấm (tự khai báo hàm hệ thống)'),
    (re.compile(r"\b(?:__)?asm(?:__)?\b"), "mã assembly nội tuyến bị cấm"),
    (re.compile(r"##"), "ghép token tiền xử lý (##) bị cấm"),
    (re.compile(r"\bfilesystem\b"), "std::filesystem bị cấm"),
    (re.compile(r"__attribute__\s*\(\(\s*(?:constructor|destructor|section)"), "__attribute__ đặc biệt bị cấm"),
    # remove(path) xóa file; std::remove(first, last, value) có 3 tham số nên vẫn hợp lệ.
    (re.compile(r"(?<![\w.>])(?:std\s*::\s*|::\s*)?remove\s*\(\s*[^,()]*\)"), "xóa file bằng remove() bị cấm"),
] + [
    # So khớp cả tên đứng một mình (không chỉ lời gọi) để chặn kiểu `auto f = system; f(...)`.
    (re.compile(rf"(?<![\w.>])(?:{names})\b"), f"{what} bị cấm")
    for what, names in _FORBIDDEN_CALLS.items()
]

# Thứ tự alternation quan trọng: comment/chuỗi phải được nhận diện trước khi bên trong bị so khớp.
_TOKEN = re.compile(
    r"""
      (?P<block>/\*.*?(?:\*/|\Z))
    | (?P<line>//[^\n]*)
    | (?P<raw>R"(?P<delim>[^()\\\s]{0,16})\(.*?\)(?P=delim)")
    | (?P<str>"(?:\\.|[^"\\\n])*")
    | (?P<chr>'(?:\\.|[^'\\\n])*')
    """,
    re.DOTALL | re.VERBOSE,
)


@dataclass
class Violation:
    line: int
    message: str
    snippet: str

    def __str__(self) -> str:
        return f"dòng {self.line}: {self.message} – `{self.snippet}`"


def _splice(code: str) -> tuple[str, list[int]]:
    """Nối các dòng kết thúc bằng ``\\`` (pha 2 của C++), giữ số dòng gốc của từng ký tự."""
    out: list[str] = []
    lines: list[int] = []
    line = 1
    i, n = 0, len(code)
    while i < n:
        ch = code[i]
        if ch == "\\" and code.startswith("\n", i + 1):
            i += 2
            line += 1
            continue
        out.append(ch)
        lines.append(line)
        if ch == "\n":
            line += 1
        i += 1
    return "".join(out), lines


def _blank(code: str, keep_strings: bool) -> str:
    """Thay comment (và chuỗi nếu ``keep_strings`` sai) bằng khoảng trắng cùng độ dài."""

    def repl(m: re.Match[str]) -> str:
        text = m.group(0)
        if keep_strings and not (m.group("block") or m.group("line")):
            return text
        body = re.sub(r"[^\n]", " ", text)
        if m.group("str") or m.group("raw"):
            return '"' + body[1:-1] + '"'
        if m.group("chr"):
            return "'" + body[1:-1] + "'"
        return body

    return _TOKEN.sub(repl, code)


def scan(code: str) -> Violation | None:
    """Trả về vi phạm xuất hiện sớm nhất, hoặc ``None`` nếu mã nguồn sạch."""
    spliced, line_of = _splice(code.replace("\r\n", "\n").replace("\r", "\n"))
    cleaned = _blank(spliced, keep_strings=False)
    # Kiểm tra #include "..." trên bản còn giữ chuỗi; các luật khác trên bản đã làm rỗng chuỗi.
    with_strings = _blank(spliced, keep_strings=True)

    best: tuple[int, str] | None = None
    for i, (pattern, message) in enumerate(_RULES):
        m = pattern.search(with_strings if i in (1, 2) else cleaned)
        if m and (best is None or m.start() < best[0]):
            best = (m.start(), message)
    if best is None:
        return None
    pos, message = best
    line = line_of[pos] if pos < len(line_of) else (line_of[-1] if line_of else 1)
    original = code.replace("\r\n", "\n").split("\n")
    snippet = original[line - 1].strip() if line - 1 < len(original) else ""
    return Violation(line, message, snippet[:120])
