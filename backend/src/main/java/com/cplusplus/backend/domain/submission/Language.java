package com.cplusplus.backend.domain.submission;

import com.cplusplus.backend.domain.common.CodedEnum;
import com.cplusplus.backend.domain.common.CodedEnumConverter;
import jakarta.persistence.Converter;

/** Ngôn ngữ được hỗ trợ. */
public enum Language implements CodedEnum {
    CPP17("cpp17", "C++17");

    private final String code;
    private final String label;

    Language(String code, String label) {
        this.code = code;
        this.label = label;
    }

    @Override
    public String code() {
        return code;
    }

    public String label() {
        return label;
    }

    @Converter(autoApply = true)
    public static class DbConverter extends CodedEnumConverter<Language> {
        public DbConverter() {
            super(Language.class);
        }
    }
}
