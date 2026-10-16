import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Copied by run.sh into player/ of a temporary worktree (the layout phase 1 will use).
export default defineConfig({
  resolve: { alias: { src: path.resolve(__dirname, 'src') } },
  test: {
    environment: 'happy-dom',
    include: ['src/__spike__/*.test.tsx'],
    setupFiles: ['./src/__spike__/fake-audio.ts'],
  },
})
