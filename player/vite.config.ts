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
        // Entry point: PHP carga este archivo desde el manifest
        entryFileNames: `${prefix}.js`,
        // Chunks: React resuelve automáticamente estos archivos cuando hace import()
        // Formato: radio-player-page-1.3-chunk-[hash].js
        chunkFileNames: () => {
          return `${prefix}-chunk-[hash].js`
        },
        assetFileNames: `${prefix}[extname]`,
        // Formato ES modules para imports dinámicos
        format: 'es',
      },
    },
  },
  // Rutas relativas para que los imports dinámicos funcionen desde cualquier URL de WordPress
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    origin: 'http://localhost:5173',
  },
})