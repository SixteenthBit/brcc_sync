import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019', 
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        format: 'es',
        manualChunks: undefined
      }
    }
  }
})