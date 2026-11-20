import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // Project pages are served at /engguoqu/. The single-file build uses relative
  // paths so engguoqu.html can be opened directly. Dev stays at the site root.
  base: process.env.SINGLE_FILE === '1' ? './' : command === 'build' ? '/engguoqu/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
