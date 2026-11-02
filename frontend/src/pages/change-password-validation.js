export function validatePasswordChange(values) {
  const errors = {}
  if (!values.currentPassword) errors.currentPassword = 'Nhập mật khẩu hiện tại'
  if (!values.newPassword || values.newPassword.length < 8) {
    errors.newPassword = 'Mật khẩu cần ít nhất 8 ký tự'
  }
  if (!values.confirmPassword) errors.confirmPassword = 'Nhập lại mật khẩu mới'
  else if (values.newPassword !== values.confirmPassword) {
    errors.confirmPassword = 'Mật khẩu nhập lại không khớp'
  }
  return errors
}
