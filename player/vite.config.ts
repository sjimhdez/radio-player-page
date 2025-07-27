// File: radio-player-page/player/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' assert { type: 'json' }

const slug = 'radio-player-page'
const version = pkg.version
const prefix = `${slug}-${version}`

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: 'manifest.json',
    rollupOptions: {
      input: 'index.html',
      output: {
        entryFileNames: `${prefix}-[name].js`,
        chunkFileNames: `${prefix}-[name].js`,
        assetFileNames: `${prefix}-[name][extname]`,
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:5173',
  },
})
