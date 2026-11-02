import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import ClassroomCoursePanel from '../components/classroom/ClassroomCoursePanel'
import ClassroomContestsPanel from '../components/classroom/ClassroomContestsPanel'
import { api } from '../api'
import { useFetch } from '../lib/hooks'
import { Button } from '../components/ui/button'
import { Card } from '../components/ui/card'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'

export default function MyClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('course')
  const classroomState = useFetch(() => api.getClassroom(id), [id])
  const courseState = useFetch(() => api.getClassroomCourse(id).catch(() => null), [id])
  const courseId = courseState.data?.courseId
  const progressState = useFetch(
    () => courseId ? api.getCourseProgress(courseId) : Promise.resolve(null),
    [courseId],
  )

  const classroom = classroomState.data
  const course = courseState.data
  const progress = progressState.data

  if (classroomState.loading) {
    return (
      <div className="classroom-learning classroom-learning--loading" aria-busy="true">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full mt-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    )
  }

  return (
    <main className="classroom-learning">
      <Button
        variant="ghost"
        size="sm"
        className="classroom-learning__back"
        onClick={() => navigate('/my-classrooms')}
      >
        <ArrowLeft data-icon="inline-start" />
        Lớp học của tôi
      </Button>

      <Card className="classroom-learning__content">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start">
            <TabsTrigger value="course" className="data-active:text-primary">Nội dung học tập</TabsTrigger>
            <TabsTrigger value="contests" className="data-active:text-primary">Kỳ thi của lớp</TabsTrigger>
          </TabsList>
          <TabsContent value="course">
            <ClassroomCoursePanel course={course} loading={courseState.loading} progress={progress} classroomId={id} />
          </TabsContent>
          <TabsContent value="contests">
            <ClassroomContestsPanel classroom={classroom} loading={classroomState.loading} />
          </TabsContent>
        </Tabs>
      </Card>
    </main>
  )
}
