import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'MUYAHO_');
  return {
    server: {
      port: 3000,
      host: '127.0.0.1',
      proxy: {
        '/api/semantic_search': {
          target: env.MUYAHO_BACKEND_TARGET || 'http://127.0.0.1:6666',
          rewrite: () => '/semantic_search',
        },
        '/api/catalog/': {
          target: env.MUYAHO_IMAGE_API_TARGET || 'https://muyaho-api.yuntae.in',
          changeOrigin: true,
          rewrite: (url) => url.replace(/^\/api\/catalog/, ''),
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
