"""So sánh output của thí sinh với đáp án (Output Normalizer)."""

from __future__ import annotations

from collections.abc import Callable


def _decode(data: bytes | str) -> str:
    return data if isinstance(data, str) else data.decode("utf-8", errors="replace")


def _lines(text: str) -> list[str]:
    lines = [line.rstrip() for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n")]
    while lines and not lines[-1]:
        lines.pop()
    return lines


def compare_lines(output: bytes | str, expected: bytes | str) -> bool:
    """Mặc định: bỏ khoảng trắng cuối mỗi dòng và các dòng trống ở cuối."""
    return _lines(_decode(output)) == _lines(_decode(expected))


def compare_tokens(output: bytes | str, expected: bytes | str) -> bool:
    """Bỏ qua mọi khác biệt về khoảng trắng/xuống dòng."""
    return _decode(output).split() == _decode(expected).split()


def compare_exact(output: bytes | str, expected: bytes | str) -> bool:
    return _decode(output) == _decode(expected)


CHECKERS: dict[str, Callable[[bytes | str, bytes | str], bool]] = {
    "lines": compare_lines,
    "tokens": compare_tokens,
    "exact": compare_exact,
}


def get_checker(name: str | None) -> Callable[[bytes | str, bytes | str], bool]:
    try:
        return CHECKERS[name or "lines"]
    except KeyError:
        raise ValueError(f"checker '{name}' không hỗ trợ, chọn một trong {sorted(CHECKERS)}") from None
