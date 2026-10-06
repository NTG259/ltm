import { Button, Result, Spin } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth/context'
import { useFetch } from '../lib/hooks'
import { Workspace } from './WorkspacePage'

/** Làm bài trong kỳ thi: /contests/:cid/problems/:label */
export default function ContestWorkspacePage() {
  const { cid, label } = useParams()
  const { user, isAdmin } = useAuth()
  const navigate = useNavigate()
  const { data: contest, error } = useFetch(() => api.getContest(cid, user), [cid, user])

  if (error) return <Result status="404" title="Không tìm thấy kỳ thi" />
  if (!contest) return <Spin style={{ display: 'block', margin: 80 }} />

  const back = <Button onClick={() => navigate(`/contests/${cid}`)}>Về trang kỳ thi</Button>
  if (!isAdmin && !contest.registered) return <Result status="403" title="Bạn chưa đăng ký kỳ thi này" extra={back} />
  const problem = contest.problems.find((p) => p.label === label)
  if (!problem) return <Result status="404" title={`Kỳ thi không có bài ${label}`} extra={back} />

  return <Workspace key={`${cid}-${label}`} id={String(problem.problemId)} contest={contest} label={label} />
}
