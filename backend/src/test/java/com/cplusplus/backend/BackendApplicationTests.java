package com.cplusplus.backend;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class BackendApplicationTests {

    /** Khởi động được nghĩa là Flyway đã chạy và mọi entity khớp lược đồ (ddl-auto: validate). */
    @Test
    void contextLoads() {
    }
}
