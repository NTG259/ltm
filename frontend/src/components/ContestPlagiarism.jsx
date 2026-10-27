import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Progress,
  Radio,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
} from 'antd'
import {
  AlertOutlined,
  CodeOutlined,
  DiffOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import { useFetch, useNow } from '../lib/hooks'
import { formatDateTime, formatRelative } from '../lib/format'

export default function ContestPlagiarism({ contestId }) {
  const { message } = App.useApp()
  const now = useNow(5000)
  const [running, setRunning] = useState(false)
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'high_risk' | 'suspicious'
  const [search, setSearch] = useState('')
  const [compareModal, setCompareModal] = useState({ open: false, loading: false, data: null })

  const { data, loading, reload, setData } = useFetch(
    () => api.getPlagiarismStatus(contestId),
    [contestId],
  )

  const handleRunCheck = async () => {
    try {
      setRunning(true)
      const res = await api.runPlagiarismCheck(contestId)
      setData(res)
      message.success(`Quét xong! Đã phân tích ${res.submissionCount} bài nộp, phát hiện ${res.totalMatches} cặp trùng lặp.`)
    } catch (e) {
      message.error(e.message || 'Lỗi khi quét đạo văn')
    } finally {
      setRunning(false)
    }
  }

  const handleOpenCompare = async (subA, subB) => {
    try {
      setCompareModal({ open: true, loading: true, data: null })
      const res = await api.compareSubmissions(contestId, subA.id, subB.id)
      setCompareModal({ open: true, loading: false, data: res })
    } catch (e) {
      message.error(e.message || 'Không thể tải mã nguồn so sánh')
      setCompareModal({ open: false, loading: false, data: null })
    }
  }

  const matches = useMemo(() => data?.matches || [], [data?.matches])

  const filteredMatches = useMemo(() => {
    const q = search.trim().toLowerCase()
    return matches.filter((m) => {
      if (filterMode === 'high_risk' && m.verdictLevel !== 'HIGH_RISK') return false
      if (filterMode === 'suspicious' && m.verdictLevel !== 'SUSPICIOUS') return false
      if (!q) return true
      const userA = `${m.submissionA?.username} ${m.submissionA?.fullName}`.toLowerCase()
      const userB = `${m.submissionB?.username} ${m.submissionB?.fullName}`.toLowerCase()
      const title = (m.problemTitle || '').toLowerCase()
      return userA.includes(q) || userB.includes(q) || title.includes(q)
    })
  }, [matches, filterMode, search])

  const stats = useMemo(() => {
    const totalConsidered = data?.submissionCount || 0
    const totalMatches = matches.length
    const highRisk = data?.highRiskCount || matches.filter((m) => m.verdictLevel === 'HIGH_RISK').length
    const suspicious = data?.suspiciousCount || matches.filter((m) => m.verdictLevel === 'SUSPICIOUS').length
    return { totalConsidered, totalMatches, highRisk, suspicious }
  }, [data, matches])

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: 'var(--muted)' }}>Đang tải báo cáo đạo văn…</div>
      </div>
    )
  }

  const columns = [
    {
      title: 'Bài tập',
      dataIndex: 'problemTitle',
      width: 180,
      render: (v) => <span style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Thí sinh A',
      render: (_, r) => {
        const sa = r.submissionA
        return (
          <div>
            <div className="mono" style={{ fontWeight: 600 }}>{sa?.username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sa?.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Nộp: {formatRelative(sa?.createdAt, now)} · Điểm: <b>{sa?.score}</b>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Thí sinh B',
      render: (_, r) => {
        const sb = r.submissionB
        return (
          <div>
            <div className="mono" style={{ fontWeight: 600 }}>{sb?.username}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{sb?.fullName}</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              Nộp: {formatRelative(sb?.createdAt, now)} · Điểm: <b>{sb?.score}</b>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Độ tương đồng',
      dataIndex: 'similarityScore',
      width: 200,
      sorter: (a, b) => b.similarityScore - a.similarityScore,
      render: (score, r) => {
        const isHigh = r.verdictLevel === 'HIGH_RISK'
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ color: isHigh ? '#ef4444' : '#f59e0b', fontSize: 14 }}>
                {score}%
              </b>
              <Tag color={isHigh ? 'error' : 'warning'} style={{ margin: 0, fontWeight: 600 }}>
                {isHigh ? 'Nguy cơ cao' : 'Nghi vấn'}
              </Tag>
            </div>
            <Progress
              percent={score}
              size="small"
              showInfo={false}
              strokeColor={isHigh ? '#ef4444' : '#f59e0b'}
            />
          </Space>
        )
      },
    },
    {
      title: 'Hành động',
      width: 140,
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          type="primary"
          ghost
          icon={<DiffOutlined />}
          onClick={() => handleOpenCompare(r.submissionA, r.submissionB)}
        >
          Đối chiếu mã
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Alert cảnh báo nếu có bài nộp nguy cơ cao */}
      {stats.highRisk > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<AlertOutlined />}
          message={
            <span>
              Phát hiện <b>{stats.highRisk} cặp bài nộp</b> có độ tương đồng mã nguồn rất cao (&ge; 75%). Đề nghị giám thị kiểm tra đối chiếu mã nguồn!
            </span>
          }
        />
      )}

      {/* Thẻ thống kê */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Bài nộp đã quét"
              value={stats.totalConsidered}
              prefix={<CodeOutlined style={{ color: 'var(--primary)' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Tổng cặp trùng lặp (≥50%)"
              value={stats.totalMatches}
              valueStyle={{ color: stats.totalMatches > 0 ? '#f59e0b' : '#10b981' }}
              prefix={<DiffOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Nghi vấn (50% - 74%)"
              value={stats.suspicious}
              valueStyle={{ color: '#f59e0b' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Nguy cơ cao (≥75%)"
              value={stats.highRisk}
              valueStyle={{ color: '#ef4444' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng kết quả */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: 'var(--primary)' }} />
            <span>Kết quả phân tích độ tương đồng mã nguồn (MOSS / Winnowing)</span>
            {data?.createdAt && (
              <span className="mono muted" style={{ fontSize: 12, fontWeight: 'normal' }}>
                · Quét lúc: {formatDateTime(data.createdAt)}
              </span>
            )}
          </Space>
        }
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={reload} size="small">
              Tải lại
            </Button>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleRunCheck}
              loading={running}
            >
              {running ? 'Đang quét...' : 'Quét đạo văn'}
            </Button>
          </Space>
        }
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
          <Input
            placeholder="Tìm theo MSSV, họ tên hoặc tên bài…"
            prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
          />
          <Radio.Group
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="all">Tất cả ({matches.length})</Radio.Button>
            <Radio.Button value="high_risk">Nguy cơ cao ({stats.highRisk})</Radio.Button>
            <Radio.Button value="suspicious">Nghi vấn ({stats.suspicious})</Radio.Button>
          </Radio.Group>
        </div>

        {matches.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <div>Chưa có bài nộp nào bị phát hiện sao chép hoặc chưa thực hiện quét.</div>
                <div style={{ marginTop: 8 }}>
                  Bấm nút <b>"Quét đạo văn"</b> phía trên để chạy thuật toán phân tích.
                </div>
              </div>
            }
          />
        ) : (
          <Table
            rowKey="id"
            size="small"
            columns={columns}
            dataSource={filteredMatches}
            pagination={{ pageSize: 10, showSizeChanger: false }}
          />
        )}
      </Card>

      {/* Modal đối chiếu mã nguồn Side-by-Side */}
      <Modal
        title={
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingRight: 32 }}>
            <Space>
              <DiffOutlined style={{ color: 'var(--primary)' }} />
              <span>Đối chiếu mã nguồn trực quan</span>
            </Space>
            {compareModal.data && (
              <Tag
                color={compareModal.data.verdictLevel === 'HIGH_RISK' ? 'error' : 'warning'}
                style={{ fontSize: 13, padding: '2px 8px', fontWeight: 600 }}
              >
                Độ tương đồng: {compareModal.data.similarityScore}%
              </Tag>
            )}
          </div>
        }
        open={compareModal.open}
        onCancel={() => setCompareModal({ open: false, loading: false, data: null })}
        footer={[
          <Button key="close" type="primary" onClick={() => setCompareModal({ open: false, loading: false, data: null })}>
            Đóng đối chiếu
          </Button>,
        ]}
        width={960}
        styles={{ body: { maxHeight: '72vh', overflowY: 'auto', padding: '12px 16px' } }}
      >
        {compareModal.loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spin size="large" />
            <div style={{ marginTop: 12 }}>Đang trích xuất mã nguồn đối chiếu…</div>
          </div>
        ) : compareModal.data ? (
          <div style={{ display: 'grid', gap: 16 }}>
            <Alert
              type={compareModal.data.verdictLevel === 'HIGH_RISK' ? 'error' : 'warning'}
              message={
                <div>
                  Thuật toán Winnowing & Tokenizer nhận định: Mã nguồn 2 bài nộp có mức tương đồng{' '}
                  <b>{compareModal.data.similarityScore}%</b>. Các biến/hàm và cấu trúc logic trùng lặp đáng kể.
                </div>
              }
            />

            <Row gutter={16}>
              {/* Bên trái: Thí sinh A */}
              <Col span={12}>
                <Card
                  size="small"
                  title={
                    <div>
                      <b style={{ color: 'var(--primary)' }}>
                        {compareModal.data.submissionA.fullName}
                      </b>{' '}
                      <span className="mono muted">({compareModal.data.submissionA.username})</span>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 'normal' }}>
                        Bài #{compareModal.data.submissionA.id} · {formatDateTime(compareModal.data.submissionA.createdAt)}
                      </div>
                    </div>
                  }
                  styles={{ body: { padding: 0 } }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      background: 'var(--bg-editor, #1e1e1e)',
                      color: '#d4d4d4',
                      fontSize: 12,
                      fontFamily: 'Consolas, monospace',
                      overflowX: 'auto',
                      maxHeight: 450,
                      lineHeight: 1.5,
                      borderRadius: '0 0 6px 6px',
                    }}
                  >
                    {compareModal.data.submissionA.sourceCode}
                  </pre>
                </Card>
              </Col>

              {/* Bên phải: Thí sinh B */}
              <Col span={12}>
                <Card
                  size="small"
                  title={
                    <div>
                      <b style={{ color: '#ef4444' }}>
                        {compareModal.data.submissionB.fullName}
                      </b>{' '}
                      <span className="mono muted">({compareModal.data.submissionB.username})</span>
                      <div style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 'normal' }}>
                        Bài #{compareModal.data.submissionB.id} · {formatDateTime(compareModal.data.submissionB.createdAt)}
                      </div>
                    </div>
                  }
                  styles={{ body: { padding: 0 } }}
                >
                  <pre
                    style={{
                      margin: 0,
                      padding: 12,
                      background: 'var(--bg-editor, #1e1e1e)',
                      color: '#d4d4d4',
                      fontSize: 12,
                      fontFamily: 'Consolas, monospace',
                      overflowX: 'auto',
                      maxHeight: 450,
                      lineHeight: 1.5,
                      borderRadius: '0 0 6px 6px',
                    }}
                  >
                    {compareModal.data.submissionB.sourceCode}
                  </pre>
                </Card>
              </Col>
            </Row>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
