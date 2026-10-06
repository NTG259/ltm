import { useCallback, useState } from 'react'
import {
  App,
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons'
import { Link, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api } from '../../api'
import { useAuth } from '../../auth/context'
import { useFetch, useNow, useSocket } from '../../lib/hooks'
import { formatDateTime, formatDuration } from '../../lib/format'
import { CONTEST_STATUS, liveStatus } from '../../lib/contest'

const LABELS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function ContestDrawer({ contest, open, onClose, onSaved }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()
  const problems = useFetch(() => api.listProblems(), [])
  const picked = Form.useWatch('problemIds', form) || []
  const titleOf = Object.fromEntries((problems.data || []).map((p) => [p.id, p.title]))

  const save = async () => {
    const v = await form.validateFields()
    setSaving(true)
    try {
      const saved = await api.saveContest({
        id: contest?.id,
        title: v.title.trim(),
        description: v.description || '',
        startAt: v.startAt.valueOf(),
        durationMin: v.durationMin,
        problemIds: v.problemIds,
      })
      message.success(contest?.id ? 'Đã cập nhật kỳ thi' : `Đã tạo kỳ thi #${saved.id}`)
      onSaved()
    } catch (e) {
      message.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size={560}
      destroyOnHidden
      title={contest?.id ? 'Sửa kỳ thi' : 'Tạo kỳ thi mới'}
      extra={
        <Space>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" loading={saving} onClick={save}>
            Lưu
          </Button>
        </Space>
      }
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={
          contest?.id
            ? { ...contest, startAt: dayjs(contest.startAt) }
            : { durationMin: 120, startAt: dayjs().add(1, 'day').startOf('hour'), problemIds: [] }
        }
      >
        <Form.Item name="title" label="Tên kỳ thi" rules={[{ required: true, whitespace: true, message: 'Nhập tên kỳ thi' }]}>
          <Input placeholder="Kỳ thi giữa kỳ – Thuật toán cơ bản" />
        </Form.Item>
        <Space size={12} style={{ display: 'flex' }} align="start">
          <Form.Item name="startAt" label="Thời gian bắt đầu" rules={[{ required: true, message: 'Chọn thời gian' }]}>
            <DatePicker showTime={{ format: 'HH:mm' }} format="DD/MM/YYYY HH:mm" style={{ width: 220 }} />
          </Form.Item>
          <Form.Item name="durationMin" label="Thời lượng (phút)" rules={[{ required: true, message: 'Nhập thời lượng' }]}>
            <InputNumber min={10} max={600} step={15} style={{ width: 160 }} />
          </Form.Item>
        </Space>
        <Form.Item
          name="problemIds"
          label="Bộ đề"
          extra="Thứ tự chọn sẽ là thứ tự bài A, B, C…"
          rules={[{ required: true, type: 'array', min: 1, message: 'Chọn ít nhất 1 bài' }]}
        >
          <Select
            mode="multiple"
            loading={problems.loading}
            placeholder="Chọn bài từ ngân hàng đề"
            showSearch={{ optionFilterProp: 'label' }}
            options={(problems.data || []).map((p) => ({ value: p.id, label: `#${p.id} ${p.title}` }))}
          />
        </Form.Item>
        {picked.length > 0 && (
          <Card size="small" style={{ marginBottom: 24 }}>
            {picked.map((pid, i) => (
              <div key={pid}>
                <b>{LABELS[i]}.</b> {titleOf[pid]}
              </div>
            ))}
          </Card>
        )}
        <Form.Item name="description" label="Mô tả / thể lệ">
          <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} placeholder="Giới thiệu kỳ thi, lưu ý cho thí sinh…" />
        </Form.Item>
      </Form>
    </Drawer>
  )
}

export default function AdminContestsPage() {
  const { user } = useAuth()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const now = useNow(1000)
  const list = useFetch(() => api.listContests(user), [user])
  const [editing, setEditing] = useState(null)
  const { reload } = list
  useSocket(useCallback((msg) => msg.type === 'CONTEST_UPDATE' && reload(), [reload]))

  const remove = async (c) => {
    await api.deleteContest(c.id)
    message.success(`Đã xoá kỳ thi "${c.title}"`)
    reload()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Quản lý kỳ thi</h1>
          <p>Tạo kỳ thi từ ngân hàng đề, đặt lịch và theo dõi bảng xếp hạng trực tiếp.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>
          Tạo kỳ thi
        </Button>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={list.loading}
          dataSource={[...(list.data || [])].sort((a, b) => b.startAt - a.startAt)}
          pagination={false}
          scroll={{ x: 860 }}
          columns={[
            {
              title: 'Kỳ thi',
              render: (_, c) => (
                <div>
                  <Link to={`/contests/${c.id}`} style={{ fontWeight: 500 }}>
                    {c.title}
                  </Link>
                  <div>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                      {c.problems.map((p) => p.label).join(' · ')} ({c.problems.length} bài)
                    </Typography.Text>
                  </div>
                </div>
              ),
            },
            {
              title: 'Trạng thái',
              width: 130,
              render: (_, c) => {
                const st = liveStatus(c, now)
                return <Tag color={CONTEST_STATUS[st].color}>{CONTEST_STATUS[st].label}</Tag>
              },
            },
            { title: 'Bắt đầu', dataIndex: 'startAt', width: 170, render: (v) => formatDateTime(v) },
            { title: 'Thời lượng', dataIndex: 'durationMin', width: 120, render: (v) => formatDuration(v) },
            { title: 'Thí sinh', dataIndex: 'participantCount', width: 90, align: 'center' },
            {
              title: '',
              width: 130,
              align: 'right',
              render: (_, c) => (
                <Space>
                  <Button
                    size="small"
                    icon={<EyeOutlined />}
                    onClick={() => navigate(`/contests/${c.id}`)}
                    aria-label="Theo dõi"
                  />
                  <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(c)} aria-label="Sửa" />
                  <Popconfirm
                    title="Xoá kỳ thi?"
                    description="Bảng xếp hạng của kỳ thi sẽ bị xoá. Bài nộp vẫn được giữ."
                    okText="Xoá"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(c)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xoá" />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <ContestDrawer
        key={editing?.id ?? 'new'}
        open={!!editing}
        contest={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          reload()
        }}
      />
    </div>
  )
}
