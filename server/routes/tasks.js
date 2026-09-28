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
  // Option B stricte : début prévu + échéance obligatoires pour le calcul
  // de la performance (DP_durée = FP − DP_heure, retards, taux, gravité).
  if (!dueDate) return res.status(400).json({ error: 'Échéance (fin prévue) requise.' })
  if (!startTime) return res.status(400).json({ error: 'Début prévu requis.' })
  const startMs = new Date(startTime).getTime()
  const dueMs = new Date(dueDate).getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(dueMs)) {
    return res.status(400).json({ error: 'Dates invalides.' })
  }
  if (dueMs <= startMs) {
    return res.status(400).json({ error: "L'échéance doit être après le début prévu." })
  }

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
// Le bouton « Ajouter une preuve » peut aussi importer un vrai fichier
// (photo / document) : nom + type + taille + contenu base64, stockés avec
// l'horodatage. Ces preuves fichier apparaissent dans la rubrique Preuves.

const insertProofStmt = db.prepare(
  'INSERT INTO proofs (id, task_id, user_email, created_at, file_name, mime_type, size_bytes, data_base64) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
)
const listProofsStmt = db.prepare(
  'SELECT id, task_id, created_at, file_name, mime_type, size_bytes FROM proofs WHERE task_id = ? AND user_email = ? ORDER BY created_at ASC'
)

// Historique global des preuves de l'utilisateur (avec nom de la tâche) :
// alimente la rubrique « Preuves » sans changer son interface.
const listAllProofsStmt = db.prepare(`
  SELECT p.id, p.task_id, p.created_at, p.file_name, p.mime_type, p.size_bytes,
    CASE WHEN p.data_base64 IS NOT NULL THEN 1 ELSE 0 END AS has_file,
    t.title AS task_title
  FROM proofs p
  JOIN tasks t ON t.id = p.task_id AND t.user_email = p.user_email
  WHERE p.user_email = ?
  ORDER BY p.created_at DESC
  LIMIT 200
`)

// Contenu d'une preuve fichier (téléchargement / aperçu plein écran).
const getProofFileStmt = db.prepare(
  'SELECT file_name, mime_type, data_base64 FROM proofs WHERE id = ? AND user_email = ?'
)

// Suppression d'une preuve de l'utilisateur (scopée par son e-mail).
router.delete('/proofs/:proofId', (req, res) => {
  const result = db
    .prepare('DELETE FROM proofs WHERE id = ? AND user_email = ?')
    .run(req.params.proofId, req.user.email)
  if (result.changes === 0) return res.status(404).json({ error: 'Preuve introuvable.' })
  res.status(204).end()
})

// IMPORTANT : déclarée AVANT '/:id' / '/:id/proofs', sinon Express prendrait
// 'all' pour un identifiant de tâche et renverrait 404.
router.get('/proofs/all', (req, res) => {
  res.json(listAllProofsStmt.all(req.user.email))
})

router.get('/proofs/:proofId/file', (req, res) => {
  const row = getProofFileStmt.get(req.params.proofId, req.user.email)
  if (!row || !row.data_base64) return res.status(404).json({ error: 'Fichier introuvable.' })
  res.json({ fileName: row.file_name, mimeType: row.mime_type, dataBase64: row.data_base64 })
})

// Taille maximale d'une preuve : 2 Mo.
//
// Couplée à la limite du corps de requête dans server/index.js (`4mb`) : les
// deux SE CHANGENT ENSEMBLE. Voir le commentaire détaillé à cet endroit.
//
// 2 Mo n'est pas un cap arbitraire : c'est ce qui tient dans les 0,5 Go de
// volume du palier gratuit Railway. À 8 Mo, une preuve occupait ~10,7 Mo en
// base64 et le volume était plein après 45 proofs ; à 2 Mo, ~2,7 Mo, soit
// environ 185. Les preuves n'étant jamais purgées, c'est le facteur limitant.
const PROOF_FILE_MAX_BYTES = 2 * 1024 * 1024

