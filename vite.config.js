import { defineConfig } from 'vite';

export default defineConfig({
  // itch.io 등 서브디렉토리 배포용 상대경로
  base: './',

  // 개발 서버 설정
  server: {
    port: 5173,
    strictPort: false,
    host: true,
    // HMR 강화
    hmr: {
      overlay: true
    },
    // 파일 감시 설정
    watch: {
      usePolling: true,  // 파일 변경 감지 강화
      interval: 100
    }
  },

  // 캐시 완전 비활성화 (개발 중)
  cacheDir: 'node_modules/.vite',

  // 빌드 설정
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },

  // 최적화 설정
  optimizeDeps: {
    force: true  // 의존성 강제 재빌드
  }
});
