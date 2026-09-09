// tasks.js
// Parle à l'API des tâches : le serveur persiste tout dans SQLite, scopé
// par le compte connecté. Même surface de fonctions qu'à l'époque
// localStorage, mais toutes asynchrones puisqu'elles passent par le réseau.

export const STATUS = {
  TODO: 'todo', // badge rouge : non exécutée
  DOING: 'doing', // badge orange : en cours
  DONE: 'done', // badge vert : exécutée
}

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
}

async function parseOrThrow(res, message) {
  if (!res.ok) throw new Error(message)
  if (res.status === 204) return null
  return res.json()
}

export async function getAllTasks() {
  const res = await fetch('/api/tasks')
  return parseOrThrow(res, 'Impossible de charger les tâches.')
}

export async function addTask(payload) {
  const res = await fetch('/api/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseOrThrow(res, 'Impossible de créer la tâche.')
}

export async function updateTask(id, changes) {
  const res = await fetch(`/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(changes),
  })
  return parseOrThrow(res, 'Impossible de modifier la tâche.')
}

export async function setStatus(id, status) {
  // completedAt ne doit exister que si la tâche est actuellement exécutée :
  // sans ça, les statistiques basées dessus (tendance, activité, streak...)
  // resteraient désynchronisées du statut réel si on annule une exécution.
  return updateTask(id, { status, completedAt: status === STATUS.DONE ? new Date().toISOString() : null })
}

// Fournir une preuve sur une tâche : le serveur enregistre l'horodatage et,
// si besoin, bascule la tâche « en cours » avec son heure réelle de début.
// C'est ce timestamp qui sert au taux d'avancement temporel.
export async function provideProof(id) {
  const res = await fetch(`/api/tasks/${id}/proofs`, {
    method: 'POST',
  })
  return parseOrThrow(res, "Impossible d'enregistrer la preuve.")
}

export async function getProofs(id) {
  const res = await fetch(`/api/tasks/${id}/proofs`)
  return parseOrThrow(res, 'Impossible de charger les preuves.')
}

export async function deleteTask(id) {
  const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error('Impossible de supprimer la tâche.')
}

export async function findTask(id) {
  // Pas de route dédiée : la liste est déjà scopée par utilisateur et
  // jamais assez grande, pour un usage perso, pour que ça coûte quoi que ce soit.
  const tasks = await getAllTasks()
  return tasks.find((t) => t.id === id) || null
}
