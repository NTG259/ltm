import { useMemo, useState } from 'react'
import { Button, Card, Input, Progress, Segmented, Select, Space, Table, Tag, Tooltip } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch } from '../lib/hooks'
import { DIFFICULTIES } from '../lib/verdicts'
import { percent } from '../lib/format'

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
          <p>Chọn bài, viết lời giải và nộp bài.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '6px 14px',
              borderRadius: 999,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            }}
          >
            <span style={{ fontSize: 13, color: 'var(--text-2)', fontWeight: 500 }}>Đã giải</span>
            <b style={{ color: 'var(--text)', fontSize: 14, fontFamily: 'var(--mono)' }}>
              {solved}/{problems.data?.length ?? 0}
            </b>
            <Progress
              percent={problems.data?.length ? Math.round((solved / problems.data.length) * 100) : 0}
              size={[64, 6]}
              showInfo={false}
              strokeColor="#10b981"
            />
          </div>
        </div>
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
          rowClassName={(p) => {
            if (myStatus[p.id] === 'solved') return 'row-problem-solved'
            if (myStatus[p.id] === 'tried') return 'row-problem-failed'
            return ''
          }}
          onRow={(p) => ({ onDoubleClick: () => navigate(`/problems/${p.id}`) })}
          columns={[
            { title: 'Mã', dataIndex: 'id', width: 70, render: (id) => <span className="mono muted">#{id}</span> },
            {
              title: 'Bài tập',
              render: (_, p) => (
                <div>
                  <Link
                    to={`/problems/${p.id}`}
                    style={{
                      fontWeight: 600,
                      color:
                        myStatus[p.id] === 'solved'
                          ? '#15803d'
                          : myStatus[p.id] === 'tried'
                          ? '#b91c1c'
                          : undefined,
                    }}
                  >
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
              width: 120,
              render: (d) => <span className={`diff-pill diff-pill-${d}`}>{DIFFICULTIES[d]?.label || d}</span>,
            },
            {
              title: '',
              width: 110,
              align: 'right',
              render: (_, p) => (
                <Button
                  type={myStatus[p.id] === 'solved' ? 'default' : myStatus[p.id] === 'tried' ? 'default' : 'primary'}
                  size="small"
                  style={
                    myStatus[p.id] === 'solved'
                      ? { borderColor: '#16a34a', color: '#16a34a', fontWeight: 600 }
                      : myStatus[p.id] === 'tried'
                      ? { borderColor: '#dc2626', color: '#dc2626', fontWeight: 600 }
                      : undefined
                  }
                  onClick={() => navigate(`/problems/${p.id}`)}
                >
                  {myStatus[p.id] === 'solved' ? 'Đã giải' : myStatus[p.id] ? 'Làm tiếp' : 'Làm bài'}
                </Button>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
