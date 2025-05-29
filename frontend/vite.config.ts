import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020', // Updated to match TypeScript target and support modern syntax
    minify: 'esbuild',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Ensure compatibility with older browsers while supporting modern syntax
        format: 'es',
        manualChunks: undefined
      }
    }
  }
})