import React from 'react'
import { Button, Result } from 'antd'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <Result
            status="500"
            title="Đã xảy ra lỗi hiển thị"
            subTitle={this.state.error?.message || 'Không thể tải nội dung trang này. Vui lòng thử lại.'}
            extra={[
              <Button type="primary" key="reload" onClick={() => window.location.reload()}>
                Tải lại trang
              </Button>,
              <Button key="back" onClick={() => window.history.back()}>
                Quay lại
              </Button>,
            ]}
          />
        </div>
      )
    }

    return this.props.children
  }
}

