import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Master Server: HTTP REST :8000, WebSocket :8001 (xem README gốc §5).
// Khi chạy dev, /api được proxy sang Master để tránh CORS.
// Mặc định local dev: :8082. Docker Compose: set VITE_BACKEND_URL=http://127.0.0.1:18000 trong .env.local
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.VITE_BACKEND_URL || 'http://127.0.0.1:8082'
  return {
    plugins: [react()],
    build: {
      // Các trang đã lazy-load; chunk lớn còn lại là antd dùng chung.
      chunkSizeWarningLimit: 1200,
    },
    server: {
      proxy: {
        '/api': backendUrl,
      },
    },
  }
})
