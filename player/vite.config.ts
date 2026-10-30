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
      src: path.resolve(import.meta.dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    manifest: 'manifest.json',
    // Vite 6 default ('modules'); Vite 7+ raised it. Kept so supported browsers don't change.
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14'],
    rolldownOptions: {
      input: 'src/main.tsx',
      output: {
        entryFileNames: `${prefix}.min.js`,
        chunkFileNames: (chunkInfo) => {
          // Named after the chunk, without a hash: the version in the name busts caches.
          const chunkName = chunkInfo.name || 'chunk'
          // Only letters, digits and hyphens, so the name is a valid file name.
          const cleanName = chunkName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
          return `${prefix}-${cleanName}.min.js`
        },
        assetFileNames: `${prefix}[extname]`,
        // Keep bundled third-party license notices (Oxc strips them when minifying).
        comments: { legal: true },
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
