import { useState } from 'react'
import {
  App,
  Button,
  Card,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  ArrowDownOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  InboxOutlined,
  ArrowUpOutlined,
  BookOutlined,
  DeleteOutlined,
  EditOutlined,
  FileTextOutlined,
  PlusOutlined,
  RocketOutlined,
  SaveOutlined,
} from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'
import { useAuth } from '../../auth/context'

export default function AdminCourseEditPage({ teacher = false }) {
  const { id } = useParams()
  const { user } = useAuth()
  const { message } = App.useApp()
  const { data: course, loading, reload: refetch } = useFetch(() => api.getCourse(id), [id])
  const canManage = !teacher || course?.createdBy === user?.username || course?.createdById === user?.id || !course?.createdBy || course?.createdByRole === 'ADMIN' || course?.createdBy === 'admin'

  const [modalOpen, setModalOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [reordering, setReordering] = useState(false)

  // Quản lý soạn bài giảng chi tiết (Lesson Editor)
  const [lessonDrawerOpen, setLessonDrawerOpen] = useState(false)
  const [lessonUnit, setLessonUnit] = useState(null)
  const [lessonLoading, setLessonLoading] = useState(false)
  const [lessonSaving, setLessonSaving] = useState(false)
  const [theoryContent, setTheoryContent] = useState('')
  const [sampleCode, setSampleCode] = useState('')
  const [sampleInput, setSampleInput] = useState('')

  // Quản lý bài tập thực hành liên kết (Unit Problems)
  const [unitProblems, setUnitProblems] = useState([])
  const [allProblems, setAllProblems] = useState([])
  const [selectedProblemId, setSelectedProblemId] = useState(null)
  const [assigningProblem, setAssigningProblem] = useState(false)

  // Quản lý tài liệu đính kèm (Unit Files)
  const [unitFiles, setUnitFiles] = useState([])
  const [uploadingFile, setUploadingFile] = useState(false)

  const units = course?.units || []

  const openCreateUnit = () => {
    setEditingUnit(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEditUnit = (unit) => {
    setEditingUnit(unit)
    form.setFieldsValue({ title: unit.title })
    setModalOpen(true)
  }

  const saveUnit = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editingUnit) {
        await api.updateCourseUnit(id, editingUnit.id, values)
        message.success('Đã cập nhật chủ đề')
      } else {
        await api.addCourseUnit(id, values)
        message.success('Đã thêm chủ đề mới')
      }
      setModalOpen(false)
      refetch()
    } catch (e) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const removeUnit = async (unitId) => {
    try {
      await api.deleteCourseUnit(id, unitId)
      message.success('Đã xóa chủ đề')
      refetch()
    } catch (e) {
      message.error(e.message)
    }
  }

  const moveUnit = async (index, direction) => {
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= units.length) return

    const newUnits = [...units]
    const temp = newUnits[index]
    newUnits[index] = newUnits[targetIndex]
    newUnits[targetIndex] = temp

    const reorderPayload = newUnits.map((u, idx) => ({
      id: u.id,
      orderIndex: idx + 1,
    }))

    setReordering(true)
    try {
      await api.reorderCourseUnits(id, reorderPayload)
      message.success('Đã cập nhật thứ tự chủ đề')
      refetch()
    } catch (e) {
      message.error(e.message)
    } finally {
      setReordering(false)
    }
  }

  // Mở Drawer soạn bài giảng chi tiết
  const openEditLesson = async (unit) => {
    setLessonUnit(unit)
    setLessonDrawerOpen(true)
    setLessonLoading(true)
    setSelectedProblemId(null)
    try {
      const [resLesson, resProblems, resAll, resFiles] = await Promise.all([
        api.getLesson(unit.id),
        api.getUnitProblems(unit.id),
        teacher ? api.teacherContestProblems() : api.listProblems(),
        api.listUnitFiles(unit.id).catch(() => []),
      ])
      setTheoryContent(resLesson.theoryContent || '')
      setSampleCode(resLesson.sampleCode || '')
      setSampleInput(resLesson.sampleInput || '')
      setUnitProblems(resProblems || [])
      setAllProblems(resAll || [])
      setUnitFiles(resFiles || [])
    } catch (e) {
      message.error(e.message)
    } finally {
      setLessonLoading(false)
    }
  }

  const handleUploadFile = async (file) => {
    if (!lessonUnit) return false
    setUploadingFile(true)
    try {
      await api.uploadUnitFile(lessonUnit.id, file)
      message.success(`Đã tải lên tài liệu ${file.name}`)
      const files = await api.listUnitFiles(lessonUnit.id).catch(() => [])
      setUnitFiles(files || [])
    } catch (e) {
      message.error(e.message || 'Không thể tải lên tài liệu')
    } finally {
      setUploadingFile(false)
    }
    return false
  }

  const handleDeleteFile = async (fileId) => {
    if (!lessonUnit) return
    try {
      await api.deleteUnitFile(lessonUnit.id, fileId)
      message.success('Đã xóa tài liệu')
      setUnitFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch (e) {
      message.error(e.message || 'Không thể xóa tài liệu')
    }
  }

  const handleAssignProblem = async () => {
    if (!selectedProblemId || !lessonUnit) return
    setAssigningProblem(true)
    try {
      const added = await api.assignUnitProblem(lessonUnit.id, selectedProblemId)
      message.success('Đã gắn bài tập vào chủ đề!')
      setUnitProblems((prev) => [...prev, added])
      setSelectedProblemId(null)
    } catch (e) {
      message.error(e.message)
    } finally {
      setAssigningProblem(false)
    }
  }

  const handleRemoveProblem = async (problemId) => {
    if (!lessonUnit) return
    try {
      await api.removeUnitProblem(lessonUnit.id, problemId)
      message.success('Đã gỡ bài tập khỏi chủ đề!')
      setUnitProblems((prev) => prev.filter((p) => p.problemId !== problemId))
    } catch (e) {
      message.error(e.message)
    }
  }

  const saveLesson = async () => {
    if (!lessonUnit) return
    setLessonSaving(true)
    try {
      await api.updateLesson(lessonUnit.id, {
        theoryContent,
        sampleCode,
        sampleInput,
      })
      message.success('Đã lưu bài giảng thành công!')
      setLessonDrawerOpen(false)
    } catch (e) {
      message.error(e.message)
    } finally {
      setLessonSaving(false)
    }
  }

  const columns = [
    {
      title: '#',
      dataIndex: 'orderIndex',
      key: 'orderIndex',
      width: 60,
      align: 'center',
      render: (val) => <Tag color="blue">{val}</Tag>,
    },
    {
      title: 'Tên chủ đề bài học',
      dataIndex: 'title',
      key: 'title',
      render: (text) => <span style={{ fontWeight: 500, fontSize: 15 }}>{text}</span>,
    },
    {
      title: 'Thứ tự',
      key: 'reorder',
      width: 110,
      align: 'center',
      render: (_, __, idx) => (
        <Space size={4}>
          <Tooltip title="Di chuyển lên">
            <Button
              size="small"
              icon={<ArrowUpOutlined />}
              disabled={!canManage || idx === 0 || reordering}
              onClick={() => moveUnit(idx, -1)}
            />
          </Tooltip>
          <Tooltip title="Di chuyển xuống">
            <Button
              size="small"
              icon={<ArrowDownOutlined />}
              disabled={!canManage || idx === units.length - 1 || reordering}
              onClick={() => moveUnit(idx, 1)}
            />
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 220,
      align: 'left',
      render: (_, row) => (
        <Space>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<FileTextOutlined />}
            onClick={() => openEditLesson(row)}
          >
            {canManage ? 'Soạn bài' : 'Xem bài'}
          </Button>
          {canManage && <Button size="small" icon={<EditOutlined />} onClick={() => openEditUnit(row)} />}
          {canManage && (
            <Popconfirm
              title="Xóa chủ đề này?"
              onConfirm={() => removeUnit(row.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div className="page admin-page--editor">
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <Space style={{ marginBottom: 8 }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                {course?.title}
              </Typography.Title>
              {course?.published ? (
                <Tag color="success">Đang công khai</Tag>
              ) : (
                <Tag color="default">Bản nháp</Tag>
              )}
            </Space>
            {course?.description && (
              <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 14 }}>
                {course.description}
              </Typography.Paragraph>
            )}
          </div>
          {canManage && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateUnit}>
              Thêm chủ đề
            </Button>
          )}
        </div>
      </Card>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <BookOutlined /> Danh sách chủ đề ({units.length})
          </div>
        }
        styles={{ body: { padding: 0 } }}
      >
        <Table
          rowKey="id"
          dataSource={units}
          columns={columns}
          loading={loading || reordering}
          pagination={false}
          locale={{ emptyText: <Empty description="Chưa có chủ đề nào. Hãy bấm 'Thêm chủ đề' để bắt đầu." /> }}
        />
      </Card>

      {/* Modal chỉnh sửa tên chủ đề */}
      <Modal
        title={editingUnit ? 'Chỉnh sửa chủ đề' : 'Thêm chủ đề mới'}
        open={modalOpen}
        onOk={saveUnit}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Tên chủ đề"
            rules={[{ required: true, message: 'Vui lòng nhập tên chủ đề' }]}
          >
            <Input placeholder="Ví dụ: Cú pháp biến và Kiểu dữ liệu nguyên thủy" maxLength={255} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Drawer Soạn bài giảng chi tiết (Lesson Editor) */}
      <Drawer
        title={
          <Space>
            <FileTextOutlined style={{ color: '#2563eb' }} />
            <span>Biên soạn bài giảng: <b>{lessonUnit?.title}</b></span>
          </Space>
        }
        width={1000}
        open={lessonDrawerOpen}
        onClose={() => setLessonDrawerOpen(false)}
        destroyOnClose
        extra={
          <Space>
            <Button onClick={() => setLessonDrawerOpen(false)}>{canManage ? 'Hủy' : 'Đóng'}</Button>
            {canManage ? (
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={lessonSaving}
                onClick={saveLesson}
              >
                Lưu bài giảng
              </Button>
            ) : (
              <Tag color="orange">Chế độ chỉ đọc</Tag>
            )}
          </Space>
        }
      >
        {lessonLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <Spin tip="Đang tải dữ liệu bài giảng..." />
          </div>
        ) : (
          <Tabs
            defaultActiveKey="problems"
            items={[
              {
                key: 'problems',
                label: (
                  <span>
                    <RocketOutlined /> Bài tập thực hành ({unitProblems.length})
                  </span>
                ),
                children: (
                  <div style={{ padding: '8px 0' }}>
                    <Card style={{ marginBottom: 20, background: 'var(--surface)' }}>
                      <Typography.Title level={5} style={{ marginTop: 0 }}>
                        Gắn thêm bài tập từ Ngân hàng đề
                      </Typography.Title>
                      <Space wrap style={{ width: '100%' }}>
                        <Select
                          showSearch
                          placeholder="Chọn bài tập từ ngân hàng đề..."
                          style={{ width: 420 }}
                          value={selectedProblemId}
                          onChange={setSelectedProblemId}
                          filterOption={(input, option) =>
                            (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                          }
                          options={allProblems
                            .filter((p) => !unitProblems.some((up) => up.problemId === p.id))
                            .map((p) => ({
                              value: p.id,
                              label: `#${p.id} - ${p.title} (${p.difficulty})`,
                            }))}
                        />
                        <Button
                          type="primary"
                          icon={<PlusOutlined />}
                          disabled={!selectedProblemId}
                          loading={assigningProblem}
                          onClick={handleAssignProblem}
                        >
                          Gắn bài tập
                        </Button>
                      </Space>
                    </Card>

                    <Table
                      rowKey="problemId"
                      dataSource={unitProblems}
                      pagination={false}
                      locale={{ emptyText: <Empty description="Chưa có bài tập nào được gắn vào chủ đề này." /> }}
                      columns={[
                        {
                          title: '#',
                          dataIndex: 'orderIndex',
                          width: 60,
                          align: 'center',
                          render: (val, _, idx) => <Tag color="blue">{val || idx + 1}</Tag>,
                        },
                        {
                          title: 'Tên bài tập',
                          key: 'title',
                          render: (_, row) => (
                            <Space>
                              <span style={{ fontWeight: 600 }}>#{row.problemId}</span>
                              <span>{row.title}</span>
                            </Space>
                          ),
                        },
                        {
                          title: 'Độ khó',
                          dataIndex: 'difficulty',
                          width: 100,
                          align: 'center',
                          render: (d) => {
                            const color = d === 'easy' ? 'green' : d === 'medium' ? 'gold' : 'red'
                            return <Tag color={color}>{d ? d.toUpperCase() : 'EASY'}</Tag>
                          },
                        },
                        {
                          title: 'Thao tác',
                          key: 'actions',
                          width: 100,
                          align: 'left',
                          render: (_, row) => (
                            <Popconfirm
                              title="Gỡ bài tập này khỏi chủ đề?"
                              onConfirm={() => handleRemoveProblem(row.problemId)}
                              okText="Gỡ"
                              cancelText="Hủy"
                              okButtonProps={{ danger: true }}
                            >
                              <Button size="small" danger icon={<DeleteOutlined />}>
                                Gỡ
                              </Button>
                            </Popconfirm>
                          ),
                        },
                      ]}
                    />
                  </div>
                ),
              },
              {
                key: 'files',
                label: (
                  <span>
                    <FilePdfOutlined /> Tài liệu đính kèm ({unitFiles.length})
                  </span>
                ),
                children: (
                  <div style={{ padding: '8px 0' }}>
                    <Card style={{ marginBottom: 20, background: 'var(--surface)' }}>
                      <Typography.Title level={5} style={{ marginTop: 0 }}>
                        Tải lên tài liệu bài giảng (PDF / Slides / DOCX)
                      </Typography.Title>
                      <Upload.Dragger
                        name="file"
                        multiple={false}
                        beforeUpload={handleUploadFile}
                        showUploadList={false}
                        disabled={uploadingFile}
                        style={{ padding: '20px 0' }}
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined style={{ fontSize: 40, color: 'var(--primary)' }} />
                        </p>
                        <p className="ant-upload-text">Kéo thả file vào đây hoặc bấm để chọn tệp tài liệu</p>
                        <p className="ant-upload-hint">Hỗ trợ PDF, PPTX, DOCX, ZIP... tối đa 50MB</p>
                      </Upload.Dragger>
                    </Card>

                    <Table
                      rowKey="id"
                      dataSource={unitFiles}
                      pagination={false}
                      locale={{ emptyText: <Empty description="Chưa có tài liệu đính kèm nào." /> }}
                      columns={[
                        {
                          title: 'Tên tài liệu',
                          dataIndex: 'fileName',
                          render: (name, row) => (
                            <Space>
                              <FilePdfOutlined style={{ color: '#ef4444', fontSize: 16 }} />
                              <a href={`/api/courses/units/${lessonUnit?.id}/files/${row.id}`} download={name} target="_blank" rel="noreferrer">
                                <b>{name}</b>
                              </a>
                            </Space>
                          ),
                        },
                        {
                          title: 'Kích thước',
                          dataIndex: 'fileSize',
                          width: 120,
                          render: (bytes) => bytes ? `${(bytes / 1024).toFixed(1)} KB` : '—',
                        },
                        {
                          title: 'Ngày tải lên',
                          dataIndex: 'createdAt',
                          width: 160,
                          render: (d) => d ? new Date(d).toLocaleDateString('vi-VN') : '—',
                        },
                        {
                          title: 'Thao tác',
                          key: 'actions',
                          width: 140,
                          align: 'left',
                          render: (_, row) => (
                            <Space>
                              <a href={`/api/courses/units/${lessonUnit?.id}/files/${row.id}`} download={row.fileName} target="_blank" rel="noreferrer">
                                <Button size="small" icon={<DownloadOutlined />}>Tải về</Button>
                              </a>
                              <Popconfirm
                                title="Xóa tài liệu này?"
                                onConfirm={() => handleDeleteFile(row.id)}
                                okText="Xóa"
                                cancelText="Hủy"
                                okButtonProps={{ danger: true }}
                              >
                                <Button size="small" danger icon={<DeleteOutlined />} />
                              </Popconfirm>
                            </Space>
                          ),
                        },
                      ]}
                    />
                  </div>
                ),
              }
            ]}
          />
        )}
      </Drawer>
    </div>
  )
}
