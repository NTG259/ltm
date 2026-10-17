import { useCallback, useMemo, useState } from 'react'
import {
  Alert,
  App,
  Badge,
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
  Timeline,
  Tooltip,
  Typography,
} from 'antd'
import {
  AlertOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { formatDateTime, formatRelative } from '../lib/format'

export default function ContestProctoring({ contestId }) {
  const { notification } = App.useApp()
  const now = useNow(5000)
  const { data, loading, reload, setData } = useFetch(() => api.getProctorStatus(contestId), [contestId])
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'violating' | 'high_risk'
  const [selectedUser, setSelectedUser] = useState(null) // user xem timeline modal

  const participants = useMemo(() => data?.participants || [], [data?.participants])
  const recentViolations = useMemo(() => data?.recentViolations || [], [data?.recentViolations])

  // Lắng nghe sự kiện PROCTOR_ALERT từ WebSocket
  useSocket(
    useCallback(
      (msg) => {
        if (msg.type !== 'PROCTOR_ALERT' || Number(msg.contestId) !== Number(contestId)) {
          return
        }

        // Hiện popup thông báo vi phạm realtime cho giám thị
        notification.warning({
          message: '⚠️ Thí sinh rời màn hình thi!',
          description: (
            <div>
              <b>{msg.fullName || msg.username}</b> ({msg.username}) vừa rời tab làm bài.
              <div>
                Số lần vi phạm: <b style={{ color: '#ef4444' }}>{msg.violationCount} lần</b>
              </div>
            </div>
          ),
          placement: 'topRight',
          duration: 4.5,
        })

        // Cập nhật danh sách thí sinh và recent violations realtime
        setData((prev) => {
          if (!prev) return prev
          const updatedParticipants = (prev.participants || []).map((p) => {
            if (p.username === msg.username || String(p.userId) === String(msg.username)) {
              const newCount = msg.violationCount
              const newViolations = [
                {
                  id: Date.now(),
                  type: msg.violationType,
                  details: msg.details,
                  createdAt: msg.timestamp || Date.now(),
                },
                ...(p.violations || []),
              ]
              return {
                ...p,
                tabSwitchCount: newCount,
                lastViolationAt: msg.timestamp || Date.now(),
                violations: newViolations,
              }
            }
            return p
          })

          const updatedRecent = [
            {
              id: Date.now(),
              username: msg.username,
              fullName: msg.fullName || msg.username,
              type: msg.violationType,
              details: msg.details,
              createdAt: msg.timestamp || Date.now(),
            },
            ...(prev.recentViolations || []).slice(0, 49),
          ]

          return {
            ...prev,
            participants: updatedParticipants,
            recentViolations: updatedRecent,
          }
        })
      },
      [contestId, notification, setData],
    ),
  )

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = participants.length
    const clean = participants.filter((p) => !p.tabSwitchCount || p.tabSwitchCount === 0).length
    const warning = participants.filter((p) => p.tabSwitchCount >= 1 && p.tabSwitchCount < 3).length
    const highRisk = participants.filter((p) => p.tabSwitchCount >= 3).length
    const totalSwitches = participants.reduce((sum, p) => sum + (p.tabSwitchCount || 0), 0)
    return { total, clean, warning, highRisk, totalSwitches }
  }, [participants])

  // Lọc danh sách thí sinh
  const filteredParticipants = useMemo(() => {
    const q = search.trim().toLowerCase()
    return participants
      .filter((p) => {
        if (filterMode === 'violating' && (!p.tabSwitchCount || p.tabSwitchCount === 0)) return false
        if (filterMode === 'high_risk' && (p.tabSwitchCount || 0) < 3) return false
        if (!q) return true
        return (
          (p.username && p.username.toLowerCase().includes(q)) ||
          (p.fullName && p.fullName.toLowerCase().includes(q))
        )
      })
      .sort((a, b) => (b.tabSwitchCount || 0) - (a.tabSwitchCount || 0))
  }, [participants, search, filterMode])

  if (loading && participants.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <Spin size="large" />
        <div style={{ marginTop: 12, color: 'var(--muted)' }}>Đang tải dữ liệu giám sát phòng thi…</div>
      </div>
    )
  }

  const columns = [
    {
      title: 'Tài khoản / MSSV',
      dataIndex: 'username',
      width: 150,
      render: (v) => <span className="mono" style={{ fontWeight: 600 }}>{v}</span>,
    },
    {
      title: 'Họ và tên thí sinh',
      dataIndex: 'fullName',
      render: (v) => <span style={{ fontWeight: 500 }}>{v || '—'}</span>,
    },
    {
      title: 'Đánh giá rủi ro',
      width: 170,
      render: (_, r) => {
        const count = r.tabSwitchCount || 0
        if (count === 0) {
          return (
            <Tag color="success" icon={<CheckCircleOutlined />}>
              Nghiêm túc (0)
            </Tag>
          )
        }
        if (count < 3) {
          return (
            <Tag color="warning" icon={<WarningOutlined />}>
              Cảnh báo ({count})
            </Tag>
          )
        }
        return (
          <Tag color="error" icon={<AlertOutlined />} style={{ fontWeight: 600 }}>
            Nguy cơ cao ({count})
          </Tag>
        )
      },
    },
    {
      title: 'Số lần rời màn hình',
      dataIndex: 'tabSwitchCount',
      width: 180,
      sorter: (a, b) => (a.tabSwitchCount || 0) - (b.tabSwitchCount || 0),
      render: (v) => {
        const count = v || 0
        const percent = Math.min(100, (count / 5) * 100)
        const status = count === 0 ? 'success' : count < 3 ? 'normal' : 'exception'
        return (
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <b>{count} lần</b>
              <span className="mono muted" style={{ fontSize: 11 }}>
                {count >= 3 ? 'Đáng ngờ' : count > 0 ? 'Nhắc nhở' : 'An toàn'}
              </span>
            </div>
            <Progress
              percent={percent}
              size="small"
              status={status}
              showInfo={false}
              strokeColor={count >= 3 ? '#ef4444' : count > 0 ? '#f59e0b' : '#10b981'}
            />
          </Space>
        )
      },
    },
    {
      title: 'Lần vi phạm cuối',
      dataIndex: 'lastViolationAt',
      width: 180,
      render: (v) =>
        v ? (
          <Tooltip title={formatDateTime(v)}>
            <span>
              <ClockCircleOutlined style={{ marginRight: 4, color: 'var(--muted)' }} />
              {formatRelative(v, now)}
            </span>
          </Tooltip>
        ) : (
          <span className="muted">—</span>
        ),
    },
    {
      title: 'Chi tiết',
      width: 130,
      align: 'right',
      render: (_, r) => (
        <Button
          size="small"
          icon={<HistoryOutlined />}
          onClick={() => setSelectedUser(r)}
        >
          Nhật ký {r.violations?.length ? `(${r.violations.length})` : ''}
        </Button>
      ),
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {/* Cảnh báo nổi bật nếu có thí sinh vi phạm nhiều */}
      {stats.highRisk > 0 && (
        <Alert
          type="error"
          showIcon
          icon={<AlertOutlined />}
          message={
            <span>
              Phát hiện <b>{stats.highRisk} thí sinh</b> có hành vi rời tab liên tục (&ge; 3 lần). Giám thị cần chú ý kiểm tra!
            </span>
          }
        />
      )}

      {/* Thẻ thống kê tổng quan */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Tổng thí sinh trong phòng"
              value={stats.total}
              prefix={<SafetyCertificateOutlined style={{ color: 'var(--primary)' }} />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Thí sinh làm bài nghiêm túc"
              value={stats.clean}
              valueStyle={{ color: '#10b981' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Cảnh báo rời tab (1-2 lần)"
              value={stats.warning}
              valueStyle={{ color: '#f59e0b' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Nguy cơ cao gian lận (≥3 lần)"
              value={stats.highRisk}
              valueStyle={{ color: '#ef4444' }}
              prefix={<AlertOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bảng thí sinh và Feed thời gian thực */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <SafetyCertificateOutlined style={{ color: 'var(--primary)' }} />
                <span>Danh sách thí sinh giám sát</span>
                <Badge count={filteredParticipants.length} style={{ backgroundColor: 'var(--primary)' }} />
              </Space>
            }
            extra={
              <Button size="small" icon={<ReloadOutlined />} onClick={reload} loading={loading}>
                Làm mới
              </Button>
            }
          >
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <Input
                placeholder="Tìm theo MSSV hoặc họ tên…"
                prefix={<SearchOutlined style={{ color: 'var(--muted)' }} />}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                allowClear
                style={{ width: 240 }}
              />
              <Radio.Group
                value={filterMode}
                onChange={(e) => setFilterMode(e.target.value)}
                optionType="button"
                buttonStyle="solid"
                size="middle"
              >
                <Radio.Button value="all">Tất cả ({stats.total})</Radio.Button>
                <Radio.Button value="violating">Có rời tab ({stats.warning + stats.highRisk})</Radio.Button>
                <Radio.Button value="high_risk">Nguy cơ cao ({stats.highRisk})</Radio.Button>
              </Radio.Group>
            </div>

            <Table
              rowKey="userId"
              size="small"
              columns={columns}
              dataSource={filteredParticipants}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              locale={{ emptyText: <Empty description="Không có thí sinh nào phù hợp bộ lọc" /> }}
            />
          </Card>
        </Col>

        {/* Cột Feed sự kiện vi phạm thời gian thực */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space>
                <span className="live-dot" style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
                <span>Nhật ký thời gian thực</span>
                <Badge count={recentViolations.length} overflowCount={99} />
              </Space>
            }
            styles={{ body: { maxHeight: 520, overflowY: 'auto', padding: '12px 16px' } }}
          >
            {recentViolations.length === 0 ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Chưa có sự kiện vi phạm nào được ghi nhận"
              />
            ) : (
              <Timeline
                mode="left"
                items={recentViolations.map((v) => ({
                  color: '#ef4444',
                  label: (
                    <span className="mono muted" style={{ fontSize: 11 }}>
                      {formatRelative(v.createdAt, now)}
                    </span>
                  ),
                  children: (
                    <div style={{ fontSize: 13, marginBottom: 8 }}>
                      <div>
                        <b>{v.fullName || v.username}</b>{' '}
                        <span className="mono muted">({v.username})</span>
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                        {v.details || 'Rời màn hình làm bài thi'}
                      </div>
                      <div className="mono muted" style={{ fontSize: 11 }}>
                        {formatDateTime(v.createdAt)}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Modal xem lịch sử vi phạm chi tiết của một thí sinh */}
      <Modal
        title={
          selectedUser && (
            <Space>
              <HistoryOutlined />
              <span>
                Nhật ký vi phạm: <b>{selectedUser.fullName || selectedUser.username}</b> ({selectedUser.username})
              </span>
            </Space>
          )
        }
        open={!!selectedUser}
        onCancel={() => setSelectedUser(null)}
        footer={[
          <Button key="close" type="primary" onClick={() => setSelectedUser(null)}>
            Đóng
          </Button>,
        ]}
        width={560}
      >
        {selectedUser && (
          <div style={{ marginTop: 16 }}>
            <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Tag color={selectedUser.tabSwitchCount >= 3 ? 'error' : selectedUser.tabSwitchCount > 0 ? 'warning' : 'success'}>
                Tổng vi phạm: {selectedUser.tabSwitchCount || 0} lần
              </Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                Đăng ký thi lúc: {formatDateTime(selectedUser.registeredAt)}
              </Typography.Text>
            </div>

            {(!selectedUser.violations || selectedUser.violations.length === 0) ? (
              <Empty description="Thí sinh này chưa có ghi nhận vi phạm nào" />
            ) : (
              <Timeline
                items={selectedUser.violations.map((v, idx) => ({
                  color: idx === 0 ? '#ef4444' : '#f59e0b',
                  children: (
                    <div>
                      <div style={{ fontWeight: 600 }}>
                        {v.type === 'TAB_SWITCH' ? 'Chuyển tab / Thu nhỏ trình duyệt' : 'Mất tiêu điểm cửa sổ'}
                      </div>
                      <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{v.details}</div>
                      <div className="mono muted" style={{ fontSize: 11 }}>
                        {formatDateTime(v.createdAt)} ({formatRelative(v.createdAt, now)})
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
