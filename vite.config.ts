import { defineConfig } from 'vite';
import { swCacheVersionPlugin } from './vite-plugin-sw-cache-version';

export default defineConfig(({ command }) => ({
  plugins: [swCacheVersionPlugin()],
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(
      command === 'build'
        ? `Built ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}`
        : 'Built dev'
    )
  },
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
}));
