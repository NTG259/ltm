package com.cplusplus.backend.security;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

/** Ensures a fresh or repaired database always has an administrator account. */
@Component
public class AdminAccountInitializer implements ApplicationRunner {

    private static final String ADMIN_USERNAME = "admin";
    private static final String ADMIN_NAME = "Quản trị viên";

    private final UserRepository userRepository;
    private final SecurityService securityService;
    private final String adminPassword;

    public AdminAccountInitializer(UserRepository userRepository,
                                   SecurityService securityService,
                                   @Value("${ADMIN_PASSWORD:admin123}") String adminPassword) {
        this.userRepository = userRepository;
        this.securityService = securityService;
        this.adminPassword = adminPassword;
    }

    @Override
    public void run(ApplicationArguments args) {
        initialize();
    }

    void initialize() {
        if (userRepository.findByUsernameIgnoreCase(ADMIN_USERNAME).isPresent()) {
            return;
        }

        String passwordHash = securityService.hashPassword(adminPassword);
        userRepository.save(User.admin(ADMIN_USERNAME, ADMIN_NAME, passwordHash));
    }
}
