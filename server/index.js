// index.js
// Point d'entrée UNIQUE : l'API et l'écran.
//
// En développement, deux serveurs tournaient : Vite (5173) servait l'écran et
// relayait /api vers Express (3001) via vite.config.js.
//
// En production ce montage n'existe pas : un seul programme doit tout servir.
// Sans les blocs ci-dessous, l'application en ligne affichait une page blanche,
// et Railway la jugeait morte (le port 3001 était figé alors que Railway en
// impose un autre, injecté dans la variable PORT).

import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import db from './db.js'
import authRoutes from './routes/auth.js'
import tasksRoutes from './routes/tasks.js'
import settingsRoutes from './routes/settings.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DIST_DIR = path.join(__dirname, '..', 'dist')

// Railway fournit PORT ; 3001 reste le repli du développement local.
const PORT = Number(process.env.PORT) || 3001

const app = express()

// OBLIGATOIRE derrière le proxy de Railway, et à placer avant tout le reste.
// Sans cela, req.ip vaut l'adresse du proxy — identique pour tous les
// visiteurs — et le limiteur de tentatives de connexion bloque TOUT LE MONDE
// dès que quelqu'un se trompe 5 fois. C'est un bug invisible en local (aucun
// proxy) qui aurait empêché vos utilisateurs de vous servir.
app.set('trust proxy', 1)

// Limite des corps de requête. Elle doit rester supérieure au plus gros envoi
// possible, preuve comprise : une preuve est envoyée en base64, ce qui agrandit
// la donnée d'environ 33 %.
//
// Le calcul : 2 Mo de fichier → ×4/3 en base64 → ≈ 2,7 Mo de corps JSON.
// 4 Mo laisse donc une marge confortable, sans accepter un envoi absurde.
//
// ⚠️ À MODIFIER EN MEME TEMPS que PROOF_FILE_MAX_BYTES (server/routes/tasks.js,
// aujourd'hui 2 Mo) : les deux valeurs forment une paire. Si la limite du
// corps restait supérieure à ce que la route accepte, un fichier entre les
// deux seuils serait rejeté ICI, avec une erreur 413 brute, avant même
// d'atteindre le message clair « Fichier trop volumineux ».
// Un test verrouille ce couplage : test/preuves-limite.test.js
app.use(express.json({ limit: '4mb' }))
app.use(cookieParser())

// Sonde de santé : Railway interroge cette adresse pour savoir si le service
// est vivant. Elle doit répondre AVANT toute vérification de session.
app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.use('/api/auth', authRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/settings', settingsRoutes)

// L'écran compilé (dossier dist/, produit par `npm run build`). En développement
// ce dossier n'existe pas : c'est Vite qui sert l'écran, et ce bloc ne trouve
// rien — sans erreur.
if (fs.existsSync(DIST_DIR)) {
  app.use(express.static(DIST_DIR))
}

// Toute adresse inconnue renvoie l'écran plutôt qu'une erreur : c'est ce qui
// permet de recharger la page directement sur une vue profonde (une tâche, un
// réglage). `app.get('*')` est interdit en Express 5 — on utilise un middleware
// final, qui fonctionne dans toutes les versions.
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Introuvable.' })
  }
  const indexFile = path.join(DIST_DIR, 'index.html')
  if (!fs.existsSync(indexFile)) {
    return res.status(404).send('Interface non construite. Lancez « npm run build ».')
  }
  res.sendFile(indexFile)
})

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Doli sur http://0.0.0.0:${PORT}`)
  console.log(
    fs.existsSync(DIST_DIR)
      ? `Écran servi depuis ${DIST_DIR}`
      : 'Écran non construit (dist/ absent) — en développement, utilisez Vite.'
  )
})

// Arrêt propre : Railway envoie SIGTERM avant d'éteindre le service. Fermer la
// base évite de couper une écriture en plein milieu et de laisser un fichier
// WAL corrompu (donc des données perdues).
let closing = false
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    if (closing) return
    closing = true
    console.log(`${signal} reçu, arrêt en cours...`)
    server.close(() => {
      try {
        db.close()
        console.log('Base fermée proprement.')
      } catch (err) {
        console.error('Erreur à la fermeture de la base :', err.message)
      }
      process.exit(0)
    })
  })
}

