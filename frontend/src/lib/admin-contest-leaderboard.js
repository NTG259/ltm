import { liveStatus } from './contest.js'

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, (letter) => letter === 'Đ' ? 'D' : 'd')
    .toLocaleLowerCase('vi')
}

export function filterContestLeaderboard(contests, { search = '', status = 'all', now = Date.now() } = {}) {
  const query = normalizeSearch(search.trim())

  return [...(contests || [])]
    .filter((contest) => status === 'all' || liveStatus(contest, now) === status)
    .filter((contest) => !query || normalizeSearch(contest.title).includes(query))
    .sort((a, b) => b.startAt - a.startAt)
}
