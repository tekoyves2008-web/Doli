// routes/tasks.js
// Toutes les routes sont scopées par req.user.email (posé par requireAuth) :
// chaque requête ne peut jamais lire, modifier ou supprimer que les tâches
// de la personne connectée.

import { Router } from 'express'
import crypto from 'node:crypto'
import db from '../db.js'
import { requireAuth } from '../middleware/requireAuth.js'

const router = Router()
router.use(requireAuth)

function rowToTask(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    dueDate: row.due_date,
    startTime: row.start_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
    startedAt: row.started_at,
    proofCount: row.proof_count ?? 0,
    lastProofAt: row.last_proof_at ?? null,
    startNotified: !!row.start_notified,
    dueNotified: !!row.due_notified,
    remindStart5: !!row.remind_start_5,
    remindStart2: !!row.remind_start_2,
    remindDue5: !!row.remind_due_5,
    remindDue2: !!row.remind_due_2,
  }
}

// Colonnes de la table tasks réservées à la lecture (renseignées par des
// sous-requêtes) : elles ne doivent jamais être écrites telles quelles via PATCH.
const READONLY_FIELDS = new Set(['proof_count', 'last_proof_at'])

// Sélection d'une tâche avec ses indicateurs de preuve (nombre + plus récente).
const TASK_SELECT = `
  SELECT t.*,
    (SELECT COUNT(*) FROM proofs p WHERE p.task_id = t.id) AS proof_count,
    (SELECT MAX(created_at) FROM proofs p WHERE p.task_id = t.id) AS last_proof_at
  FROM tasks t
`

const listStmt = db.prepare(`${TASK_SELECT} WHERE t.user_email = ? ORDER BY t.created_at DESC`)
const getStmt = db.prepare(`${TASK_SELECT} WHERE t.id = ? AND t.user_email = ?`)
const insertStmt = db.prepare(`
  INSERT INTO tasks (id, user_email, title, description, status, priority, due_date, start_time, created_at)
  VALUES (@id, @user_email, @title, @description, @status, @priority, @due_date, @start_time, @created_at)
`)
const deleteStmt = db.prepare('DELETE FROM tasks WHERE id = ? AND user_email = ?')

router.get('/', (req, res) => {
  res.json(listStmt.all(req.user.email).map(rowToTask))
})

router.post('/', (req, res) => {
  const { title, description = '', dueDate = null, startTime = null, priority = 'medium' } = req.body
  if (!title || !title.trim()) return res.status(400).json({ error: 'Titre requis.' })

  const id = crypto.randomUUID()
  insertStmt.run({
    id,
    user_email: req.user.email,
    title: title.trim(),
    description: description.trim(),
    status: 'todo',
    priority,
    due_date: dueDate,
    start_time: startTime,
    created_at: new Date().toISOString(),
  })
  res.status(201).json(rowToTask(getStmt.get(id, req.user.email)))
})

// Colonnes modifiables, mappées JS (camelCase) → SQL (snake_case). Tout champ
// du corps de la requête qui n'est pas dans cette liste est ignoré.
const UPDATABLE_FIELDS = {
  title: 'title',
  description: 'description',
  status: 'status',
  priority: 'priority',
  dueDate: 'due_date',
  startTime: 'start_time',
  completedAt: 'completed_at',
  startedAt: 'started_at',
  startNotified: 'start_notified',
  dueNotified: 'due_notified',
  remindStart5: 'remind_start_5',
  remindStart2: 'remind_start_2',
  remindDue5: 'remind_due_5',
  remindDue2: 'remind_due_2',
}

router.patch('/:id', (req, res) => {
  const existing = getStmt.get(req.params.id, req.user.email)
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' })

  const sets = []
  const values = []

  // L'heure réelle de début (startedAt) est pilotée par l'API, pas par le
  // client : elle vaut l'instant où la tâche passe au statut « en cours ».
  // Si elle est déjà posée, elle est conservée (la tâche continue).
  const newStatus = req.body.status
  if (newStatus === 'doing' && !existing.started_at) {
    sets.push('started_at = ?')
    values.push(new Date().toISOString())
  } else if (newStatus === 'todo') {
    // Retour à « non exécutée » : on efface l'heure réelle de début pour que
    // la prochaine mise « en cours » reparte d'un début propre.
    sets.push('started_at = ?')
    values.push(null)
  }

  for (const [jsKey, column] of Object.entries(UPDATABLE_FIELDS)) {
    if (!(jsKey in req.body)) continue
    if (READONLY_FIELDS.has(column)) continue
    let value = req.body[jsKey]
    if (typeof value === 'boolean') value = value ? 1 : 0
    sets.push(`${column} = ?`)
    values.push(value)
  }
  sets.push('updated_at = ?')
  values.push(new Date().toISOString(), req.params.id, req.user.email)

  db.prepare(`UPDATE tasks SET ${sets.join(', ')} WHERE id = ? AND user_email = ?`).run(...values)
  res.json(rowToTask(getStmt.get(req.params.id, req.user.email)))
})

// --- Preuves d'exécution --------------------------------------------------
// « Fournir une preuve » enregistre juste un horodatage côté serveur. La
// tâche passe automatiquement « en cours » (et reçoit son heure réelle de
// début) si elle ne l'était pas déjà : une preuve suppose qu'on travaille.

const insertProofStmt = db.prepare(
  'INSERT INTO proofs (id, task_id, user_email, created_at) VALUES (?, ?, ?, ?)'
)
const listProofsStmt = db.prepare(
  'SELECT id, task_id, created_at FROM proofs WHERE task_id = ? AND user_email = ? ORDER BY created_at ASC'
)

router.post('/:id/proofs', (req, res) => {
  const existing = getStmt.get(req.params.id, req.user.email)
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' })

  const now = new Date().toISOString()

  // Si la tâche n'était pas « en cours », elle y passe : preuve sans tâche
  // en cours n'aurait aucun sens pour le taux d'avancement temporel.
  if (existing.status !== 'doing') {
    const startedAt = existing.started_at || now
    db.prepare(
      "UPDATE tasks SET status = 'doing', started_at = ?, updated_at = ? WHERE id = ? AND user_email = ?"
    ).run(startedAt, now, req.params.id, req.user.email)
  }

  insertProofStmt.run(crypto.randomUUID(), req.params.id, req.user.email, now)
  res.status(201).json(rowToTask(getStmt.get(req.params.id, req.user.email)))
})

router.get('/:id/proofs', (req, res) => {
  const existing = getStmt.get(req.params.id, req.user.email)
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' })
  res.json(listProofsStmt.all(req.params.id, req.user.email))
})

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM proofs WHERE task_id = ? AND user_email = ?').run(
    req.params.id,
    req.user.email
  )
  const result = deleteStmt.run(req.params.id, req.user.email)
  if (result.changes === 0) return res.status(404).json({ error: 'Tâche introuvable.' })
  res.status(204).end()
})

export default router
