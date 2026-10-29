import { useState } from 'react'
import {
  App, Button, Empty, Modal, Select, Space, Spin, Table, Tag, Tabs,
  Typography, Upload, Popconfirm,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, TrophyOutlined,
  FilePdfOutlined, UploadOutlined, DeleteOutlined, PlayCircleOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, useNow } from '../../lib/hooks'
import { formatDateTime } from '../../lib/format'

function phaseTag(c, now) {
  if (now < c.startAt) return <Tag color="blue">Sắp diễn ra</Tag>
  if (now < c.endAt) return <Tag color="green">Đang diễn ra</Tag>
  return <Tag color="default">Đã kết thúc</Tag>
}

// ── Tab Sinh viên ──────────────────────────────────────────────────────────
function StudentsTab({ classroomId }) {
  const { message } = App.useApp()
  const { data: students, loading, reload: refresh } = useFetch(
    () => api.listClassroomStudents(classroomId), [classroomId]
  )

  const handleImport = async (file) => {
    try {
      const res = await api.importClassroomStudents(classroomId, file)
      message.success(`Đã import ${res.imported} sinh viên`)
      refresh()
    } catch (e) {
      message.error(e.message)
    }
    return false
  }

  const handleRemove = async (userId) => {
    try {
      await api.removeClassroomStudent(classroomId, userId)
      message.success('Đã xoá sinh viên')
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  const columns = [
    { title: 'MSSV', dataIndex: 'username', className: 'mono' },
    { title: 'Họ tên', dataIndex: 'fullName' },
    {
      title: 'Ngày thêm',
      dataIndex: 'joinedAt',
      render: (v) => new Date(v).toLocaleDateString('vi-VN'),
    },
    {
      title: '',
      width: 80,
      render: (_, r) => (
        <Popconfirm title="Xoá sinh viên này?" onConfirm={() => handleRemove(r.userId)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ]

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 12 }}>
        <Upload accept=".csv" beforeUpload={handleImport} showUploadList={false}>
          <Button icon={<UploadOutlined />}>Import CSV</Button>
        </Upload>
      </Space>
      {!loading && (!students || students.length === 0) ? (
        <Empty description="Chưa có sinh viên. Import file CSV (mssv,password) để thêm." />
      ) : (
        <Table rowKey="userId" columns={columns} dataSource={students || []} loading={loading} pagination={false} size="small" />
      )}
    </div>
  )
}

// ── Tab Kỳ thi ────────────────────────────────────────────────────────────
function ContestsTab({ classroomId }) {
  const now = useNow(30000)
  const { message } = App.useApp()
  const { data: contests, loading, reload } = useFetch(
    () => api.listClassroomContests(classroomId), [classroomId]
  )
  const { data: available } = useFetch(() => api.teacherAvailableContests(), [])
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedContest, setSelectedContest] = useState(null)
  const [assigning, setAssigning] = useState(false)
  const assignedIds = new Set((contests || []).map((contest) => contest.contestId))
  const availableToAssign = (available || []).filter((contest) => !assignedIds.has(contest.id))

  const assign = async () => {
    if (!selectedContest) return
    setAssigning(true)
    try {
      await api.assignClassroomContest(classroomId, selectedContest)
      message.success('Đã gán kỳ thi vào lớp')
      setAssignOpen(false)
      setSelectedContest(null)
      reload()
    } catch (error) {
      message.error(error.message)
    } finally {
      setAssigning(false)
    }
  }

  const columns = [
    {
      title: 'Kỳ thi',
      dataIndex: 'title',
      render: (t, r) => (
        <Link to={`/contests/${r.contestId}`} style={{ fontWeight: 600 }}>
          <TrophyOutlined style={{ marginRight: 6 }} />{t}
        </Link>
      ),
    },
    { title: 'Bắt đầu', dataIndex: 'startAt', width: 170, render: (v) => formatDateTime(v) },
    { title: 'Kết thúc', dataIndex: 'endAt', width: 170, render: (v) => formatDateTime(v) },
    { title: 'Trạng thái', width: 140, render: (_, r) => phaseTag(r, now) },
  ]

  return (
    <div style={{ padding: 20 }}>
      <Button icon={<PlusOutlined />} onClick={() => setAssignOpen(true)} disabled={!availableToAssign.length} style={{ marginBottom: 12 }}>
        Gán kỳ thi có sẵn
      </Button>
      {!loading && (!contests || contests.length === 0) ? (
        <Empty description="Lớp này chưa có kỳ thi nào." />
      ) : (
        <Table rowKey="contestId" columns={columns} dataSource={contests || []} loading={loading} pagination={false} size="small" />
      )}
      <Modal open={assignOpen} title="Gán kỳ thi có sẵn" onOk={assign} onCancel={() => setAssignOpen(false)}
        confirmLoading={assigning} okText="Gán vào lớp" cancelText="Hủy">
        <Select style={{ width: '100%', marginTop: 12 }} value={selectedContest} onChange={setSelectedContest}
          placeholder="Chọn kỳ thi do admin hoặc bạn tạo"
          options={availableToAssign.map((contest) => ({ value: contest.id, label: contest.title }))} />
      </Modal>
    </div>
  )
}

// ── Tab Khóa học ──────────────────────────────────────────────────────────
function CourseTab({ classroomId }) {
  const { message } = App.useApp()
  const [selectedUnit, setSelectedUnit] = useState(null)
  const [assignOpen, setAssignOpen] = useState(false)
  const [assigningId, setAssigningId] = useState(null)
  const [uploading, setUploading] = useState(false)

  const { data: courseData, loading, reload: refresh } = useFetch(
    () => api.getClassroomCourse(classroomId).catch(() => null), [classroomId]
  )
  const { data: allCourses } = useFetch(() => api.listCourses(), [])

  const units = courseData?.units || []
  const activeUnit = selectedUnit != null
    ? units.find((u) => u.id === selectedUnit) ?? units[0]
    : units[0]

  const handleAssign = async () => {
    if (!assigningId) return
    try {
      await api.assignClassroomCourse(classroomId, assigningId)
      message.success('Đã gán khóa học')
      setAssignOpen(false)
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleUnassign = async () => {
    try {
      await api.unassignClassroomCourse(classroomId)
      message.success('Đã huỷ gán khóa học')
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleUpload = async (file) => {
    if (!activeUnit) return false
    setUploading(true)
    try {
      await api.uploadUnitFile(activeUnit.id, file)
      message.success('Đã tải lên tài liệu')
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setUploading(false)
    }
    return false
  }

  const handleDeleteFile = async (unitId, fileId) => {
    try {
      await api.deleteUnitFile(unitId, fileId)
      message.success('Đã xoá file')
      refresh()
    } catch (e) {
      message.error(e.message)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>

  if (!courseData) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Empty
          description="Lớp này chưa được gán khóa học"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
        <Button type="primary" icon={<PlusOutlined />} style={{ marginTop: 16 }} onClick={() => setAssignOpen(true)}>
          Gán khóa học
        </Button>

        <Modal
          title="Gán khóa học cho lớp"
          open={assignOpen}
          onOk={handleAssign}
          onCancel={() => setAssignOpen(false)}
          okText="Xác nhận"
          cancelText="Huỷ"
        >
          <div style={{ marginBottom: 12, color: 'var(--text-2)', fontSize: 13 }}>
            Mỗi lớp chỉ gán được 1 khóa học.
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="Chọn khóa học"
            onChange={setAssigningId}
            options={(allCourses || []).map((c) => ({ value: c.id, label: c.title }))}
          />
        </Modal>
      </div>
    )
  }

  return (
    <>
      {/* Course header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)' }}>
        <span style={{ fontWeight: 600 }}>📗 {courseData.title}</span>
        <Tag>{units.length} chương</Tag>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <Button size="small" onClick={() => setAssignOpen(true)}>Đổi khóa học</Button>
          <Popconfirm title="Huỷ gán khóa học?" onConfirm={handleUnassign}>
            <Button size="small" danger>Huỷ gán</Button>
          </Popconfirm>
        </div>
      </div>

      {/* Sidebar + content */}
      <div style={{ display: 'flex', minHeight: 420 }}>
        {/* Sidebar chương */}
        <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
          <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}>
            Danh sách chương
          </div>
          {units.map((unit) => (
            <div
              key={unit.id}
              onClick={() => setSelectedUnit(unit.id)}
              style={{
                padding: '10px 14px', fontSize: 13, cursor: 'pointer', lineHeight: 1.4,
                borderLeft: `3px solid ${activeUnit?.id === unit.id ? 'var(--primary)' : 'transparent'}`,
                background: activeUnit?.id === unit.id ? 'var(--primary-bg, #ede9fe)' : 'transparent',
                color: activeUnit?.id === unit.id ? 'var(--primary)' : 'var(--text-2)',
                fontWeight: activeUnit?.id === unit.id ? 600 : 400,
                transition: 'all .15s',
              }}
            >
              {unit.title}
            </div>
          ))}
        </div>

        {/* Nội dung chương */}
        {activeUnit ? (
          <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
            <Typography.Title level={5} style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
              {activeUnit.title}
            </Typography.Title>

            {/* Files */}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-2)', marginBottom: 8 }}>
              Tài liệu PDF
            </div>
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              {(activeUnit.files || []).map((f) => (
                <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)' }}>
                  <FilePdfOutlined style={{ fontSize: 18, color: '#ef4444', flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{f.filename}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{f.fileSize ? (f.fileSize / 1024 / 1024).toFixed(1) + ' MB' : ''}</span>
                  <Popconfirm title="Xoá file này?" onConfirm={() => handleDeleteFile(activeUnit.id, f.id)}>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              ))}
              {(activeUnit.files || []).length === 0 && (
                <div style={{ color: 'var(--text-2)', fontSize: 13, fontStyle: 'italic' }}>Chưa có tài liệu nào</div>
              )}
            </Space>
            <Upload accept=".pdf" beforeUpload={handleUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />} loading={uploading} style={{ marginBottom: 24 }}>
                Tải lên PDF
              </Button>
            </Upload>

            {/* Problems */}
            <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', color: 'var(--text-2)', marginBottom: 8 }}>
              Bài tập lập trình
            </div>
            {(activeUnit.problems || []).length === 0 ? (
              <div style={{ color: 'var(--text-2)', fontSize: 13, fontStyle: 'italic', marginBottom: 12 }}>Chưa có bài tập nào</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
                {(activeUnit.problems || []).map((p) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
                    <Link to={`/problems/${p.id}`} style={{ flex: 1, fontWeight: 500 }}>
                      <PlayCircleOutlined style={{ marginRight: 6, color: 'var(--primary)' }} />
                      {p.title}
                    </Link>
                    <Tag color={p.difficulty === 'EASY' ? 'green' : p.difficulty === 'MEDIUM' ? 'orange' : 'red'}>
                      {p.difficulty}
                    </Tag>
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </div>
                ))}
              </div>
            )}
            <Space>
              <Button icon={<PlusOutlined />}>Chọn bài tập có sẵn</Button>
              <Button icon={<PlusOutlined />}>Tạo bài tập mới</Button>
            </Space>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Empty description="Chọn chương bên trái để xem nội dung" />
          </div>
        )}
      </div>

      {/* Assign modal */}
      <Modal
        title="Đổi khóa học"
        open={assignOpen}
        onOk={handleAssign}
        onCancel={() => setAssignOpen(false)}
        okText="Xác nhận"
        cancelText="Huỷ"
      >
        <Select
          style={{ width: '100%' }}
          placeholder="Chọn khóa học"
          defaultValue={courseData?.courseId}
          onChange={setAssigningId}
          options={(allCourses || []).map((c) => ({ value: c.id, label: c.title }))}
        />
      </Modal>
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function TeacherClassroomDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: classroom, loading } = useFetch(() => api.getClassroom(id), [id])

  const tabItems = [
    { key: 'students', label: `👥 Sinh viên`, children: <StudentsTab classroomId={id} /> },
    { key: 'contests', label: `🏆 Kỳ thi`, children: <ContestsTab classroomId={id} /> },
    { key: 'course', label: `📖 Khóa học`, children: <CourseTab classroomId={id} /> },
  ]

  return (
    <App>
      <div style={{ maxWidth: 1100, margin: '32px auto', padding: '0 16px' }}>
        <Button icon={<ArrowLeftOutlined />} style={{ marginBottom: 16 }} onClick={() => navigate('/teacher/classrooms')}>
          Quay lại
        </Button>

        {loading ? (
          <Spin />
        ) : (
          <>
            <Typography.Title level={3} style={{ marginBottom: 4 }}>
              {classroom?.name || '…'}
            </Typography.Title>
            {classroom?.semester && <Tag color="purple" style={{ marginBottom: 16 }}>{classroom.semester}</Tag>}

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <Tabs
                items={tabItems}
                defaultActiveKey="students"
                tabBarStyle={{ margin: 0, padding: '0 16px', background: 'var(--surface)' }}
                renderTabBar={(props, DefaultTabBar) => (
                  <div style={{ borderBottom: '1px solid var(--border)' }}>
                    <DefaultTabBar {...props} />
                  </div>
                )}
              />
            </div>
          </>
        )}
      </div>
    </App>
  )
}
