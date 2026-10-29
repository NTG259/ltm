package com.cplusplus.backend.repository;

import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.domain.user.Role;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    /** Dùng upper(username) nên khớp chỉ mục ux_users_username. */
    Optional<User> findByUsernameIgnoreCase(String username);

    List<User> findByRoleOrderByFullNameAsc(Role role);
}
