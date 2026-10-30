import { Avatar, Button, Dropdown, Layout, Menu, Space, Tooltip, Typography } from 'antd'
import {
  BookOutlined,
  CloudServerOutlined,
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  KeyOutlined,
  OrderedListOutlined,
  ProfileOutlined,
  FlagOutlined,
  TeamOutlined,
  UserOutlined,
  UsergroupAddOutlined,
  SunOutlined,
  MoonOutlined,
  TrophyOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { useOnlineCount, useSocketStatus } from '../lib/hooks'
import CyberBackground from './CyberBackground'

const SOCKET_LABEL = {
  open: { status: 'success', text: 'WS :8001', tip: 'Đã kết nối WebSocket RFC 6455 tới Master' },
  connecting: { status: 'warning', text: 'Đang kết nối…', tip: 'Đang kết nối WebSocket tới Master :8001' },
  reconnecting: { status: 'warning', text: 'Đang thử lại…', tip: 'WebSocket bị ngắt – đang tự động kết nối lại' },
  disconnected: { status: 'error', text: 'Mất kết nối', tip: 'WebSocket chưa kết nối' },
  closed: { status: 'error', text: 'Mất kết nối', tip: 'WebSocket bị ngắt – tự động thử lại' },
}

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const socketStatus = useSocketStatus()
  const socket = SOCKET_LABEL[socketStatus] || SOCKET_LABEL.connecting
  const onlineCount = useOnlineCount()
  const location = useLocation()
  const navigate = useNavigate()

  const items = [
    ...(isAdmin
      ? [
          { key: '/admin/overview', icon: <DashboardOutlined />, label: <Link to="/admin/overview">Tổng quan</Link> },
          { key: '/admin', icon: <CloudServerOutlined />, label: <Link to="/admin">Giám sát</Link> },
          { key: '/admin/lecturers', icon: <UsergroupAddOutlined />, label: <Link to="/admin/lecturers">Giảng viên</Link> },
          { key: '/admin/submissions', icon: <ProfileOutlined />, label: <Link to="/admin/submissions">Bài nộp</Link> },
          { key: '/admin/problems', icon: <DatabaseOutlined />, label: <Link to="/admin/problems">Đề bài</Link> },
          { key: '/admin/contests', icon: <FlagOutlined />, label: <Link to="/admin/contests">Kỳ thi</Link> },
          { key: '/admin/courses', icon: <BookOutlined />, label: <Link to="/admin/courses">Khóa học</Link> },
          { key: '/admin/classrooms', icon: <TeamOutlined />, label: <Link to="/admin/classrooms">Lớp học</Link> },
          { key: '/leaderboard', icon: <TrophyOutlined />, label: <Link to="/leaderboard">Xếp hạng</Link> },
        ]
      : [
          { key: '/problems', icon: <CodeOutlined />, label: <Link to="/problems">Bài tập</Link> },
          { key: '/courses', icon: <BookOutlined />, label: <Link to="/courses">Khóa học</Link> },
          { key: '/contests', icon: <FlagOutlined />, label: <Link to="/contests">Kỳ thi</Link> },
          { key: '/submissions', icon: <OrderedListOutlined />, label: <Link to="/submissions">Bài nộp</Link> },
          { key: '/my-classrooms', icon: <TeamOutlined />, label: <Link to="/my-classrooms">Lớp học</Link> },
          { key: '/leaderboard', icon: <TrophyOutlined />, label: <Link to="/leaderboard">Xếp hạng</Link> },
        ]),
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
      <CyberBackground mode={mode} />
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
        <Link to={isAdmin ? '/admin' : '/problems'} className="brand">
          <span className="brand-logo">
            <CodeOutlined />
          </span>
          <span>
            Code<b>Judge</b>
          </span>
        </Link>
        <Menu mode="horizontal" items={items} selectedKeys={[selected]} className="header-menu" />
        <Space size={8} align="center" style={{ lineHeight: 1 }}>
          {isAdmin && <Tooltip title={
            socketStatus === 'open' && onlineCount != null
              ? `${onlineCount} sinh viên đang online`
              : socket.tip
          }>
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
              {socketStatus === 'open' && onlineCount != null ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <UsergroupAddOutlined style={{ fontSize: 12 }} />
                  {onlineCount}
                </span>
              ) : (
                <span>{socket.text}</span>
              )}
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
                  key: 'change-password',
                  icon: <KeyOutlined />,
                  label: 'Đổi mật khẩu',
                  onClick: () => navigate('/change-password'),
                },
                {
                  key: 'logout',
                  icon: <LogoutOutlined />,
                  danger: true,
                  label: 'Đăng xuất',
                  onClick: async () => {
                    if (await logout()) navigate('/login')
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
    </Layout>
  )
}
