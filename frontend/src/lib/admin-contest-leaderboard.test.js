import test from 'node:test'
import assert from 'node:assert/strict'
import { filterContestLeaderboard } from './admin-contest-leaderboard.js'

const NOW = Date.parse('2026-11-02T10:00:00Z')
const contests = [
  { id: 1, title: 'C++ - Giữa kỳ', startAt: NOW - 7_200_000, endAt: NOW - 3_600_000 },
  { id: 2, title: 'CTDL - Cuối kỳ', startAt: NOW + 86_400_000, endAt: NOW + 93_600_000 },
  { id: 3, title: 'OOP - Giữa kỳ', startAt: NOW - 1_800_000, endAt: NOW + 1_800_000 },
]

test('filters contests by Vietnamese-insensitive title search', () => {
  const rows = filterContestLeaderboard(contests, { search: 'giua ky', status: 'all', now: NOW })

  assert.deepEqual(rows.map((contest) => contest.id), [3, 1])
})

test('filters contests by live status and keeps newest start time first', () => {
  const running = filterContestLeaderboard(contests, { search: '', status: 'RUNNING', now: NOW })
  const upcoming = filterContestLeaderboard(contests, { search: '', status: 'UPCOMING', now: NOW })

  assert.deepEqual(running.map((contest) => contest.id), [3])
  assert.deepEqual(upcoming.map((contest) => contest.id), [2])
})
