package com.cplusplus.backend.storage;

import java.io.InputStream;
import java.time.Duration;
import java.util.Map;

public interface ObjectStorage {
    record UploadForm(String url, Map<String, String> fields) {}
    record ObjectInfo(long size, String checksum, String contentType) {}

    String bucket();
    UploadForm createPdfUploadForm(String objectKey, long maxBytes, Duration ttl);
    ObjectInfo stat(String objectKey);
    InputStream open(String objectKey);
    void put(String objectKey, InputStream input, long size, String contentType);
    void promote(String sourceKey, String targetKey);
    void delete(String objectKey);
    String downloadUrl(String objectKey, String filename, Duration ttl);
}
