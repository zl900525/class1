import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 網站放在 https://zl900525.github.io/class1/，所以路徑前綴要跟 repo 名稱一樣（架構文件第 12 節）
export default defineConfig({
  base: '/class1/',
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
