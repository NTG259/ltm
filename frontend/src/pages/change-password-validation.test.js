import test from 'node:test'
import assert from 'node:assert/strict'

import { validatePasswordChange } from './change-password-validation.js'

test('password change requires the current password', () => {
  assert.equal(validatePasswordChange({ currentPassword: '', newPassword: '12345678', confirmPassword: '12345678' }).currentPassword, 'Nhập mật khẩu hiện tại')
})

test('password change requires at least eight characters', () => {
  assert.equal(validatePasswordChange({ currentPassword: 'old', newPassword: '1234567', confirmPassword: '1234567' }).newPassword, 'Mật khẩu cần ít nhất 8 ký tự')
})

test('password change requires matching confirmation', () => {
  assert.equal(validatePasswordChange({ currentPassword: 'old', newPassword: '12345678', confirmPassword: '87654321' }).confirmPassword, 'Mật khẩu nhập lại không khớp')
})

test('password change accepts valid values', () => {
  assert.deepEqual(validatePasswordChange({ currentPassword: 'old', newPassword: '12345678', confirmPassword: '12345678' }), {})
})
