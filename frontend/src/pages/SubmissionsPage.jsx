import { useCallback, useMemo } from 'react'
import { Card, Input, Select, Space, Statistic, Table, Tag, Typography } from 'antd'
import { CloudServerOutlined, SearchOutlined } from '@ant-design/icons'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { VERDICT_KEYS, VERDICTS } from '../lib/verdicts'
import { formatDateTime, formatMemory, formatRelative, formatTime } from '../lib/format'
import VerdictTag from '../components/VerdictTag'

/** Danh sách bài nộp: thí sinh thấy bài của mình; admin tra cứu & lọc toàn trường. Cập nhật realtime. */
export default function SubmissionsPage({ admin }) {
  const { user } = useAuth()
  const now = useNow(10000)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const verdict = searchParams.get('verdict') || null
  const problemId = searchParams.get('problemId') ? Number(searchParams.get('problemId')) : null
  const student = searchParams.get('student') || ''

  const onProblemChange = (val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('problemId', val)
      else next.delete('problemId')
      return next
    }, { replace: true })
  }

  const onStudentChange = (val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('student', val)
      else next.delete('student')
      return next
    }, { replace: true })
  }

  const onVerdictChange = (val) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev)
      if (val) next.set('verdict', val)
      else next.delete('verdict')
      return next
    }, { replace: true })
  }

  const subs = useFetch(() => api.listSubmissions(admin ? {} : { userId: user.id }), [admin, user.id])
  const problems = useFetch(() => api.listProblems(), [])
  const { setData } = subs

  useSocket(
    useCallback(
      (msg) => {
        if (msg.type !== 'SUBMISSION_UPDATE') return
        const s = msg.submission
        if (!admin && s.userId !== user.id) return
        // eslint-disable-next-line no-unused-vars
        const { sourceCode, tests, history, ...row } = s
        setData((list) => {
          if (!list) return list
          const i = list.findIndex((x) => x.id === s.id)
          if (i < 0) return [row, ...list]
          const next = [...list]
          next[i] = { ...next[i], ...row }
          return next
        })
      },
      [admin, user.id, setData],
    ),
  )

  const all = useMemo(() => subs.data || [], [subs.data])
  const rows = all.filter(
    (s) =>
      (!verdict || (verdict === 'PENDING' ? s.status !== 'FINISHED' : s.verdict === verdict)) &&
      (!problemId || s.problemId === problemId) &&
      (!student || `${s.userId} ${s.userName}`.toLowerCase().includes(student.toLowerCase())),
  )
  const stats = useMemo(() => {
    const finished = all.filter((s) => s.status === 'FINISHED')
    return {
      total: all.length,
      pending: all.length - finished.length,
      ac: finished.filter((s) => s.verdict === 'AC').length,
      students: new Set(all.map((s) => s.userId)).size,
    }
  }, [all])

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>{admin ? 'Toàn bộ bài nộp của sinh viên' : 'Bài nộp của tôi'}</h1>
          <p>
            {admin
              ? 'Tra cứu và lọc bài nộp của sinh viên. Bấm vào bất kỳ dòng nào để xem chi tiết mã nguồn C++ và kết quả chấm.'
              : 'Lịch sử nộp bài và kết quả chấm của bạn. Bấm vào bất kỳ dòng nào để xem chi tiết mã nguồn và kết quả test.'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card size="small">
          <Statistic title="Tổng bài nộp" value={stats.total} />
        </Card>
        <Card size="small">
          <Statistic title="Accepted" value={stats.ac} styles={{ content: { color: '#10b981' } }} />
        </Card>
        <Card size="small">
          <Statistic title="Đang chờ / đang chấm" value={stats.pending} styles={{ content: { color: '#2563eb' } }} />
        </Card>
        {admin && (
          <Card size="small">
            <Statistic title="Số thí sinh" value={stats.students} />
          </Card>
        )}
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Space wrap size={12} style={{ padding: 14 }}>
          {admin && (
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="MSSV hoặc họ tên"
              value={student}
              onChange={(e) => onStudentChange(e.target.value)}
              style={{ width: 220 }}
            />
          )}
          <Select
            allowClear
            placeholder="Đề bài"
            value={problemId}
            onChange={onProblemChange}
            style={{ width: 260 }}
            showSearch={{ optionFilterProp: 'label' }}
            options={(problems.data || []).map((p) => ({ value: p.id, label: `#${p.id} ${p.title}` }))}
          />
          <Select
            allowClear
            placeholder="Kết quả"
            value={verdict}
            onChange={onVerdictChange}
            style={{ width: 220 }}
            options={[
              { value: 'PENDING', label: 'Đang chờ / đang chấm' },
              ...VERDICT_KEYS.map((v) => ({ value: v, label: `${v} – ${VERDICTS[v].label}` })),
            ]}
          />
          <Typography.Text type="secondary">{rows.length} kết quả</Typography.Text>
        </Space>
        <Table
          rowKey="id"
          loading={subs.loading}
          dataSource={rows}
          scroll={{ x: 920 }}
          pagination={{ pageSize: 15, showSizeChanger: false }}
          onRow={(s) => ({
            style: { cursor: 'pointer' },
            onClick: (e) => {
              if (e.target.closest('a, button, input, .ant-select')) return
              navigate(`/submissions/${s.id}`)
            },
          })}
          columns={[
            {
              title: 'Mã bài',
              dataIndex: 'id',
              width: 85,
              render: (id) => (
                <Link to={`/submissions/${id}`} className="mono" style={{ fontWeight: 600 }}>
                  #{id}
                </Link>
              ),
            },
            {
              title: 'Thời điểm',
              dataIndex: 'createdAt',
              width: 130,
              render: (v) => <span title={formatDateTime(v)}>{formatRelative(v, now)}</span>,
            },
            ...(admin
              ? [
                  {
                    title: 'Thí sinh',
                    render: (_, s) => (
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.userName}</div>
                        <Tag
                          color="geekblue"
                          style={{ cursor: 'pointer', marginTop: 2 }}
                          title="Bấm để lọc toàn bộ bài nộp của MSSV này"
                          onClick={(e) => {
                            e.stopPropagation()
                            onStudentChange(s.userId)
                          }}
                        >
                          {s.userId}
                        </Tag>
                      </div>
                    ),
                  },
                ]
              : []),
            {
              title: 'Đề bài',
              render: (_, s) => (
                <Space size={6} wrap>
                  <span style={{ fontWeight: 500 }}>
                    #{s.problemId} {s.problemTitle}
                  </span>
                  <Link
                    to={`/problems/${s.problemId}`}
                    target="_blank"
                    title="Mở nội dung đề bài ở tab mới"
                    onClick={(e) => e.stopPropagation()}
                    style={{ fontSize: 12, color: 'var(--text-2)' }}
                  >
                    [Xem đề ↗]
                  </Link>
                  {s.contestId && (
                    <Link to={`/contests/${s.contestId}`} onClick={(e) => e.stopPropagation()}>
                      <Tag color="purple" style={{ margin: 0 }}>
                        Kỳ thi #{s.contestId}
                      </Tag>
                    </Link>
                  )}
                </Space>
              ),
            },
            { title: 'Kết quả', width: 140, render: (_, s) => <VerdictTag submission={s} /> },
            { title: 'Điểm', dataIndex: 'score', width: 70, render: (v) => v ?? '—' },
            { title: 'Thời gian', dataIndex: 'timeMs', width: 100, render: (v) => <span className="mono">{formatTime(v)}</span> },
            {
              title: 'Bộ nhớ',
              dataIndex: 'memoryKb',
              width: 100,
              render: (v) => <span className="mono">{formatMemory(v)}</span>,
            },
            {
              title: 'Worker',
              dataIndex: 'workerId',
              width: 120,
              render: (w, s) =>
                w ? (
                  <Tag icon={<CloudServerOutlined />} className="mono">
                    {w}
                    {s.attempts > 1 ? ` ×${s.attempts}` : ''}
                  </Tag>
                ) : (
                  '—'
                ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
