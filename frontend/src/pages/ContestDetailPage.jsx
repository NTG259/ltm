import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { App, Breadcrumb, Button, Card, Empty, Popconfirm, Result, Space, Spin, Table, Tabs, Tag, Tooltip, Typography } from 'antd'
import { CheckCircleFilled, DiffOutlined, ExclamationCircleFilled, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow, useSocket } from '../lib/hooks'
import { formatDateTime, formatDuration, formatRelative } from '../lib/format'
import { CONTEST_STATUS, liveStatus } from '../lib/contest'
import ContestClock from '../components/ContestClock'
import ContestStandings from '../components/ContestStandings'
import ContestProctoring from '../components/ContestProctoring'
import ContestPlagiarism from '../components/ContestPlagiarism'
import VerdictTag from '../components/VerdictTag'

function ProblemsTab({ contest, status, mySubs, canSolve }) {
  const navigate = useNavigate()
  if (status === 'UPCOMING')
    return (
      <Empty
        image={<LockOutlined style={{ fontSize: 40, color: 'var(--muted)' }} />}
        description="Đề bài sẽ hiện khi kỳ thi bắt đầu"
      />
    )

  const mine = {}
  mySubs.forEach((s) => {
    if (s.verdict === 'AC') mine[s.problemId] = 'solved'
    else if (!mine[s.problemId]) mine[s.problemId] = 'tried'
  })
  const open = (p) => navigate(status === 'ENDED' ? `/problems/${p.problemId}` : `/contests/${contest.id}/problems/${p.label}`)

  return (
    <Table
      rowKey="label"
      pagination={false}
      dataSource={contest.problems}
      onRow={(p) => ({ onClick: () => canSolve && open(p), style: { cursor: canSolve ? 'pointer' : undefined } })}
      columns={[
        {
          title: '',
          width: 44,
          align: 'center',
          render: (_, p) =>
            mine[p.problemId] === 'solved' ? (
              <CheckCircleFilled style={{ color: '#10b981' }} />
            ) : mine[p.problemId] ? (
              <ExclamationCircleFilled style={{ color: '#f59e0b' }} />
            ) : null,
        },
        { title: 'Bài', dataIndex: 'label', width: 60, render: (v) => <b style={{ fontSize: 16 }}>{v}</b> },
        { title: 'Tên bài', dataIndex: 'title', render: (v) => <span style={{ fontWeight: 500 }}>{v}</span> },
        {
          title: 'Giới hạn',
          width: 130,
          render: (_, p) => (
            <span className="mono muted" style={{ fontSize: 12 }}>
              {p.timeLimitMs / 1000}s · {p.memoryLimitMb}MB
            </span>
          ),
        },
        {
          title: 'Đã giải',
          width: 110,
          render: (_, p) => (
            <Tooltip title={`${p.solvedCount} thí sinh AC / ${p.attemptCount} thí sinh đã nộp`}>
              <span className="mono">
                {p.solvedCount}/{p.attemptCount}
              </span>
            </Tooltip>
          ),
        },
        {
          title: '',
          width: 110,
          align: 'right',
          render: (_, p) =>
            canSolve && (
              <Button size="small" type={status === 'RUNNING' ? 'primary' : 'default'} onClick={() => open(p)}>
                {status === 'RUNNING' ? 'Làm bài' : 'Luyện tập'}
              </Button>
            ),
        },
      ]}
    />
  )
}

function SubmissionsTab({ subs, labels, showUser }) {
  const now = useNow(15000)
  return (
    <Table
      rowKey="id"
      size="small"
      dataSource={subs}
      pagination={{ pageSize: 15, hideOnSinglePage: true }}
      locale={{ emptyText: 'Chưa có bài nộp' }}
      columns={[
        {
          title: 'ID',
          dataIndex: 'id',
          width: 80,
          render: (id) => (
            <Link to={`/submissions/${id}`} className="mono">
              #{id}
            </Link>
          ),
        },
        { title: 'Thời điểm', dataIndex: 'createdAt', width: 130, render: (v) => formatRelative(v, now) },
        ...(showUser ? [{ title: 'Thí sinh', render: (_, s) => `${s.userName} (${s.userId})` }] : []),
        { title: 'Bài', render: (_, s) => `${labels[s.problemId] ?? '?'}. ${s.problemTitle}` },
        { title: 'Kết quả', width: 160, render: (_, s) => <VerdictTag submission={s} /> },
      ]}
    />
  )
}

