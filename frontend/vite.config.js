import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Where Django is running. Change it if port 8000 is taken, e.g.
//   API_URL=http://127.0.0.1:8001 npm run dev
const API_URL = process.env.API_URL || 'http://127.0.0.1:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    // Send every /api request to Django, so the browser sees one website
    // and the login cookie just works. changeOrigin: false keeps the browser's
    // address in the Host header, which Django's CSRF check compares against.
    proxy: {
      '/api': { target: API_URL, changeOrigin: false },
    },
  },
})
