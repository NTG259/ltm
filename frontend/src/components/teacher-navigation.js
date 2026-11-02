import { BarChart2, BookOpen, Database, FileCheck2, GraduationCap, Trophy } from 'lucide-react'

export const TEACHER_NAV_GROUPS = [
  {
    label: 'Giảng dạy',
    items: [
      { path: '/teacher/classrooms', label: 'Lớp học', icon: GraduationCap },
      { path: '/teacher/courses', label: 'Khóa học', icon: BookOpen },
    ],
  },
  {
    label: 'Quản lý',
    items: [
      { path: '/teacher/problems', label: 'Kho đề', icon: Database },
      { path: '/teacher/contests', label: 'Kỳ thi', icon: Trophy },
    ],
  },
  {
    label: 'Hoạt động',
    items: [
      { path: '/teacher/submissions', label: 'Bài nộp', icon: FileCheck2 },
      { path: '/teacher/leaderboard', label: 'Xếp hạng', icon: BarChart2 },
    ],
  },
]

const TEACHER_NAV_ITEMS = TEACHER_NAV_GROUPS.flatMap((group) => group.items)

function matchesPath(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function findTeacherNavigationItem(pathname) {
  return TEACHER_NAV_ITEMS.find((item) => (
    matchesPath(pathname, item.path)
    || item.aliases?.some((alias) => matchesPath(pathname, alias))
  )) || null
}
