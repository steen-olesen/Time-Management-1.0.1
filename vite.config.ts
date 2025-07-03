import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Ensure proper handling of dynamic imports
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'charts': ['recharts'],
          'pdf': ['jspdf', 'jspdf-autotable'],
          'date': ['date-fns'],
          'icons': ['react-icons'],
          'supabase': ['@supabase/supabase-js']
        }
      }
    },
    // Increase chunk size warning limit
    chunkSizeWarningLimit: 1000,
    // Ensure source maps are generated for debugging
    sourcemap: false,
    // Optimize for production
    minify: 'terser',
    target: 'es2020'
  },
  // Ensure environment variables are properly loaded
  define: {
    'process.env': {}
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable', 'recharts', '@supabase/supabase-js', 'date-fns']
  },
  // Ensure proper resolution
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
