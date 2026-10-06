import { Avatar, Badge, Button, Dropdown, Layout, Menu, Space, Tag, Tooltip, Typography } from 'antd'
import {
  CodeOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  LogoutOutlined,
  MoonOutlined,
  OrderedListOutlined,
  ProfileOutlined,
  SunOutlined,
  TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { useSocketStatus } from '../lib/hooks'
import { USE_MOCK } from '../api'

const SOCKET_LABEL = {
  mock: { status: 'processing', text: 'Mock Master', tip: 'Đang dùng Master giả lập trong trình duyệt (VITE_USE_MOCK)' },
  open: { status: 'success', text: 'WS :8001', tip: 'Đã kết nối WebSocket RFC 6455 tới Master' },
  connecting: { status: 'warning', text: 'Đang kết nối…', tip: 'Đang kết nối WebSocket tới Master :8001' },
  closed: { status: 'error', text: 'Mất kết nối', tip: 'WebSocket bị ngắt – tự động thử lại' },
}

export default function AppLayout() {
  const { user, isAdmin, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const socket = SOCKET_LABEL[useSocketStatus()] || SOCKET_LABEL.connecting
  const location = useLocation()
  const navigate = useNavigate()

  const items = [
    ...(isAdmin
      ? [
          { key: '/admin', icon: <DashboardOutlined />, label: <Link to="/admin">Giám sát Worker</Link> },
          { key: '/admin/problems', icon: <DatabaseOutlined />, label: <Link to="/admin/problems">Ngân hàng đề</Link> },
          { key: '/admin/submissions', icon: <ProfileOutlined />, label: <Link to="/admin/submissions">Toàn bộ bài nộp</Link> },
        ]
      : [
          { key: '/problems', icon: <CodeOutlined />, label: <Link to="/problems">Bài tập</Link> },
          { key: '/submissions', icon: <OrderedListOutlined />, label: <Link to="/submissions">Bài nộp của tôi</Link> },
        ]),
    { key: '/leaderboard', icon: <TrophyOutlined />, label: <Link to="/leaderboard">Bảng xếp hạng</Link> },
  ]
  const selected =
    items
      .map((i) => i.key)
      .filter((k) => location.pathname === k || location.pathname.startsWith(`${k}/`))
      .sort((a, b) => b.length - a.length)[0] || (location.pathname.startsWith('/problems') ? '/problems' : '')

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Layout.Header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          borderBottom: '1px solid var(--border)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <Link to={isAdmin ? '/admin' : '/problems'} className="brand">
          <span className="brand-logo">
            <CodeOutlined />
          </span>
          <span>
            Code<b>Judge</b>
          </span>
          {isAdmin && (
            <Tag color="purple" style={{ marginInlineStart: 4 }}>
              Admin
            </Tag>
          )}
        </Link>
        <Menu mode="horizontal" items={items} selectedKeys={[selected]} className="header-menu" />
        <Space size={12}>
          <Tooltip title={socket.tip}>
            <Badge
              status={socket.status}
              text={
                <span className="mono" style={{ fontSize: 12 }}>
                  {socket.text}
                </span>
              }
            />
          </Tooltip>
          <Tooltip title={mode === 'dark' ? 'Giao diện sáng' : 'Giao diện tối'}>
            <Button type="text" icon={mode === 'dark' ? <SunOutlined /> : <MoonOutlined />} onClick={toggle} />
          </Tooltip>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'me',
                  disabled: true,
                  label: (
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{user.name}</div>
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
            <Avatar style={{ background: isAdmin ? '#7c3aed' : '#2563eb', cursor: 'pointer' }} icon={<UserOutlined />} />
          </Dropdown>
        </Space>
      </Layout.Header>
      <Layout.Content>
        <Outlet />
      </Layout.Content>
      {!location.pathname.match(/^\/problems\/\d+/) && (
        <Layout.Footer style={{ textAlign: 'center', padding: '14px 20px', fontSize: 12, color: 'var(--text-2)' }}>
          CodeJudge – Hệ thống chấm bài C++ phân tán · Master HTTP :8000 · WebSocket :8001 · Worker TCP :9000
          {USE_MOCK && ' · Chế độ mock'}
        </Layout.Footer>
      )}
    </Layout>
  )
}
