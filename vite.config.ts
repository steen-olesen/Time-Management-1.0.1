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
    target: 'es2020',
    // Ensure proper asset handling
    assetsDir: 'assets',
    // Fix potential memory issues during build
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
            if (id.includes('recharts')) {
              return 'charts'
            }
            if (id.includes('jspdf')) {
              return 'pdf'
            }
            if (id.includes('date-fns')) {
              return 'date'
            }
            if (id.includes('react-icons')) {
              return 'icons'
            }
            if (id.includes('@supabase')) {
              return 'supabase'
            }
            return 'vendor'
          }
        }
      }
    }
  },
  // Ensure environment variables are properly loaded
  define: {
    'process.env': {}
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['jspdf', 'jspdf-autotable', 'recharts', '@supabase/supabase-js', 'date-fns'],
    exclude: []
  },
  // Ensure proper resolution
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  // Server configuration for development
  server: {
    port: 5173,
    host: true
  }
})
