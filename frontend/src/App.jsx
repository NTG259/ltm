import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/context'
import { buildTheme, ThemeModeContext } from './theme'
import StudentLayout from './components/StudentLayout'
import AdminLayout from './components/AdminLayout'
import TeacherLayout from './components/TeacherLayout'
import LoginPage from './pages/LoginPage'
import ErrorBoundary from './components/ErrorBoundary'

const ProblemsPage = lazy(() => import('./pages/ProblemsPage'))
const WorkspacePage = lazy(() => import('./pages/WorkspacePage'))
const SubmissionsPage = lazy(() => import('./pages/SubmissionsPage'))
const SubmissionDetailPage = lazy(() => import('./pages/SubmissionDetailPage'))
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'))
const ContestsPage = lazy(() => import('./pages/ContestsPage'))
const ContestDetailPage = lazy(() => import('./pages/ContestDetailPage'))
const ContestWorkspacePage = lazy(() => import('./pages/ContestWorkspacePage'))
const AdminContestsPage = lazy(() => import('./pages/admin/AdminContestsPage'))
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'))
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'))
const AdminLecturersPage = lazy(() => import('./pages/admin/AdminLecturersPage'))
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'))
const AdminProblemsPage = lazy(() => import('./pages/admin/AdminProblemsPage'))
const AdminClassroomsPage = lazy(() => import('./pages/admin/AdminClassroomsPage'))
const AdminClassroomDetailPage = lazy(() => import('./pages/admin/AdminClassroomDetailPage'))
const AdminClassroomMonitorPage = lazy(() => import('./pages/admin/AdminClassroomMonitorPage'))
const AdminContestMonitorPage = lazy(() => import('./pages/admin/AdminContestMonitorPage'))
const MyClassroomsPage = lazy(() => import('./pages/MyClassroomsPage'))
const MyClassroomDetailPage = lazy(() => import('./pages/MyClassroomDetailPage'))
const CourseListPage = lazy(() => import('./pages/Courses/CourseListPage'))
const CourseDetailPage = lazy(() => import('./pages/Courses/CourseDetailPage'))
const CourseLearnPage = lazy(() => import('./pages/Courses/CourseLearnPage'))
const AdminCoursesPage = lazy(() => import('./pages/admin/AdminCoursesPage'))
const AdminCourseEditPage = lazy(() => import('./pages/admin/AdminCourseEditPage'))
const TeacherClassroomsPage = lazy(() => import('./pages/teacher/TeacherClassroomsPage'))
const TeacherClassroomDetailPage = lazy(() => import('./pages/teacher/TeacherClassroomDetailPage'))
const TeacherProblemsPage = lazy(() => import('./pages/teacher/TeacherProblemsPage'))
const TeacherContestsPage = lazy(() => import('./pages/teacher/TeacherContestsPage'))

const THEME_KEY = 'cj.theme'

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'light'
  } catch {
    return 'light'
  }
}

function getHomePath(user) {
  if (!user) return '/login'
  if (user.role === 'admin') return '/admin/overview'
  if (user.role === 'lecturer') return '/teacher/classrooms'
  return '/problems'
}

