import { useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Popconfirm, Select, Space, Table } from 'antd'
import { DeleteOutlined, EditOutlined, TeamOutlined, PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { useFetch } from '../../lib/hooks'

export default function AdminClassroomsPage() {
  const { message } = App.useApp()
  const { data: classrooms, loading, reload: refetch } = useFetch(() => api.listClassrooms(), [])
  const { data: lecturers } = useFetch(() => api.listLecturers(), [])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    form.setFieldsValue({ name: row.name, semester: row.semester, lecturerId: row.lecturerId ?? undefined })
    setModalOpen(true)
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const payload = { ...values, lecturerId: values.lecturerId ? String(values.lecturerId) : '' }
      if (editing) {
        await api.updateClassroom(editing.id, payload)
        message.success('Đã cập nhật lớp học và giảng viên phụ trách')
      } else {
        await api.createClassroom(payload)
        message.success('Đã tạo lớp học')
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
      await api.deleteClassroom(id)
      message.success('Đã xóa lớp học')
      refetch()
    } catch (e) {
      message.error(e.message)
    }
  }

  const columns = [
    { title: 'Tên lớp', dataIndex: 'name', key: 'name', render: (name, row) => <Link to={`/admin/classrooms/${row.id}`}>{name}</Link> },
    { title: 'Kỳ học', dataIndex: 'semester', key: 'semester', render: (value) => value || '—' },
    { title: 'Giảng viên phụ trách', dataIndex: 'lecturerName', key: 'lecturer', render: (name, row) => name ? `${name} (${row.lecturerStaffId})` : 'Chưa phân công' },
    { title: 'Ngày tạo', dataIndex: 'createdAt', key: 'createdAt', render: (value) => new Date(value).toLocaleDateString('vi-VN') },
    {
      title: '', key: 'actions', width: 120,
      render: (_, row) => (
        <Space>
          <Link to={`/admin/classrooms/${row.id}`}><Button size="small" icon={<TeamOutlined />}>Chi tiết</Button></Link>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          <Popconfirm title="Xóa lớp này?" onConfirm={() => remove(row.id)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page admin-page--compact">
      <AdminPageHeader title="Quản lý lớp học" actions={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Tạo lớp</Button>} />
      <Card>
        <Table rowKey="id" columns={columns} dataSource={classrooms || []} loading={loading} pagination={false}
          locale={{ emptyText: 'Chưa có lớp học nào' }} />
      </Card>
      <Modal open={modalOpen} title={editing ? 'Sửa lớp học' : 'Tạo lớp học mới'} onOk={save}
        onCancel={() => setModalOpen(false)} confirmLoading={saving} okText={editing ? 'Lưu' : 'Tạo'} cancelText="Hủy">
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Tên lớp" rules={[{ required: true, whitespace: true, message: 'Nhập tên lớp' }]}>
            <Input maxLength={255} placeholder="Ví dụ: Lập trình C++ - K65" />
          </Form.Item>
          <Form.Item name="semester" label="Kỳ học"><Input maxLength={50} placeholder="Ví dụ: HK1/2025" /></Form.Item>
          <Form.Item name="lecturerId" label="Giảng viên phụ trách">
            <Select allowClear placeholder="Chưa phân công" options={(lecturers || []).map((lecturer) => ({
              value: lecturer.id, label: `${lecturer.fullName} (${lecturer.staffId})`,
            }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
