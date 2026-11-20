import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  // Project pages are served at /engguoqu/. Dev stays at the site root.
  base: command === 'build' ? '/engguoqu/' : '/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
}));
