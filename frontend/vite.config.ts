import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2019', // Updated to fix nullish coalescing operator compatibility issues
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