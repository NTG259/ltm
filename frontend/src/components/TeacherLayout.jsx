import { Avatar, Button, Dropdown, Layout, Menu, Typography } from 'antd'
import {
  CodeOutlined,
  LogoutOutlined,
  TeamOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
  FlagOutlined,
  DatabaseOutlined,
  BookOutlined,
  TrophyOutlined,
  OrderedListOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import CyberBackground from './CyberBackground'

export default function TeacherLayout() {
  const { user, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const location = useLocation()
  const navigate = useNavigate()

  const items = [
    { key: '/teacher/classrooms', icon: <TeamOutlined />, label: <Link to="/teacher/classrooms">Lớp học</Link> },
    { key: '/teacher/courses', icon: <BookOutlined />, label: <Link to="/teacher/courses">Khóa học</Link> },
    { key: '/teacher/problems', icon: <DatabaseOutlined />, label: <Link to="/teacher/problems">Kho đề</Link> },
    { key: '/teacher/contests', icon: <FlagOutlined />, label: <Link to="/teacher/contests">Kỳ thi</Link> },
    { key: '/teacher/submissions', icon: <OrderedListOutlined />, label: <Link to="/teacher/submissions">Bài nộp</Link> },
    { key: '/teacher/leaderboard', icon: <TrophyOutlined />, label: <Link to="/teacher/leaderboard">Xếp hạng</Link> },
  ]

  const selected = items
    .map((i) => i.key)
    .filter((k) => location.pathname === k || location.pathname.startsWith(k + '/'))
    .sort((a, b) => b.length - a.length)[0] || ''

  return (
    <Layout style={{ minHeight: '100vh', background: 'transparent', position: 'relative' }}>
      <CyberBackground mode={mode} />
      <Layout.Header
        className="app-header"
        style={{
          display: 'flex', alignItems: 'center', gap: 16,
          height: 60, lineHeight: 'normal', padding: '0 24px',
          position: 'sticky', top: 0, zIndex: 100,
        }}
      >
        <Link to="/teacher/classrooms" className="brand">
          <span className="brand-logo"><CodeOutlined /></span>
          <span>Code<b>Judge</b></span>
        </Link>

        <Menu mode="horizontal" items={items} selectedKeys={[selected]} className="header-menu" />

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button
            type="text"
            className="header-theme-btn"
            onClick={toggle}
            icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
          />
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                {
                  key: 'me', disabled: true,
                  label: (
                    <div style={{ padding: '4px 0' }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{user.name}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>Giảng viên</Typography.Text>
                    </div>
                  ),
                },
                { type: 'divider' },
                {
                  key: 'logout', icon: <LogoutOutlined />, danger: true, label: 'Đăng xuất',
                  onClick: async () => { await logout(); navigate('/login') },
                },
              ],
            }}
          >
            <div className="header-user-pill">
              <Avatar
                size={26}
                style={{ background: 'linear-gradient(135deg, #7c3aed 0%, #d946ef 100%)', fontWeight: 700, fontSize: 12 }}
                icon={<UserOutlined />}
              />
              <span style={{ fontSize: 13, fontWeight: 600, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.name}
              </span>
            </div>
          </Dropdown>
        </div>
      </Layout.Header>
      <Layout.Content style={{ background: 'transparent', position: 'relative', zIndex: 1 }}>
        <Outlet />
      </Layout.Content>
    </Layout>
  )
}
