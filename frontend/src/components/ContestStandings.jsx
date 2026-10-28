import { Button, Table, Tooltip, Typography } from 'antd'
import { DownloadOutlined, StarFilled } from '@ant-design/icons'
import { downloadCsv } from '../lib/exportCsv'

/** Bảng xếp hạng ICPC. Ô: thời điểm AC (phút) + số lần sai; xanh = AC, đỏ = chưa AC, vàng = đang chấm. */
export default function ContestStandings({ data, loading, currentUserId, problems = [], contestTitle }) {
  const titles = Object.fromEntries(problems.map((p) => [p.label, p.title]))

  const exportCsv = () => {
    if (!data?.rows?.length) return
    const labelHeaders = (data.labels || []).map((label) => ({
      label,
      value: (r) => {
        const c = r.cells[label]
        if (!c) return ''
        if (c.solved) return `AC ${c.minute}'${c.wrong ? ` (+${c.wrong})` : ''}`
        if (c.pending) return 'Đang chấm'
        return c.wrong ? `-${c.wrong}` : ''
      },
    }))
    const headers = [
      { key: 'rank', label: 'Hạng' },
      { key: 'userId', label: 'MSSV' },
      { key: 'userName', label: 'Họ tên' },
      { key: 'solved', label: 'Số bài' },
      { key: 'penalty', label: 'Phạt' },
      ...labelHeaders,
    ]
    downloadCsv(data.rows, headers, `standings-${contestTitle || 'contest'}.csv`)
  }

  return (
    <Table
      rowKey="userId"
      size="middle"
      loading={loading}
      dataSource={data?.rows || []}
      pagination={false}
      scroll={{ x: 360 + (data?.labels.length || 0) * 80 }}
      rowClassName={(r) => (r.userId === currentUserId ? 'ant-table-row-selected' : '')}
      locale={{ emptyText: 'Chưa có thí sinh' }}
      columns={[
        { title: '#', dataIndex: 'rank', width: 52, align: 'center', fixed: 'left', render: (v) => <b>{v}</b> },
        {
          title: 'Thí sinh',
          width: 200,
          fixed: 'left',
          render: (_, r) => (
            <div>
              <div style={{ fontWeight: 500 }}>{r.userName}</div>
              <span className="mono muted" style={{ fontSize: 12 }}>
                {r.userId}
              </span>
            </div>
          ),
        },
        { title: 'Số bài', dataIndex: 'solved', width: 72, align: 'center', render: (v) => <b>{v}</b> },
        {
          title: (
            <Tooltip title={`Tổng phút từ lúc bắt đầu tới khi AC + ${data?.penaltyPerWrong ?? 20} phút cho mỗi lần sai`}>
              Phạt
            </Tooltip>
          ),
          dataIndex: 'penalty',
          width: 72,
          align: 'center',
          render: (v) => <span className="mono">{v}</span>,
        },
        ...(data?.labels || []).map((label) => ({
          title: (
            <Tooltip title={titles[label]}>
              <b>{label}</b>
            </Tooltip>
          ),
          key: label,
          width: 80,
          align: 'center',
          render: (_, r) => {
            const c = r.cells[label]
            if (!c) return null
            if (c.solved)
              return (
                <Tooltip
                  title={`AC ở phút ${c.minute}${c.wrong ? `, sai ${c.wrong} lần trước đó` : ''}${c.first ? ' – giải đầu tiên' : ''}`}
                >
                  <span className={`lb-cell tone-ac${c.first ? ' first' : ''}`}>
                    {c.first && <StarFilled style={{ fontSize: 10 }} />}
                    {c.minute}′<small>{c.wrong ? `+${c.wrong}` : ''}</small>
                  </span>
                </Tooltip>
              )
            if (c.pending)
              return (
                <Tooltip title="Đang chấm">
                  <span className="lb-cell tone-tle">?</span>
                </Tooltip>
              )
            return (
              <Tooltip title={`Sai ${c.wrong} lần`}>
                <span className="lb-cell tone-wa">−{c.wrong}</span>
              </Tooltip>
            )
          },
        })),
      ]}
      footer={() => (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            Ô xanh: phút AC (+ số lần sai). Ô đỏ: số lần sai. <StarFilled style={{ fontSize: 10, color: '#d97706' }} /> người giải
            đầu tiên. Lỗi biên dịch không bị tính phạt.
          </Typography.Text>
          <Button size="small" icon={<DownloadOutlined />} onClick={exportCsv} disabled={!data?.rows?.length}>
            Xuất CSV
          </Button>
        </div>
      )}
    />
  )
}
