import { useState } from 'react'
import { Avatar, Button, Drawer, Dropdown, Layout, Space, Tooltip, Typography } from 'antd'
import { MenuOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { useOnlineCount, useSocketStatus } from '../lib/hooks'

const SOCKET_LABEL = {
  open: { status: 'success', text: 'Trực tuyến', tip: 'Đã kết nối WebSocket tới Master' },
  connecting: { status: 'warning', text: 'Đang kết nối', tip: 'Đang kết nối WebSocket tới Master' },
  reconnecting: { status: 'warning', text: 'Đang thử lại', tip: 'WebSocket bị ngắt, hệ thống đang kết nối lại' },
  disconnected: { status: 'error', text: 'Mất kết nối', tip: 'WebSocket chưa kết nối' },
  closed: { status: 'error', text: 'Mất kết nối', tip: 'WebSocket bị ngắt, hệ thống sẽ tự thử lại' },
}

const NAV_GROUPS = [
  {
    label: 'Vận hành',
    items: [
      { key: '/admin/overview', label: 'Tổng quan' },
      { key: '/admin', label: 'Giám sát máy chấm', exact: true },
      { key: '/admin/submissions', label: 'Bài nộp' },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { key: '/admin/lecturers', label: 'Giảng viên' },
      { key: '/admin/problems', label: 'Đề bài' },
      { key: '/admin/contests', label: 'Kỳ thi' },
      { key: '/admin/courses', label: 'Khóa học' },
      { key: '/admin/classrooms', label: 'Lớp học' },
      { key: '/admin/leaderboard', label: 'Xếp hạng' },
    ],
  },
]

const NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items)

function findCurrentItem(pathname) {
  return NAV_ITEMS
    .filter((item) => item.exact ? pathname === item.key : pathname === item.key || pathname.startsWith(`${item.key}/`))
    .sort((a, b) => b.key.length - a.key.length)[0] || NAV_ITEMS[0]
}

function initials(name) {
  return (name || 'Admin')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function AdminBrand() {
  return (
    <Link to="/admin/overview" className="admin-brand" aria-label="CodeJudge Admin">
      <span className="admin-brand__mark">CJ</span>
      <span className="admin-brand__copy">
        <strong>CodeJudge</strong>
        <small>Admin Console</small>
      </span>
    </Link>
  )
}

function AdminNavigation({ pathname, onNavigate }) {
  const current = findCurrentItem(pathname)

  return (
    <nav className="admin-nav" aria-label="Điều hướng quản trị">
      {NAV_GROUPS.map((group) => (
        <div className="admin-nav__group" key={group.label}>
          <div className="admin-nav__label">{group.label}</div>
          <div className="admin-nav__items">
            {group.items.map((item) => {
              const selected = current.key === item.key
              return (
                <Link
                  className={selected ? 'admin-nav__item is-active' : 'admin-nav__item'}
                  key={item.key}
                  to={item.key}
                  aria-current={selected ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const socketStatus = useSocketStatus()
  const socket = SOCKET_LABEL[socketStatus] || SOCKET_LABEL.connecting
  const onlineCount = useOnlineCount()
  const location = useLocation()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const currentItem = findCurrentItem(location.pathname)

  const logoutUser = async () => {
    if (await logout()) navigate('/login')
  }

  return (
    <Layout className="admin-shell">
      <aside className="admin-sidebar">
        <AdminBrand />
        <AdminNavigation pathname={location.pathname} />
        <div className="admin-sidebar__footer">
          <span className={`admin-connection-dot is-${socket.status}`} aria-hidden="true" />
          <span>{socket.text}</span>
          {socketStatus === 'open' && onlineCount != null && <strong>{onlineCount} online</strong>}
        </div>
      </aside>

      <Drawer
        className="admin-nav-drawer"
        placement="left"
        size={292}
        open={navOpen}
        onClose={() => setNavOpen(false)}
        title={<AdminBrand />}
      >
        <AdminNavigation pathname={location.pathname} onNavigate={() => setNavOpen(false)} />
      </Drawer>

      <Layout className="admin-shell__main">
        <Layout.Header className="admin-topbar">
          <div className="admin-topbar__context">
            <Button
              type="text"
              className="admin-menu-trigger"
              icon={<MenuOutlined />}
              onClick={() => setNavOpen(true)}
              aria-label="Mở điều hướng quản trị"
            />
            <div>
              <span>Không gian quản trị</span>
              <strong>{currentItem.label}</strong>
            </div>
          </div>

          <Space size={8} align="center">
            <Tooltip title={socketStatus === 'open' && onlineCount != null ? `${onlineCount} người dùng đang online` : socket.tip}>
              <div className="admin-topbar__status">
                <span className={`admin-connection-dot is-${socket.status}`} aria-hidden="true" />
                <span>{socketStatus === 'open' && onlineCount != null ? `${onlineCount} online` : socket.text}</span>
              </div>
            </Tooltip>

            <Tooltip title={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}>
              <Button
                type="text"
                className="admin-topbar__theme"
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
                      <div className="admin-account-menu">
                        <strong>{user?.name}</strong>
                        <Typography.Text type="secondary">Quản trị viên</Typography.Text>
                      </div>
                    ),
                  },
                  { type: 'divider' },
                  { key: 'logout', danger: true, label: 'Đăng xuất', onClick: logoutUser },
                ],
              }}
            >
              <button type="button" className="admin-account" aria-label="Mở menu tài khoản">
                <Avatar size={28}>{initials(user?.name)}</Avatar>
                <span>{user?.name}</span>
              </button>
            </Dropdown>
          </Space>
        </Layout.Header>

        <Layout.Content className="admin-shell__content">
          <Outlet />
        </Layout.Content>
      </Layout>
    </Layout>
  )
}
