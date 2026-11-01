import { Button, Empty, Skeleton, Tag, Typography } from 'antd'
import { CalendarOutlined, ClockCircleOutlined, RightOutlined, TrophyOutlined } from '@ant-design/icons'
import { useNow } from '../../lib/hooks'
import { formatDateTime } from '../../lib/format'

function contestPhase(contest, now) {
  if (now < contest.startAt) return { color: 'blue', label: 'Sắp diễn ra' }
  if (now < contest.endAt) return { color: 'green', label: 'Đang diễn ra' }
  return { color: 'default', label: 'Đã kết thúc' }
}

export default function ClassroomContestsPanel({ classroom, loading }) {
  const now = useNow(30000)
  const contests = classroom?.contests || []

  if (loading) {
    return <div className="classroom-contests__loading" aria-busy="true"><Skeleton active paragraph={{ rows: 5 }} /></div>
  }

  if (!contests.length) {
    return (
      <Empty
        className="classroom-contests__empty"
        image={<TrophyOutlined />}
        description="Lớp học chưa có kỳ thi nào"
      />
    )
  }

  return (
    <div className="classroom-contests">
      <header className="classroom-contests__head">
        <div>
          <Typography.Title level={2}>Kỳ thi của lớp</Typography.Title>
          <Typography.Text type="secondary">Theo dõi lịch thi và vào phòng thi đúng giờ.</Typography.Text>
        </div>
        <Tag>{contests.length} kỳ thi</Tag>
      </header>
      <div className="classroom-contests__grid">
        {contests.map((contest) => {
          const phase = contestPhase(contest, now)
          return (
            <article className="classroom-contest" key={contest.contestId}>
              <div className="classroom-contest__top">
                <span className="classroom-contest__icon"><TrophyOutlined /></span>
                <Tag color={phase.color}>{phase.label}</Tag>
              </div>
              <Typography.Title level={3}>{contest.title}</Typography.Title>
              <div className="classroom-contest__schedule">
                <span><CalendarOutlined /> Bắt đầu <strong>{formatDateTime(contest.startAt)}</strong></span>
                <span><ClockCircleOutlined /> Kết thúc <strong>{formatDateTime(contest.endAt)}</strong></span>
              </div>
              <Button
                type={phase.label === 'Đang diễn ra' ? 'primary' : 'default'}
                block
                href={`#/contests/${contest.contestId}`}
              >
                Xem kỳ thi <RightOutlined />
              </Button>
            </article>
          )
        })}
      </div>
    </div>
  )
}
