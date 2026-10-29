import { useEffect, useState } from 'react'
import { App, Button, Card, Form, Input, Tooltip, Typography } from 'antd'
import {
  LockOutlined,
  UserOutlined,
  SunOutlined,
  MoonOutlined,
  ArrowRightOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { useThemeMode } from '../theme'
import { api } from '../api'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [onlineCount, setOnlineCount] = useState(null)

  useEffect(() => {
    api.onlineCount().then((r) => setOnlineCount(r?.count ?? 0)).catch(() => {})
  }, [])
  const [form] = Form.useForm()
  const { login } = useAuth()
  const { mode, toggle } = useThemeMode()
  const { message } = App.useApp()
  const navigate = useNavigate()

  const onFinish = async (values) => {
    setLoading(true)
    try {
      const user = await login(values)
      message.success(`Xin chào, ${user.name}`)
      const dest = user.role === 'admin' ? '/admin' : '/problems'
      navigate(dest, { replace: true })
    } catch (e) {
      message.error(e.message)
    } finally {
      setLoading(false)
    }
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

      {/* Form đăng nhập Kính mờ (Frosted Glass) */}
      <section className="login-form-pane">
        {/* Top Control Bar: Server Status & Nút chuyển Light/Dark Mode */}
        <div className="login-top-bar">
          <div className="server-status-chip">
            <span className="status-dot"></span>
            <span>{onlineCount === null ? 'Đang kết nối…' : `${onlineCount} sinh viên online`}</span>
          </div>

          <Tooltip title={mode === 'dark' ? 'Chuyển sang Giao diện Sáng' : 'Chuyển sang Giao diện Tối'}>
            <button
              type="button"
              className="login-theme-toggle"
              onClick={toggle}
              aria-label={mode === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'}
            >
              <span className="theme-toggle-icon">
                {mode === 'dark' ? <SunOutlined /> : <MoonOutlined />}
              </span>
            </button>
          </Tooltip>
        </div>

        <div className="login-card-wrapper">
          <Card className="login-glass-card" bordered={false}>
            <div className="login-card-header">
              <Typography.Title level={2} className="login-title">
                Đăng nhập
              </Typography.Title>
              <Typography.Paragraph className="login-subtitle">
                Đăng nhập để học tập, luyện tập và tham gia các kỳ thi.
              </Typography.Paragraph>
            </div>

            <Form
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={onFinish}
              size="large"
              className="login-actual-form"
            >
              <Form.Item
                name="username"
                label={<span className="field-label">Tài khoản</span>}
                rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập tài khoản' }]}
                normalize={(value) => value?.trim()}
              >
                <Input
                  prefix={<UserOutlined className="input-icon" />}
                  placeholder="Nhập MSSV hoặc tên tài khoản"
                  className="login-input"
                  autoComplete="username"
                  autoFocus
                />
              </Form.Item>

              <Form.Item
                name="password"
                label={<span className="field-label">Mật khẩu</span>}
                rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
              >
                <Input.Password
                  prefix={<LockOutlined className="input-icon" />}
                  placeholder="Nhập mật khẩu"
                  className="login-input"
                  autoComplete="current-password"
                />
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                className="login-submit-btn"
                icon={<ArrowRightOutlined />}
              >
                Đăng nhập
              </Button>
            </Form>
          </Card>
        </div>
      </section>
    </div>
  )
}
