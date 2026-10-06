import { useCallback } from 'react'
import { Avatar, Card, Col, Row, Statistic, Table, Tooltip, Typography } from 'antd'
import { CrownFilled, SyncOutlined } from '@ant-design/icons'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useSocket } from '../lib/hooks'

const MEDAL = ['#f59e0b', '#94a3b8', '#c2410c']

export default function LeaderboardPage() {
  const { user } = useAuth()
  const lb = useFetch(() => api.leaderboard(), [])
  const { reload } = lb

  // Bảng xếp hạng tự làm mới khi có bài chấm xong.
  useSocket(useCallback((msg) => msg.type === 'SUBMISSION_UPDATE' && msg.submission.status === 'FINISHED' && reload(), [reload]))

  const data = lb.data || { problems: [], rows: [] }
  const top = data.rows.slice(0, 3)

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bảng xếp hạng</h1>
          <p>Xếp theo số bài AC, sau đó tổng điểm cao nhất mỗi bài, cuối cùng là số lần nộp ít hơn.</p>
        </div>
        <Typography.Text type="secondary">
          <SyncOutlined spin={lb.loading} /> Cập nhật tự động qua WebSocket
        </Typography.Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {top.map((r, i) => (
          <Col xs={24} md={8} key={r.userId}>
            <Card>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                <Avatar size={44} style={{ background: MEDAL[i] }}>
                  {i === 0 ? <CrownFilled /> : `#${i + 1}`}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <Typography.Text strong style={{ fontSize: 16 }} ellipsis>
                    {r.userName}
                  </Typography.Text>
                  <div className="mono muted" style={{ fontSize: 12 }}>
                    {r.userId}
                  </div>
                </div>
              </div>
              <Row>
                <Col span={8}>
                  <Statistic title="Đã giải" value={r.solved} suffix={`/${data.problems.length}`} />
                </Col>
                <Col span={8}>
                  <Statistic title="Tổng điểm" value={r.score} />
                </Col>
                <Col span={8}>
                  <Statistic title="Lượt nộp" value={r.attempts} />
                </Col>
              </Row>
            </Card>
          </Col>
        ))}
      </Row>

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
              render: (v) => <b style={{ color: MEDAL[v - 1] }}>{v}</b>,
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
