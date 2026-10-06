import { useCallback, useState } from 'react'
import { App, Button, Card, Col, Empty, Row, Segmented, Space, Spin, Tag, Typography } from 'antd'
import { CalendarOutlined, CheckOutlined, FieldTimeOutlined, TeamOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { formatDateTime, formatDuration } from '../lib/format'
import { CONTEST_STATUS, liveStatus } from '../lib/contest'
import ContestClock from '../components/ContestClock'

function ContestCard({ contest: c, status, onRegister, registering }) {
  const navigate = useNavigate()
  const { isAdmin } = useAuth()
  const open = () => navigate(`/contests/${c.id}`)

  let action
  if (status === 'ENDED') action = <Button onClick={open}>Xem kết quả</Button>
  else if (isAdmin) action = <Button onClick={open}>Theo dõi</Button>
  else if (!c.registered)
    action = (
      <Button type="primary" loading={registering} onClick={() => onRegister(c)}>
        {status === 'RUNNING' ? 'Đăng ký & vào thi' : 'Đăng ký'}
      </Button>
    )
  else if (status === 'RUNNING')
    action = (
      <Button type="primary" onClick={open}>
        Vào thi
      </Button>
    )
  else action = <Button onClick={open}>Xem thể lệ</Button>

  return (
    <Card className="contest-card" hoverable onClick={open}>
      <Space wrap size={6}>
        <Tag color={CONTEST_STATUS[status].color}>{CONTEST_STATUS[status].label}</Tag>
        {c.registered && (
          <Tag icon={<CheckOutlined />} color="success" variant="filled">
            Đã đăng ký
          </Tag>
        )}
      </Space>
      <Typography.Title level={4} style={{ margin: 0 }}>
        {c.title}
      </Typography.Title>
      <div className="contest-meta">
        <span>
          <CalendarOutlined /> {formatDateTime(c.startAt)}
        </span>
        <span>
          <FieldTimeOutlined /> {formatDuration(c.durationMin)}
        </span>
        <span>
          <TeamOutlined /> {c.participantCount} thí sinh
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {status !== 'ENDED' ? <ContestClock contest={c} compact /> : <span />}
        {/* Không cho click nút lan ra click thẻ */}
        <span onClick={(e) => e.stopPropagation()}>{action}</span>
      </div>
    </Card>
  )
}

export default function ContestsPage() {
  const { user } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [filter, setFilter] = useState('active')
  const [registering, setRegistering] = useState(null)
  const list = useFetch(() => api.listContests(user), [user])
  const { reload } = list
  useSocket(useCallback((msg) => msg.type === 'CONTEST_UPDATE' && reload(), [reload]))

  const register = async (c) => {
    setRegistering(c.id)
    try {
      await api.registerContest(c.id, user)
      message.success(`Đã đăng ký "${c.title}"`)
      if (liveStatus(c, Date.now()) === 'RUNNING') navigate(`/contests/${c.id}`)
      else reload()
    } catch (e) {
      message.error(e.message)
    } finally {
      setRegistering(null)
    }
  }

  const contests = (list.data || []).map((c) => ({ c, status: liveStatus(c, now) }))
  const order = { RUNNING: 0, UPCOMING: 1, ENDED: 2 }
  const shown = contests
    .filter(({ status }) => (filter === 'active' ? status !== 'ENDED' : status === 'ENDED'))
    .sort(
      (a, b) =>
        order[a.status] - order[b.status] || (a.status === 'ENDED' ? b.c.startAt - a.c.startAt : a.c.startAt - b.c.startAt),
    )

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Kỳ thi</h1>
          <p>Đăng ký và tham gia các kỳ thi lập trình do giảng viên tổ chức.</p>
        </div>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'active', label: 'Đang & sắp diễn ra' },
            { value: 'ended', label: 'Đã kết thúc' },
          ]}
        />
      </div>
      {list.loading ? (
        <Spin style={{ display: 'block', margin: 60 }} />
      ) : shown.length ? (
        <Row gutter={[16, 16]}>
          {shown.map(({ c, status }) => (
            <Col xs={24} lg={12} key={c.id}>
              <ContestCard contest={c} status={status} onRegister={register} registering={registering === c.id} />
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <Empty description={filter === 'active' ? 'Hiện chưa có kỳ thi nào sắp diễn ra' : 'Chưa có kỳ thi nào kết thúc'} />
        </Card>
      )}
    </div>
  )
}
