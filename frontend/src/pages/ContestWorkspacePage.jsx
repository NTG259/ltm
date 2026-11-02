import { useEffect, useState } from 'react'
import { FileQuestion, Trophy } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch, useNow } from '../lib/hooks'
import { liveStatus } from '../lib/contest'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '../components/ui/empty'
import { Spinner } from '../components/ui/spinner'
import { Workspace } from './WorkspacePage'

function ContestWorkspaceState({ title, description, onBack, icon: Icon = Trophy }) {
  return (
    <div className="page">
      <Card>
        <CardContent>
          <Empty className="min-h-72">
            <EmptyHeader>
              <EmptyMedia variant="icon"><Icon /></EmptyMedia>
              <EmptyTitle>{title}</EmptyTitle>
              {description && <EmptyDescription>{description}</EmptyDescription>}
            </EmptyHeader>
            {onBack && <Button variant="outline" onClick={onBack}>Về trang kỳ thi</Button>}
          </Empty>
        </CardContent>
      </Card>
    </div>
  )
}

export default function ContestWorkspacePage() {
  const { cid, label } = useParams()
  const { user, isAdmin, isLecturer } = useAuth()
  const navigate = useNavigate()
  const now = useNow(1000)
  const { data: contest, error, reload } = useFetch(() => api.getContest(cid, user), [cid, user])
  const [registrationError, setRegistrationError] = useState(null)
  const isStaff = isAdmin || isLecturer
  const status = contest ? liveStatus(contest, now) : null
  const contestId = contest?.id
  const registered = contest?.registered
  const needsRegistration = !isStaff && contestId && status === 'RUNNING' && !registered

  useEffect(() => {
    if (needsRegistration) {
      api.registerContest(contestId, user)
        .then(reload)
        .catch(setRegistrationError)
    }
  }, [contestId, needsRegistration, user, reload])

  if (error) return <ContestWorkspaceState title="Không tìm thấy kỳ thi" icon={FileQuestion} />
  if (registrationError) {
    return <ContestWorkspaceState title="Không thể đăng ký kỳ thi" description={registrationError.message} onBack={() => navigate(`/contests/${cid}`)} />
  }
  if (!contest || needsRegistration) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center" aria-label="Đang chuẩn bị workspace">
        <Spinner className="size-6" />
      </div>
    )
  }

  const goBack = () => navigate(`/contests/${cid}`)
  if (!isStaff && !contest.registered && status === 'UPCOMING') {
    return <ContestWorkspaceState title="Kỳ thi chưa bắt đầu" description="Bạn chỉ có thể mở đề khi kỳ thi bắt đầu." onBack={goBack} />
  }
  const problem = (contest.problems || []).find((item) => item.label === label)
  if (!problem) {
    return <ContestWorkspaceState title={`Kỳ thi không có bài ${label}`} icon={FileQuestion} onBack={goBack} />
  }

  return <Workspace key={`${cid}-${label}`} id={String(problem.problemId)} contest={contest} label={label} />
}
