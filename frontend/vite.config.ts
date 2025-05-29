import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es5', // Very conservative
    minify: false, // No minification to avoid syntax issues
    rollupOptions: {
      output: {
        format: 'iife' // Older format
      }
    }
  }
})
