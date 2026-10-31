import { useState } from 'react'
import { App, Button, Card, DatePicker, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import { DeleteOutlined, EditOutlined, PlusOutlined, TrophyOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'
import { formatDateTime, formatDuration } from '../../lib/format'
import { CONTEST_STATUS, liveStatus } from '../../lib/contest'
import { useNow } from '../../lib/hooks'

export default function TeacherContestsPage() {
  const { message } = App.useApp()
  const contests = useFetch(() => api.teacherListContests(), [])
  const classrooms = useFetch(() => api.listClassrooms(), [])
  const problems = useFetch(() => api.teacherContestProblems(), [])
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const now = useNow(1000)

  const open = (contest) => {
    setEditing(contest || {})
    form.setFieldsValue(contest?.id ? {
      ...contest,
      startAt: dayjs(contest.startAt),
      classroomId: contest.classroomId,
      problemIds: (contest.problems || []).map((p) => p.problemId ?? p.id),
    } : { title: '', description: '', startAt: dayjs().add(1, 'day').startOf('hour'), durationMin: 120, classroomId: undefined, problemIds: [] })
  }

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const payload = { ...values, id: editing?.id, startAt: values.startAt.valueOf(), description: values.description || '' }
      await api.teacherSaveContest(payload)
      message.success(editing?.id ? 'Đã cập nhật kỳ thi' : 'Đã tạo kỳ thi và gán vào lớp')
      setEditing(null)
      contests.reload()
    } catch (error) { message.error(error.message) }
    finally { setSaving(false) }
  }

  const remove = async (id) => {
    try { await api.teacherDeleteContest(id); message.success('Đã xóa kỳ thi'); contests.reload() }
    catch (error) { message.error(error.message) }
  }

  return (
    <div className="page">
      <Space style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <Typography.Title level={3} style={{ margin: 0 }}>Kỳ thi của tôi</Typography.Title>
          <Typography.Text type="secondary">Tạo kỳ thi cho lớp được phân công bằng các đề có sẵn trong kho chung.</Typography.Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>Tạo kỳ thi</Button>
      </Space>
      <Card styles={{ body: { padding: 0 } }}>
        <Table rowKey="id" loading={contests.loading} dataSource={contests.data || []} pagination={false}
          columns={[
            { title: 'Kỳ thi', render: (_, c) => <><Link to={`/teacher/contests/${c.id}`}><b>{c.title}</b></Link><div><Typography.Text type="secondary">{(c.problems || []).map((p) => p.label).join(' · ')}</Typography.Text></div></> },
            { title: 'Lớp', dataIndex: 'classroomId', width: 170, render: (id) => classrooms.data?.find((c) => c.id === id)?.name || '—' },
            { title: 'Trạng thái', width: 125, render: (_, c) => { const status = liveStatus(c, now); return <Tag color={CONTEST_STATUS[status]?.color}>{CONTEST_STATUS[status]?.label || status}</Tag> } },
            { title: 'Bắt đầu', dataIndex: 'startAt', width: 170, render: formatDateTime },
            { title: 'Thời lượng', dataIndex: 'durationMin', width: 110, render: formatDuration },
            { title: '', width: 150, render: (_, c) => <Space>
              {c.classroomId ? <Link to={`/teacher/classrooms/${c.classroomId}/contests/${c.id}/monitor`}><Button size="small" icon={<TrophyOutlined />} title="Giám sát kỳ thi của lớp" aria-label="Kết quả" /></Link> : <Link to={`/teacher/contests/${c.id}`}><Button size="small" icon={<TrophyOutlined />} title="Giám sát phòng thi" aria-label="Kết quả" /></Link>}
              <Button size="small" icon={<EditOutlined />} onClick={() => open(c)} aria-label="Sửa" />
              <Popconfirm title="Xóa kỳ thi?" onConfirm={() => remove(c.id)} okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xóa" />
              </Popconfirm>
            </Space> },
          ]}
        />
      </Card>
      <Modal open={!!editing} title={editing?.id ? 'Sửa kỳ thi' : 'Tạo kỳ thi'} onOk={save}
        onCancel={() => setEditing(null)} confirmLoading={saving} okText="Lưu" cancelText="Hủy" width={640} destroyOnHidden>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="title" label="Tên kỳ thi" rules={[{ required: true, whitespace: true }]}><Input maxLength={200} /></Form.Item>
          <Form.Item name="classroomId" label="Lớp học" rules={[{ required: true, message: 'Chọn lớp' }]}>
            <Select disabled={!!editing?.id} options={(classrooms.data || []).map((c) => ({ value: c.id, label: c.name }))} placeholder="Chọn lớp do bạn quản lý" />
          </Form.Item>
          <Space align="start" style={{ display: 'flex' }}>
            <Form.Item name="startAt" label="Thời gian bắt đầu" rules={[{ required: true }]}><DatePicker showTime format="DD/MM/YYYY HH:mm" /></Form.Item>
            <Form.Item name="durationMin" label="Thời lượng (phút)" rules={[{ required: true }]}><InputNumber min={10} max={600} step={15} /></Form.Item>
          </Space>
          <Form.Item name="problemIds" label="Đề từ kho dùng chung" rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất một bài' }]}>
            <Select mode="multiple" loading={problems.loading} options={(problems.data || []).map((p) => ({ value: p.id, label: `#${p.id} ${p.title}` }))} placeholder="Chọn bài tập" />
          </Form.Item>
          <Form.Item name="description" label="Mô tả / thể lệ"><Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
