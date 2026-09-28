// routes/auth.js
// Comptes propres à Doli : email + mot de passe haché (bcrypt), stockés dans
// notre propre table `users`. Ce mot de passe n'a aucun lien avec un éventuel
// compte Google de la personne — c'est un simple identifiant de l'application.

import { Router } from 'express'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import db from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import {
  isRegistrationOpen,
  isInviteCodeValid,
  requiresInviteCode,
  isEmailWellFormed,
  isDomainAllowed,
  allowedDomains,
  registrationPolicy,
} from '../registration-policy.js'

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 jours

// --- Contrôle des inscriptions --------------------------------------------
// Les règles vivent dans server/registration-policy.js (voir ce fichier pour le
// détail de ALLOW_REGISTRATION, REGISTRATION_SECRET et EMAIL_DOMAIN_ALLOWLIST).
// En bref : les inscriptions sont FERMÉES par défaut, et si on les ouvre sans
// code d'invitation, tout le monde peut créer un compte — d'où l'avertissement.


const insertSessionStmt = db.prepare(
  'INSERT INTO sessions (session_id, user_email, user_name, expires_at) VALUES (?, ?, ?, ?)'
)
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE session_id = ?')
const getUserStmt = db.prepare('SELECT * FROM users WHERE email = ?')
const insertUserStmt = db.prepare('INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')

// --- Limitation de débit ---------------------------------------------------
// Sans cela, /api/login accepte autant de tentatives par seconde que la
// machine en encaisse : c'est l'attaque la plus évidente sur un formulaire de
// connexion. Implémentation maison (aucune dépendance) : un compteur par
// couple (adresse IP, action) remis à zéro après la fenêtre.
//
// Le compteur est effacé à la RÉUSSITE : un utilisateur légitime qui se trompe
// plusieurs fois de suite doit pouvoir se reconnecter sans être bloqué.
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_MAX = 10 // tentatives par fenêtre et par IP

/** @type {Map<string, {count:number, resetAt:number}>} */
const rateBuckets = new Map()

function rateKey(req, action) {
  // req.ip : correct en accès direct. DERRIÈRE UN REVERSE PROXY (Railway,
  // Nginx…), il faut activer app.set('trust proxy', 1) côté serveur, sinon
  // toutes les requêtes semblent venir de la même adresse.
  return `${action}:${req.ip || req.socket?.remoteAddress || 'inconnu'}`
}

function isRateLimited(req, action) {
  const key = rateKey(req, action)
  const now = Date.now()
  const bucket = rateBuckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  bucket.count += 1
  return bucket.count > RATE_LIMIT_MAX
}

/** Remet le compteur à zéro après une authentification réussie. */
function clearRateLimit(req, action) {
  rateBuckets.delete(rateKey(req, action))
}

// Nettoyage périodique : sans lui, la Map grossirait indéfiniment avec les
// adresses vues (chaque nouvelle IP laisserait une entrée pendant 15 min).
const rateSweeper = setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt <= now) rateBuckets.delete(key)
  }
}, RATE_LIMIT_WINDOW_MS)
rateSweeper.unref?.() // ne doit pas empêcher le processus de s'arrêter

function tooManyAttempts(res) {
  return res.status(429).json({
    error: 'Trop de tentatives. Réessayez dans quelques minutes.',
  })
}

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
    // `secure` n'est activé que si l'environnement l'exige (HTTPS). En local on
    // tourne en HTTP : l'activer ici casserait la connexion, car le navigateur
    // refuse un cookie « secure » reçu en clair.
    secure: process.env.COOKIE_SECURE === 'true',
  })
}

router.post('/register', async (req, res) => {
  if (isRateLimited(req, 'register')) return tooManyAttempts(res)

  // 1) Les inscriptions sont fermées par défaut : c'est la protection la plus
  //    simple contre quelqu'un qui découvrirait l'adresse du site.
  if (!isRegistrationOpen()) {
    return res.status(403).json({ error: 'Les inscriptions sont fermées. Demandez un compte à la personne qui vous invite.' })
  }
  // 2) Si elles sont ouvertes, un code d'invitation peut être exigé.
  if (requiresInviteCode() && !isInviteCodeValid(req.body.inviteCode)) {
    return res.status(403).json({ error: 'Code d’invitation incorrect.' })
  }
  if (isRegistrationOpen() && !requiresInviteCode()) {
    console.warn('[auth] ALLOW_REGISTRATION=true sans REGISTRATION_SECRET : toute personne peut créer un compte.')
  }

  const { name, email, password, confirmPassword } = req.body
  if (!name?.trim() || !email || !password || !confirmPassword) {
    return res.status(400).json({ error: 'Tous les champs sont requis.' })
  }

  const normalizedEmail = String(email).trim().toLowerCase()
  if (!isEmailWellFormed(normalizedEmail)) {
    return res.status(400).json({ error: "L'adresse email n'est pas valide." })
  }
  // Liste blanche de domaines, seulement si l'exploitant en a défini une
  // (EMAIL_DOMAIN_ALLOWLIST). Vide = tous les domaines acceptés.
  if (!isDomainAllowed(normalizedEmail)) {
    return res.status(400).json({ error: `Cette adresse n'est pas acceptée (domaine autorisé : ${allowedDomains().join(', ')}).` })
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
  if (isRateLimited(req, 'login')) return tooManyAttempts(res)
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis.' })

  const normalizedEmail = String(email).trim().toLowerCase()
  const row = getUserStmt.get(normalizedEmail)
  // Même message que le mot de passe soit faux ou que le compte n'existe
  // pas : ça évite de révéler quelles adresses sont déjà enregistrées.
  if (!row || !(await bcrypt.compare(password, row.password_hash))) {
    return res.status(401).json({ error: 'Adresse ou mot de passe incorrect.' })
  }

  // Authentification réussie : le compteur repart à zéro.
  clearRateLimit(req, 'login')
  const user = { email: row.email, name: row.name }
  startSession(res, user)
  res.json(user)
})

// Indique au frontend si l'inscription est possible, et si un code
// d'invitation est exigé. Sans cela, le bouton « Créer un compte » resterait
// affiché alors que le serveur répond 403 : l'utilisateur ne comprendrait pas
// pourquoi rien ne se passe.
router.get('/registration', (req, res) => {
  res.json(registrationPolicy())
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
