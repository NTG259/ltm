import { useState } from 'react'
import { App, Button, Card, Form, Input, Segmented, Tooltip, Typography, Tag } from 'antd'
import {
  CodeOutlined,
  IdcardOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
  ThunderboltOutlined,
  CloudServerOutlined,
  LaptopOutlined,
  CheckCircleFilled,
  ArrowRightOutlined,
  InfoCircleOutlined,
  RocketOutlined,
  ClusterOutlined,
  ApiOutlined,
  SyncOutlined,
  CheckOutlined,
} from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { USE_MOCK } from '../api'

const VERDICTS = [
  { code: 'AC', name: 'Accepted', desc: 'Vượt qua 100% test case (Điểm tối đa)', tone: 'ac' },
  { code: 'WA', name: 'Wrong Answer', desc: 'Kết quả in ra không khớp với đáp án mẫu', tone: 'wa' },
  { code: 'TLE', name: 'Time Limit', desc: 'Chạy quá thời gian giới hạn (CPU limit)', tone: 'tle' },
  { code: 'MLE', name: 'Memory Limit', desc: 'Vượt quá ngưỡng bộ nhớ RAM cho phép', tone: 'mle' },
  { code: 'RTE', name: 'Runtime Error', desc: 'Lỗi thực thi (Segmentation Fault, chia 0)', tone: 'rte' },
  { code: 'CE', name: 'Compile Error', desc: 'Lỗi biên dịch mã nguồn g++ C++17', tone: 'ce' },
  { code: 'SEC', name: 'Security Error', desc: 'Vi phạm lệnh cấm syscall trong sandbox', tone: 'sec' },
]

