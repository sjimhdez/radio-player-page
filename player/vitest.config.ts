import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
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
        'src/hooks/use-audio-visualizer.tsx',
        'src/hooks/use-can-visualize.tsx',
        'src/vite-env.d.ts',
      ],
      reporter: ['text-summary', 'html', 'json-summary'],
    },
  },
})
