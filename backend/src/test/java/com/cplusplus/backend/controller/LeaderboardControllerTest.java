package com.cplusplus.backend.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.cplusplus.backend.TestcontainersConfiguration;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.AuthInterceptor;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
@Transactional
class LeaderboardControllerTest {
    @Autowired LeaderboardController leaderboard;
    @Autowired UserRepository users;
    @Autowired JdbcTemplate jdbc;

    @Test
    void ranksClassByAcThenAttemptsAndCountsDistinctSolvers() {
        User a = users.save(User.student("B99DCCN001", "Sinh viên A"));
        User b = users.save(User.student("B99DCCN002", "Sinh viên B"));
        User c = users.save(User.student("B99DCCN003", "Sinh viên C"));
        Long classId = jdbc.queryForObject("INSERT INTO classrooms (name) VALUES ('Lớp kiểm thử') RETURNING id", Long.class);
        for (User u : List.of(a, b, c))
            jdbc.update("INSERT INTO classroom_students (classroom_id, user_id) VALUES (?, ?)", classId, u.getId());
        Long p1 = problem("Bài A");
        Long p2 = problem("Bài B");
        Instant base = Instant.parse("2026-10-01T00:00:00Z");
        submission(a, p1, "WA", base.plusSeconds(60));
        submission(a, p1, "AC", base.plusSeconds(120));
        submission(a, p2, "AC", base.plusSeconds(180));
        submission(b, p1, "AC", base.plusSeconds(240));
        submission(b, p2, "AC", base.plusSeconds(300));

        var students = leaderboard.students(classId, request(a));
        @SuppressWarnings("unchecked")
        var rows = (List<Map<String, Object>>) students.get("rows");
        assertThat(rows).extracting(r -> r.get("userId")).containsExactly("B99DCCN002", "B99DCCN001", "B99DCCN003");
        assertThat(rows).extracting(r -> r.get("rank")).containsExactly(1L, 2L, 3L);
        assertThat(rows).extracting(r -> r.get("attempts")).containsExactly(2L, 3L, 0L);

        var admin = users.save(User.admin("rankadmin", "Admin", "hash"));
        var problemResult = leaderboard.problems(classId, request(admin));
        @SuppressWarnings("unchecked")
        var problems = (List<Map<String, Object>>) problemResult.get("rows");
        Map<String, Object> first = problems.stream().filter(r -> r.get("problemId").equals(p1)).findFirst().orElseThrow();
        assertThat(first).containsEntry("submissions", 3L).containsEntry("attemptedUsers", 2L)
                .containsEntry("acceptedUsers", 2L);
        @SuppressWarnings("unchecked")
        var detail = (List<Map<String, Object>>) leaderboard.problemDetails(p1, classId, request(admin)).get("rows");
        assertThat(detail).hasSize(2);
        assertThat(detail).extracting(r -> r.get("submissions")).containsExactlyInAnyOrder(2L, 1L);
    }

    @Test
    void limitsStudentsAndLecturersToAssignedClasses() {
        User student = users.save(User.student("B99DCCN004", "Sinh viên D"));
        User lecturer = users.save(User.lecturer("lecturer_test", "Giảng viên", "hash"));
        Long allowed = jdbc.queryForObject("INSERT INTO classrooms (name, created_by) VALUES ('Lớp được xem', ?) RETURNING id", Long.class, lecturer.getId());
        Long denied = jdbc.queryForObject("INSERT INTO classrooms (name) VALUES ('Lớp khác') RETURNING id", Long.class);
        jdbc.update("INSERT INTO classroom_students (classroom_id, user_id) VALUES (?, ?)", allowed, student.getId());

        assertThat(leaderboard.classrooms(request(student))).extracting(r -> r.get("id")).containsExactly(allowed);
        assertThat(leaderboard.classrooms(request(lecturer))).extracting(r -> r.get("id")).containsExactly(allowed);
        assertThatThrownBy(() -> leaderboard.students(denied, request(student)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> leaderboard.problems(allowed, request(student)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> leaderboard.problemDetails(1L, allowed, request(student)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
        assertThatThrownBy(() -> leaderboard.problems(denied, request(lecturer)))
                .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    private Long problem(String title) {
        return jdbc.queryForObject("INSERT INTO problems (title, statement) VALUES (?, 'test') RETURNING id", Long.class, title);
    }

    private void submission(User user, Long problemId, String verdict, Instant createdAt) {
        jdbc.update("""
                INSERT INTO submissions (user_id, problem_id, source_code, time_limit_ms, memory_limit_mb,
                                         status, verdict, score, created_at, finished_at)
                VALUES (?, ?, 'int main(){}', 1000, 256, 'FINISHED', ?, ?, ?, ?)
                """, user.getId(), problemId, verdict, verdict.equals("AC") ? 100 : 0,
                Timestamp.from(createdAt), Timestamp.from(createdAt.plusSeconds(1)));
    }

    private MockHttpServletRequest request(User user) {
        var request = new MockHttpServletRequest();
        request.setAttribute(AuthInterceptor.CURRENT_USER_ATTR, user);
        return request;
    }
}
