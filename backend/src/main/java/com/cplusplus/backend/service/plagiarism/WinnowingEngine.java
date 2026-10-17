package com.cplusplus.backend.service.plagiarism;

import java.util.*;

/**
 * Cài đặt thuật toán Winnowing (chuẩn MOSS - Stanford) kết hợp Token LCS
 * để phát hiện tương đồng mã nguồn.
 */
public class WinnowingEngine {

    private static final int K_GRAM_SIZE = 4;
    private static final int WINDOW_SIZE = 4;
    private static final long HASH_BASE = 31L;
    private static final long HASH_MOD = 1_000_000_007L;

    public record MatchResult(double similarityScore, int matchedFingerprints, int totalFingerprintsA, int totalFingerprintsB) {}

    public static MatchResult compare(List<String> tokensA, List<String> tokensB) {
        if (tokensA == null || tokensB == null || tokensA.isEmpty() || tokensB.isEmpty()) {
            return new MatchResult(0.0, 0, 0, 0);
        }

        // 1. Tính fingerprints theo Winnowing
        Set<Long> fpA = getFingerprints(tokensA);
        Set<Long> fpB = getFingerprints(tokensB);

        int countA = fpA.size();
        int countB = fpB.size();

        if (countA == 0 || countB == 0) {
            // Khi mã nguồn quá ngắn (< k-gram), so sánh trực tiếp token equality
            double simpleRatio = calculateTokenLcsRatio(tokensA, tokensB);
            return new MatchResult(Math.round(simpleRatio * 10.0) / 10.0, 0, countA, countB);
        }

        // Giao của 2 tập fingerprints
        Set<Long> intersection = new HashSet<>(fpA);
        intersection.retainAll(fpB);
        int matched = intersection.size();

        // Jaccard similarity trên fingerprints
        double winnowingScore = (2.0 * matched) / (countA + countB) * 100.0;

        // Token LCS ratio
        double lcsScore = calculateTokenLcsRatio(tokensA, tokensB);

        // Kết hợp trọng số: 65% Winnowing + 35% LCS
        double combined = 0.65 * winnowingScore + 0.35 * lcsScore;
        combined = Math.max(0.0, Math.min(100.0, combined));
        double rounded = Math.round(combined * 10.0) / 10.0;

        return new MatchResult(rounded, matched, countA, countB);
    }

    private static Set<Long> getFingerprints(List<String> tokens) {
        if (tokens.size() < K_GRAM_SIZE) {
            return Collections.emptySet();
        }

        // Tạo danh sách k-gram hash
        List<Long> hashes = new ArrayList<>();
        int n = tokens.size();
        for (int i = 0; i <= n - K_GRAM_SIZE; i++) {
            long hash = 0;
            for (int j = 0; j < K_GRAM_SIZE; j++) {
                String token = tokens.get(i + j);
                int tokenHash = token.hashCode();
                hash = (hash * HASH_BASE + (tokenHash & 0x7FFFFFFF)) % HASH_MOD;
            }
            hashes.add(hash);
        }

        if (hashes.size() < WINDOW_SIZE) {
            return new HashSet<>(hashes);
        }

        // Cửa sổ trượt (sliding window) chọn min hash
        Set<Long> fingerprints = new HashSet<>();
        int minIdx = -1;

        for (int i = 0; i <= hashes.size() - WINDOW_SIZE; i++) {
            if (minIdx >= i && minIdx < i + WINDOW_SIZE) {
                // Kiểm tra xem phần tử mới nhất có nhỏ hơn không
                int lastIdx = i + WINDOW_SIZE - 1;
                if (hashes.get(lastIdx) <= hashes.get(minIdx)) {
                    minIdx = lastIdx;
                }
            } else {
                // Tìm lại min trong cửa sổ hiện tại
                minIdx = i;
                for (int j = i + 1; j < i + WINDOW_SIZE; j++) {
                    if (hashes.get(j) <= hashes.get(minIdx)) {
                        minIdx = j;
                    }
                }
            }
            fingerprints.add(hashes.get(minIdx));
        }

        return fingerprints;
    }

    /**
     * Tính tỷ lệ chuỗi con chung dài nhất (LCS) giữa 2 danh sách tokens:
     * Dùng mảng 1 chiều tối ưu không gian O(M).
     */
    private static double calculateTokenLcsRatio(List<String> a, List<String> b) {
        int n = a.size();
        int m = b.size();
        if (n == 0 || m == 0) return 0.0;

        // Giới hạn max token để tránh O(N*M) quá lớn nếu bài nộp cả nghìn dòng
        int maxLen = 800;
        List<String> subA = n > maxLen ? a.subList(0, maxLen) : a;
        List<String> subB = m > maxLen ? b.subList(0, maxLen) : b;
        int lenA = subA.size();
        int lenB = subB.size();

        int[] dp = new int[lenB + 1];

        for (int i = 1; i <= lenA; i++) {
            int prev = 0;
            String tokA = subA.get(i - 1);
            for (int j = 1; j <= lenB; j++) {
                int temp = dp[j];
                if (tokA.equals(subB.get(j - 1))) {
                    dp[j] = prev + 1;
                } else {
                    dp[j] = Math.max(dp[j], dp[j - 1]);
                }
                prev = temp;
            }
        }

        int lcs = dp[lenB];
        return (2.0 * lcs) / (lenA + lenB) * 100.0;
    }
}
