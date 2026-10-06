package com.cplusplus.backend.domain.common;

/**
 * Enum lưu trong DB bằng một mã riêng (vd. {@code easy}, {@code cpp17}) thay vì tên hằng.
 * Mã này trùng với giá trị API trả cho frontend.
 */
public interface CodedEnum {

    String code();

    static <E extends Enum<E> & CodedEnum> E fromCode(Class<E> type, String code) {
        for (E value : type.getEnumConstants()) {
            if (value.code().equals(code)) {
                return value;
            }
        }
        throw new IllegalArgumentException("Giá trị '" + code + "' không hợp lệ cho " + type.getSimpleName());
    }
}
