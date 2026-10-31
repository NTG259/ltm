import { Avatar, Button, Dropdown, Layout, Menu, Space, Tooltip, Typography } from 'antd'
import {
  BookOutlined,
  CodeOutlined,
  FlagOutlined,
  KeyOutlined,
  LogoutOutlined,
  OrderedListOutlined,
  TeamOutlined,
  TrophyOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import CyberBackground from './CyberBackground'

export default function StudentLayout() {
  const { user, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const location = useLocation()
  const navigate = useNavigate()

  const items = [
    { key: '/problems', icon: <CodeOutlined />, label: <Link to="/problems">Bài tập</Link> },
    { key: '/courses', icon: <BookOutlined />, label: <Link to="/courses">Khóa học</Link> },
    { key: '/contests', icon: <FlagOutlined />, label: <Link to="/contests">Kỳ thi</Link> },
    { key: '/submissions', icon: <OrderedListOutlined />, label: <Link to="/submissions">Bài nộp</Link> },
    { key: '/my-classrooms', icon: <TeamOutlined />, label: <Link to="/my-classrooms">Lớp học</Link> },
    { key: '/leaderboard', icon: <TrophyOutlined />, label: <Link to="/leaderboard">Xếp hạng</Link> },
  ]

  const selected =
    items
      .map((i) => i.key)
      .filter((k) => location.pathname === k || location.pathname.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)[0] ||
    (location.pathname.startsWith('/problems')
      ? '/problems'
      : location.pathname.startsWith('/contests')
      ? '/contests'
      : location.pathname.startsWith('/submissions')
      ? '/submissions'
      : location.pathname.startsWith('/courses')
      ? '/courses'
      : '')

  return (
    <Layout className="student-layout" style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
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
        <Link to="/problems" className="brand">
          <span className="brand-logo">
            <CodeOutlined />
          </span>
          <span>
            Code<b>Judge</b>
          </span>
        </Link>
        <Menu mode="horizontal" items={items} selectedKeys={[selected]} className="header-menu" />
        <Space size={8} align="center" style={{ lineHeight: 1 }}>
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
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{user?.name}</div>
                      <Typography.Text type="secondary" className="mono" style={{ fontSize: 12 }}>
                        {user?.id}
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
                  background: 'linear-gradient(135deg, #4f46e5 0%, #8b5cf6 100%)',
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
                {user?.name}
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

