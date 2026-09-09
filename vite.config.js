import { defineConfig } from 'vite'

// Port fixe : la connexion Google exige que l'origine (http://localhost:PORT)
// soit enregistrée à l'avance dans Google Cloud Console. Un port qui dérive
// d'un lancement à l'autre casserait la connexion.
export default defineConfig({
  server: {
    // Écouter sur toutes les interfaces (IPv4 + IPv6). Sans cela, Node peut
    // n'écouter que sur [::1] (IPv6) et un navigateur qui résout localhost
    // en 127.0.0.1 obtient "Ce site est inaccessible".
    host: true,
    port: 5173,
    strictPort: true,
    // Le navigateur ne voit qu'une seule origine (localhost:5173) : Vite
    // relaie /api vers Express en coulisses. Ça évite tout souci CORS et
    // fait que le cookie de session posé par le backend s'applique bien à
    // localhost:5173, l'origine que le navigateur voit réellement.
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
