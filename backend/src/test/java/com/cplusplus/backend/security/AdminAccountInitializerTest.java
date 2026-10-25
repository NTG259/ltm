package com.cplusplus.backend.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AdminAccountInitializerTest {

    @Mock UserRepository users;
    @Mock SecurityService security;

    @Test
    void createsAdminWhenItDoesNotExist() {
        when(users.findByUsernameIgnoreCase("admin")).thenReturn(Optional.empty());
        when(security.hashPassword("safe-admin-password")).thenReturn("bcrypt-hash");

        new AdminAccountInitializer(users, security, "safe-admin-password").initialize();

        ArgumentCaptor<User> admin = ArgumentCaptor.forClass(User.class);
        verify(users).save(admin.capture());
        assertThat(admin.getValue().isAdmin()).isTrue();
        assertThat(admin.getValue().getUsername()).isEqualTo("admin");
        assertThat(admin.getValue().getPasswordHash()).isEqualTo("bcrypt-hash");
    }

    @Test
    void leavesExistingAdminUntouched() {
        when(users.findByUsernameIgnoreCase("admin"))
                .thenReturn(Optional.of(User.admin("admin", "Administrator", "existing-hash")));

        new AdminAccountInitializer(users, security, "safe-admin-password").initialize();

        verify(security, never()).hashPassword(any());
        verify(users, never()).save(any(User.class));
    }
}
