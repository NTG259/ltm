package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.user.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    /** Dùng upper(username) nên khớp chỉ mục ux_users_username. */
    Optional<User> findByUsernameIgnoreCase(String username);
}
