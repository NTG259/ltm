package com.cplusplus.backend.domain.submission;

import com.cplusplus.backend.domain.common.CodedEnum;
import com.cplusplus.backend.domain.common.CodedEnumConverter;
import jakarta.persistence.Converter;

/** Ngôn ngữ được hỗ trợ. */
public enum Language implements CodedEnum {
    CPP17("cpp17");

    private final String code;

    Language(String code) {
        this.code = code;
    }

    @Override
    public String code() {
        return code;
    }

    @Converter(autoApply = true)
    public static class DbConverter extends CodedEnumConverter<Language> {
        public DbConverter() {
            super(Language.class);
        }
    }
}