// Types réellement acceptés pour une preuve. Le client déclare le type de son
// fichier : sans cette liste blanche, il pourrait déclarer « text/html » ou
// « image/svg+xml » et faire interpréter le contenu par le navigateur au lieu
// de le télécharger (ces deux-là sont donc volontairement absents).
//
// « application/octet-stream » est autorisé : c'est le repli qu'envoie le
// navigateur quand il ne connaît pas le type, et c'est justement le type le
// plus sûr — il force le téléchargement au lieu de l'affichage.
const ALLOWED_PROOF_MIME = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/bmp',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown', 'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/octet-stream',
])

router.post('/:id/proofs', (req, res) => {
  const existing = getStmt.get(req.params.id, req.user.email)
  if (!existing) return res.status(404).json({ error: 'Tâche introuvable.' })

  // Une tâche terminée n'accepte plus de preuve.
  //
  // Garde-fou INDISPENSABLE, pas décoratif : quelques lignes plus bas, toute
  // tâche dont le statut n'est pas « en cours » est remise automatiquement en
  // « en cours ». Sans ce refus, ajouter une preuve à une tâche terminée la
  // DÉFAISAIT — elle redevenait « en cours », sa progression retombait et la
  // série était faussée. La donnée était réellement corrompue, et seul le
  // serveur peut l'empêcher (le client peut être périmé, ou mentir).
  if (existing.status === 'done') {
    return res.status(409).json({ error: 'Impossible d’ajouter une preuve : cette tâche est terminée.' })
  }

  const now = new Date().toISOString()

  // Si la tâche n'était pas « en cours », elle y passe : preuve sans tâche
  // en cours n'aurait aucun sens pour le taux d'avancement temporel.
  if (existing.status !== 'doing') {
    const startedAt = existing.started_at || now
    db.prepare(
      "UPDATE tasks SET status = 'doing', started_at = ?, updated_at = ? WHERE id = ? AND user_email = ?"
    ).run(startedAt, now, req.params.id, req.user.email)
  }

  // Preuve avec fichier importé (optionnel) : le client envoie le fichier en
  // base64. Sans fichier, on enregistre un simple horodatage (comportement
  // historique du bouton « Fournir une preuve »).
  let fileName = null
  let mimeType = null
  let sizeBytes = null
  let dataBase64 = null
  if (req.body && (req.body.dataBase64 || req.body.fileName)) {
    fileName = String(req.body.fileName || 'preuve').slice(0, 180)
    mimeType = String(req.body.mimeType || 'application/octet-stream').slice(0, 120)
    // Le type est fourni par le client : on ne le croit pas. En particulier,
    // « text/html » est refusé — un fichier se prétendant HTML pourrait être
    // interprété par le navigateur au lieu d'être téléchargé.
    if (!ALLOWED_PROOF_MIME.has(mimeType)) {
      return res.status(415).json({ error: 'Ce type de fichier n’est pas accepté.' })
    }
    dataBase64 = String(req.body.dataBase64 || '')
    // Taille réelle estimée depuis le base64 (×3/4) : refuse au-delà de la limite.
    sizeBytes = Math.floor((dataBase64.length * 3) / 4)
    if (!dataBase64 || sizeBytes > PROOF_FILE_MAX_BYTES) {
      // Le message est CALCULÉ depuis la constante, jamais écrit en dur : c'est
      // le moyen le plus sûr qu'il ne puisse pas annoncer une limite différente
      // de celle réellement appliquée.
      const maxMo = Math.round(PROOF_FILE_MAX_BYTES / (1024 * 1024))
      return res.status(413).json({ error: `Fichier trop volumineux (${maxMo} Mo maximum).` })
    }
  }

  insertProofStmt.run(crypto.randomUUID(), req.params.id, req.user.email, now, fileName, mimeType, sizeBytes, dataBase64)
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
