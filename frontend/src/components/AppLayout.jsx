import { Avatar, Button, Dropdown, Layout, Menu, Space, Tag, Tooltip, Typography } from 'antd'
import {
  BookOutlined,
  DashboardOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  ProfileOutlined,
  FlagOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { useSocketStatus } from '../lib/hooks'
import { USE_MOCK } from '../api'
import CyberBackground from './CyberBackground'

const SOCKET_LABEL = {
  mock: { status: 'processing', text: 'Mock Master', tip: 'Đang dùng Master giả lập trong trình duyệt (VITE_USE_MOCK)' },
  open: { status: 'success', text: 'WS :8001', tip: 'Đã kết nối WebSocket RFC 6455 tới Master' },
  connecting: { status: 'warning', text: 'Đang kết nối…', tip: 'Đang kết nối WebSocket tới Master :8001' },
  closed: { status: 'error', text: 'Mất kết nối', tip: 'WebSocket bị ngắt – tự động thử lại' },
}

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const isLecturer = user?.role === 'lecturer'
  const { mode, toggle } = useThemeMode()
  const socket = SOCKET_LABEL[useSocketStatus()] || SOCKET_LABEL.connecting
  const location = useLocation()
  const navigate = useNavigate()

  const items = [
    ...(isAdmin
      ? [
          { key: '/admin', icon: <CloudServerOutlined />, label: <Link to="/admin">Giám sát</Link> },
          { key: '/admin/overview', icon: <DashboardOutlined />, label: <Link to="/admin/overview">Tổng quan</Link> },
          { key: '/admin/submissions', icon: <ProfileOutlined />, label: <Link to="/admin/submissions">Bài nộp sinh viên</Link> },
          { key: '/admin/problems', icon: <DatabaseOutlined />, label: <Link to="/admin/problems">Đề bài</Link> },
          { key: '/admin/contests', icon: <FlagOutlined />, label: <Link to="/admin/contests">Kỳ thi</Link> },
          { key: '/admin/courses', icon: <BookOutlined />, label: <Link to="/admin/courses">Khóa học</Link> },
          { key: '/admin/classrooms', icon: <TeamOutlined />, label: <Link to="/admin/classrooms">Lớp học</Link> },
        ]
      : isLecturer ? [] : [
          { key: '/courses', label: <Link to="/courses">Khóa học</Link> },
          { key: '/playground', label: <Link to="/playground">Chạy thử</Link> },
          { key: '/problems', label: <Link to="/problems">Bài tập</Link> },
          { key: '/contests', label: <Link to="/contests">Kỳ thi</Link> },
          { key: '/submissions', label: <Link to="/submissions">Bài nộp</Link> },
          { key: '/my-classrooms', label: <Link to="/my-classrooms">Lớp học</Link> },
        ]),
    ...(isAdmin ? [{ key: '/leaderboard', icon: <TrophyOutlined />, label: <Link to="/leaderboard">Xếp hạng</Link> }] : [{ key: '/leaderboard', label: <Link to="/leaderboard">Xếp hạng</Link> }]),
  ]
  const selected =
    items
      .map((i) => i.key)
      .filter((k) => location.pathname === k || location.pathname.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)[0] ||
    (location.pathname.startsWith('/problems')
      ? isAdmin
        ? '/admin/problems'
        : '/problems'
      : location.pathname.startsWith('/contests')
        ? isAdmin
          ? '/admin/contests'
          : '/contests'
        : location.pathname.startsWith('/submissions')
          ? isAdmin
            ? '/admin/submissions'
            : '/submissions'
          : location.pathname.startsWith('/courses')
            ? isAdmin
              ? '/admin/courses'
              : '/courses'
            : '')

  return (
    <Layout className={isAdmin ? 'admin-layout' : 'student-layout'} style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      {isAdmin && <CyberBackground mode={mode} />}
      <Layout.Header
        className="app-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          height: 60,
          lineHeight: 'normal',
          padding: '0 24px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <Link to={isAdmin ? '/admin' : isLecturer ? '/leaderboard' : '/problems'} className="brand">
          <span>
            Code<b>Judge</b>
          </span>
          {isAdmin && (
            <Tag color="purple" style={{ marginInlineStart: 4, borderRadius: 999, fontWeight: 600 }}>
              Admin
            </Tag>
          )}
          {isLecturer && <Tag color="blue" style={{ marginInlineStart: 4, borderRadius: 999 }}>Giảng viên</Tag>}
        </Link>
        <Menu mode="horizontal" items={items} selectedKeys={[selected]} className="header-menu" />
        <Space size={8} align="center" style={{ lineHeight: 1 }}>
          {isAdmin && <Tooltip title={socket.tip}>
            <div className="header-status-pill">
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  backgroundColor:
                    socket.status === 'success'
                      ? '#10b981'
                      : socket.status === 'warning'
                      ? '#f59e0b'
                      : '#ef4444',
                  boxShadow:
                    socket.status === 'success'
                      ? '0 0 8px rgba(16, 185, 129, 0.7)'
                      : 'none',
                }}
              />
              <span>{socket.text}</span>
            </div>
          </Tooltip>}

          <Tooltip title={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
            <Button
              type="text"
              className="header-theme-btn"
              onClick={toggle}
              icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              aria-label={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            />
          </Tooltip>

          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'me',
                  disabled: true,
                  label: (
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{user.name}</div>
                      <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                        {user.id}
                      </Typography.Text>
                    </div>
                  ),
                },
                { type: 'divider' },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  danger: true,
                  label: 'Đăng xuất',
                  onClick: () => {
                    logout()
                    navigate('/login')
                  },
                },
              ],
            }}
          >
            <div className="header-user-pill">
              <Avatar
                size={26}
                style={{
                  background: isAdmin
                    ? 'linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
                  fontWeight: 700,
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                icon={<UserOutlined />}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--text)',
                  maxWidth: 110,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  lineHeight: 'normal',
                }}
              >
                {user.name}
              </span>
            </div>
          </Dropdown>
        </Space>
      </Layout.Header>
      <Layout.Content style={{ background: 'transparent', position: 'relative', zIndex: 1 }}>
        <Outlet />
      </Layout.Content>
      {isAdmin && !location.pathname.match(/^\/(problems\/\d+|contests\/\d+\/problems\/|courses\/\d+\/learn)/) && (
        <Layout.Footer style={{ textAlign: 'center', padding: '14px 20px', fontSize: 12, color: 'var(--text-2)' }}>
          CodeJudge – Hệ thống chấm bài C++ phân tán · Master HTTP :8082 · WebSocket :8001 · Worker TCP :9000
          {USE_MOCK && ' · Chế độ mock'}
        </Layout.Footer>
      )}
    </Layout>
  )
}
