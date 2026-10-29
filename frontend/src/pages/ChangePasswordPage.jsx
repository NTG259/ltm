import { useState } from 'react'
import { App, Button, Card, Form, Input, Typography } from 'antd'
import { api } from '../api'

export default function ChangePasswordPage() {
  const { message } = App.useApp()
  const [saving, setSaving] = useState(false)

  const submit = async (values) => {
    setSaving(true)
    try {
      await api.changePassword({ currentPassword: values.currentPassword, newPassword: values.newPassword })
      message.success('Đổi mật khẩu thành công. Mật khẩu ban đầu đã được ẩn khỏi lớp học.')
      window.history.back()
    } catch (error) {
      message.error(error.message || 'Không thể đổi mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page" style={{ maxWidth: 560, margin: '32px auto' }}>
      <Card>
        <Typography.Title level={3}>Đổi mật khẩu</Typography.Title>
        <Typography.Paragraph type="secondary">
          Sau khi đổi, giảng viên sẽ không còn xem được mật khẩu ban đầu của bạn.
        </Typography.Paragraph>
        <Form layout="vertical" onFinish={submit}>
          <Form.Item name="currentPassword" label="Mật khẩu hiện tại" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="Mật khẩu mới" rules={[{ required: true }, { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự' }]}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Nhập lại mật khẩu mới"
            dependencies={['newPassword']}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue('newPassword') === value
                    ? Promise.resolve()
                    : Promise.reject(new Error('Mật khẩu nhập lại không khớp'))
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Lưu mật khẩu mới</Button>
        </Form>
      </Card>
    </div>
  )
}
