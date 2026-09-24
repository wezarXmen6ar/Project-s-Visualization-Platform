import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['{shared,server,client}/**/*.test.{ts,tsx}'],
    setupFiles: ['./test-setup.ts'],
  },
});
