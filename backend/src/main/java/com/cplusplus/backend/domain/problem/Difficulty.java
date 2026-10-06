package com.cplusplus.backend.domain.problem;

import com.cplusplus.backend.domain.common.CodedEnum;
import com.cplusplus.backend.domain.common.CodedEnumConverter;
import jakarta.persistence.Converter;

/** Độ khó đề bài. */
public enum Difficulty implements CodedEnum {
    EASY("easy"),
    MEDIUM("medium"),
    HARD("hard");

    private final String code;

    Difficulty(String code) {
        this.code = code;
    }

    @Override
    public String code() {
        return code;
    }

    @Converter(autoApply = true)
    public static class DbConverter extends CodedEnumConverter<Difficulty> {
        public DbConverter() {
            super(Difficulty.class);
        }
    }
}
