import { useState } from 'react'
import { App, Button, Card, Form, Input, Segmented, Space, Tag, Typography } from 'antd'
import { CodeOutlined, IdcardOutlined, LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { USE_MOCK } from '../api'

const ARCH = `Browser ──HTTP :8000──▶ Master ◀──TCP :9000 (>BBI)── worker-1
        ◀──WS   :8001──       │                     worker-2
                              ▼                     worker-N
                        FIFO Queue + Least-Busy
                        Heartbeat 5s / Failover`

export default function LoginPage() {
  const [role, setRole] = useState('student')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
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

  return (
    <div className="login-wrap">
      <section className="login-hero">
        <div>
          <div className="brand" style={{ color: '#fff' }}>
            <span className="brand-logo">
              <CodeOutlined />
            </span>
            <span>
              Code<b style={{ color: '#93c5fd' }}>Judge</b>
            </span>
          </div>
          <h1>Hệ thống chấm bài lập trình C++ tự động phân tán</h1>
          <Typography.Paragraph style={{ color: '#cbd5e1', maxWidth: 520 }}>
            Nộp bài C++17, theo dõi tiến trình biên dịch và từng test case theo thời gian thực qua WebSocket. Bài nộp được điều
            phối tới cụm Judge Worker và tự động chấm lại nếu máy chấm gặp sự cố.
          </Typography.Paragraph>
          <Space wrap size={[6, 6]}>
            {['AC', 'WA', 'TLE', 'MLE', 'RTE', 'CE', 'SEC'].map((v) => (
              <span key={v} className={`verdict tone-${v.toLowerCase()}`}>
                {v}
              </span>
            ))}
          </Space>
        </div>
        <div className="arch">{ARCH}</div>
      </section>

      <section className="login-form">
        <Card>
          <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
            Đăng nhập
          </Typography.Title>
          <Typography.Paragraph type="secondary">Chọn vai trò để bắt đầu.</Typography.Paragraph>
          <Segmented
            block
            value={role}
            onChange={setRole}
            style={{ marginBottom: 20 }}
            options={[
              { value: 'student', label: 'Thí sinh', icon: <UserOutlined /> },
              { value: 'admin', label: 'Quản trị viên', icon: <SafetyCertificateOutlined /> },
            ]}
          />
          <Form key={role} layout="vertical" requiredMark={false} onFinish={onFinish} size="large">
            {role === 'student' ? (
              <>
                <Form.Item
                  name="studentId"
                  label="Mã sinh viên"
                  rules={[
                    { required: true, message: 'Nhập MSSV' },
                    { pattern: /^[A-Za-z]\d{2}[A-Za-z]{4}\d{3}$/, message: 'MSSV dạng B20DCCN001' },
                  ]}
                  normalize={(v) => v?.toUpperCase()}
                >
                  <Input prefix={<IdcardOutlined />} placeholder="B20DCCN001" className="mono" autoFocus />
                </Form.Item>
                <Form.Item
                  name="fullName"
                  label="Họ và tên"
                  rules={[{ required: true, whitespace: true, message: 'Nhập họ tên' }]}
                >
                  <Input prefix={<UserOutlined />} placeholder="Nguyễn Văn A" />
                </Form.Item>
              </>
            ) : (
              <Form.Item name="password" label="Mật khẩu quản trị" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
                <Input.Password prefix={<LockOutlined />} placeholder="••••••••" autoFocus />
              </Form.Item>
            )}
            <Button type="primary" htmlType="submit" block loading={loading}>
              {role === 'student' ? 'Bắt đầu làm bài' : 'Vào trang quản trị'}
            </Button>
          </Form>
          {USE_MOCK && (
            <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 16, marginBottom: 0 }}>
              <Tag color="blue">Mock</Tag>
              Mật khẩu admin mặc định: <span className="inline-code">admin123</span>
            </Typography.Paragraph>
          )}
        </Card>
      </section>
    </div>
  )
}