function RequireRole({ allowedRoles, children }) {
  const { user, initializing } = useAuth()
  const location = useLocation()

  if (initializing) {
    return <Spin style={{ display: 'block', margin: 80 }} />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  // Chuyển hướng thông minh khi Admin hoặc Giảng viên mở liên kết bài tập /problems/:id
  if (location.pathname.startsWith('/problems/')) {
    const match = location.pathname.match(/^\/problems\/(\d+)$/)
    if (match) {
      const id = match[1]
      if (user.role === 'admin') return <Navigate to={`/admin/problems/${id}`} replace />
      if (user.role === 'lecturer') return <Navigate to={`/teacher/problems/${id}`} replace />
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Ngăn chặn truy cập chéo giữa các actor: chuyển hướng về đúng trang chủ của vai trò
    return <Navigate to={getHomePath(user)} replace />
  }

  return children
}

function AppRoutes() {
  const { user, initializing } = useAuth()
  const home = getHomePath(user)

  if (initializing) {
    return <Spin style={{ display: 'block', margin: 80 }} />
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={<Spin style={{ display: 'block', margin: 80 }} />}>
        <Routes>
          <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage />} />

          {/* 1. Student routes (Dành riêng cho sinh viên) */}
          <Route
            element={
              <RequireRole allowedRoles={['student']}>
                <StudentLayout />
              </RequireRole>
            }
          >
            <Route path="/problems" element={<ProblemsPage />} />
            <Route path="/problems/:id" element={<WorkspacePage />} />
            <Route path="/courses" element={<CourseListPage />} />
            <Route path="/courses/:id" element={<CourseDetailPage />} />
            <Route path="/courses/:courseId/learn" element={<CourseLearnPage />} />
            <Route path="/courses/:courseId/learn/:unitId" element={<CourseLearnPage />} />
            <Route path="/contests" element={<ContestsPage />} />
            <Route path="/contests/:id" element={<ContestDetailPage />} />
            <Route path="/contests/:cid/problems/:label" element={<ContestWorkspacePage />} />
            <Route path="/submissions" element={<SubmissionsPage />} />
            <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="/my-classrooms" element={<MyClassroomsPage />} />
            <Route path="/classrooms/:id" element={<MyClassroomDetailPage />} />
            <Route path="/leaderboard" element={<LeaderboardPage />} />
            <Route path="/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* 2. Admin routes (Dành riêng cho quản trị viên) */}
          <Route
            element={
              <RequireRole allowedRoles={['admin']}>
                <AdminLayout />
              </RequireRole>
            }
          >
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/overview" element={<AdminOverviewPage />} />
            <Route path="/admin/lecturers" element={<AdminLecturersPage />} />
            <Route path="/admin/problems" element={<AdminProblemsPage />} />
            <Route path="/admin/problems/:id" element={<WorkspacePage />} />
            <Route path="/admin/contests" element={<AdminContestsPage />} />
            <Route path="/admin/contests/:id" element={<ContestDetailPage />} />
            <Route path="/admin/contests/:cid/problems/:label" element={<ContestWorkspacePage />} />
            <Route path="/admin/courses" element={<AdminCoursesPage />} />
            <Route path="/admin/courses/:id" element={<AdminCourseEditPage />} />
            <Route path="/admin/submissions" element={<SubmissionsPage admin />} />
            <Route path="/admin/submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="/admin/classrooms" element={<AdminClassroomsPage />} />
            <Route path="/admin/classrooms/:id" element={<AdminClassroomDetailPage />} />
            <Route path="/admin/classrooms/:id/monitor" element={<AdminClassroomMonitorPage />} />
            <Route path="/admin/classrooms/:cid/contests/:kid/monitor" element={<AdminContestMonitorPage />} />
            <Route path="/admin/leaderboard" element={<LeaderboardPage />} />
          </Route>

          {/* 3. Teacher routes (Dành riêng cho giảng viên) */}
          <Route
            element={
              <RequireRole allowedRoles={['lecturer']}>
                <TeacherLayout />
              </RequireRole>
            }
          >
            <Route path="/teacher/classrooms" element={<TeacherClassroomsPage />} />
            <Route path="/teacher/classrooms/:id" element={<TeacherClassroomDetailPage />} />
            <Route path="/teacher/problems" element={<AdminProblemsPage teacher />} />
            <Route path="/teacher/problems/:id" element={<WorkspacePage />} />
            <Route path="/teacher/courses" element={<AdminCoursesPage teacher />} />
            <Route path="/teacher/courses/:id" element={<AdminCourseEditPage teacher />} />
            <Route path="/teacher/contests" element={<AdminContestsPage teacher />} />
            <Route path="/teacher/contests/:id" element={<ContestDetailPage />} />
            <Route path="/teacher/contests/:cid/problems/:label" element={<ContestWorkspacePage />} />
            <Route path="/teacher/submissions" element={<SubmissionsPage teacher />} />
            <Route path="/teacher/submissions/:id" element={<SubmissionDetailPage />} />
            <Route path="/teacher/classrooms/:cid/contests/:kid/monitor" element={<AdminContestMonitorPage teacher />} />
            <Route path="/teacher/leaderboard" element={<LeaderboardPage />} />
            <Route path="/teacher/change-password" element={<ChangePasswordPage />} />
          </Route>

          {/* Route mặc định / URL không khớp: chuyển hướng về đúng trang chủ của actor */}
          <Route path="*" element={<Navigate to={home} replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  )
}

export default function App() {
  const [mode, setMode] = useState(readTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', mode)
    document.body.setAttribute('data-theme', mode)
  }, [mode])

  const toggle = useCallback(() => {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* ignore */
      }
      return next
    })
  }, [])
  const themeCtx = useMemo(() => ({ mode, toggle }), [mode, toggle])

  return (
    <ThemeModeContext.Provider value={themeCtx}>
      <ConfigProvider theme={buildTheme(mode)} locale={viVN}>
        <AntApp>
          <div className="app-root" data-theme={mode}>
            <AuthProvider>
              <HashRouter>
                <AppRoutes />
              </HashRouter>
            </AuthProvider>
          </div>
        </AntApp>
      </ConfigProvider>
    </ThemeModeContext.Provider>
  )
}
