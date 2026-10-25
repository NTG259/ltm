import { useCallback } from 'react'
import { Card, Table, Tooltip } from 'antd'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useSocket } from '../lib/hooks'

export default function LeaderboardPage() {
  const { user } = useAuth()
  const lb = useFetch(() => api.leaderboard(), [])
  const { reload } = lb

  // Bảng xếp hạng tự làm mới khi có bài chấm xong.
  useSocket(useCallback((msg) => msg.type === 'SUBMISSION_UPDATE' && msg.submission.status === 'FINISHED' && reload(), [reload]))

  const data = lb.data || { problems: [], rows: [] }
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bảng xếp hạng</h1>
          <p>Xếp theo số bài đúng, điểm và số lần nộp.</p>
        </div>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="userId"
          loading={lb.loading && !lb.data}
          dataSource={data.rows}
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          scroll={{ x: 520 + data.problems.length * 80 }}
          rowClassName={(r) => (r.userId === user.id ? 'ant-table-row-selected' : '')}
          columns={[
            {
              title: '#',
              dataIndex: 'rank',
              width: 56,
              fixed: 'left',
              align: 'center',
              render: (v) => <b>{v}</b>,
            },
            {
              title: 'Thí sinh',
              fixed: 'left',
              width: 200,
              render: (_, r) => (
                <div>
                  <div style={{ fontWeight: 500 }}>{r.userName}</div>
                  <span className="mono muted" style={{ fontSize: 12 }}>
                    {r.userId}
                  </span>
                </div>
              ),
            },
            {
              title: 'AC',
              dataIndex: 'solved',
              width: 60,
              align: 'center',
              render: (v) => <b style={{ color: '#10b981' }}>{v}</b>,
            },
            { title: 'Điểm', dataIndex: 'score', width: 80, align: 'center' },
            ...data.problems.map((p) => ({
              title: (
                <Tooltip title={p.title}>
                  <span className="mono">#{p.id}</span>
                </Tooltip>
              ),
              key: p.id,
              width: 80,
              align: 'center',
              render: (_, r) => {
                const c = r.cells[p.id]
                if (!c) return <span className="muted">·</span>
                const tone = c.solved ? 'ac' : c.best > 0 ? 'tle' : 'wa'
                return (
                  <span className={`lb-cell tone-${tone}`}>
                    {c.solved ? '✓' : c.best}
                    <small>{c.tries} lần</small>
                  </span>
                )
              },
            })),
          ]}
        />
      </Card>
    </div>
  )
}
