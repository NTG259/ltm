import { useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Popconfirm, Segmented, Space, Switch, Table, Tag, Typography } from 'antd'
import { BookOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { useFetch } from '../../lib/hooks'
import { useAuth } from '../../auth/context'

export default function AdminCoursesPage({ teacher = false }) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const { data: allCourses, loading, reload: refetch } = useFetch(() => api.listCourses(), [])
  const [filterMode, setFilterMode] = useState('my')
  const courses = teacher
    ? filterMode === 'my'
      ? (allCourses || []).filter((course) => course.createdBy === user?.id)
      : allCourses || []
    : allCourses || []
  const basePath = teacher ? '/teacher/courses' : '/admin/courses'
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ published: false })
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    form.setFieldsValue({
      title: row.title,
      description: row.description,
      published: row.published,
    })
    setModalOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      if (editing) {
        await api.updateCourse(editing.id, values)
        message.success('Đã cập nhật khóa học')
      } else {
        await api.createCourse(values)
        message.success('Đã tạo khóa học mới')
      }
      setModalOpen(false)
      refetch()
    } catch (e) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    try {
      await api.deleteCourse(id)
      message.success('Đã xóa khóa học')
      refetch()
    } catch (e) {
      message.error(e.message)
    }
  }

  const togglePublish = async (row) => {
    try {
      await api.updateCourse(row.id, { published: !row.published })
      message.success(row.published ? 'Đã chuyển thành bản nháp' : 'Đã công khai khóa học')
      refetch()
    } catch (e) {
      message.error(e.message)
    }
  }

  const columns = [
    {
      title: 'Tên khóa học / Lộ trình',
      dataIndex: 'title',
      key: 'title',
      render: (title, row) => (
        <Space orientation="vertical" size={2}>
          <Link to={`${basePath}/${row.id}`} style={{ fontWeight: 600, fontSize: 15 }}>
            {title}
          </Link>
          {row.description && (
            <Typography.Text type="secondary" ellipsis style={{ maxWidth: 400 }}>
              {row.description}
            </Typography.Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Số chủ đề',
      dataIndex: 'unitCount',
      key: 'unitCount',
      width: 110,
      align: 'center',
      render: (v) => <Tag color="blue">{v || 0} chủ đề</Tag>,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'published',
      key: 'published',
      width: 140,
      render: (published, row) => (
        <Space>
          <Switch
            size="small"
            disabled={teacher && row.createdBy !== user?.id}
            checked={published}
            onChange={() => togglePublish(row)}
          />
          <span style={{ fontSize: 13, color: published ? '#16a34a' : '#64748b' }}>
            {published ? 'Công khai' : 'Bản nháp'}
          </span>
        </Space>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 130,
      render: (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 160,
      align: 'right',
      render: (_, row) => {
        const canManage = !teacher || row.createdBy === user?.id
        return (
          <Space>
            <Link to={`${basePath}/${row.id}`}>
              <Button size="small" icon={<UnorderedListOutlined />}>
                Chủ đề
              </Button>
            </Link>
            {canManage && <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
            {canManage && (
              <Popconfirm
                title="Xóa khóa học này?"
                description="Tất cả chủ đề bên trong cũng sẽ bị xóa vĩnh viễn."
                onConfirm={() => remove(row.id)}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            )}
          </Space>
        )
      },
    },
  ]

  return (
    <div className="page admin-page--wide">
      <AdminPageHeader
        title={teacher ? 'Khóa học của tôi' : 'Quản lý Khóa học & Lộ trình'}
        description={teacher ? 'Tạo khóa học và soạn nội dung bằng các đề có sẵn trong kho chung.' : 'Xây dựng lộ trình học C++, sắp xếp các chủ đề lý thuyết và bài tập'}
        icon={<BookOutlined />}
        actions={
          <Space>
            {teacher && (
              <Segmented
                value={filterMode}
                onChange={setFilterMode}
                options={[
                  { label: 'Khóa học của tôi', value: 'my' },
                  { label: 'Tất cả khóa học', value: 'all' },
                ]}
              />
            )}
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="large">
              Tạo khóa học mới
            </Button>
          </Space>
        }
      />

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          dataSource={courses || []}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? 'Chỉnh sửa khóa học' : 'Tạo khóa học mới'}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="Lưu"
        cancelText="Hủy"
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="title"
            label="Tiêu đề khóa học"
            rules={[{ required: true, message: 'Vui lòng nhập tiêu đề khóa học' }]}
          >
            <Input placeholder="Ví dụ: Nhập môn Lập trình C++ từ số 0" maxLength={255} />
          </Form.Item>
          <Form.Item name="description" label="Mô tả khóa học">
            <Input.TextArea
              rows={4}
              placeholder="Mô tả ngắn gọn về kiến thức sẽ học trong lộ trình này..."
            />
          </Form.Item>
          <Form.Item name="published" label="Trạng thái xuất bản" valuePropName="checked">
            <Switch checkedChildren="Công khai" unCheckedChildren="Bản nháp" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
