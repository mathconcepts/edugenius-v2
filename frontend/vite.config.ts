import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/solutions': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/telegram': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React runtime
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Animation
          'motion': ['framer-motion'],
          // Charts (heavy — isolated)
          'charts': ['recharts'],
          // Math rendering (KaTeX — isolated, only loaded for chat)
          'math': ['katex', 'remark-math', 'rehype-katex'],
          // Markdown
          'markdown': ['react-markdown', 'react-syntax-highlighter'],
        },
      },
    },
    // Raise warning threshold a bit since recharts + katex are legitimately large
    chunkSizeWarningLimit: 600,
  },
});
