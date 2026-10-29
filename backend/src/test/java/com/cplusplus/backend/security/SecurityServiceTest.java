package com.cplusplus.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.repository.UserSessionRepository;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
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
    @Mock ClassroomStudentRepository classroomStudents;

    @Test
    void loginDeterminesRoleFromStoredAccount() {
        User admin = User.admin(
                "admin",
                "Quản trị viên",
                new BCryptPasswordEncoder().encode("admin123")
        );
        when(users.findByUsernameIgnoreCase("AdMiN")).thenReturn(Optional.of(admin));
        SecurityService service = new SecurityService(users, sessions, classroomStudents);

        SecurityService.AuthResult result = service.login("  AdMiN  ", "admin123");

        assertThat(result.user()).isSameAs(admin);
        assertThat(result.user().isAdmin()).isTrue();
        assertThat(result.token()).isNotBlank();
    }

    @Test
    void rejectsStudentLoginWhenPasswordDoesNotMatch() {
        User student = User.student("B20DCCN001", "B20DCCN001");
        student.setPasswordHash(new BCryptPasswordEncoder().encode("CorrectPass2026"));
        when(users.findByUsernameIgnoreCase("B20DCCN001")).thenReturn(Optional.of(student));
        SecurityService service = new SecurityService(users, sessions, classroomStudents);

        assertThatThrownBy(() -> service.loginStudent("B20DCCN001", "WrongPass2026"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("MSSV hoặc mật khẩu không chính xác");
    }
}
