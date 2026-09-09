// index.js
// Point d'entrée du backend. Le frontend (Vite, port 5173) l'atteint via le
// proxy /api configuré dans vite.config.js — jamais d'appel direct au port
// 3001 depuis le navigateur, donc pas de souci CORS en dev.

import express from 'express'
import cookieParser from 'cookie-parser'
import authRoutes from './routes/auth.js'
import tasksRoutes from './routes/tasks.js'
import settingsRoutes from './routes/settings.js'

const PORT = 3001

const app = express()
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRoutes)
app.use('/api/tasks', tasksRoutes)
app.use('/api/settings', settingsRoutes)

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API Doli sur http://0.0.0.0:${PORT}`)
})
