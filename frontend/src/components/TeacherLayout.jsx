import { useState } from 'react'
import { Code2, KeyRound, LogOut, Menu, Moon, Sun } from 'lucide-react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Separator } from './ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from './ui/sheet'
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip'
import { cn } from '@/lib/utils'
import { TEACHER_NAV_GROUPS, findTeacherNavigationItem } from './teacher-navigation'

function initials(name) {
  return (name || 'Giảng viên')
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function TeacherBrand() {
  return (
    <Link to="/teacher/classrooms" className="student-brand" aria-label="CodeJudge Lecturer">
      <span className="student-brand__mark"><Code2 /></span>
      <span className="student-brand__copy">
        <strong>CodeJudge</strong>
        <small>Lecturer Workspace</small>
      </span>
    </Link>
  )
}

function TeacherNavigation({ pathname, onNavigate }) {
  const current = findTeacherNavigationItem(pathname)

  return (
    <nav className="student-nav" aria-label="Điều hướng giảng viên">
      {TEACHER_NAV_GROUPS.map((group) => (
        <div className="student-nav__group" key={group.label}>
          <div className="student-nav__label">{group.label}</div>
          <div className="student-nav__items">
            {group.items.map((item) => {
              const Icon = item.icon
              const selected = current?.path === item.path

              return (
                <Link
                  className={cn('student-nav__item', selected && 'is-active')}
                  key={item.path}
                  to={item.path}
                  aria-current={selected ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

export default function TeacherLayout() {
  const { user, logout } = useAuth()
  const { mode, toggle } = useThemeMode()
  const location = useLocation()
  const navigate = useNavigate()
  const [userOpen, setUserOpen] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const currentItem = findTeacherNavigationItem(location.pathname)
  const currentLabel = currentItem?.label
    || (location.pathname === '/teacher/change-password' ? 'Đổi mật khẩu' : 'Không gian giảng dạy')

  const logoutUser = async () => {
    setUserOpen(false)
    if (await logout()) navigate('/login')
  }

  return (
    <div className="student-shell">
      <aside className="student-sidebar">
        <TeacherBrand />
        <TeacherNavigation pathname={location.pathname} />
        <div className="student-sidebar__footer">
          <span className="student-user-mark" aria-hidden="true">{initials(user?.name)}</span>
          <span className="student-sidebar__identity">
            <strong>{user?.name}</strong>
            <small>Giảng viên</small>
          </span>
        </div>
      </aside>

      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[292px] gap-0 p-0">
          <SheetHeader className="border-b px-5 py-4 text-left">
            <SheetTitle><TeacherBrand /></SheetTitle>
            <SheetDescription className="sr-only">Điều hướng không gian giảng dạy</SheetDescription>
          </SheetHeader>
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4">
            <TeacherNavigation pathname={location.pathname} onNavigate={() => setNavOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="student-shell__main">
        <header className="student-topbar">
          <div className="student-topbar__context">
            <Button
              className="student-menu-trigger"
              variant="ghost"
              size="icon"
              onClick={() => setNavOpen(true)}
              aria-label="Mở điều hướng giảng viên"
            >
              <Menu />
            </Button>
            <div>
              <span>Không gian giảng dạy</span>
              <strong>{currentLabel}</strong>
            </div>
          </div>

          <div className="student-topbar__actions">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={toggle}
                    aria-label={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
                  />
                }
              >
                {mode === 'dark' ? <Sun /> : <Moon />}
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
              </TooltipContent>
            </Tooltip>

            <Popover open={userOpen} onOpenChange={setUserOpen}>
              <PopoverTrigger
                render={<Button variant="ghost" className="student-account" />}
              >
                <span className="student-user-mark" aria-hidden="true">{initials(user?.name)}</span>
                <span className="student-account__name">{user?.name}</span>
              </PopoverTrigger>
              <PopoverContent align="end" sideOffset={8} className="w-56 gap-1 p-1.5">
                <div className="flex flex-col gap-0.5 px-2 py-1.5">
                  <strong className="truncate text-sm">{user?.name}</strong>
                  <span className="truncate font-mono text-xs text-muted-foreground">Giảng viên</span>
                </div>
                <Separator />
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => { setUserOpen(false); navigate('/teacher/change-password') }}
                >
                  <KeyRound data-icon="inline-start" />
                  Đổi mật khẩu
                </Button>
                <Button
                  variant="ghost"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={logoutUser}
                >
                  <LogOut data-icon="inline-start" />
                  Đăng xuất
                </Button>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <main className="student-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
