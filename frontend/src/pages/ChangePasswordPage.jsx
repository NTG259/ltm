import { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { api } from '../api'
import { validatePasswordChange } from './change-password-validation'
import StudentPageHeader from '../components/student/StudentPageHeader'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '../components/ui/field'
import { Input } from '../components/ui/input'
import { Spinner } from '../components/ui/spinner'

const INITIAL_VALUES = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
}

export default function ChangePasswordPage() {
  const [values, setValues] = useState(INITIAL_VALUES)
  const [errors, setErrors] = useState({})
  const [feedback, setFeedback] = useState(null)
  const [saving, setSaving] = useState(false)

  const updateField = (field) => (event) => {
    setValues((current) => ({ ...current, [field]: event.target.value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setFeedback(null)
  }

  const submit = async (event) => {
    event.preventDefault()
    const nextErrors = validatePasswordChange(values)
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSaving(true)
    setFeedback(null)
    try {
      await api.changePassword({
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      })
      window.history.back()
    } catch (error) {
      setFeedback(error.message || 'Không thể đổi mật khẩu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page flex max-w-2xl flex-col gap-5">
      <StudentPageHeader
        eyebrow="Tài khoản"
        title="Đổi mật khẩu"
        description="Cập nhật mật khẩu đăng nhập để bảo vệ tài khoản CodeJudge của bạn."
      />

      {feedback && (
        <Alert variant="destructive">
          <AlertTitle>Không thể đổi mật khẩu</AlertTitle>
          <AlertDescription>{feedback}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-4" aria-hidden="true" />
            Thông tin bảo mật
          </CardTitle>
          <CardDescription>
            Sau khi đổi, mật khẩu ban đầu sẽ không còn hiển thị trong trang quản lý tài khoản.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} noValidate>
            <FieldGroup>
              <Field data-invalid={Boolean(errors.currentPassword)}>
                <FieldLabel htmlFor="current-password">Mật khẩu hiện tại</FieldLabel>
                <Input
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={values.currentPassword}
                  onChange={updateField('currentPassword')}
                  aria-invalid={Boolean(errors.currentPassword)}
                />
                <FieldError>{errors.currentPassword}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.newPassword)}>
                <FieldLabel htmlFor="new-password">Mật khẩu mới</FieldLabel>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={values.newPassword}
                  onChange={updateField('newPassword')}
                  aria-invalid={Boolean(errors.newPassword)}
                />
                <FieldDescription>Sử dụng ít nhất 8 ký tự.</FieldDescription>
                <FieldError>{errors.newPassword}</FieldError>
              </Field>

              <Field data-invalid={Boolean(errors.confirmPassword)}>
                <FieldLabel htmlFor="confirm-password">Nhập lại mật khẩu mới</FieldLabel>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={values.confirmPassword}
                  onChange={updateField('confirmPassword')}
                  aria-invalid={Boolean(errors.confirmPassword)}
                />
                <FieldError>{errors.confirmPassword}</FieldError>
              </Field>

              <Button type="submit" className="w-fit" disabled={saving}>
                {saving && <Spinner data-icon="inline-start" />}
                Lưu mật khẩu mới
              </Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
