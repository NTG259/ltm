import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiBase = process.env.LMS_DEMO_API_BASE || 'http://localhost:18000/api'
const password = process.env.LMS_DEMO_ADMIN_PASSWORD || 'admin123'
const seedDir = '/tmp/codejudge-lms-demo-seed'
const pdfPath = join(root, 'output', 'pdf', 'tai-lieu-cpp-nhap-xuat.pdf')
const pdfName = 'tai-lieu-cpp-nhap-xuat.pdf'

function compose(args) {
  const result = spawnSync('docker', ['compose', ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    throw new Error(`docker compose ${args[0]} failed: ${(result.stderr || result.stdout).trim()}`)
  }
  return result.stdout.trim()
}

async function request(path, token, options = {}) {
  const response = await fetch(apiBase + path, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`${path}: HTTP ${response.status} ${body.slice(0, 250)}`)
  }
  return response
}

const login = await request('/auth/login', null, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password }),
}).then((response) => response.json())
const token = login.token
if (!token) throw new Error('Admin login did not return a token.')

const dbName = compose(['exec', '-T', 'db', 'printenv', 'POSTGRES_DB'])
const dbUser = compose(['exec', '-T', 'db', 'printenv', 'POSTGRES_USER'])
if (!dbName || !dbUser) throw new Error('Compose database name or user is missing.')
compose(['exec', '-T', 'db', 'mkdir', '-p', seedDir])
for (const file of ['lms_demo.sql', 'lms_demo_lessons.sql']) {
  compose(['cp', join(root, 'backend', 'src', 'main', 'resources', 'db', 'seed', file), `db:${seedDir}/${file}`])
}
compose(['exec', '-T', 'db', 'psql', '-X', '-q', '-v', 'ON_ERROR_STOP=1', '-U', dbUser, '-d', dbName, '-f', `${seedDir}/lms_demo.sql`])

const course = await request('/courses/1', token).then((response) => response.json())
const unit = course.units?.find((item) => item.orderIndex === 1)
if (!unit) throw new Error('Course 1, unit 1 was not found.')
const filePath = `/courses/units/${unit.id}/files`
const files = await request(filePath, token).then((response) => response.json())
let existing = files.find((item) => item.filename === pdfName)
if (existing) {
  const download = await fetch(`${apiBase}${filePath}/${existing.id}/download`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const valid = download.ok && Buffer.from(await download.arrayBuffer()).subarray(0, 4).toString() === '%PDF'
  if (!valid) {
    await request(`${filePath}/${existing.id}`, token, { method: 'DELETE' })
    existing = null
  }
}
if (!existing) {
  const form = new FormData()
  form.append('file', new Blob([readFileSync(pdfPath)], { type: 'application/pdf' }), pdfName)
  existing = await request(filePath, token, { method: 'POST', body: form })
    .then((response) => response.json())
}

const downloaded = await request(`${filePath}/${existing.id}/download`, token)
  .then((response) => response.arrayBuffer())
if (Buffer.from(downloaded).subarray(0, 4).toString() !== '%PDF') {
  throw new Error('The uploaded file did not download as a valid PDF.')
}
await request('/auth/logout', token, { method: 'DELETE' })
console.log(`LMS demo ready in Compose DB ${dbName}; PDF attached to course 1, unit ${unit.id}, file ${existing.id}.`)
