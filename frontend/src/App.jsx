import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { App as AntApp, ConfigProvider, Spin } from 'antd'
import viVN from 'antd/locale/vi_VN'
import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AuthProvider from './auth/AuthProvider'
import { useAuth } from './auth/context'
import { buildTheme, ThemeModeContext } from './theme'
import AppLayout from './components/AppLayout'
import LoginPage from './pages/LoginPage'

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
const AdminProblemsPage = lazy(() => import('./pages/admin/AdminProblemsPage'))

const THEME_KEY = 'cj.theme'

function readTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || 'light'
  } catch {
    return 'light'
  }
}

function RequireAuth({ admin, children }) {
  const { user, isAdmin } = useAuth()
  const location = useLocation()
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (admin && !isAdmin) return <Navigate to="/problems" replace />
  return children
}

function AppRoutes() {
  const { user, isAdmin } = useAuth()
  const home = !user ? '/login' : isAdmin ? '/admin' : '/problems'
  return (
    <Suspense fallback={<Spin style={{ display: 'block', margin: 80 }} />}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route path="/problems" element={<ProblemsPage />} />
          <Route path="/problems/:id" element={<WorkspacePage />} />
          <Route path="/submissions" element={<SubmissionsPage />} />
          <Route path="/submissions/:id" element={<SubmissionDetailPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/contests" element={<ContestsPage />} />
          <Route path="/contests/:id" element={<ContestDetailPage />} />
          <Route path="/contests/:cid/problems/:label" element={<ContestWorkspacePage />} />
          <Route
            path="/admin"
            element={
              <RequireAuth admin>
                <AdminDashboardPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/problems"
            element={
              <RequireAuth admin>
                <AdminProblemsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/contests"
            element={
              <RequireAuth admin>
                <AdminContestsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/admin/submissions"
            element={
              <RequireAuth admin>
                <SubmissionsPage admin />
              </RequireAuth>
            }
          />
        </Route>
        <Route path="*" element={<Navigate to={home} replace />} />
      </Routes>
    </Suspense>
  )
}

export default function App() {
  const [mode, setMode] = useState(readTheme)
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
