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
        entryFileNames: `${prefix}.min.js`,
        chunkFileNames: (chunkInfo) => {
          // Usar el nombre del chunk si está disponible, de lo contrario usar hash
          const chunkName = chunkInfo.name || 'chunk'
          // Limpiar el nombre para que sea válido como nombre de archivo
          const cleanName = chunkName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase()
          return `${prefix}-${cleanName}.min.js`
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