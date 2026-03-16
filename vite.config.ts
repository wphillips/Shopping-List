import { defineConfig } from 'vite';
import { swCacheVersionPlugin } from './vite-plugin-sw-cache-version';

export default defineConfig({
  plugins: [swCacheVersionPlugin()],
  test: {
    globals: true,
    environment: 'jsdom'
  },
  server: {
    host: '0.0.0.0',
  },
  publicDir: 'public',
  build: {
    rollupOptions: {
      input: {
        main: './index.html'
      }
    }
  }
});
