import { useCallback, useState } from 'react'
import { Button, Card, Select, Space, Table, Tooltip, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useSocket } from '../lib/hooks'
import { downloadCsv } from '../lib/exportCsv'

export default function LeaderboardPage() {
  const { user, isAdmin } = useAuth()
  const [classroomId, setClassroomId] = useState(null)

  const lb = useFetch(() => api.leaderboard(classroomId), [classroomId])
  const { reload } = lb

  const classrooms = useFetch(() => api.listClassrooms(), [])

  useSocket(useCallback((msg) => msg.type === 'SUBMISSION_UPDATE' && msg.submission.status === 'FINISHED' && reload(), [reload]))

  const data = lb.data || { problems: [], rows: [] }

  const classroomOptions = [
    { value: null, label: 'Toàn hệ thống' },
    ...((classrooms.data || []).map((c) => ({ value: c.id, label: c.name }))),
  ]

  const exportCsv = () => {
    if (!data.rows?.length) return
    const problemHeaders = data.problems.map((p) => ({
      label: `#${p.id} ${p.title}`,
      value: (r) => {
        const c = r.cells[p.id]
        if (!c) return ''
        if (c.solved) return `AC (${c.tries} lần)`
        return c.best > 0 ? `${c.best}đ (${c.tries} lần)` : `${c.tries} lần sai`
      },
    }))
    const headers = [
      { key: 'rank', label: 'Hạng' },
      { key: 'userId', label: 'MSSV' },
      { key: 'userName', label: 'Họ tên' },
      { key: 'solved', label: 'Số bài AC' },
      { key: 'score', label: 'Điểm' },
      ...problemHeaders,
    ]
    const label = classroomOptions.find((o) => o.value === classroomId)?.label || 'toan-he-thong'
    downloadCsv(data.rows, headers, `leaderboard-${label.replace(/\s+/g, '-')}.csv`)
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Bảng xếp hạng</h1>
          <p>Xếp theo số bài đúng (AC), điểm và số lần nộp.</p>
        </div>
        <Space>
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>Phạm vi:</Typography.Text>
          <Select
            value={classroomId}
            onChange={setClassroomId}
            options={classroomOptions}
            style={{ minWidth: 180 }}
            loading={classrooms.loading}
          />
          <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!data.rows?.length}>
            Xuất CSV
          </Button>
        </Space>
      </div>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="userId"
          loading={lb.loading && !lb.data}
          dataSource={data.rows}
          pagination={{ pageSize: 25, hideOnSinglePage: true }}
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
