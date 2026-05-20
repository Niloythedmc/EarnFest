import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1500, // Further increase limit to reduce warnings
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Better chunk splitting for performance
          if (id.includes('node_modules')) {
            if (id.includes('lottie') || id.includes('react')) {
              return 'ui-vendor'; // Separate UI libraries
            }
            if (id.includes('axios') || id.includes('firebase')) {
              return 'api-vendor'; // Separate API libraries
            }
            if (id.includes('recharts') || id.includes('framer-motion')) {
              return 'charts-vendor'; // Separate chart libraries
            }
            return 'vendor'; // Other libraries
          }
          // Split large application code
          if (id.includes('src/pages/')) {
            return 'pages';
          }
          if (id.includes('src/components/')) {
            return 'components';
          }
        }
      },
      // Suppress specific warnings
      onwarn(warning, warn) {
        // Suppress lottie eval warnings
        if (warning.code === 'EVAL' && warning.message?.includes('lottie')) {
          return;
        }
        warn(warning);
      }
    },
    // Optimize dependencies
    commonjsOptions: {
      include: [/node_modules/],
    },
    // Better minification (Default to esbuild for speed)
    minify: 'esbuild',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['lottie-react', 'pako', 'axios'],
    exclude: ['@telegram-apps/sdk'], // Exclude problematic packages if needed
  },
})
