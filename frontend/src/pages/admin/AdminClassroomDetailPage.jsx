import { useRef, useState } from 'react'
import { App, Button, Card, Popconfirm, Select, Space, Table, Tabs, Tag, Typography, Upload } from 'antd'
import { ArrowLeftOutlined, DeleteOutlined, EyeOutlined, UploadOutlined, WifiOutlined } from '@ant-design/icons'
import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'

export default function AdminClassroomDetailPage() {
  const { id } = useParams()
  const { message } = App.useApp()

  const { data: students, loading: loadingStudents, reload: refetchStudents } = useFetch(
    () => api.listClassroomStudents(id), [id]
  )
  const { data: assignedContests, loading: loadingContests, reload: refetchContests } = useFetch(
    () => api.listClassroomContests(id), [id]
  )
  const { data: allContests } = useFetch(() => api.listContests(), [])

  const [importing, setImporting] = useState(false)
  const [selectedContest, setSelectedContest] = useState(null)
  const [assigning, setAssigning] = useState(false)

  const assignedIds = new Set((assignedContests || []).map((c) => c.contestId))
  const availableContests = (allContests || []).filter((c) => !assignedIds.has(c.id))

  const handleCsvUpload = async ({ file }) => {
    setImporting(true)
    try {
      const result = await api.importClassroomStudents(id, file)
      message.success(
        `Đã thêm ${result.imported} sinh viên (tạo mới: ${result.created}, đã có: ${result.alreadyEnrolled}` +
        (result.skippedInOtherClass > 0 ? `, bỏ qua (ở lớp khác): ${result.skippedInOtherClass}` : '') + ')'
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

  const studentColumns = [
    { title: 'MSSV', dataIndex: 'username', key: 'username', className: 'mono' },
    { title: 'Họ tên', dataIndex: 'fullName', key: 'fullName' },
    { title: 'Ngày thêm', dataIndex: 'joinedAt', key: 'joinedAt', render: (v) => new Date(v).toLocaleDateString('vi-VN') },
    {
      title: '',
      key: 'actions',
      width: 80,
      render: (_, row) => (
        <Popconfirm title="Xóa khỏi lớp?" onConfirm={() => removeStudent(row.userId)} okText="Xóa" cancelText="Hủy" okButtonProps={{ danger: true }}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
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
            <Button size="small" icon={<EyeOutlined />}>Giám sát</Button>
          </Link>
          <Popconfirm title="Bỏ gán kỳ thi?" onConfirm={() => unassignContest(row.contestId)} okText="Bỏ gán" cancelText="Hủy" okButtonProps={{ danger: true }}>
            <Button size="small" danger>Bỏ gán</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 16px' }}>
      <Space style={{ marginBottom: 16 }}>
        <Link to="/admin/classrooms">
          <Button icon={<ArrowLeftOutlined />}>Danh sách lớp</Button>
        </Link>
        <Typography.Title level={3} style={{ margin: 0 }}>Chi tiết lớp</Typography.Title>
        <Link to={`/admin/classrooms/${id}/monitor`}>
          <Button icon={<WifiOutlined />}>Giám sát Online</Button>
        </Link>
      </Space>

      <Tabs defaultActiveKey="students" items={[
        {
          key: 'students',
          label: `Sinh viên (${(students || []).length})`,
          children: (
            <Card>
              <div style={{ marginBottom: 16 }}>
                <Upload
                  accept=".csv"
                  customRequest={handleCsvUpload}
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} loading={importing}>
                    Import CSV (MSSV, HọTên)
                  </Button>
                </Upload>
              </div>
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
                  options={(availableContests).map((c) => ({ value: c.id, label: c.title }))}
                  showSearch
                  filterOption={(input, option) => option.label.toLowerCase().includes(input.toLowerCase())}
                />
                <Button type="primary" onClick={assignContest} loading={assigning} disabled={!selectedContest}>
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
      ]} />
    </div>
  )
}
