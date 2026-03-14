import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const API_URL = process.env.VITE_API_URL || 'http://localhost:8080'
const WS_URL = process.env.VITE_WS_URL || 'ws://localhost:8080'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': API_URL,
      '/ws': { target: WS_URL, ws: true }
    }
  }
})
