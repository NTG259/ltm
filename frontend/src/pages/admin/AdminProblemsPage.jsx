import { useState } from 'react'
import {
  Alert,
  App,
  Button,
  Card,
  Checkbox,
  Col,
  Drawer,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  FileZipOutlined,
  InboxOutlined,
  MinusCircleOutlined,
  PlusOutlined,
  ProfileOutlined,
  UploadOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import AdminPageHeader from '../../components/admin/AdminPageHeader'
import { useFetch } from '../../lib/hooks'
import { DIFFICULTIES } from '../../lib/verdicts'
import { percent } from '../../lib/format'

const DIFF_COLOR = { easy: 'green', medium: 'gold', hard: 'red' }
const CHECKER_OPTIONS = [
  { value: 'lines', label: 'Lines (so từng dòng, bỏ trailing whitespace)' },
  { value: 'tokens', label: 'Tokens (so từng token, bỏ khoảng trắng)' },
  { value: 'exact', label: 'Exact (so chính xác từng ký tự)' },
]

const EMPTY = {
  title: '',
  difficulty: 'easy',
  checker: 'lines',
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
  const [uploadingZip, setUploadingZip] = useState(false)
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
                    <Col xs={24} sm={6}>
                      <Form.Item name="difficulty" label="Độ khó">
                        <Select options={Object.entries(DIFFICULTIES).map(([k, v]) => ({ value: k, label: v.label }))} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Form.Item name="timeLimitMs" label="Giới hạn thời gian (ms)" rules={[{ required: true }]}>
                        <InputNumber min={100} max={10000} step={100} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={12} sm={6}>
                      <Form.Item name="memoryLimitMb" label="Giới hạn bộ nhớ (MB)" rules={[{ required: true }]}>
                        <InputNumber min={16} max={1024} step={16} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col xs={24} sm={6}>
                      <Form.Item name="checker" label="Checker">
                        <Select options={CHECKER_OPTIONS} />
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

                  <Card
                    size="small"
                    style={{
                      marginBottom: 16,
                      background: 'rgba(56, 189, 248, 0.04)',
                      borderColor: 'rgba(56, 189, 248, 0.2)',
                    }}
                  >
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space align="center" style={{ justifyContent: 'space-between', width: '100%', flexWrap: 'wrap' }}>
                        <Space>
                          <FileZipOutlined style={{ fontSize: 18, color: '#38bdf8' }} />
                          <Typography.Text strong>Nhập hàng loạt từ file ZIP</Typography.Text>
                        </Space>
                        <Upload
                          accept=".zip"
                          showUploadList={false}
                          beforeUpload={async (file) => {
                            try {
                              setUploadingZip(true)
                              const res = await api.parseProblemTestCasesZip(file)
                              if (res.tests?.length) {
                                const currentTests = form.getFieldValue('tests') || []
                                const hasContent = currentTests.some((t) => t.input || t.output)
                                const newTests = hasContent ? [...currentTests, ...res.tests] : res.tests
                                form.setFieldsValue({ tests: newTests })
                                message.success(`Đã nạp thành công ${res.tests.length} testcase từ ${file.name}`)
                                if (res.unpairedInputs?.length) {
                                  message.warning(`Có ${res.unpairedInputs.length} file input thiếu output tương ứng`)
                                }
                              } else {
                                message.warning('Không tìm thấy testcase hợp lệ trong file ZIP')
                              }
                            } catch (err) {
                              message.error(err.message || 'Lỗi khi đọc file ZIP')
                            } finally {
                              setUploadingZip(false)
                            }
                            return false
                          }}
                        >
                          <Button icon={<UploadOutlined />} loading={uploadingZip}>
                            Chọn file ZIP (.zip)
                          </Button>
                        </Upload>
                      </Space>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Hỗ trợ các cặp file: <code>1.in / 1.out</code>, <code>test01.inp / test01.out</code>, thư mục <code>input/</code> và <code>output/</code>,...
                      </Typography.Text>
                    </Space>
                  </Card>

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

function QuickZipModal({ open, problem, onClose, onUploaded }) {
  const [fileList, setFileList] = useState([])
  const [keepSamples, setKeepSamples] = useState(true)
  const [uploading, setUploading] = useState(false)
  const { message } = App.useApp()

  const handleUpload = async () => {
    if (!fileList.length) {
      message.warning('Vui lòng chọn file .zip')
      return
    }
    setUploading(true)
    try {
      const res = await api.uploadProblemTestCasesZip(problem.id, fileList[0], keepSamples)
      message.success(res.message || `Đã nhập thành công ${res.importedCount} test case!`)
      if (res.unpairedInputs?.length) {
        message.warning(`Có ${res.unpairedInputs.length} file input thiếu output tương ứng`)
      }
      onUploaded()
      onClose()
    } catch (err) {
      message.error(err.message || 'Lỗi khi tải lên file ZIP')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        <Space>
          <FileZipOutlined style={{ color: '#38bdf8' }} />
          <span>Nhập bộ test từ file ZIP – #{problem?.id} {problem?.title}</span>
        </Space>
      }
      footer={[
        <Button key="cancel" onClick={onClose}>
          Đóng
        </Button>,
        <Button key="submit" type="primary" loading={uploading} onClick={handleUpload}>
          Bắt đầu nhập test
        </Button>,
      ]}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%', marginTop: 12 }}>
        <Alert
          type="info"
          showIcon
          message="Định dạng file ZIP hợp lệ"
          description={
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              <li>Cặp file theo số thứ tự: <code>1.in / 1.out</code>, <code>2.inp / 2.out</code>, <code>test03.in / test03.ans</code></li>
              <li>Thư mục riêng: <code>input/1.txt</code> và <code>output/1.txt</code></li>
              <li>Thư mục từng test: <code>test01/input.txt</code> và <code>test01/output.txt</code></li>
            </ul>
          }
        />

        <Checkbox checked={keepSamples} onChange={(e) => setKeepSamples(e.target.checked)}>
          Giữ lại các test ví dụ (Sample tests) hiện có của đề
        </Checkbox>

        <Upload.Dragger
          accept=".zip"
          maxCount={1}
          fileList={fileList}
          beforeUpload={(file) => {
            setFileList([file])
            return false
          }}
          onRemove={() => setFileList([])}
          style={{ padding: '16px 0' }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined style={{ color: '#38bdf8', fontSize: 36 }} />
          </p>
          <p className="ant-upload-text">Kéo thả file .zip vào đây hoặc bấm để chọn</p>
          <p className="ant-upload-hint">Dung lượng tối đa 50 MB, hỗ trợ tối đa 500 testcases</p>
        </Upload.Dragger>
      </Space>
    </Modal>
  )
}

export default function AdminProblemsPage() {
  const { message } = App.useApp()
  const list = useFetch(() => api.listProblems(), [])
  const [editing, setEditing] = useState(null)
  const [zipModalProblem, setZipModalProblem] = useState(null)

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

  const toggleVisibility = async (id, visible) => {
    try {
      await api.toggleProblemVisibility(id, visible)
      list.reload()
    } catch (e) {
      message.error(e.message)
    }
  }

  return (
    <div className="page">
      <AdminPageHeader
        title="Ngân hàng đề bài"
        description="Thêm, sửa, xoá đề bài và bộ test case dùng để chấm."
        actions={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing(EMPTY)}>
            Thêm đề bài
          </Button>
        }
      />
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          loading={list.loading}
          dataSource={list.data || []}
          pagination={false}
          scroll={{ x: 860 }}
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
              title: 'Công khai',
              dataIndex: 'publicVisible',
              width: 90,
              align: 'center',
              render: (val, p) => (
                <Tooltip title={val ? 'Đang công khai — bấm để ẩn' : 'Đang ẩn — bấm để công khai'}>
                  <Switch size="small" checked={val} onChange={(v) => toggleVisibility(p.id, v)} />
                </Tooltip>
              ),
            },
            {
              title: 'Bài nộp (AC)',
              width: 140,
              render: (_, p) => (
                <Tooltip title={`Xem toàn bộ bài nộp của đề #${p.id}`}>
                  <Link to={`/admin/submissions?problemId=${p.id}`}>
                    <Tag color={p.totalSubmissions > 0 ? 'blue' : 'default'} style={{ cursor: 'pointer', margin: 0 }}>
                      <span className="mono" style={{ fontSize: 12 }}>
                        {p.acceptedSubmissions}/{p.totalSubmissions} ({percent(p.acceptedSubmissions, p.totalSubmissions)}%)
                      </span>
                    </Tag>
                  </Link>
                </Tooltip>
              ),
            },
            {
              title: '',
              width: 140,
              align: 'right',
              render: (_, p) => (
                <Space>
                  <Tooltip title="Xem bài nộp của đề này">
                    <Link to={`/admin/submissions?problemId=${p.id}`}>
                      <Button size="small" icon={<ProfileOutlined />} aria-label="Xem bài nộp" />
                    </Link>
                  </Tooltip>
                  <Tooltip title="Nhập bộ test từ file ZIP">
                    <Button
                      size="small"
                      icon={<FileZipOutlined />}
                      onClick={() => setZipModalProblem(p)}
                      aria-label="Upload ZIP"
                    />
                  </Tooltip>
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
      <QuickZipModal
        open={!!zipModalProblem}
        problem={zipModalProblem}
        onClose={() => setZipModalProblem(null)}
        onUploaded={() => list.reload()}
      />
    </div>
  )
}
