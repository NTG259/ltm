import test from 'node:test'
import assert from 'node:assert/strict'

import {
  STUDENT_NAV_GROUPS,
  findStudentNavigationItem,
} from './student-navigation.js'

test('student navigation exposes learning and activity groups in scan order', () => {
  assert.deepEqual(
    STUDENT_NAV_GROUPS.map((group) => ({
      label: group.label,
      paths: group.items.map((item) => item.path),
    })),
    [
      {
        label: 'Học tập',
        paths: ['/problems', '/my-classrooms', '/contests'],
      },
      {
        label: 'Hoạt động',
        paths: ['/submissions', '/leaderboard'],
      },
    ],
  )
})

test('student navigation maps nested learning routes to their parent item', () => {
  assert.equal(findStudentNavigationItem('/problems/12')?.path, '/problems')
  assert.equal(findStudentNavigationItem('/contests/7')?.path, '/contests')
  assert.equal(findStudentNavigationItem('/courses/3/learn/9')?.path, '/my-classrooms')
  assert.equal(findStudentNavigationItem('/classrooms/4')?.path, '/my-classrooms')
})

test('student navigation keeps account pages out of the primary navigation', () => {
  assert.equal(findStudentNavigationItem('/change-password'), null)
})
