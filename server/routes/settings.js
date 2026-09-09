// routes/settings.js
// Une ligne de réglages par utilisateur (scopée par req.user.email, posé par
// requireAuth). Si l'utilisateur n'en a pas encore, on renvoie les valeurs
// par défaut sans créer de ligne — elle n'est créée qu'au premier PUT.

import { Router } from 'express'
import db from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

const DEFAULTS = { theme: 'dark', viewMode: 'list', bestStreak: 0, weeklyGoal: 10, achievementThresholds: [10, 50] }

function rowToSettings(row) {
  if (!row) return { ...DEFAULTS }
  return {
    theme: row.theme,
    viewMode: row.view_mode,
    bestStreak: row.best_streak,
    weeklyGoal: row.weekly_goal,
    achievementThresholds: JSON.parse(row.achievement_thresholds),
  }
}

const getStmt = db.prepare('SELECT * FROM settings WHERE user_email = ?')
const upsertStmt = db.prepare(`
  INSERT INTO settings (user_email, theme, view_mode, best_streak, weekly_goal, achievement_thresholds)
  VALUES (@user_email, @theme, @view_mode, @best_streak, @weekly_goal, @achievement_thresholds)
  ON CONFLICT(user_email) DO UPDATE SET
    theme = excluded.theme,
    view_mode = excluded.view_mode,
    best_streak = excluded.best_streak,
    weekly_goal = excluded.weekly_goal,
    achievement_thresholds = excluded.achievement_thresholds
`)

router.get('/', (req, res) => {
  res.json(rowToSettings(getStmt.get(req.user.email)))
})

router.put('/', (req, res) => {
  const merged = { ...rowToSettings(getStmt.get(req.user.email)), ...req.body }
  upsertStmt.run({
    user_email: req.user.email,
    theme: merged.theme,
    view_mode: merged.viewMode,
    best_streak: merged.bestStreak,
    weekly_goal: merged.weeklyGoal,
    achievement_thresholds: JSON.stringify(merged.achievementThresholds),
  })
  res.json(merged)
})

export default router
