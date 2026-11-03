package com.cplusplus.backend.service;

import com.cplusplus.backend.domain.course.CourseUnit;
import com.cplusplus.backend.domain.course.UserUnitProgress;
import com.cplusplus.backend.domain.user.User;
import com.cplusplus.backend.repository.CourseUnitProblemRepository;
import com.cplusplus.backend.repository.CourseUnitRepository;
import com.cplusplus.backend.repository.UserUnitProgressRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CourseProgressServiceTest {

    @Mock CourseUnitProblemRepository unitProblems;
    @Mock UserUnitProgressRepository progress;
    @Mock CourseUnitRepository units;
    @Mock User user;
    @Mock CourseUnit unit;
    @InjectMocks CourseProgressService service;

    @Test
    void firstManualClickCanUndoCompletionInheritedFromAcceptedSubmission() {
        when(user.getId()).thenReturn(7L);
        when(unit.getId()).thenReturn(9L);
        when(units.findById(9L)).thenReturn(Optional.of(unit));
        when(progress.findByUserIdAndUnitId(7L, 9L)).thenReturn(Optional.empty());
        when(progress.hasAcceptedProblemInUnit(7L, 9L)).thenReturn(true);

        boolean completed = service.toggleUnitProgress(user, 9L);

        ArgumentCaptor<UserUnitProgress> saved = ArgumentCaptor.forClass(UserUnitProgress.class);
        verify(progress).save(saved.capture());
        assertThat(completed).isFalse();
        assertThat(saved.getValue().isCompleted()).isFalse();
    }

    @Test
    void firstManualClickCompletesFreshUnit() {
        when(user.getId()).thenReturn(7L);
        when(unit.getId()).thenReturn(9L);
        when(units.findById(9L)).thenReturn(Optional.of(unit));
        when(progress.findByUserIdAndUnitId(7L, 9L)).thenReturn(Optional.empty());

        boolean completed = service.toggleUnitProgress(user, 9L);

        ArgumentCaptor<UserUnitProgress> saved = ArgumentCaptor.forClass(UserUnitProgress.class);
        verify(progress).save(saved.capture());
        assertThat(completed).isTrue();
        assertThat(saved.getValue().isCompleted()).isTrue();
    }
}
