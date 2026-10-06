// Tô màu cú pháp C++ đơn giản (không cần thư viện ngoài). Trả về HTML đã escape.
const KEYWORDS = new Set(
  (
    'alignas alignof and asm auto break case catch class const constexpr continue decltype default delete do ' +
    'else enum explicit export extern false for friend goto if inline mutable namespace new noexcept not nullptr ' +
    'operator or private protected public register return sizeof static static_assert static_cast struct switch ' +
    'template this throw true try typedef typename union using virtual volatile while'
  ).split(' '),
)
const TYPES = new Set(
  (
    'bool char double float int long short signed unsigned void size_t string vector map set pair queue stack ' +
    'deque priority_queue unordered_map unordered_set array bitset int64_t uint64_t'
  ).split(' '),
)
const TOKEN_RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|(^[ \t]*#[^\n]*)|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b\d[\d.]*(?:[eE][+-]?\d+)?[uUlLfF]*\b|\b0x[\da-fA-F]+\b)|([A-Za-z_]\w*)(?=\s*\()|([A-Za-z_]\w*)/gm

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function highlightCpp(code) {
  let out = ''
  let last = 0
  for (const m of code.matchAll(TOKEN_RE)) {
    out += esc(code.slice(last, m.index))
    const [text, cmt, pre, str, num, fn, word] = m
    let cls = null
    if (cmt) cls = 'cmt'
    else if (pre) cls = 'pre'
    else if (str) cls = 'str'
    else if (num) cls = 'num'
    else if (fn) cls = KEYWORDS.has(fn) ? 'kw' : TYPES.has(fn) ? 'type' : 'fn'
    else if (word) cls = KEYWORDS.has(word) ? 'kw' : TYPES.has(word) ? 'type' : null
    out += cls ? `<span class="tok-${cls}">${esc(text)}</span>` : esc(text)
    last = m.index + text.length
  }
  return out + esc(code.slice(last))
}
