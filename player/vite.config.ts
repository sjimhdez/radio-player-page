import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json' with { type: 'json' }
import path from 'path'

const slug = 'radio-player-page'
const version = pkg.version
const prefix = `${slug}-${version}`

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      src: path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: 'manifest.json',
    rollupOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: `${prefix}.js`,
        chunkFileNames: () => {
          return `${prefix}-chunk-[hash].js`
        },
        assetFileNames: `${prefix}[extname]`,
      },
    },
  },
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:5173',
  },
})