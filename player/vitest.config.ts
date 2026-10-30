import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test/setup.ts'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      // Tests, fakes and type declarations have no logic of their own.
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/vite-env.d.ts'],
      reporter: ['text-summary', 'html', 'json-summary'],
      // The minimums of .claude/rules/testing.md: the core, as pure logic,
      // is held higher than the hooks. Each glob is checked on its files together.
      thresholds: {
        'src/core/**': { lines: 90, branches: 85 },
        'src/hooks/**': { lines: 85 },
      },
    },
  },
})
