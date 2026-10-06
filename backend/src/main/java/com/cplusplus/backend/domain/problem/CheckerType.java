package com.cplusplus.backend.domain.problem;

import com.cplusplus.backend.domain.common.CodedEnum;
import com.cplusplus.backend.domain.common.CodedEnumConverter;
import jakarta.persistence.Converter;

/** Cách so output, khớp với {@code judgement/checker.py}. */
public enum CheckerType implements CodedEnum {
    LINES("lines"),
    TOKENS("tokens"),
    EXACT("exact");

    private final String code;

    CheckerType(String code) {
        this.code = code;
    }

    @Override
    public String code() {
        return code;
    }

    @Converter(autoApply = true)
    public static class DbConverter extends CodedEnumConverter<CheckerType> {
        public DbConverter() {
            super(CheckerType.class);
        }
    }
}
