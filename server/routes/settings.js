// routes/settings.js
// Une ligne de réglages par utilisateur (scopée par req.user.email, posé par
// requireAuth). Si l'utilisateur n'en a pas encore, on renvoie les valeurs
// par défaut sans créer de ligne — elle n'est créée qu'au premier PUT.

import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'
import { UPSERT_SETTINGS_SQL } from '../settings-sql.js'

const router = Router()
router.use(requireAuth)

const DEFAULTS = { theme: 'dark', viewMode: 'list', bestStreak: 0, weeklyGoal: 10, achievementThresholds: [10, 50], prefs: {} }

// La colonne prefs contient du JSON libre : une donnée corrompue ne doit
// jamais empêcher l'application de démarrer, d'où le repli silencieux.
function parsePrefs(raw) {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function rowToSettings(row) {
  if (!row) return { ...DEFAULTS }
  return {
    theme: row.theme,
    viewMode: row.view_mode,
    bestStreak: row.best_streak,
    weeklyGoal: row.weekly_goal,
    achievementThresholds: JSON.parse(row.achievement_thresholds),
    prefs: parsePrefs(row.prefs),
  }
}

const getStmt = db.prepare('SELECT * FROM settings WHERE user_email = ?')
// La colonne `prefs` doit figurer dans l'INSERT **et** dans le DO UPDATE.
// Sans elle, better-sqlite3 ignore silencieusement le paramètre `prefs` passé
// à run() : la requête renvoie 200 (donc l'interface affiche « enregistré »)
// alors que rien n'est écrit. Les préférences disparaissaient à chaque
// rechargement, sans la moindre erreur visible.
const upsertStmt = db.prepare(UPSERT_SETTINGS_SQL)

router.get('/', (req, res) => {
  res.json(rowToSettings(getStmt.get(req.user.email)))
})

router.put('/', (req, res) => {
  const current = rowToSettings(getStmt.get(req.user.email))
  // `prefs` est fusionné clé par clé : un client qui n'envoie qu'un réglage
  // ne doit surtout pas effacer les autres, et un `null` maladroit non plus.
  const merged = {
    ...current,
    ...req.body,
    prefs: { ...current.prefs, ...(req.body.prefs || {}) },
  }
  upsertStmt.run({
    user_email: req.user.email,
    theme: merged.theme,
    view_mode: merged.viewMode,
    best_streak: merged.bestStreak,
    weekly_goal: merged.weeklyGoal,
    achievement_thresholds: JSON.stringify(merged.achievementThresholds),
    prefs: JSON.stringify(merged.prefs),
  })
  res.json(merged)
})

export default router
