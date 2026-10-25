package com.cplusplus.backend.security;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.repository.UserSessionRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;

@ExtendWith(MockitoExtension.class)
class SecurityServiceTest {

    @Mock UserRepository users;
    @Mock UserSessionRepository sessions;

    @Test
    void rejectsStudentLoginWhenPasswordDoesNotMatch() {
        User student = User.student("B20DCCN001", "B20DCCN001");
        student.setPasswordHash(new BCryptPasswordEncoder().encode("CorrectPass2026"));
        when(users.findByUsernameIgnoreCase("B20DCCN001")).thenReturn(Optional.of(student));
        SecurityService service = new SecurityService(users, sessions);

        assertThatThrownBy(() -> service.loginStudent("B20DCCN001", "WrongPass2026"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("MSSV hoặc mật khẩu không chính xác");
    }
}
