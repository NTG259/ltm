import { useMemo, useState } from 'react'
import { Button, Card, Input, Progress, Segmented, Select, Space, Table, Tag, Tooltip, Typography } from 'antd'
import { CheckCircleFilled, ExclamationCircleFilled, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch } from '../lib/hooks'
import { DIFFICULTIES } from '../lib/verdicts'
import { percent } from '../lib/format'

const DIFF_COLOR = { easy: 'green', medium: 'gold', hard: 'red' }

export default function ProblemsPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const problems = useFetch(() => api.listProblems(), [])
  const mine = useFetch(() => api.listSubmissions({ userId: user.id }), [user.id])
  const [query, setQuery] = useState('')
  const [difficulty, setDifficulty] = useState('all')
  const [tag, setTag] = useState(null)

  const myStatus = useMemo(() => {
    const map = {}
    ;(mine.data || []).forEach((s) => {
      if (s.verdict === 'AC') map[s.problemId] = 'solved'
      else if (!map[s.problemId]) map[s.problemId] = 'tried'
    })
    return map
  }, [mine.data])

  const tags = useMemo(() => [...new Set((problems.data || []).flatMap((p) => p.tags))], [problems.data])
  const rows = (problems.data || []).filter(
    (p) =>
      (difficulty === 'all' || p.difficulty === difficulty) &&
      (!tag || p.tags.includes(tag)) &&
      (!query || `#${p.id} ${p.title}`.toLowerCase().includes(query.toLowerCase())),
  )
  const solved = Object.values(myStatus).filter((v) => v === 'solved').length

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Kho bài tập</h1>
          <p>Chọn đề bài, viết lời giải C++17 và nộp để được chấm tự động.</p>
        </div>
        <Typography.Text type="secondary" className="mono">
          Đã giải <b style={{ color: 'var(--text)' }}>{solved}</b> / {problems.data?.length ?? '…'} bài
        </Typography.Text>
      </div>

      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: 14 } }}>
        <Space wrap size={12} style={{ width: '100%' }}>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Tìm theo tên hoặc mã bài (#1)…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 300 }}
          />
          <Segmented
            value={difficulty}
            onChange={setDifficulty}
            options={[
              { value: 'all', label: 'Tất cả' },
              ...Object.entries(DIFFICULTIES).map(([k, v]) => ({ value: k, label: v.label })),
            ]}
          />
          <Select
            allowClear
            placeholder="Chủ đề"
            value={tag}
            onChange={setTag}
            style={{ width: 200 }}
            options={tags.map((t) => ({ value: t, label: t }))}
          />
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={problems.loading}
          dataSource={rows}
          pagination={false}
          scroll={{ x: 760 }}
          onRow={(p) => ({ onDoubleClick: () => navigate(`/problems/${p.id}`) })}
          columns={[
            {
              title: '',
              width: 48,
              align: 'center',
              render: (_, p) =>
                myStatus[p.id] === 'solved' ? (
                  <Tooltip title="Đã giải">
                    <CheckCircleFilled style={{ color: '#10b981' }} />
                  </Tooltip>
                ) : myStatus[p.id] === 'tried' ? (
                  <Tooltip title="Đã thử, chưa AC">
                    <ExclamationCircleFilled style={{ color: '#f59e0b' }} />
                  </Tooltip>
                ) : null,
            },
            { title: 'Mã', dataIndex: 'id', width: 70, render: (id) => <span className="mono muted">#{id}</span> },
            {
              title: 'Tên bài tập',
              render: (_, p) => (
                <div>
                  <Link to={`/problems/${p.id}`} style={{ fontWeight: 500 }}>
                    {p.title}
                  </Link>
                  <div style={{ marginTop: 4 }}>
                    {p.tags.map((t) => (
                      <Tag key={t} variant="filled" style={{ fontSize: 11 }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              title: 'Giới hạn',
              width: 120,
              render: (_, p) => (
                <span className="mono" style={{ fontSize: 12 }}>
                  {p.timeLimitMs / 1000}s · {p.memoryLimitMb}MB
                </span>
              ),
            },
            {
              title: 'Tỉ lệ AC',
              width: 170,
              sorter: (a, b) =>
                percent(a.acceptedSubmissions, a.totalSubmissions) - percent(b.acceptedSubmissions, b.totalSubmissions),
              render: (_, p) => {
                const r = percent(p.acceptedSubmissions, p.totalSubmissions)
                return (
                  <Tooltip title={`${p.acceptedSubmissions}/${p.totalSubmissions} bài nộp AC`}>
                    <Progress percent={r} size="small" strokeColor={r >= 50 ? '#10b981' : r >= 25 ? '#f59e0b' : '#ef4444'} />
                  </Tooltip>
                )
              },
            },
            {
              title: 'Độ khó',
              dataIndex: 'difficulty',
              width: 110,
              render: (d) => <Tag color={DIFF_COLOR[d]}>{DIFFICULTIES[d].label}</Tag>,
            },
            {
              title: '',
              width: 110,
              align: 'right',
              render: (_, p) => (
                <Button
                  type={myStatus[p.id] === 'solved' ? 'default' : 'primary'}
                  size="small"
                  onClick={() => navigate(`/problems/${p.id}`)}
                >
                  {myStatus[p.id] === 'solved' ? 'Xem lại' : myStatus[p.id] ? 'Làm tiếp' : 'Giải ngay'}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
