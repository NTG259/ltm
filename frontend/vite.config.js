import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Master Server: HTTP REST :8000, WebSocket :8001 (xem README gốc §5).
// Khi chạy dev, /api được proxy sang Master để tránh CORS.
export default defineConfig({
  plugins: [react()],
  build: {
    // Các trang đã lazy-load; chunk lớn còn lại là antd dùng chung.
    chunkSizeWarningLimit: 1200,
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})
