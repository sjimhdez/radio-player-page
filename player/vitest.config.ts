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
      // Frozen zone (ADR 0018 / spec 0001 §4.9) and non-logic files.
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        'src/components/visualizers/**',
        'src/config/visualizers.ts',
        'src/types/visualizers.tsx',
        'src/vite-env.d.ts',
      ],
      reporter: ['text-summary', 'html', 'json-summary'],
      // Minimums of spec 0002 (.claude/rules/testing.md), raised by spec 0006 A3
      // and completed by spec 0014 (branches of src/utils/**).
      // Each glob is checked on its files together.
      thresholds: {
        'src/core/**': { lines: 90, branches: 85 },
        'src/utils/**': { lines: 90, branches: 85 },
        'src/hooks/**': { lines: 85 },
      },
    },
  },
})
