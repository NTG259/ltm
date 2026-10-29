package com.cplusplus.backend.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.cplusplus.backend.domain.classroom.Classroom;
import com.cplusplus.backend.domain.classroom.ClassroomStudent;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.ClassroomStudentRepository;
import com.cplusplus.backend.repository.UserRepository;
import com.cplusplus.backend.security.SecurityService;
import java.nio.charset.StandardCharsets;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

@ExtendWith(MockitoExtension.class)
class ClassroomCsvImporterTest {

    @Mock UserRepository users;
    @Mock ClassroomStudentRepository classroomStudents;
    @Mock SecurityService security;
    @Mock Classroom classroom;

    @Test
    void hashesLoginPasswordAndRetainsImportedPasswordForAdmin() {
        MockMultipartFile csv = new MockMultipartFile(
                "file", "accounts.csv", "text/csv",
                ("mssv,password\nB20DCCN001,TestPass2026!\n").getBytes(StandardCharsets.UTF_8));
        when(classroom.getId()).thenReturn(1L);
        when(users.findByUsernameIgnoreCase("B20DCCN001")).thenReturn(Optional.empty());
        when(security.hashPassword("TestPass2026!")).thenReturn("bcrypt-hash");
        when(users.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var result = new ClassroomCsvImporter(users, classroomStudents, security).importTo(classroom, csv);

        ArgumentCaptor<User> user = ArgumentCaptor.forClass(User.class);
        verify(users).save(user.capture());
        assertThat(result.get("imported")).isEqualTo(1);
        assertThat(user.getValue().getUsername()).isEqualTo("B20DCCN001");
        assertThat(user.getValue().getPasswordHash()).isEqualTo("bcrypt-hash");
        assertThat(user.getValue().getPasswordHash()).isNotEqualTo("TestPass2026!");
        ArgumentCaptor<ClassroomStudent> enrollment = ArgumentCaptor.forClass(ClassroomStudent.class);
        verify(classroomStudents).save(enrollment.capture());
        assertThat(enrollment.getValue().getImportedPassword()).isEqualTo("TestPass2026!");
    }

    @Test
    void enrollsExistingStudentIntoNewClassroomWithoutOverwritingPassword() {
        MockMultipartFile csv = new MockMultipartFile(
                "file", "accounts.csv", "text/csv",
                ("mssv,password\nB20DCCN001,AnotherPass2026!\n").getBytes(StandardCharsets.UTF_8));
        User existingStudent = org.mockito.Mockito.mock(User.class);
        when(classroom.getId()).thenReturn(1L);
        when(existingStudent.getId()).thenReturn(2L);
        when(users.findByUsernameIgnoreCase("B20DCCN001")).thenReturn(Optional.of(existingStudent));
        when(classroomStudents.existsByClassroomIdAndUserId(1L, 2L)).thenReturn(false);

        var result = new ClassroomCsvImporter(users, classroomStudents, security).importTo(classroom, csv);

        assertThat(result.get("imported")).isEqualTo(1);
        verify(classroomStudents).save(any(ClassroomStudent.class));
    }

    @Test
    void skipsStudentAlreadyEnrolledInThisClassroom() {
        MockMultipartFile csv = new MockMultipartFile(
                "file", "accounts.csv", "text/csv",
                ("mssv,password\nB20DCCN001,AnotherPass2026!\n").getBytes(StandardCharsets.UTF_8));
        User existingStudent = org.mockito.Mockito.mock(User.class);
        when(classroom.getId()).thenReturn(1L);
        when(existingStudent.getId()).thenReturn(2L);
        when(users.findByUsernameIgnoreCase("B20DCCN001")).thenReturn(Optional.of(existingStudent));
        when(classroomStudents.existsByClassroomIdAndUserId(1L, 2L)).thenReturn(true);

        var result = new ClassroomCsvImporter(users, classroomStudents, security).importTo(classroom, csv);

        assertThat(result.get("imported")).isEqualTo(0);
        assertThat(result.get("alreadyEnrolled")).isEqualTo(1);
        verify(classroomStudents, never()).save(any());
    }
}
