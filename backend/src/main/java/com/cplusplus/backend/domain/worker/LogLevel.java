package com.cplusplus.backend.domain.worker;

import com.cplusplus.backend.domain.common.CodedEnum;
import com.cplusplus.backend.domain.common.CodedEnumConverter;
import jakarta.persistence.Converter;

/** Mức nhật ký Master hiển thị trên trang Admin. */
public enum LogLevel implements CodedEnum {
    INFO("info"),
    SUCCESS("success"),
    WARNING("warning"),
    ERROR("error");

    private final String code;

    LogLevel(String code) {
        this.code = code;
    }

    @Override
    public String code() {
        return code;
    }

    @Converter(autoApply = true)
    public static class DbConverter extends CodedEnumConverter<LogLevel> {
        public DbConverter() {
            super(LogLevel.class);
        }
    }
}
