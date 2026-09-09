// routes/auth.js
// Comptes propres à Doli : email (format @gmail.com exigé) + mot de passe
// haché (bcrypt), stockés dans notre propre table `users`. Ce mot de passe
// n'a aucun lien avec le vrai compte Google de la personne — c'est un
// identifiant qui a la forme d'une adresse Gmail, rien de plus.

import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours
const GMAIL_REGEX = /^[^\s@]+@gmail\.com$/i

const insertSessionStmt = db.prepare(
  'INSERT INTO sessions (session_id, user_email, user_name, expires_at) VALUES (?, ?, ?, ?)'
)
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE session_id = ?')
const getUserStmt = db.prepare('SELECT * FROM users WHERE email = ?')
const insertUserStmt = db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')

const router = Router()

function startSession(res, user) {
  const sessionId = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS).toISOString()
  insertSessionStmt.run(sessionId, user.email, user.name, expiresAt)
  res.cookie('doli_session', sessionId, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DURATION_MS,
    path: '/',
  })
}

router.post('/register', async (req, res) => {
  const { name, email, password, confirmPassword } = req.body
  if (!name?.trim() || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  if (!GMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({ error: "L'adresse doit être au format @gmail.com." })
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ error: 'Les mots de passe ne correspondent pas.' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caractères.' })
  }
  if (getUserStmt.get(normalizedEmail)) {
    return res.status(409).json({ error: 'Un compte existe déjà avec cette adresse.' })
  }

  const passwordHash = await bcrypt.hash(password, 10)
  insertUserStmt.run(normalizedEmail, name.trim(), passwordHash, new Date().toISOString())

  const user = { email: normalizedEmail, name: name.trim() }
  startSession(res, user)
  res.status(201).json(user)
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' })

  const normalizedEmail = String(email).trim().toLowerCase()
  const row = getUserStmt.get(normalizedEmail)
  // Même message que le mot de passe soit faux ou que le compte n'existe
  // pas : ça évite de révéler quelles adresses sont déjà enregistrées.
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: 'Adresse ou mot de passe incorrect.' })
  }

  const user = { email: row.email, name: row.name }
  startSession(res, user)
  res.json(user)
})

router.get('/me', requireAuth, (req, res) => {
  res.json(req.user)
})

router.post('/logout', (req, res) => {
  const sessionId = req.cookies?.doli_session
  if (sessionId) deleteSessionStmt.run(sessionId)
  res.clearCookie('doli_session', { path: '/' })
  res.status(204).end()
})

export default router
