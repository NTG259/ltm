import { BarChart2, BookOpen, FileCheck2, GraduationCap, Trophy } from 'lucide-react'

export const STUDENT_NAV_GROUPS = [
  {
    label: 'Học tập',
    items: [
      { path: '/problems', label: 'Bài tập', icon: BookOpen },
      {
        path: '/my-classrooms',
        label: 'Lớp học',
        icon: GraduationCap,
        aliases: ['/courses', '/classrooms'],
      },
      { path: '/contests', label: 'Kỳ thi', icon: Trophy },
    ],
  },
  {
    label: 'Hoạt động',
    items: [
      { path: '/submissions', label: 'Bài nộp', icon: FileCheck2 },
      { path: '/leaderboard', label: 'Xếp hạng', icon: BarChart2 },
    ],
  },
]

const STUDENT_NAV_ITEMS = STUDENT_NAV_GROUPS.flatMap((group) => group.items)

function matchesPath(pathname, path) {
  return pathname === path || pathname.startsWith(`${path}/`)
}

export function findStudentNavigationItem(pathname) {
  return STUDENT_NAV_ITEMS.find((item) => (
    matchesPath(pathname, item.path)
    || item.aliases?.some((alias) => matchesPath(pathname, alias))
  )) || null
}
