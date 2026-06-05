import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3110,
    host: true,
    allowedHosts: 'all',
    proxy: {
      '/api': {
        target: 'https://sankhya.nxboats.com.br',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
