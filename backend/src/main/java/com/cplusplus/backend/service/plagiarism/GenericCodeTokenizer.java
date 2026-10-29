package com.cplusplus.backend.service.plagiarism;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Bộ tokenizer ngôn ngữ chung (Java, Python, v.v.) —
 * chuẩn hóa literals và định danh để phát hiện đạo văn qua ngữ nghĩa cấu trúc.
 */
public class GenericCodeTokenizer {

    private static final Pattern COMMENT_SINGLE = Pattern.compile(
            "(?://|#).*?$", Pattern.MULTILINE);
    private static final Pattern COMMENT_MULTI = Pattern.compile(
            "/\\*.*?\\*/|\"\"\".*?\"\"\"", Pattern.DOTALL);

    private static final Pattern TOKEN_PATTERN = Pattern.compile(
            "\"(?:\\\\.|[^\"\\\\])*\"|" +               // String literals
            "'(?:\\\\.|[^'\\\\])*'|" +                  // Char / short string literals
            "\\b\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?\\b|" + // Numbers
            "[a-zA-Z_][a-zA-Z0-9_]*|" +                 // Identifiers
            "==|!=|<=|>=|&&|\\|\\||<<|>>|\\+\\+|--|->|" + // Multi-char operators
            "[+\\-*/%=<>&|^!~?:;,.\\[\\]{}()@]"         // Single-char symbols
    );

    private static final Set<String> COMMON_KEYWORDS = Set.of(
            "if", "else", "for", "while", "do", "return", "break", "continue",
            "switch", "case", "default", "class", "interface", "enum", "import",
            "public", "private", "protected", "static", "final", "void", "new",
            "this", "super", "try", "catch", "finally", "throw", "throws",
            "true", "false", "null", "self", "def", "pass", "lambda", "yield",
            "and", "or", "not", "in", "is", "with", "as", "from", "print",
            "int", "long", "double", "float", "char", "bool", "string", "str",
            "list", "dict", "set", "tuple", "var", "let", "const"
    );

    public static List<String> tokenize(String sourceCode) {
        if (sourceCode == null || sourceCode.isBlank()) {
            return Collections.emptyList();
        }
        String clean = COMMENT_SINGLE.matcher(COMMENT_MULTI.matcher(sourceCode).replaceAll(" ")).replaceAll(" ");

        List<String> tokens = new ArrayList<>();
        Matcher m = TOKEN_PATTERN.matcher(clean);
        while (m.find()) {
            String tok = m.group();
            char c0 = tok.charAt(0);
            if (tok.startsWith("\"") || tok.startsWith("'")) {
                tokens.add("STR");
            } else if (Character.isDigit(c0)) {
                tokens.add("NUM");
            } else if (Character.isLetter(c0) || c0 == '_') {
                tokens.add(COMMON_KEYWORDS.contains(tok.toLowerCase()) ? tok.toLowerCase() : "ID");
            } else {
                tokens.add(tok);
            }
        }
        return tokens;
    }
}
