import { useState } from 'react'
import { App, Button, Card, Form, Input, Modal, Popconfirm, Space, Table, Tooltip, Typography, Upload } from 'antd'
import { DeleteOutlined, KeyOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function AdminLecturersPage() {
  const { message } = App.useApp()
  const list = useFetch(() => api.listLecturers(), [])
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState([])
  const [deleting, setDeleting] = useState(false)

  const create = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      await api.createLecturer(values)
      message.success('Đã tạo tài khoản giảng viên')
      setOpen(false)
      form.resetFields()
      list.reload()
    } catch (error) { message.error(error.message) }
    finally { setSaving(false) }
  }

  const importCsv = async ({ file }) => {
    setImporting(true)
    try {
      const result = await api.importLecturers(file)
      if (result.imported > 0) message.success(`Đã import ${result.imported} giảng viên`)
      else message.info('Không có giảng viên mới được import')
      if (result.skippedExisting > 0 || result.skippedInvalid > 0) {
        message.warning(`Bỏ qua ${result.skippedExisting} tài khoản đã tồn tại và ${result.skippedInvalid} dòng không hợp lệ`)
      }
      list.reload()
    } catch (error) {
      message.error(error.message || 'Không thể import file CSV')
    } finally {
      setImporting(false)
    }
    return false
  }

  const resetPasswordForLecturer = async () => {
    if (!resetTarget) return
    if (resetPassword.length < 8) {
      message.warning('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    setResetting(true)
    try {
      await api.resetLecturerPassword(resetTarget.id, resetPassword)
      message.success(`Đã đặt lại mật khẩu cho ${resetTarget.staffId}`)
      setResetTarget(null)
      setResetPassword('')
      list.reload()
    } catch (error) {
      message.error(error.message || 'Không thể đặt lại mật khẩu')
    } finally {
      setResetting(false)
    }
  }

  const filteredLecturers = (list.data || []).filter((lecturer) =>
    `${lecturer.staffId} ${lecturer.fullName}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')),
  )

  const deleteSelected = async () => {
    setDeleting(true)
    try {
      const result = await api.deleteLecturers(selectedIds)
      message.success(`Đã xóa ${result.deleted} tài khoản giảng viên; lớp được giữ lại nhưng bỏ gán giảng viên.`)
      setSelectedIds([])
      list.reload()
    } catch (error) {
      message.error(error.message || 'Không thể xóa tài khoản giảng viên')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="page">
      <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Tài khoản giảng viên</Typography.Title>
          <Typography.Text type="secondary">Tài khoản giảng viên được tạo bởi admin, không có đăng ký tự do.</Typography.Text>
        </div>
        <Space wrap>
          <Upload accept=".csv,text/csv" customRequest={importCsv} showUploadList={false}>
            <Button icon={<UploadOutlined />} loading={importing}>Import CSV</Button>
          </Upload>
          <Popconfirm
            title={`Xóa ${selectedIds.length} tài khoản giảng viên?`}
            description="Các lớp và nội dung liên quan vẫn được giữ; lớp sẽ không còn giảng viên được gán."
            okText="Xóa tài khoản"
            cancelText="Hủy"
            okButtonProps={{ danger: true, loading: deleting }}
            onConfirm={deleteSelected}
          >
            <Button danger icon={<DeleteOutlined />} disabled={!selectedIds.length} loading={deleting}>
              Xóa đã chọn ({selectedIds.length})
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>Thêm giảng viên</Button>
        </Space>
      </Space>
      <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        File CSV cần có các cột MaGiangVien, HoTen, MatKhau; mật khẩu tối thiểu 8 ký tự. Tài khoản đã tồn tại sẽ được bỏ qua.
      </Typography.Text>
      <Card styles={{ body: { padding: 0 } }}>
        <div style={{ padding: 16 }}>
          <Input.Search allowClear placeholder="Tìm theo mã hoặc họ tên giảng viên" value={search} onChange={(event) => setSearch(event.target.value)} style={{ maxWidth: 360 }} />
        </div>
        <Table rowKey="id" loading={list.loading} dataSource={filteredLecturers} pagination={{ pageSize: 20 }}
          columns={[
            { title: 'Mã giảng viên', dataIndex: 'staffId', className: 'mono' },
            { title: 'Họ tên', dataIndex: 'fullName' },
            { title: 'Lớp phụ trách', dataIndex: 'classroomCount', width: 120, align: 'center' },
            { title: 'Mật khẩu', dataIndex: 'initialPassword', width: 190, render: (password) => password
              ? <Input.Password value={password} readOnly autoComplete="off" aria-label="Mật khẩu khởi tạo giảng viên" />
              : <Typography.Text type="secondary">Đã đổi / không lưu</Typography.Text> },
            { title: 'Ngày tạo', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleDateString('vi-VN') },
            { title: 'Hành động', key: 'actions', width: 110, render: (_, lecturer) => (
              <Tooltip title="Đặt lại mật khẩu">
                <Button size="small" icon={<KeyOutlined />} onClick={() => { setResetTarget(lecturer); setResetPassword('') }} />
              </Tooltip>
            ) },
          ]}
          rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds }}
        />
      </Card>
      <Modal
        open={!!resetTarget}
        title={`Đặt lại mật khẩu · ${resetTarget?.staffId || ''}`}
        onOk={resetPasswordForLecturer}
        onCancel={() => { setResetTarget(null); setResetPassword('') }}
        confirmLoading={resetting}
        okText="Cập nhật mật khẩu"
        cancelText="Hủy"
        destroyOnHidden
      >
        <Input.Password
          autoComplete="new-password"
          value={resetPassword}
          onChange={(event) => setResetPassword(event.target.value)}
          placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
          style={{ marginTop: 12 }}
        />
      </Modal>
      <Modal open={open} title="Tạo tài khoản giảng viên" onOk={create} onCancel={() => setOpen(false)}
        confirmLoading={saving} okText="Tạo tài khoản" cancelText="Hủy" destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="staffId" label="Mã giảng viên" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={32} placeholder="Ví dụ: GV002" />
          </Form.Item>
          <Form.Item name="fullName" label="Họ tên" rules={[{ required: true, whitespace: true }]}>
            <Input maxLength={100} />
          </Form.Item>
          <Form.Item name="password" label="Mật khẩu ban đầu" rules={[{ required: true }, { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
