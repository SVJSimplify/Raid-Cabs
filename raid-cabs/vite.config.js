import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/mappls-api': {
        target: 'https://apis.mappls.com',
        changeOrigin: true,
        secure: true,
        rewrite: p => p.replace(/^\/mappls-api/, ''),
      },
    },
  },
})
