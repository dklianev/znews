import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    passWithNoTests: true,
    restoreMocks: true,
    clearMocks: true,
    testTimeout: 30000,
    hookTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage/vitest',
      include: [
        'src/**/*.{js,jsx,mjs,ts,tsx}',
        'server/**/*.{js,mjs,ts}',
        'shared/**/*.{js,mjs,ts}',
      ],
      exclude: [
        '**/*.test.*',
        'tests/**',
        'dist/**',
        'coverage/**',
        '.smoke-safe-runtime/**',
        'node_modules/**',
      ],
    },
    projects: [
      {
        test: {
          name: 'legacy-node',
          include: ['tests/vitest/**/*.node.test.mjs'],
          environment: 'node',
          fileParallelism: false,
          setupFiles: ['tests/vitest/setup/node.setup.mjs'],
        },
      },
      {
        test: {
          name: 'ui-jsdom',
          include: ['tests/vitest/**/*.dom.test.{js,jsx,mjs,ts,tsx}'],
          environment: 'jsdom',
          fileParallelism: false,
          setupFiles: ['tests/vitest/setup/jsdom.setup.mjs'],
        },
      },
    ],
  },
});
