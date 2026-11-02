import test from 'node:test'
import assert from 'node:assert/strict'

import { paginateStandingRows, standingCellStatus } from './contest-standings.js'

test('standing cell shows AC for a solved problem', () => {
  assert.equal(standingCellStatus({ solved: true, wrong: 2 }), 'AC')
})

test('standing cell shows WA after any submission without an AC', () => {
  assert.equal(standingCellStatus({ solved: false, wrong: 1 }), 'WA')
  assert.equal(standingCellStatus({ solved: false, pending: true, wrong: 0 }), 'WA')
})

test('standing cell shows a dash when the problem has not been submitted', () => {
  assert.equal(standingCellStatus(null), '-')
})

test('standings pagination returns only the requested page', () => {
  const rows = Array.from({ length: 21 }, (_, index) => ({ rank: index + 1 }))

  assert.deepEqual(paginateStandingRows(rows, 1, 20).map((row) => row.rank), Array.from({ length: 20 }, (_, index) => index + 1))
  assert.deepEqual(paginateStandingRows(rows, 2, 20).map((row) => row.rank), [21])
})
