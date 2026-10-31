import { useState, useCallback, useMemo } from 'react'
import {
  Alert, App, Button, Empty, Form, Input, Modal, Popconfirm, Segmented, Select, Space, Spin, Table, Tag, Tabs,
  Typography, Upload,
} from 'antd'
import {
  ArrowLeftOutlined, PlusOutlined, TrophyOutlined,
  FilePdfOutlined, UploadOutlined, DeleteOutlined, PlayCircleOutlined, KeyOutlined,
  ReloadOutlined, SearchOutlined, UserAddOutlined, IdcardOutlined, UserOutlined, FileTextOutlined,
} from '@ant-design/icons'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch, useNow, useSocket } from '../../lib/hooks'
import { formatDateTime, formatMemory, formatRelative, formatTime } from '../../lib/format'
import VerdictTag from '../../components/VerdictTag'
import { VERDICT_KEYS, VERDICTS } from '../../lib/verdicts'

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
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // State cho Modal thêm sinh viên thủ công / danh sách nhanh
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [addMode, setAddMode] = useState('single')
  const [adding, setAdding] = useState(false)
  const [singleForm] = Form.useForm()
  const [batchText, setBatchText] = useState('')

  const parsedStudents = useMemo(() => {
    if (!batchText.trim()) return []
    return batchText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/[,;\t]/).map((p) => p.trim())
        const sid = parts[0]?.toUpperCase()
        const name = parts.slice(1).join(' ').trim() || sid
        return sid ? { studentId: sid, fullName: name } : null
      })
      .filter(Boolean)
  }, [batchText])

  const handleAddSingle = async (values) => {
    setAdding(true)
    try {
      const studentId = values.studentId.trim().toUpperCase()
      const fullName = values.fullName.trim()
      await api.addClassroomStudent(classroomId, { studentId, fullName })
      message.success(`Đã thêm sinh viên ${studentId} (${fullName}) vào lớp`)
      singleForm.resetFields()
      setAddModalVisible(false)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const handleAddBatch = async () => {
    if (!batchText.trim()) {
      message.warning('Vui lòng nhập hoặc dán danh sách sinh viên vào ô bên dưới')
      return
    }

    if (parsedStudents.length === 0) {
      message.warning('Không tìm thấy dòng nào hợp lệ (cần có MSSV)')
      return
    }

    setAdding(true)
    try {
      const res = await api.addClassroomStudent(classroomId, { students: parsedStudents })
      if (res.errors && res.errors.length > 0) {
        message.warning(
          `Đã thêm ${res.added} sinh viên. Có ${res.errors.length} lỗi:\n${res.errors.slice(0, 3).join(', ')}${
            res.errors.length > 3 ? '...' : ''
          }`,
        )
      } else {
        message.success(`Đã thêm thành công ${res.added ?? parsedStudents.length} sinh viên vào lớp!`)
      }
      setBatchText('')
      setAddModalVisible(false)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

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

  const handleResetPassword = async () => {
    if (!resetTarget) return
    setResetting(true)
    try {
      await api.resetClassroomStudentPassword(classroomId, resetTarget.userId, newPassword)
      message.success(`Đã đặt lại mật khẩu cho ${resetTarget.username}`)
      setResetModalOpen(false)
      setResetTarget(null)
      setNewPassword('')
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  const openReset = (student) => {
    setResetTarget(student)
    setNewPassword(student.username.length >= 8 ? student.username : (student.username + '12345678').substring(0, 8))
    setResetModalOpen(true)
  }

  const columns = [
    { title: 'MSSV', dataIndex: 'username', className: 'mono', width: 140 },
    { title: 'Họ tên', dataIndex: 'fullName' },
    {
      title: 'Mật khẩu ban đầu',
      dataIndex: 'importedPassword',
      width: 160,
      render: (v) => v ? <span className="mono" style={{ color: 'var(--primary)', fontWeight: 600 }}>{v}</span> : '—',
    },
    {
      title: 'Ngày thêm',
      dataIndex: 'joinedAt',
      width: 130,
      render: (v) => new Date(v).toLocaleDateString('vi-VN'),
    },
    {
      title: '',
      width: 140,
      align: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<KeyOutlined />} onClick={() => openReset(r)} title="Đặt lại mật khẩu">
            Reset
          </Button>
          <Popconfirm title="Xoá sinh viên này khỏi lớp?" onConfirm={() => handleRemove(r.userId)} okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ padding: 20 }}>
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<UserAddOutlined />}
          onClick={() => {
            singleForm.resetFields()
            setAddModalVisible(true)
          }}
        >
          Thêm sinh viên
        </Button>
        <Upload accept=".csv" beforeUpload={handleImport} showUploadList={false}>
          <Button icon={<UploadOutlined />}>Import CSV</Button>
        </Upload>
      </Space>

      {!loading && (!students || students.length === 0) ? (
        <Empty description="Chưa có sinh viên trong lớp. Nhấn 'Thêm sinh viên' hoặc 'Import CSV' để thêm." />
      ) : (
        <Table rowKey="userId" columns={columns} dataSource={students || []} loading={loading} pagination={{ pageSize: 20 }} size="small" />
      )}

      {/* Modal Thêm sinh viên thủ công / danh sách nhanh */}
      <Modal
        title={
          <Space>
            <UserAddOutlined style={{ color: '#4f46e5' }} />
            <span>Thêm sinh viên vào lớp</span>
          </Space>
        }
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        destroyOnClose
        centered
        width={540}
      >
        <Segmented
          block
          value={addMode}
          onChange={setAddMode}
          style={{ marginBottom: 20 }}
          options={[
            { value: 'single', label: 'Thêm từng sinh viên', icon: <UserOutlined /> },
            { value: 'batch', label: 'Dán danh sách nhanh (Paste)', icon: <FileTextOutlined /> },
          ]}
        />

        {addMode === 'single' ? (
          <Form
            form={singleForm}
            layout="vertical"
            requiredMark={false}
            onFinish={handleAddSingle}
          >
            <Form.Item
              name="studentId"
              label="Mã sinh viên (MSSV)"
              rules={[
                { required: true, message: 'Vui lòng nhập MSSV' },
                {
                  pattern: /^[A-Za-z0-9._-]{3,32}$/,
                  message: 'MSSV gồm 3-32 ký tự chữ, số (VD: B24DCCN101)',
                },
              ]}
              normalize={(v) => v?.toUpperCase()}
            >
              <Input
                prefix={<IdcardOutlined />}
                placeholder="VD: B24DCCN101"
                className="mono"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="fullName"
              label="Họ và tên sinh viên"
              rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ và tên' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="VD: Nguyễn Văn An" />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              message="Tự động khởi tạo tài khoản"
              description="Nếu sinh viên chưa có tài khoản, hệ thống sẽ tự động tạo hồ sơ với mật khẩu ban đầu bằng MSSV. Mật khẩu sẽ hiển thị ở cột 'Mật khẩu ban đầu' để bạn gửi cho sinh viên."
              style={{ marginBottom: 20 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button onClick={() => setAddModalVisible(false)}>Hủy</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={adding}
                icon={<UserAddOutlined />}
              >
                Thêm vào lớp
              </Button>
            </div>
          </Form>
        ) : (
          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                Dán danh sách từ Excel/Word (mỗi dòng 1 sinh viên dạng <code>MSSV, Họ tên</code>):
              </Typography.Text>
              <Button
                size="small"
                type="link"
                style={{ padding: 0 }}
                onClick={() =>
                  setBatchText(
                    'B24DCCN001, Nguyễn Văn An\nB24DCCN002, Trần Thị Bình\nB24DCCN003, Lê Hoàng Cường'
                  )
                }
              >
                Dán dữ liệu mẫu
              </Button>
            </div>
            <Input.TextArea
              rows={6}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder="Nhập hoặc dán danh sách vào đây (mỗi sinh viên một dòng)...&#10;Ví dụ:&#10;B24DCCN001, Nguyễn Văn An&#10;B24DCCN002, Trần Thị Bình"
              className="mono"
              style={{ marginBottom: 12 }}
            />

            {parsedStudents.length > 0 ? (
              <div
                style={{
                  marginBottom: 14,
                  padding: '8px 12px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderRadius: 6,
                  color: '#059669',
                  fontSize: 13,
                  fontWeight: 500,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>✓</span>
                <span>
                  Đã nhận diện <b>{parsedStudents.length}</b> sinh viên hợp lệ sẵn sàng thêm vào lớp
                </span>
              </div>
            ) : null}

            <Alert
              type="info"
              showIcon
              message="Định dạng hỗ trợ"
              description="Hỗ trợ phân cách bằng dấu phẩy, chấm phẩy hoặc khoảng trắng Tab (khi copy trực tiếp từ Excel). Dòng chỉ có MSSV sẽ tự gán MSSV làm họ tên."
              style={{ marginBottom: 20 }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button onClick={() => setAddModalVisible(false)}>Hủy</Button>
              <Button
                type="primary"
                onClick={handleAddBatch}
                loading={adding}
                icon={<UserAddOutlined />}
              >
                Thêm danh sách{parsedStudents.length > 0 ? ` (${parsedStudents.length})` : ''}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={`Đặt lại mật khẩu: ${resetTarget?.username} (${resetTarget?.fullName})`}
        open={resetModalOpen}
        onOk={handleResetPassword}
        onCancel={() => setResetModalOpen(false)}
        confirmLoading={resetting}
        okText="Đặt lại mật khẩu"
        cancelText="Hủy"
      >
        <div style={{ marginTop: 12, marginBottom: 8, fontSize: 13, color: 'var(--text-2)' }}>
          Nhập mật khẩu mới (tối thiểu 8 ký tự):
        </div>
        <Input.Password
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="Mật khẩu mới..."
          style={{ width: '100%' }}
        />
      </Modal>
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
    {
      title: '',
      width: 120,
      render: (_, r) => (
        <Link to={`/teacher/classrooms/${classroomId}/contests/${r.contestId}/monitor`}>
          <Button size="small" type="primary" ghost icon={<TrophyOutlined />}>
            Giám sát
          </Button>
        </Link>
      ),
    },
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
  const { data: allProblems } = useFetch(() => api.listProblems(), [])
  const [problemModalOpen, setProblemModalOpen] = useState(false)
  const [selectedProblemId, setSelectedProblemId] = useState(null)
  const [addingProblem, setAddingProblem] = useState(false)

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

  const handleAssignProblem = async () => {
    if (!activeUnit || !selectedProblemId) return
    setAddingProblem(true)
    try {
      await api.assignUnitProblem(activeUnit.id, selectedProblemId)
      message.success('Đã thêm bài tập vào chương')
      setProblemModalOpen(false)
      setSelectedProblemId(null)
      refresh()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAddingProblem(false)
    }
  }

  const handleRemoveProblem = async (unitId, problemId) => {
    try {
      await api.removeUnitProblem(unitId, problemId)
      message.success('Đã gỡ bài tập khỏi chương')
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
                    <Link to={`/teacher/problems/${p.id}`} style={{ flex: 1, fontWeight: 500 }}>
                      <PlayCircleOutlined style={{ marginRight: 6, color: 'var(--primary)' }} />
                      {p.title}
                    </Link>
                    <Tag color={p.difficulty === 'EASY' ? 'green' : p.difficulty === 'MEDIUM' ? 'orange' : 'red'}>
                      {p.difficulty}
                    </Tag>
                    <Popconfirm title="Gỡ bài tập này khỏi chương?" onConfirm={() => handleRemoveProblem(activeUnit.id, p.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                ))}
              </div>
            )}
            <Space>
              <Button icon={<PlusOutlined />} onClick={() => setProblemModalOpen(true)}>Chọn bài tập có sẵn</Button>
            </Space>

            <Modal
              title="Thêm bài tập vào chương"
              open={problemModalOpen}
              onOk={handleAssignProblem}
              onCancel={() => setProblemModalOpen(false)}
              confirmLoading={addingProblem}
              okText="Gắn vào chương"
              cancelText="Hủy"
            >
              <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--text-2)' }}>
                Chọn bài tập từ kho chung để đưa vào chương học:
              </div>
              <Select
                style={{ width: '100%' }}
                placeholder="Chọn bài tập"
                value={selectedProblemId}
                onChange={setSelectedProblemId}
                showSearch
                optionFilterProp="label"
                options={(allProblems || []).map((p) => ({
                  value: p.id,
                  label: `#${p.id} ${p.title} (${p.difficulty})`,
                }))}
              />
            </Modal>
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

// ── Tab Bài nộp ──────────────────────────────────────────────────────────
function ClassroomSubmissionsTab({ classroomId }) {
  const navigate = useNavigate()
  const now = useNow(10000)
  const [student, setStudent] = useState('')
  const [problemId, setProblemId] = useState(null)
  const [verdict, setVerdict] = useState(null)
  const [page, setPage] = useState(0)

  const subs = useFetch(
    () => api.listSubmissions({
      classroomId,
      userId: student || undefined,
      problemId: problemId || undefined,
      verdict: verdict || undefined,
      page,
      size: 50,
    }),
    [classroomId, student, problemId, verdict, page],
  )
  const problems = useFetch(() => api.listProblems(), [])
  const { setData, reload } = subs

  useSocket(
    useCallback((msg) => {
      if (msg.type !== 'SUBMISSION_UPDATE') return
      const s = msg.submission
      // eslint-disable-next-line no-unused-vars
      const { sourceCode, tests, history, ...row } = s
      setData((prev) => {
        if (!prev) return prev
        const list = Array.isArray(prev) ? prev : (prev.submissions || [])
        const i = list.findIndex((x) => x.id === s.id)
        const next = i < 0 ? [row, ...list] : list.map((x, idx) => idx === i ? { ...x, ...row } : x)
        return Array.isArray(prev) ? next : { ...prev, submissions: next }
      })
    }, [setData])
  )

  const rows = subs.data?.submissions || (Array.isArray(subs.data) ? subs.data : [])
  const total = subs.data?.total || rows.length

  const columns = [
    {
      title: 'Mã bài',
      dataIndex: 'id',
      width: 85,
      render: (id) => (
        <span className="mono" style={{ fontWeight: 600 }}>
          #{id}
        </span>
      ),
    },
    {
      title: 'Sinh viên',
      dataIndex: 'userId',
      render: (u, r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.userName || u}</div>
          <Tag color="geekblue" className="mono" style={{ marginTop: 2 }}>{u}</Tag>
        </div>
      ),
    },
    {
      title: 'Đề bài',
      dataIndex: 'problemTitle',
      render: (t, r) => (
        <span style={{ fontWeight: 500 }}>
          #{r.problemId} {t}
        </span>
      ),
    },
    {
      title: 'Kết quả',
      dataIndex: 'verdict',
      width: 140,
      render: (_, r) => <VerdictTag submission={r} />,
    },
    {
      title: 'Điểm',
      dataIndex: 'score',
      width: 70,
      align: 'right',
      render: (v) => <span className="mono">{v ?? '—'}</span>,
    },
    {
      title: 'Thời gian',
      dataIndex: 'timeMs',
      width: 90,
      align: 'right',
      render: (v) => <span className="mono">{formatTime(v)}</span>,
    },
    {
      title: 'Bộ nhớ',
      dataIndex: 'memoryKb',
      width: 90,
      align: 'right',
      render: (v) => <span className="mono">{formatMemory(v)}</span>,
    },
    {
      title: 'Thời điểm',
      dataIndex: 'createdAt',
      width: 130,
      render: (v) => (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {formatRelative(v, now)}
        </span>
      ),
    },
  ]

  return (
    <div style={{ padding: 20 }}>
      <Space wrap size={12} style={{ marginBottom: 16 }}>
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="MSSV hoặc họ tên"
          value={student}
          onChange={(e) => { setStudent(e.target.value); setPage(0) }}
          style={{ width: 200 }}
        />
        <Select
          allowClear
          placeholder="Đề bài"
          value={problemId}
          onChange={(val) => { setProblemId(val); setPage(0) }}
          style={{ width: 240 }}
          showSearch={{ optionFilterProp: 'label' }}
          options={(Array.isArray(problems.data) ? problems.data : (problems.data?.problems || [])).map((p) => ({
            value: p.id,
            label: `#${p.id} ${p.title}`,
          }))}
        />
        <Select
          allowClear
          placeholder="Kết quả"
          value={verdict}
          onChange={(val) => { setVerdict(val); setPage(0) }}
          style={{ width: 180 }}
          options={[
            { value: 'PENDING', label: 'Đang chờ / đang chấm' },
            ...VERDICT_KEYS.map((v) => ({ value: v, label: `${v} – ${VERDICTS[v].label}` })),
          ]}
        />
        <Button icon={<ReloadOutlined />} onClick={reload}>Làm mới</Button>
        <Typography.Text type="secondary">{total} bài nộp</Typography.Text>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={rows}
        loading={subs.loading}
        size="small"
        pagination={{
          current: page + 1,
          pageSize: 50,
          total,
          onChange: (p) => setPage(p - 1),
          showSizeChanger: false,
        }}
        onRow={(r) => ({
          onClick: () => navigate(`/teacher/submissions/${r.id}`),
          style: { cursor: 'pointer' },
        })}
      />
    </div>
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
    { key: 'submissions', label: `📝 Bài nộp`, children: <ClassroomSubmissionsTab classroomId={id} /> },
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
