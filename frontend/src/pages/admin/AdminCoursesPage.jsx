import { useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Popconfirm, Space, Switch, Table, Tag, Typography } from 'antd'
import { BookOutlined, DeleteOutlined, EditOutlined, PlusOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function AdminCoursesPage() {
  const { message } = App.useApp()
  const { data: courses, loading, reload: refetch } = useFetch(() => api.listCourses(), [])
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
          <Link to={`/admin/courses/${row.id}`} style={{ fontWeight: 600, fontSize: 15 }}>
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
      render: (_, row) => (
        <Space>
          <Link to={`/admin/courses/${row.id}`}>
            <Button size="small" icon={<UnorderedListOutlined />}>
              Chủ đề
            </Button>
          </Link>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
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
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '16px 20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <BookOutlined style={{ color: '#2563eb' }} /> Quản lý Khóa học & Lộ trình
          </Typography.Title>
          <Typography.Text type="secondary">
            Xây dựng lộ trình học C++, sắp xếp các chủ đề lý thuyết và bài tập
          </Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} size="large">
          Tạo khóa học mới
        </Button>
      </div>

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
