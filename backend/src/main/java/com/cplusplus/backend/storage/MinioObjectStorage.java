package com.cplusplus.backend.storage;

import io.minio.*;
import io.minio.http.Method;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.Map;

@Component
public class MinioObjectStorage implements ObjectStorage {
    private static final Logger log = LoggerFactory.getLogger(MinioObjectStorage.class);

    private final MinioClient client;
    private final String publicEndpoint;
    private final String bucket;

    public MinioObjectStorage(
            @Value("${app.storage.internal-endpoint:http://localhost:19000}") String internalEndpoint,
            @Value("${app.storage.public-endpoint:http://localhost:19000}") String publicEndpoint,
            @Value("${app.storage.access-key:minioadmin}") String accessKey,
            @Value("${app.storage.secret-key:minioadmin123}") String secretKey,
            @Value("${app.storage.bucket:course-materials}") String bucket) {
        this.client = MinioClient.builder().endpoint(internalEndpoint)
                .credentials(accessKey, secretKey).region("us-east-1").build();
        this.publicEndpoint = publicEndpoint.replaceAll("/+$", "");
        this.bucket = bucket;
    }

    @PostConstruct
    void initialize() {
        try {
            ensureBucket();
        } catch (Exception e) {
            log.warn("Object storage chưa sẵn sàng lúc khởi động: {}", e.getMessage());
        }
    }

    @Override public String bucket() { return bucket; }

    @Override
    public UploadForm createPdfUploadForm(String objectKey, long maxBytes, Duration ttl) {
        try {
            ensureBucket();
            PostPolicy policy = new PostPolicy(bucket, ZonedDateTime.now(ZoneOffset.UTC).plus(ttl));
            policy.addEqualsCondition("key", objectKey);
            policy.addEqualsCondition("Content-Type", "application/pdf");
            policy.addContentLengthRangeCondition(1, maxBytes);
            return new UploadForm(publicEndpoint + "/" + bucket, client.getPresignedPostFormData(policy));
        } catch (Exception e) {
            throw failure("Không thể tạo phiên upload", e);
        }
    }

    @Override
    public ObjectInfo stat(String objectKey) {
        try {
            StatObjectResponse result = client.statObject(StatObjectArgs.builder()
                    .bucket(bucket).object(objectKey).build());
            return new ObjectInfo(result.size(), result.etag(), result.contentType());
        } catch (Exception e) {
            throw failure("Không thể kiểm tra object", e);
        }
    }

    @Override
    public InputStream open(String objectKey) {
        try {
            return client.getObject(GetObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception e) {
            throw failure("Không thể đọc object", e);
        }
    }

    @Override
    public void put(String objectKey, InputStream input, long size, String contentType) {
        try {
            ensureBucket();
            client.putObject(PutObjectArgs.builder().bucket(bucket).object(objectKey)
                    .stream(input, size, -1).contentType(contentType).build());
        } catch (Exception e) {
            throw failure("Không thể lưu object", e);
        }
    }

    @Override
    public void promote(String sourceKey, String targetKey) {
        try {
            client.copyObject(CopyObjectArgs.builder().bucket(bucket).object(targetKey)
                    .source(CopySource.builder().bucket(bucket).object(sourceKey).build()).build());
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(sourceKey).build());
        } catch (Exception e) {
            throw failure("Không thể hoàn tất object", e);
        }
    }

    @Override
    public void delete(String objectKey) {
        try {
            client.removeObject(RemoveObjectArgs.builder().bucket(bucket).object(objectKey).build());
        } catch (Exception e) {
            throw failure("Không thể xóa object", e);
        }
    }

    @Override
    public String downloadUrl(String objectKey, String filename, Duration ttl) {
        try {
            String disposition = "attachment; filename*=UTF-8''" +
                    URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20");
            String signed = client.getPresignedObjectUrl(GetPresignedObjectUrlArgs.builder()
                    .method(Method.GET).bucket(bucket).object(objectKey)
                    .expiry((int) ttl.toSeconds())
                    .extraQueryParams(Map.of("response-content-disposition", disposition)).build());
            return signed.replaceFirst("^https?://[^/]+", publicEndpoint);
        } catch (Exception e) {
            throw failure("Không thể tạo URL tải", e);
        }
    }

    private void ensureBucket() throws Exception {
        if (!client.bucketExists(BucketExistsArgs.builder().bucket(bucket).build())) {
            client.makeBucket(MakeBucketArgs.builder().bucket(bucket).build());
        }
    }

    private IllegalStateException failure(String message, Exception cause) {
        return new IllegalStateException(message, cause);
    }
}