export default function ContestDetailPage() {
  const { id } = useParams()
  const { user, isAdmin, isLecturer } = useAuth()
  const isStaff = isAdmin || isLecturer
  const { message } = App.useApp()
  const navigate = useNavigate()
  const now = useNow(1000)
  const [tab, setTab] = useState('problems')
  const [registering, setRegistering] = useState(false)
  const [unregistering, setUnregistering] = useState(false)
  const contest = useFetch(() => api.getContest(id, user), [id, user])
  const standings = useFetch(() => api.contestStandings(id), [id])
  const subs = useFetch(
    () => api.listSubmissions({ contestId: id, userId: isStaff ? undefined : user.id }),
    [id, user.id, isStaff],
  )
  const c = contest.data
  const status = c ? liveStatus(c, now) : null
  const { reload: reloadContest } = contest
  const { reload: reloadStandings } = standings
  const { reload: reloadSubs } = subs

  // Kỳ thi vừa bắt đầu/kết thúc → tải lại một lần để nhận đề bài.
  const prevStatus = useRef(null)
  useEffect(() => {
    if (prevStatus.current && status && prevStatus.current !== status) reloadContest()
    prevStatus.current = status
  }, [status, reloadContest])

  useSocket(
    useCallback(
      (msg) => {
        if (msg.type === 'CONTEST_UPDATE' && msg.contestId === Number(id)) reloadContest()
        if (msg.type === 'SUBMISSION_UPDATE' && msg.submission.contestId === Number(id)) {
          if (msg.submission.status === 'FINISHED' || msg.submission.status === 'IN_QUEUE') reloadStandings()
          reloadSubs()
        }
      },
      [id, reloadContest, reloadStandings, reloadSubs],
    ),
  )

  const labels = useMemo(() => Object.fromEntries((c?.problems || []).map((p) => [p.problemId, p.label])), [c])

  if (contest.error)
    return (
      <Result
        status="404"
        title="Không tìm thấy kỳ thi"
        extra={<Button onClick={() => navigate('/contests')}>Danh sách kỳ thi</Button>}
      />
    )
  if (!c) return <Spin style={{ display: 'block', margin: 80 }} />

  const register = async () => {
    setRegistering(true)
    try {
      await api.registerContest(c.id, user)
      message.success('Đăng ký thành công')
      reloadContest()
      reloadStandings()
    } catch (e) {
      message.error(e.message)
    } finally {
      setRegistering(false)
    }
  }

  const unregister = async () => {
    setUnregistering(true)
    try {
      await api.unregisterContest(c.id)
      message.success('Đã hủy đăng ký')
      reloadContest()
      reloadStandings()
    } catch (e) {
      message.error(e.message)
    } finally {
      setUnregistering(false)
    }
  }

  const canSolve = isStaff || status === 'ENDED' || (status === 'RUNNING' && c.registered)
  const myRow = standings.data?.rows.find((r) => r.userId === user.id)

  return (
    <div className="page">
      <Breadcrumb
        style={{ marginBottom: 12 }}
        items={[{ title: <Link to={isStaff ? (isAdmin ? '/admin/contests' : '/teacher/contests') : '/contests'}>Kỳ thi</Link> }, { title: c.title }]}
      />
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 260, display: 'grid', gap: 8 }}>
            <Space wrap size={6}>
              <Tag color={CONTEST_STATUS[status].color}>{CONTEST_STATUS[status].label}</Tag>
              <Tag>ICPC</Tag>
              {c.registered && <Tag color="success">Đã đăng ký</Tag>}
            </Space>
            <Typography.Title level={3} style={{ margin: 0 }}>
              {c.title}
            </Typography.Title>
            <div className="contest-meta">
              <span>Bắt đầu: {formatDateTime(c.startAt)}</span>
              <span>Thời lượng: {formatDuration(c.durationMin)}</span>
              <span>{c.participantCount} thí sinh</span>
              {myRow && (
                <span>
                  Hạng của bạn: <b style={{ color: 'var(--text)' }}>#{myRow.rank}</b> · {myRow.solved} bài · phạt {myRow.penalty}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'grid', gap: 10, justifyItems: 'end' }}>
            <ContestClock contest={c} />
            {!isStaff && !c.registered && status === 'UPCOMING' && (
              <Button type="primary" size="large" loading={registering} onClick={register}>
                Đăng ký tham gia
              </Button>
            )}
            {!isStaff && c.registered && status === 'UPCOMING' && (
              <Popconfirm
                title="Hủy đăng ký kỳ thi?"
                description="Bạn có thể đăng ký lại trước khi kỳ thi bắt đầu."
                okText="Hủy đăng ký"
                cancelText="Giữ lại"
                okButtonProps={{ danger: true }}
                onConfirm={unregister}
              >
                <Button size="large" loading={unregistering} danger>
                  Hủy đăng ký
                </Button>
              </Popconfirm>
            )}
          </div>
        </div>
      </Card>

      {status === 'RUNNING' && !c.registered && !isStaff && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Typography.Text type="warning">Bạn cần đăng ký để xem đề và nộp bài trong kỳ thi này.</Typography.Text>
        </Card>
      )}

      <Card styles={{ body: { paddingTop: 4 } }}>
        <Tabs
          activeKey={tab}
          onChange={setTab}
          items={[
            {
              key: 'problems',
              label: 'Đề bài',
              children:
                status === 'RUNNING' && !c.registered && !isStaff ? (
                  <Empty description="Đăng ký để xem đề bài" />
                ) : (
                  <ProblemsTab contest={c} status={status} mySubs={subs.data || []} canSolve={canSolve} />
                ),
            },
            {
              key: 'standings',
              label: 'Xếp hạng',
              children: (
                <ContestStandings
                  data={standings.data}
                  loading={standings.loading && !standings.data}
                  currentUserId={user.id}
                  problems={c.problems}
                  contestTitle={c.title}
                />
              ),
            },
            {
              key: 'subs',
              label: 'Bài nộp',
              children: <SubmissionsTab subs={subs.data || []} labels={labels} showUser={isStaff} />,
            },
            ...(isStaff
              ? [
                  {
                    key: 'proctor',
                    label: (
                      <Space size={6}>
                        <SafetyCertificateOutlined style={{ color: '#ef4444' }} />
                        <span>Giám sát</span>
                      </Space>
                    ),
                    children: <ContestProctoring contestId={c.id} />,
                  },
                  {
                    key: 'plagiarism',
                    label: (
                      <Space size={6}>
                        <DiffOutlined style={{ color: '#f59e0b' }} />
                        <span>Chống đạo văn</span>
                      </Space>
                    ),
                    children: <ContestPlagiarism contestId={c.id} />,
                  },
                ]
              : []),
            {
              key: 'rules',
              label: 'Thể lệ',
              children: (
                <div className="statement" style={{ padding: '4px 0' }}>
                  <p>{c.description}</p>
                  <h3>Cách tính điểm (ICPC)</h3>
                  <p>
                    Xếp hạng theo số bài giải đúng (AC). Nếu bằng nhau, ai có tổng thời gian phạt ít hơn xếp trên. Thời gian phạt
                    của mỗi bài = số phút từ lúc bắt đầu đến khi AC + {standings.data?.penaltyPerWrong ?? 20} phút cho mỗi lần nộp
                    sai trước đó. Lỗi biên dịch (CE) và vi phạm bảo mật (SEC) không bị tính phạt.
                  </p>
                  <h3>Quy định</h3>
                  <p>
                    Chỉ thí sinh đã đăng ký mới được nộp bài. Ngôn ngữ C++17. Bài nộp sau khi kỳ thi kết thúc không được tính vào
                    bảng xếp hạng.
                  </p>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
