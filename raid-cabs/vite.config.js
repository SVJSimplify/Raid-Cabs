import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Supabase realtime-js imports 'ws' (Node.js only WebSocket lib)
      // Replace it with an empty shim — browser uses native WebSocket
      // This prevents a broken worker being created that crashes Safari
      'ws': path.resolve(__dirname, 'src/lib/ws-shim.js'),
    },
  },
})
