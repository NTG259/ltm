import { useState } from 'react'
import {
  App,
  Button,
  Card,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd'
import { DeleteOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { useFetch } from '../../lib/hooks'
import { DIFFICULTIES } from '../../lib/verdicts'
import { percent } from '../../lib/format'

const DIFF_COLOR = { easy: 'green', medium: 'gold', hard: 'red' }
const EMPTY = {
  title: '',
  difficulty: 'easy',
  tags: [],
  timeLimitMs: 1000,
  memoryLimitMb: 256,
  statement: '',
  inputSpec: '',
  outputSpec: '',
  samples: [{ input: '', output: '' }],
  tests: [{ input: '', output: '' }],
}

function IoList({ name, label, addText }) {
  return (
    <Form.List
      name={name}
      rules={[
        {
          validator: async (_, v) => {
            if (!v?.length) throw new Error(`Cần ít nhất 1 ${label}`)
          },
        },
      ]}
    >
      {(fields, { add, remove }, { errors }) => (
        <>
          {fields.map((f, i) => (
            <Card
              key={f.key}
              size="small"
              style={{ marginBottom: 10 }}
              title={
                <span className="mono">
                  {label} #{i + 1}
                </span>
              }
              extra={
                fields.length > 1 && (
                  <Button
                    type="text"
                    danger
                    size="small"
                    icon={<MinusCircleOutlined />}
                    onClick={() => remove(f.name)}
                    aria-label="Xoá"
                  />
                )
              }
            >
              <Row gutter={10}>
                <Col span={12}>
                  <Form.Item
                    name={[f.name, 'input']}
                    label="Input"
                    rules={[{ required: true, message: 'Nhập input' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} className="mono" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name={[f.name, 'output']}
                    label="Output"
                    rules={[{ required: true, message: 'Nhập output' }]}
                    style={{ marginBottom: 0 }}
                  >
                    <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} className="mono" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          ))}
          <Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({ input: '', output: '' })}>
            {addText}
          </Button>
          <Form.ErrorList errors={errors} />
        </>
      )}
    </Form.List>
  )
}

function ProblemDrawer({ open, problem, onClose, onSaved }) {
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()

  const save = async () => {
    const values = await form.validateFields()
    setSaving(true)
    try {
      const saved = await api.saveProblem({ ...values, id: problem?.id })
      message.success(problem?.id ? `Đã cập nhật đề #${saved.id}` : `Đã thêm đề #${saved.id}`)
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
      size={760}
      destroyOnHidden
      title={problem?.id ? `Sửa đề #${problem.id}` : 'Thêm đề bài mới'}
      extra={
        <Space>
          <Button onClick={onClose}>Huỷ</Button>
          <Button type="primary" loading={saving} onClick={save}>
            Lưu
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" initialValues={problem || EMPTY} requiredMark="optional">
        <Tabs
          items={[
            {
              key: 'info',
              label: 'Thông tin & đề bài',
              forceRender: true,
              children: (
                <>
                  <Form.Item name="title" label="Tên bài" rules={[{ required: true, whitespace: true, message: 'Nhập tên bài' }]}>
                    <Input />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col xs={24} sm={8}>
                      <Form.Item name="difficulty" label="Độ khó">
                        <Select options={Object.entries(DIFFICULTIES).map(([k, v]) => ({ value: k, label: v.label }))} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Form.Item name="timeLimitMs" label="Giới hạn thời gian (ms)" rules={[{ required: true }]}>
                        <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={8}>
                      <Form.Item name="memoryLimitMb" label="Giới hạn bộ nhớ (MB)" rules={[{ required: true }]}>
                        <InputNumber min={16} max={1024} step={16} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="tags" label="Chủ đề">
                    <Select mode="tags" placeholder="Gõ rồi Enter để thêm" />
                  </Form.Item>
                  <Form.Item
                    name="statement"
                    label="Nội dung đề"
                    extra="Dùng `backtick` cho code inline, dòng trống để tách đoạn."
                    rules={[{ required: true, message: 'Nhập nội dung đề' }]}
                  >
                    <Input.TextArea autoSize={{ minRows: 5, maxRows: 14 }} />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="inputSpec" label="Dữ liệu vào" rules={[{ required: true, message: 'Bắt buộc' }]}>
                        <Input.TextArea autoSize={{ minRows: 3 }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="outputSpec" label="Kết quả" rules={[{ required: true, message: 'Bắt buộc' }]}>
                        <Input.TextArea autoSize={{ minRows: 3 }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ),
            },
            {
              key: 'samples',
              label: 'Ví dụ (công khai)',
              forceRender: true,
              children: <IoList name="samples" label="Ví dụ" addText="Thêm ví dụ" />,
            },
            {
              key: 'tests',
              label: 'Bộ test chấm (ẩn)',
              forceRender: true,
              children: (
                <>
                  <Typography.Paragraph type="secondary">
                    Worker chấm lần lượt từng test qua stdin/stdout. Đầu ra được so sánh sau khi chuẩn hoá khoảng trắng cuối dòng.
                  </Typography.Paragraph>
                  <IoList name="tests" label="Test" addText="Thêm test case" />
                </>
              ),
            },
          ]}
        />
      </Form>
    </Drawer>
  )
}

export default function AdminProblemsPage() {
  const { message } = App.useApp()
  const list = useFetch(() => api.listProblems(), [])
  const [editing, setEditing] = useState(null)

  const openEdit = async (id) => {
    try {
      setEditing(await api.getProblem(id))
    } catch (e) {
      message.error(e.message)
    }
  }
  const remove = async (id) => {
    await api.deleteProblem(id)
    message.success(`Đã xoá đề #${id}`)
    list.reload()
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Ngân hàng đề bài</h1>
          <p>Thêm, sửa, xoá đề bài và bộ test case dùng để chấm.</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(EMPTY)}>
          Thêm đề bài
        </Button>
      </div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={list.loading}
          dataSource={list.data || []}
          pagination={false}
          scroll={{ x: 820 }}
          columns={[
            { title: 'Mã', dataIndex: 'id', width: 70, render: (id) => <span className="mono">#{id}</span> },
            {
              title: 'Tên bài',
              render: (_, p) => (
                <div>
                  <Link to={`/problems/${p.id}`}>{p.title}</Link>
                  <div style={{ marginTop: 4 }}>
                    {p.tags.map((t) => (
                      <Tag key={t} variant="filled" style={{ fontSize: 11 }}>
                        {t}
                      </Tag>
                    ))}
                  </div>
                </div>
              ),
            },
            {
              title: 'Độ khó',
              dataIndex: 'difficulty',
              width: 110,
              render: (d) => <Tag color={DIFF_COLOR[d]}>{DIFFICULTIES[d].label}</Tag>,
            },
            {
              title: 'Giới hạn',
              width: 130,
              render: (_, p) => (
                <span className="mono" style={{ fontSize: 12 }}>
                  {p.timeLimitMs} ms · {p.memoryLimitMb} MB
                </span>
              ),
            },
            { title: 'Số test', dataIndex: 'testCount', width: 80, align: 'center' },
            {
              title: 'Bài nộp (AC)',
              width: 130,
              render: (_, p) => (
                <span className="mono" style={{ fontSize: 12 }}>
                  {p.acceptedSubmissions}/{p.totalSubmissions} ({percent(p.acceptedSubmissions, p.totalSubmissions)}%)
                </span>
              ),
            },
            {
              title: '',
              width: 110,
              align: 'right',
              render: (_, p) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(p.id)} aria-label="Sửa" />
                  <Popconfirm
                    title={`Xoá đề #${p.id}?`}
                    description="Toàn bộ test case của đề sẽ bị xoá."
                    okText="Xoá"
                    cancelText="Huỷ"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => remove(p.id)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} aria-label="Xoá" />
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <ProblemDrawer
        key={editing?.id ?? 'new'}
        open={!!editing}
        problem={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          list.reload()
        }}
      />
    </div>
  )
}
