package com.cplusplus.backend.service.plagiarism;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ chuẩn hóa Tokenizer mã nguồn C++:
 * - Loại bỏ hoàn toàn comments (//... và /*...* /).
 * - Chuẩn hóa String/Char/Number literals.
 * - Nhận diện từ khóa chuẩn C++ và toán tử.
 * - Chuẩn hóa tất cả tên biến / tên hàm người dùng thành ID.
 */
public class CppCodeTokenizer {

    private static final Set<String> CPP_KEYWORDS = Set.of(
            "int", "long", "double", "float", "char", "bool", "void", "auto", "short", "unsigned", "signed",
            "string", "vector", "map", "set", "pair", "queue", "stack", "deque", "priority_queue", "unordered_map", "unordered_set",
            "struct", "class", "public", "private", "protected",
            "if", "else", "for", "while", "do", "return", "break", "continue", "switch", "case", "default",
            "cin", "cout", "endl", "printf", "scanf", "getline",
            "push_back", "pop_back", "emplace_back", "size", "empty", "clear", "begin", "end", "insert", "erase", "find",
            "sort", "max", "min", "abs", "swap", "reverse", "memset",
            "include", "using", "namespace", "std", "const", "static", "inline", "typedef", "define"
    );

    private static final Pattern COMMENT_PATTERN = Pattern.compile(
            "//.*?$|/\\*.*?\\*/",
            Pattern.MULTILINE | Pattern.DOTALL
    );

    private static final Pattern TOKEN_PATTERN = Pattern.compile(
            "\"(?:\\\\.|[^\"\\\\])*\"|" +                 // String literals
            "'(?:\\\\.|[^'\\\\])*'|" +                   // Char literals
            "\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b|" + // Number literals
            "==|!=|<=|>=|&&|\\|\\||<<|>>|\\+\\+|--|->|" + // Multi-char operators
            "[a-zA-Z_][a-zA-Z0-9_]*|" +                   // Identifiers / Keywords
            "[+\\-*/%=<>&|^!~?:;,.\\[\\]{}()]"            // Single-char symbols
    );

    public static List<String> tokenize(String sourceCode) {
        if (sourceCode == null || sourceCode.isBlank()) {
            return Collections.emptyList();
        }

        // 1. Loại bỏ comment
        String cleanCode = COMMENT_PATTERN.matcher(sourceCode).replaceAll(" ");

        // 2. Tách tokens
        List<String> tokens = new ArrayList<>();
        Matcher matcher = TOKEN_PATTERN.matcher(cleanCode);

        while (matcher.find()) {
            String token = matcher.group();
            if (token.startsWith("\"") && token.endsWith("\"")) {
                tokens.add("STR");
            } else if (token.startsWith("'") && token.endsWith("'")) {
                tokens.add("CHR");
            } else if (Character.isDigit(token.charAt(0))) {
                tokens.add("NUM");
            } else if (Character.isLetter(token.charAt(0)) || token.charAt(0) == '_') {
                String lower = token.toLowerCase();
                if (CPP_KEYWORDS.contains(lower)) {
                    tokens.add(lower);
                } else {
                    // Biến hoặc hàm người dùng đặt
                    tokens.add("ID");
                }
            } else {
                // Toán tử hoặc dấu câu
                tokens.add(token);
            }
        }

        return tokens;
    }
}
