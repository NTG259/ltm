import { useCallback, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Select, Space, Table, Tabs, Tag, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useSocket } from '../lib/hooks'
import { downloadCsv } from '../lib/exportCsv'

const SORT_OPTIONS = [
  { value: 'submissions', label: 'Nhiều lượt nộp nhất' },
  { value: 'acceptedUsers', label: 'Nhiều người AC nhất' },
  { value: 'acceptanceRate', label: 'Tỷ lệ AC thấp nhất (≥10 người thử)' },
]

function formatTime(value) {
  return value == null ? '—' : new Date(value).toLocaleString('vi-VN')
}

function ProblemDetails({ problemId, query }) {
  const detail = useFetch(() => api.leaderboardProblemDetails(problemId, query),
    [problemId, query.classroomId])
  if (detail.error) return <Alert type="error" showIcon message={detail.error.message} />
  return <Table
    size="small"
    rowKey="userId"
    loading={detail.loading}
    dataSource={detail.data?.rows || []}
    pagination={{ pageSize: 10 }}
    columns={[
      { title: 'Sinh viên đã thử', render: (_, r) => <><b>{r.userName}</b> <span className="mono muted">{r.userId}</span></> },
      { title: 'Lượt nộp', dataIndex: 'submissions', width: 110, align: 'center' },
      { title: 'Kết quả', dataIndex: 'solved', width: 110, render: (v) => <Tag color={v ? 'success' : 'warning'}>{v ? 'Đã AC' : 'Chưa AC'}</Tag> },
      { title: 'Nộp gần nhất', dataIndex: 'lastSubmittedAt', width: 165, render: formatTime },
    ]}
    locale={{ emptyText: 'Chưa có sinh viên nộp bài này' }}
  />
}

