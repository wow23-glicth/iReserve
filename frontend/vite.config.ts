import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000', // Change this to your local PHP server URL (e.g. 'http://localhost/iReserve-master/iReserve-master' if using XAMPP)
        changeOrigin: true,
        secure: false,
      }
    }
  }
})

