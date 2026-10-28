import { useMemo, useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Table,
  Tabs,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  ArrowLeftOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  IdcardOutlined,
  KeyOutlined,
  ProfileOutlined,
  UploadOutlined,
  UserAddOutlined,
  UserOutlined,
  WifiOutlined,
} from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function AdminClassroomDetailPage() {
  const { id } = useParams()
  const { message } = App.useApp()

  const { data: students, loading: loadingStudents, reload: refetchStudents } = useFetch(
    () => api.listClassroomStudents(id),
    [id],
  )
  const { data: assignedContests, loading: loadingContests, reload: refetchContests } = useFetch(
    () => api.listClassroomContests(id),
    [id],
  )
  const { data: allContests } = useFetch(() => api.listContests(), [])

  const [importing, setImporting] = useState(false)
  const [selectedContest, setSelectedContest] = useState(null)
  const [assigning, setAssigning] = useState(false)

  // State cho Modal reset mật khẩu
  const [resetTarget, setResetTarget] = useState(null) // { userId, username }
  const [resetPassword, setResetPassword] = useState('')
  const [resetting, setResetting] = useState(false)

  // State cho Modal thêm sinh viên thủ công
  const [addModalVisible, setAddModalVisible] = useState(false)
  const [addMode, setAddMode] = useState('single')
  const [adding, setAdding] = useState(false)
  const [singleForm] = Form.useForm()
  const [batchText, setBatchText] = useState('')

  const assignedIds = new Set((assignedContests || []).map((c) => c.contestId))
  const availableContests = (allContests || []).filter((c) => !assignedIds.has(c.id))

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

  // Thêm 1 sinh viên cụ thể
  const handleAddSingle = async (values) => {
    setAdding(true)
    try {
      const studentId = values.studentId.trim().toUpperCase()
      const fullName = values.fullName.trim()
      await api.addClassroomStudent(id, { studentId, fullName })
      message.success(`Đã thêm sinh viên ${studentId} (${fullName}) vào lớp`)
      singleForm.resetFields()
      setAddModalVisible(false)
      refetchStudents()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  // Thêm nhanh bằng danh sách paste văn bản
  const handleAddBatch = async () => {
    if (!batchText.trim()) {
      message.warning('Vui lòng nhập hoặc dán danh sách sinh viên vào ô bên trên')
      return
    }

    if (parsedStudents.length === 0) {
      message.warning('Không tìm thấy dòng nào hợp lệ (cần có MSSV)')
      return
    }

    setAdding(true)
    try {
      const res = await api.addClassroomStudent(id, { students: parsedStudents })
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
      refetchStudents()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAdding(false)
    }
  }

  const handleCsvUpload = async ({ file }) => {
    setImporting(true)
    try {
      const result = await api.importClassroomStudents(id, file)
      message.success(
        `Đã thêm ${result.imported} sinh viên (tạo mới: ${result.created}, đã có: ${result.alreadyEnrolled}` +
          (result.skippedInOtherClass > 0 ? `, bỏ qua (ở lớp khác): ${result.skippedInOtherClass}` : '') +
          ')',
      )
      refetchStudents()
    } catch (e) {
      message.error(e.message)
    } finally {
      setImporting(false)
    }
    return false // ngăn antd upload tự động
  }

  const removeStudent = async (userId) => {
    try {
      await api.removeClassroomStudent(id, userId)
      message.success('Đã xóa sinh viên khỏi lớp')
      refetchStudents()
    } catch (e) {
      message.error(e.message)
    }
  }

  const assignContest = async () => {
    if (!selectedContest) return
    setAssigning(true)
    try {
      await api.assignClassroomContest(id, selectedContest)
      message.success('Đã gán kỳ thi')
      setSelectedContest(null)
      refetchContests()
    } catch (e) {
      message.error(e.message)
    } finally {
      setAssigning(false)
    }
  }

  const unassignContest = async (contestId) => {
    try {
      await api.unassignClassroomContest(id, contestId)
      message.success('Đã bỏ gán kỳ thi')
      refetchContests()
    } catch (e) {
      message.error(e.message)
    }
  }

  const handleResetPassword = async () => {
    if (!resetTarget) return
    if (!resetPassword || resetPassword.length < 8) {
      message.warning('Mật khẩu phải có ít nhất 8 ký tự')
      return
    }
    setResetting(true)
    try {
      await api.resetStudentPassword(resetTarget.userId, resetPassword)
      message.success(`Đã đặt lại mật khẩu cho ${resetTarget.username}`)
      setResetTarget(null)
      setResetPassword('')
    } catch (e) {
      message.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  const studentColumns = [
    {
      title: 'MSSV',
      dataIndex: 'username',
      key: 'username',
      className: 'mono',
      render: (v) => (
        <Tooltip title={`Xem toàn bộ bài nộp của ${v}`}>
          <Link to={`/admin/submissions?student=${v}`}>{v}</Link>
        </Tooltip>
      ),
    },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    {
      title: 'Mật khẩu import',
      dataIndex: 'importedPassword',
      key: 'importedPassword',
      width: 210,
      render: (password) => password ? (
        <Input.Password
          value={password}
          readOnly
          autoComplete="off"
          aria-label="Mật khẩu ban đầu từ CSV"
        />
      ) : <Typography.Text type="secondary">Chưa lưu</Typography.Text>,
    },
    {
      title: 'Ngày thêm',
      dataIndex: 'joinedAt',
      key: 'joinedAt',
      render: (v) => new Date(v).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 140,
      render: (_, row) => (
        <Space size={6}>
          <Tooltip title={`Xem bài nộp của ${row.username}`}>
            <Link to={`/admin/submissions?student=${row.username}`}>
              <Button size="small" icon={<ProfileOutlined />} />
            </Link>
          </Tooltip>
          <Tooltip title="Đặt lại mật khẩu">
            <Button
              size="small"
              icon={<KeyOutlined />}
              onClick={() => { setResetTarget({ userId: row.userId, username: row.username }); setResetPassword('') }}
            />
          </Tooltip>
          <Popconfirm
            title="Xóa khỏi lớp?"
            description="Sinh viên sẽ không còn xem được các kỳ thi của lớp này."
            onConfirm={() => removeStudent(row.userId)}
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

  const contestColumns = [
    { title: 'Tên kỳ thi', dataIndex: 'title', key: 'title' },
    {
      title: 'Bắt đầu',
      dataIndex: 'startAt',
      key: 'startAt',
      render: (v) => new Date(v).toLocaleString('vi-VN'),
    },
    {
      title: '',
      key: 'actions',
      width: 180,
      render: (_, row) => (
        <Space>
          <Link to={`/admin/classrooms/${id}/contests/${row.contestId}/monitor`}>
            <Button size="small" icon={<EyeOutlined />}>
              Giám sát
            </Button>
          </Link>
          <Popconfirm
            title="Bỏ gán kỳ thi?"
            onConfirm={() => unassignContest(row.contestId)}
            okText="Bỏ gán"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button size="small" danger>
              Bỏ gán
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div className="page admin-page--medium">
      <Space wrap style={{ marginBottom: 16 }}>
        <Link to="/admin/classrooms">
          <Button icon={<ArrowLeftOutlined />}>Danh sách lớp</Button>
        </Link>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Chi tiết lớp
        </Typography.Title>
        <Link to={`/admin/classrooms/${id}/monitor`}>
          <Button icon={<WifiOutlined />}>Giám sát Online</Button>
        </Link>
      </Space>

      <Tabs
        defaultActiveKey="students"
        items={[
          {
            key: 'students',
            label: `Sinh viên (${(students || []).length})`,
            children: (
              <Card>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 12,
                    marginBottom: 16,
                  }}
                >
                  <Space wrap>
                    <Button
                      type="primary"
                      icon={<UserAddOutlined />}
                      onClick={() => setAddModalVisible(true)}
                    >
                      Thêm sinh viên
                    </Button>
                    <Upload
                      accept=".csv"
                      customRequest={handleCsvUpload}
                      showUploadList={false}
                    >
                      <Button icon={<UploadOutlined />} loading={importing}>
                        Import CSV (MSSV, mật khẩu)
                      </Button>
                    </Upload>
                  </Space>
                  <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                    Tổng số: <b>{(students || []).length}</b> sinh viên
                  </Typography.Text>
                </div>
                <Alert
                  type="info"
                  showIcon
                  message="Định dạng file: mssv,password"
                  description="Mật khẩu ban đầu từ CSV được lưu để admin xem lại bằng nút hiện/ẩn. Cột này không cập nhật khi mật khẩu tài khoản thay đổi. Các lần import cũ hiển thị Chưa lưu. MSSV đã có mật khẩu sẽ không bị ghi đè."
                  style={{ marginBottom: 16 }}
                />

                <Table
                  rowKey="userId"
                  columns={studentColumns}
                  dataSource={students || []}
                  loading={loadingStudents}
                  pagination={{ pageSize: 20 }}
                  locale={{ emptyText: 'Chưa có sinh viên nào trong lớp' }}
                />
              </Card>
            ),
          },
          {
            key: 'contests',
            label: `Kỳ thi (${(assignedContests || []).length})`,
            children: (
              <Card>
                <Space style={{ marginBottom: 16 }}>
                  <Select
                    style={{ width: 320 }}
                    placeholder="Chọn kỳ thi để gán"
                    value={selectedContest}
                    onChange={setSelectedContest}
                    options={availableContests.map((c) => ({ value: c.id, label: c.title }))}
                    showSearch
                    filterOption={(input, option) =>
                      option.label.toLowerCase().includes(input.toLowerCase())
                    }
                  />
                  <Button
                    type="primary"
                    onClick={assignContest}
                    loading={assigning}
                    disabled={!selectedContest}
                  >
                    Gán kỳ thi
                  </Button>
                </Space>
                <Table
                  rowKey="contestId"
                  columns={contestColumns}
                  dataSource={assignedContests || []}
                  loading={loadingContests}
                  pagination={false}
                  locale={{ emptyText: 'Chưa có kỳ thi nào được gán' }}
                />
              </Card>
            ),
          },
        ]}
      />

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
        width={520}
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
                  pattern: /^[A-Za-z]\d{2}[A-Za-z]{4}\d{3}$/,
                  message: 'MSSV định dạng VD: B20DCCN001',
                },
              ]}
              normalize={(v) => v?.toUpperCase()}
            >
              <Input
                prefix={<IdcardOutlined />}
                placeholder="VD: B20DCCN001"
                className="mono"
                autoFocus
              />
            </Form.Item>

            <Form.Item
              name="fullName"
              label="Họ và tên thí sinh"
              rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên' }]}
            >
              <Input prefix={<UserOutlined />} placeholder="VD: Nguyễn Văn A" />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              message="Quy tắc hệ thống"
              description="Nếu sinh viên chưa có tài khoản, hệ thống sẽ tự động tạo hồ sơ mới. Mỗi sinh viên chỉ được thuộc 1 lớp học duy nhất."
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
                    'B20DCCN001, Nguyễn Văn A\nB20DCCN002, Trần Thị Bình\nB20DCCN003, Lê Văn Cường'
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
              placeholder="Nhập hoặc dán danh sách vào đây (mỗi sinh viên một dòng)...&#10;Ví dụ:&#10;B20DCCN001, Nguyễn Văn A&#10;B20DCCN002, Trần Thị Bình"
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

      {/* Modal reset mật khẩu sinh viên */}
      <Modal
        title={
          <Space>
            <KeyOutlined style={{ color: '#f59e0b' }} />
            <span>Đặt lại mật khẩu</span>
          </Space>
        }
        open={!!resetTarget}
        onCancel={() => { setResetTarget(null); setResetPassword('') }}
        onOk={handleResetPassword}
        okText="Xác nhận"
        cancelText="Hủy"
        confirmLoading={resetting}
        destroyOnClose
        centered
        width={400}
      >
        {resetTarget && (
          <>
            <Typography.Text>
              Đặt mật khẩu mới cho sinh viên <strong>{resetTarget.username}</strong>:
            </Typography.Text>
            <Input.Password
              style={{ marginTop: 12 }}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới (ít nhất 8 ký tự)"
              autoFocus
              onPressEnter={handleResetPassword}
            />
          </>
        )}
      </Modal>
    </div>
  )
}
