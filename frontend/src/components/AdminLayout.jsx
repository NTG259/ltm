import { useEffect, useState } from 'react'
import { Avatar, Button, Drawer, Dropdown, Layout, Space, Tooltip, Typography } from 'antd'
import { MenuOutlined, MoonOutlined, SunOutlined } from '@ant-design/icons'
import {
  Activity,
  BarChart2,
  BookOpen,
  Code2,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
  Users,
} from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '@/lib/utils'
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
      { key: '/admin/overview', label: 'Tổng quan', icon: LayoutDashboard },
      { key: '/admin', label: 'Giám sát máy chấm', icon: Activity, exact: true },
      { key: '/admin/submissions', label: 'Bài nộp', icon: FileCheck2 },
    ],
  },
  {
    label: 'Quản trị',
    items: [
      { key: '/admin/lecturers', label: 'Giảng viên', icon: Users },
      { key: '/admin/problems', label: 'Đề bài', icon: Code2 },
      { key: '/admin/contests', label: 'Kỳ thi', icon: Trophy },
      { key: '/admin/courses', label: 'Khóa học', icon: BookOpen },
      { key: '/admin/classrooms', label: 'Lớp học', icon: GraduationCap },
      { key: '/admin/leaderboard', label: 'Xếp hạng', icon: BarChart2 },
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

function AdminBrand({ collapsed }) {
  const brand = (
    <Link to="/admin/overview" className={cn('admin-brand', collapsed && 'is-collapsed')} aria-label="CodeJudge Admin">
      <span className="admin-brand__mark">CJ</span>
      {!collapsed && (
        <span className="admin-brand__copy">
          <strong>CodeJudge</strong>
          <small>Admin Console</small>
        </span>
      )}
    </Link>
  )

  if (collapsed) {
    return (
      <Tooltip title="CodeJudge Admin Console" placement="right">
        {brand}
      </Tooltip>
    )
  }

  return brand
}

function AdminNavigation({ pathname, onNavigate, collapsed }) {
  const current = findCurrentItem(pathname)

  return (
    <nav className={cn('admin-nav', collapsed && 'is-collapsed')} aria-label="Điều hướng quản trị">
      {NAV_GROUPS.map((group) => (
        <div className="admin-nav__group" key={group.label}>
          {!collapsed ? (
            <div className="admin-nav__label">{group.label}</div>
          ) : (
            <div className="admin-nav__divider" aria-hidden="true" />
          )}
          <div className="admin-nav__items">
            {group.items.map((item) => {
              const Icon = item.icon
              const selected = current.key === item.key

              const linkNode = (
                <Link
                  className={cn(
                    'admin-nav__item',
                    selected && 'is-active',
                    collapsed && 'is-collapsed',
                  )}
                  key={item.key}
                  to={item.key}
                  aria-current={selected ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  {Icon && <Icon className="size-4 shrink-0" aria-hidden="true" />}
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )

              if (collapsed) {
                return (
                  <Tooltip key={item.key} title={item.label} placement="right">
                    {linkNode}
                  </Tooltip>
                )
              }

              return linkNode
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

const ADMIN_SIDEBAR_COLLAPSED_KEY = 'cj.admin.sidebar.collapsed'

function readAdminSidebarCollapsed() {
  try {
    return localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY) === 'true'
  } catch {
    return false
  }
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
  const [collapsed, setCollapsedState] = useState(readAdminSidebarCollapsed)

  const setCollapsed = (value) => {
    setCollapsedState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      try {
        localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, String(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        const target = event.target
        const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable
        if (!isEditing) {
          event.preventDefault()
          setCollapsed((prev) => !prev)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const currentItem = findCurrentItem(location.pathname)

  const logoutUser = async () => {
    if (await logout()) navigate('/login')
  }

  return (
    <Layout className="admin-shell">
      <aside className={cn('admin-sidebar', collapsed && 'is-collapsed')}>
        <div className="admin-sidebar__header">
          <AdminBrand collapsed={collapsed} />
        </div>

        <AdminNavigation pathname={location.pathname} collapsed={collapsed} />

        <div className={cn('admin-sidebar__footer', collapsed && 'is-collapsed')}>
          {collapsed ? (
            <Tooltip title={`${socket.text}${socketStatus === 'open' && onlineCount != null ? ` · ${onlineCount} online` : ''}`} placement="right">
              <span className={`admin-connection-dot is-${socket.status}`} aria-hidden="true" />
            </Tooltip>
          ) : (
            <>
              <span className={`admin-connection-dot is-${socket.status}`} aria-hidden="true" />
              <span>{socket.text}</span>
              {socketStatus === 'open' && onlineCount != null && <strong>{onlineCount} online</strong>}
            </>
          )}
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
            <Tooltip title={collapsed ? 'Mở rộng thanh bên (Ctrl+B)' : 'Thu gọn thanh bên (Ctrl+B)'} placement="bottom">
              <Button
                type="text"
                className="admin-desktop-sidebar-trigger"
                icon={collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
                onClick={() => setCollapsed((prev) => !prev)}
                aria-label={collapsed ? 'Mở rộng thanh bên (Ctrl+B)' : 'Thu gọn thanh bên (Ctrl+B)'}
              />
            </Tooltip>
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