export default function LoginPage() {
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const [copiedDemo, setCopiedDemo] = useState(null)
  const [form] = Form.useForm()
  const { login } = useAuth()
  const { mode, toggle } = useThemeMode()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const user = await login({ role, ...values })
      message.success(`Xin chào, ${user.name}`)
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/problems'), { replace: true })
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fillDemoStudent = () => {
    setRole('student')
    form.setFieldsValue({
      studentId: 'B20DCCN001',
      fullName: 'Nguyễn Văn A',
    })
    setCopiedDemo('student')
    setTimeout(() => setCopiedDemo(null), 2000)
  }

  const fillDemoAdmin = () => {
    setRole('admin')
    form.setFieldsValue({
      password: 'admin123',
    })
    setCopiedDemo('admin')
    setTimeout(() => setCopiedDemo(null), 2000)
  }

  return (
    <div className={`login-wrap ${mode === 'dark' ? 'theme-dark' : 'theme-light'}`}>
      {/* Living Ambient Glow Elements */}
      <div className="login-ambient-canvas" aria-hidden="true">
        <div className="ambient-grid"></div>
        <div className="ambient-orb orb-1"></div>
        <div className="ambient-orb orb-2"></div>
        <div className="ambient-orb orb-3"></div>
        <div className="ambient-orb orb-4"></div>
      </div>

      {/* Cột trái: Hero & Interactive Architecture Pipeline */}
      <section className="login-hero">
        <div className="login-hero-glass-card">
          {/* Header Brand Bar */}
          <div className="login-brand-header">
            <div className="brand login-brand">
              <span className="brand-logo login-logo">
                <CodeOutlined />
              </span>
              <span className="login-brand-text">
                Code<span className="brand-gradient-text">Judge</span>
              </span>
            </div>
            <div className="system-pill">
              <span className="system-ping-dot"></span>
              <span className="system-pill-text">v2.4 Distributed Architecture</span>
            </div>
          </div>

          {/* Headline & Description */}
          <div className="login-hero-intro">
            <h1 className="hero-title">
              Hệ thống chấm bài lập trình <br />
              <span className="hero-gradient-text">C++ tự động phân tán</span>
            </h1>
            <p className="hero-desc">
              Biên dịch C++17 trong Sandbox bảo mật, theo dõi tiến trình từng test case theo thời gian thực qua WebSocket.
              Điều phối thông minh tới cụm máy chấm Judge Worker với cơ chế tự động phục hồi sự cố (Failover).
            </p>
          </div>

          {/* Interactive Verdict Pills */}
          <div className="verdict-showcase">
            <div className="verdict-header">
              <span className="verdict-label">Các trạng thái kết quả (Verdicts):</span>
              <span className="verdict-hint">Rê chuột để xem định nghĩa</span>
            </div>
            <div className="verdict-chips-row">
              {VERDICTS.map((v) => (
                <Tooltip key={v.code} title={`${v.code} - ${v.name}: ${v.desc}`} placement="top">
                  <span className={`login-verdict-badge tone-${v.tone}`}>
                    <b>{v.code}</b>
                    <small>{v.name}</small>
                  </span>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Visual Architecture Diagram */}
          <div className="visual-arch-container">
            <div className="visual-arch-header">
              <div className="arch-header-left">
                <ClusterOutlined className="arch-header-icon" />
                <span className="arch-header-title">Kiến trúc luồng xử lý phân tán</span>
              </div>
              <div className="arch-live-badge">
                <span className="tiny-pulse"></span>
                <span>Cluster Online</span>
              </div>
            </div>

            <div className="arch-nodes-grid">
              {/* Node 1: Web Client */}
              <div className="arch-node-card client-node">
                <div className="node-glow-backdrop"></div>
                <div className="node-header">
                  <div className="node-icon-wrap client-icon">
                    <LaptopOutlined />
                  </div>
                  <div className="node-title-group">
                    <span className="node-title">Web Client</span>
                    <span className="node-sub">Browser UI</span>
                  </div>
                </div>
                <div className="node-meta">React 18 &bull; Monaco</div>
                <div className="node-protocol-tag">REST &bull; WS :8082</div>
              </div>

              {/* Flow connector 1 */}
              <div className="arch-flow-arrow">
                <div className="flow-track">
                  <div className="flow-laser"></div>
                </div>
                <span className="flow-text">HTTP / WS</span>
              </div>

              {/* Node 2: Master Node */}
              <div className="arch-node-card master-node">
                <div className="node-glow-backdrop master-glow"></div>
                <div className="node-header">
                  <div className="node-icon-wrap master-icon">
                    <CloudServerOutlined />
                  </div>
                  <div className="node-title-group">
                    <span className="node-title">Judge Master</span>
                    <span className="node-sub">Dispatcher</span>
                  </div>
                </div>
                <div className="node-meta">Spring Boot &bull; FIFO</div>
                <div className="node-protocol-tag primary">Least-Busy Queue</div>
              </div>

              {/* Flow connector 2 */}
              <div className="arch-flow-arrow">
                <div className="flow-track">
                  <div className="flow-laser reverse"></div>
                </div>
                <span className="flow-text">TCP :9000</span>
              </div>

              {/* Node 3: Worker Cluster */}
              <div className="arch-node-card worker-node">
                <div className="node-glow-backdrop worker-glow"></div>
                <div className="node-header">
                  <div className="node-icon-wrap worker-icon">
                    <ThunderboltOutlined />
                  </div>
                  <div className="node-title-group">
                    <span className="node-title">Worker Pool</span>
                    <span className="node-sub">Sandbox C++17</span>
                  </div>
                </div>
                <div className="worker-status-row">
                  <span className="worker-mini-pill online">
                    <span className="pill-dot"></span> worker-1
                  </span>
                  <span className="worker-mini-pill online">
                    <span className="pill-dot"></span> worker-2
                  </span>
                  <span className="worker-mini-pill standby">+N pool</span>
                </div>
              </div>
            </div>

            {/* Live Pipeline Telemetry Footer */}
            <div className="arch-specs-footer">
              <span className="spec-item">
                <CheckCircleFilled className="spec-icon green" /> Heartbeat 5s &amp; Auto Re-queue
              </span>
              <span className="spec-item">
                <CheckCircleFilled className="spec-icon blue" /> Real-time WebSocket Telemetry
              </span>
              <span className="spec-item">
                <CheckCircleFilled className="spec-icon purple" /> Zero-Trust Chroot Sandbox
              </span>
            </div>
          </div>

          <div className="login-hero-footer">
            <span>&copy; {new Date().getFullYear()} CodeJudge Distributed Platform &bull; Lập trình mạng &bull; Học viện Công nghệ Bưu chính Viễn thông</span>
          </div>
        </div>
      </section>

      {/* Cột phải: Form đăng nhập Kính mờ (Frosted Glass) */}
      <section className="login-form-pane">
        {/* Top Control Bar: Server Status & Nút chuyển Light/Dark Mode */}
        <div className="login-top-bar">
          <div className="server-status-chip">
            <span className="status-dot"></span>
            <span>Master :8082 Online</span>
          </div>

          <Tooltip title={mode === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}>
            <button
              type="button"
              className="login-theme-toggle"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              <span className="theme-toggle-icon">
                {mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              </span>
              <span className="theme-toggle-text">
                {mode === 'dark' ? 'Giao diện Sáng' : 'Giao diện Tối'}
              </span>
            </button>
          </Tooltip>
        </div>

        <div className="login-card-wrapper">
          <Card className="login-glass-card" bordered={false}>
            {/* Specular highlight border sheen */}
            <div className="card-specular-glow"></div>

            <div className="login-card-header">
              <div className="login-card-badge">
                <RocketOutlined className="badge-rocket" /> Cổng xác thực sinh viên &amp; quản trị
              </div>
              <Typography.Title level={2} className="login-title">
                Đăng nhập
              </Typography.Title>
              <Typography.Paragraph className="login-subtitle">
                Chọn vai trò để tiếp tục phiên làm việc trên hệ thống.
              </Typography.Paragraph>
            </div>

            {/* Role switch */}
            <Segmented
              block
              value={role}
              onChange={setRole}
              className="login-role-segmented"
              options={[
                { value: 'student', label: 'Thí sinh (Sinh viên)', icon: <UserOutlined /> },
                { value: 'admin', label: 'Quản trị viên', icon: <SafetyCertificateOutlined /> },
              ]}
            />

            {/* Quick Demo Autofill Chips */}
            <div className="quick-demo-box">
              <div className="demo-header">
                <span className="demo-label">Đăng nhập nhanh (Mẫu):</span>
                {copiedDemo && (
                  <span className="demo-copied-badge">
                    <CheckOutlined /> Đã điền thông tin!
                  </span>
                )}
              </div>
              <div className="demo-chips">
                <button
                  type="button"
                  className={`demo-pill ${role === 'student' ? 'active' : ''}`}
                  onClick={fillDemoStudent}
                >
                  <UserOutlined />
                  <span>B20DCCN001</span>
                  <small>Nguyễn Văn A</small>
                </button>
                <button
                  type="button"
                  className={`demo-pill ${role === 'admin' ? 'active' : ''}`}
                  onClick={fillDemoAdmin}
                >
                  <SafetyCertificateOutlined />
                  <span>Admin</span>
                  <small>admin123</small>
                </button>
              </div>
            </div>

            <Form
              form={form}
              key={role}
              layout="vertical"
              requiredMark={false}
              onFinish={onFinish}
              size="large"
              className="login-actual-form"
            >
              {role === 'student' ? (
                <>
                  <Form.Item
                    name="studentId"
                    label={<span className="field-label">Mã sinh viên (MSSV)</span>}
                    rules={[
                      { required: true, message: 'Vui lòng nhập MSSV' },
                      { pattern: /^[A-Za-z]\d{2}[A-Za-z]{4}\d{3}$/, message: 'MSSV định dạng VD: B20DCCN001' },
                    ]}
                    normalize={(v) => v?.toUpperCase()}
                  >
                    <Input
                      prefix={<IdcardOutlined className="input-icon" />}
                      placeholder="VD: B20DCCN001"
                      className="mono login-input"
                      autoFocus
                    />
                  </Form.Item>
                  <Form.Item
                    name="fullName"
                    label={<span className="field-label">Họ và tên thí sinh</span>}
                    rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ tên' }]}
                  >
                    <Input
                      prefix={<UserOutlined className="input-icon" />}
                      placeholder="VD: Nguyễn Văn A"
                      className="login-input"
                    />
                  </Form.Item>
                </>
              ) : (
                <Form.Item
                  name="password"
                  label={<span className="field-label">Mật khẩu quản trị</span>}
                  rules={[{ required: true, message: 'Vui lòng nhập mật khẩu quản trị' }]}
                >
                  <Input.Password
                    prefix={<LockOutlined className="input-icon" />}
                    placeholder="Nhập mật khẩu admin..."
                    className="login-input"
                    autoFocus
                  />
                </Form.Item>
              )}

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="login-submit-btn"
                icon={<ArrowRightOutlined />}
              >
                {role === 'student' ? 'Bắt đầu làm bài' : 'Vào trang quản trị'}
              </Button>
            </Form>

            {USE_MOCK && (
              <div className="login-mock-hint">
                <InfoCircleOutlined className="hint-icon" />
                <span>Chế độ Mock: Mật khẩu admin mặc định <code>admin123</code></span>
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  )
}
