import { useCallback, useMemo, useState } from 'react'
import {
  App,
  Badge,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
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
  ClockCircleOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { api } from '../api'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { formatDateTime, formatRelative } from '../lib/format'

export default function ContestProctoring({ contestId }) {
  const { notification } = App.useApp()
  const now = useNow(5000)
  const { data, loading, reload, setData } = useFetch(() => api.getProctorStatus(contestId), [contestId])
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'online' | 'violating'
  const [selectedUser, setSelectedUser] = useState(null) // user xem timeline modal
  const [realtimePresence, setRealtimePresence] = useState({})

  // Gộp trạng thái online realtime từ WebSocket vào danh sách thí sinh
  const participants = useMemo(() => {
    return (data?.participants || []).map((p) => {
      const isOnline = p.userId in realtimePresence ? realtimePresence[p.userId] : Boolean(p.online)
      return { ...p, online: isOnline }
    })
  }, [data?.participants, realtimePresence])

  // Lắng nghe sự kiện PROCTOR_ALERT và PRESENCE_UPDATE từ WebSocket
  useSocket(
    useCallback(
      (msg) => {
        // Cập nhật trạng thái Online / Offline realtime
        if (msg.type === 'PRESENCE_UPDATE') {
          setRealtimePresence((prev) => ({
            ...prev,
            [msg.userId]: msg.status === 'ONLINE',
          }))
          return
        }

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

        // Cập nhật danh sách thí sinh realtime
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

          return {
            ...prev,
            participants: updatedParticipants,
          }
        })
      },
      [contestId, notification, setData],
    ),
  )

  // Thống kê nhanh
  const stats = useMemo(() => {
    const total = participants.length
    const online = participants.filter((p) => p.online).length
    const violating = participants.filter((p) => p.tabSwitchCount > 0).length
    return { total, online, violating }
  }, [participants])

  // Lọc danh sách thí sinh
  const filteredParticipants = useMemo(() => {
    const q = search.trim().toLowerCase()
    return participants
      .filter((p) => {
        if (filterMode === 'online' && !p.online) return false
        if (filterMode === 'violating' && (!p.tabSwitchCount || p.tabSwitchCount === 0)) return false
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
      title: 'MSSV',
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
      title: 'Trạng thái',
      dataIndex: 'online',
      width: 120,
      filters: [
        { text: 'Đang online', value: true },
        { text: 'Offline', value: false },
      ],
      onFilter: (v, r) => Boolean(r.online) === v,
      render: (online) =>
        online ? (
          <Badge status="success" text={<Typography.Text type="success" style={{ fontWeight: 600 }}>Online</Typography.Text>} />
        ) : (
          <Badge status="default" text={<Typography.Text type="secondary">Offline</Typography.Text>} />
        ),
    },
    {
      title: 'Số lần rời màn hình',
      dataIndex: 'tabSwitchCount',
      width: 180,
      sorter: (a, b) => (a.tabSwitchCount || 0) - (b.tabSwitchCount || 0),
      render: (v) => {
        const count = v || 0
        return (
          <b>{count} lần</b>
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
      {/* Thẻ thống kê tổng quan */}
      <Row gutter={[12, 12]}>
        <Col xs={12} sm={8} md={4} style={{ flex: '1 1 20%', minWidth: 160 }}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Tổng thí sinh"
              value={stats.total}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4} style={{ flex: '1 1 20%', minWidth: 160 }}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Đang Online"
              value={stats.online}
              valueStyle={{ color: '#10b981' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4} style={{ flex: '1 1 20%', minWidth: 160 }}>
          <Card size="small" style={{ background: 'var(--bg-elevated)' }}>
            <Statistic
              title="Cảnh báo rời tab"
              value={stats.violating}
              valueStyle={{ color: '#f59e0b' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
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
            <Radio.Button value="online">Đang Online ({stats.online})</Radio.Button>
            <Radio.Button value="violating">Có rời tab ({stats.violating})</Radio.Button>
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
