package com.cplusplus.backend.domain.common;

import jakarta.persistence.AttributeConverter;

/** Chuyển {@link CodedEnum} <-> mã trong DB; mỗi enum có một lớp con {@code @Converter(autoApply = true)}. */
public abstract class CodedEnumConverter<E extends Enum<E> & CodedEnum> implements AttributeConverter<E, String> {

    private final Class<E> type;

    protected CodedEnumConverter(Class<E> type) {
        this.type = type;
    }

    @Override
    public String convertToDatabaseColumn(E attribute) {
        return attribute == null ? null : attribute.code();
    }

    @Override
    public E convertToEntityAttribute(String dbData) {
        return dbData == null ? null : CodedEnum.fromCode(type, dbData);
    }
}