export default function LeaderboardPage() {
  const { user, isAdmin, isLecturer } = useAuth()
  const isStaff = isAdmin || isLecturer
  const classes = useFetch(() => api.leaderboardClassrooms(), [])
  const [selectedClassroomId, setSelectedClassroomId] = useState('all')
  const [tab, setTab] = useState('students')
  const [sortMode, setSortMode] = useState('submissions')
  const [search, setSearch] = useState('')

  const classroomId = isAdmin ? (selectedClassroomId === 'all' ? null : selectedClassroomId) :
    (classes.data || []).some((c) => c.id === selectedClassroomId) ? selectedClassroomId : classes.data?.[0]?.id ?? null
  const scopeReady = isAdmin || classroomId != null
  const query = useMemo(() => ({ classroomId }), [classroomId])
  const studentRank = useFetch(
    () => scopeReady ? api.leaderboardStudents(query) : Promise.resolve({ rows: [], updatedAt: null }),
    [scopeReady, query.classroomId],
  )
  const problemRank = useFetch(
    () => isStaff && scopeReady ? api.leaderboardProblems(query) : Promise.resolve({ rows: [], updatedAt: null }),
    [isStaff, scopeReady, query.classroomId],
  )
  const reloadStudents = studentRank.reload
  const reloadProblems = problemRank.reload
  useSocket(useCallback((msg) => {
    if (msg.type === 'SUBMISSION_UPDATE' && msg.submission?.status === 'FINISHED') {
      reloadStudents()
      if (isStaff) reloadProblems()
    }
  }, [reloadStudents, reloadProblems, isStaff]))

  const studentRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi-VN')
    return (studentRank.data?.rows || []).filter((r) => !q ||
      r.userName.toLocaleLowerCase('vi-VN').includes(q) || r.userId.toLocaleLowerCase('vi-VN').includes(q))
  }, [studentRank.data, search])
  const myRow = studentRank.data?.rows?.find((r) => r.userId === user?.id)

  const problemRows = useMemo(() => {
    const q = search.trim().toLocaleLowerCase('vi-VN')
    const rows = (problemRank.data?.rows || []).filter((r) =>
      sortMode !== 'acceptanceRate' || r.attemptedUsers >= 10)
    rows.sort((a, b) => sortMode === 'acceptanceRate'
      ? a.acceptanceRate - b.acceptanceRate || b.attemptedUsers - a.attemptedUsers || a.problemId - b.problemId
      : b[sortMode] - a[sortMode] || a.problemId - b.problemId)
    return rows.map((row) => ({
      ...row,
      rank: rows.findIndex((candidate) => candidate[sortMode] === row[sortMode]) + 1,
    })).filter((r) => !q || r.title.toLocaleLowerCase('vi-VN').includes(q) || String(r.problemId).includes(q))
  }, [problemRank.data, search, sortMode])

  const studentColumns = [
    { title: '#', dataIndex: 'rank', width: 60, align: 'center', render: (v) => <b>{v}</b> },
    { title: 'Sinh viên', width: 230, render: (_, r) => <div><b>{r.userName}</b>{r.userId === user?.id && <Tag color="blue" style={{ marginLeft: 8 }}>Bạn</Tag>}<div className="mono muted" style={{ fontSize: 12 }}>{r.userId}</div></div> },
    { title: 'AC', dataIndex: 'solved', width: 100, align: 'center', render: (v) => <b style={{ color: '#10b981' }}>{v}</b> },
    { title: 'Submit', dataIndex: 'attempts', width: 100, align: 'center' },
  ]
  const problemColumns = [
    { title: '#', dataIndex: 'rank', width: 60, align: 'center', render: (v) => <b>{v}</b> },
    { title: 'Bài tập', render: (_, r) => <Link to={`/problems/${r.problemId}`}>{r.title}</Link> },
    { title: 'Lượt nộp', dataIndex: 'submissions', width: 110, align: 'center' },
    { title: 'Người đã thử', dataIndex: 'attemptedUsers', width: 120, align: 'center' },
    { title: 'Người AC', dataIndex: 'acceptedUsers', width: 110, align: 'center' },
    { title: 'Tỷ lệ AC', dataIndex: 'acceptanceRate', width: 110, align: 'center', render: (v) => v == null ? '—' : `${v}%` },
  ]

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bảng xếp hạng</h1>
          <p>Thành tích luyện tập theo lớp; bài thi có bảng ICPC riêng trong từng kỳ thi.</p>
        </div>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap size={[12, 12]}>
          <Select
            aria-label="Chọn lớp"
            style={{ minWidth: 230 }}
            placeholder="Chọn lớp học"
            value={isAdmin && classroomId == null ? 'all' : classroomId}
            onChange={setSelectedClassroomId}
            loading={classes.loading}
            options={[
              ...(isAdmin ? [{ value: 'all', label: 'Tất cả lớp' }] : []),
              ...(classes.data || []).map((c) => ({ value: c.id, label: `${c.name}${c.semester ? ` · ${c.semester}` : ''}` })),
            ]}
          />
          <Input.Search
            placeholder={tab === 'students' ? 'Tìm sinh viên / MSSV' : 'Tìm bài tập'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 230 }}
          />
          {isStaff && tab === 'problems' && <Select aria-label="Tiêu chí xếp hạng bài" value={sortMode} onChange={setSortMode} options={SORT_OPTIONS} style={{ minWidth: 270 }} />}
          <Button icon={<DownloadOutlined />} disabled={tab === 'students' ? !studentRows.length : !problemRows.length}
            onClick={() => {
              const label = (classes.data || []).find((c) => c.id === classroomId)?.name || 'tat-ca'
              const safeLabel = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9-]+/g, '-').toLowerCase()
              if (tab === 'students') downloadCsv(studentRows, [
                { key: 'rank', label: 'Hạng' }, { key: 'userId', label: 'MSSV' },
                { key: 'userName', label: 'Họ tên' }, { key: 'solved', label: 'AC' },
                { key: 'attempts', label: 'Submit' },
              ], `bang-xep-hang-sinh-vien-${safeLabel}.csv`)
              else downloadCsv(problemRows, [
                { key: 'rank', label: 'Hạng' }, { key: 'problemId', label: 'Mã bài' },
                { key: 'title', label: 'Bài tập' }, { key: 'submissions', label: 'Lượt nộp' },
                { key: 'attemptedUsers', label: 'Người đã thử' }, { key: 'acceptedUsers', label: 'Người AC' },
                { key: 'acceptanceRate', label: 'Tỷ lệ AC (%)' },
              ], `bang-xep-hang-bai-tap-${safeLabel}.csv`)
            }}>Xuất CSV</Button>
        </Space>
      </Card>

      {classes.error && <Alert type="error" showIcon message={classes.error.message} style={{ marginBottom: 16 }} />}
      {!scopeReady && !classes.loading && !classes.error && <Empty description="Bạn chưa được phân công vào lớp học" />}
      {scopeReady && <Card styles={{ body: { paddingTop: 8 } }}>
        <Tabs activeKey={tab} onChange={(value) => { setTab(value); setSearch('') }} items={[
          {
            key: 'students', label: 'Xếp hạng sinh viên', children: <>
              {studentRank.error && <Alert type="error" showIcon message={studentRank.error.message} style={{ marginBottom: 12 }} />}
              {myRow && !isStaff && <Typography.Paragraph>Bạn đang hạng <b>#{myRow.rank}</b> · AC {myRow.solved} · Submit {myRow.attempts}.</Typography.Paragraph>}
              <Table rowKey="userId" columns={studentColumns} dataSource={studentRows} loading={studentRank.loading} pagination={{ pageSize: 20 }} scroll={{ x: 500 }} rowClassName={(r) => r.userId === user?.id ? 'ant-table-row-selected' : ''} locale={{ emptyText: 'Chưa có sinh viên trong phạm vi này' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Cập nhật: {formatTime(studentRank.data?.updatedAt)}</Typography.Text>
            </>,
          },
          ...(isStaff ? [{
            key: 'problems', label: 'Xếp hạng bài tập', children: <>
              {problemRank.error && <Alert type="error" showIcon message={problemRank.error.message} style={{ marginBottom: 12 }} />}
              <Table rowKey="problemId" columns={problemColumns} dataSource={problemRows} loading={problemRank.loading} pagination={{ pageSize: 20 }} scroll={{ x: 750 }} expandable={{ expandedRowRender: (row) => <ProblemDetails problemId={row.problemId} query={query} /> }} locale={{ emptyText: 'Không có bài tập phù hợp' }} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Cập nhật: {formatTime(problemRank.data?.updatedAt)}</Typography.Text>
            </>,
          }] : []),
        ]} />
      </Card>}
    </div>
  )
}
