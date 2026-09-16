// vite.probe.config.js — TEMPORAIRE, uniquement pour le banc d'essai headless :
// même config que vite.config.js, mais /api pointe vers l'API simulée (port
// 3009) afin de ne pas toucher au vrai backend qui tourne sur 3001.
import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5273,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3009',
        changeOrigin: true,
      },
    },
  },
})