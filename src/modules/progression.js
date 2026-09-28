// progression.js
// Nouvelle méthode de calcul de la progression, basée sur chaque tâche :
//   - non exécutée (todo) → 0 %
//   - terminée (done)     → 100 %
//   - en cours (doing)    → taux d'avancement temporel :
//       (heure de la preuve fournie − heure réelle de début)
//     / (heure de fin prévue − heure réelle de début) × 100
// Ce taux reflète l'avancement temporel réel d'une tâche : il grandit à
// chaque preuve fournie, entre la durée réellement écoulée et la fin prévue.
// Sans aucune preuve, il est incalculable (null) tant que l'utilisateur n'a
// pas fourni sa première preuve.

import { STATUS } from './tasks.js'
import { isTaskOverdue } from './retards.js'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_FULL_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// La règle de retard est celle de retards.js (source unique) : cette copie
// locale ne testait pas la validité de la date et pouvait diverger.

// --- Progression individuelle d'une tâche -------------------------------
// 0 % non exécutée, 100 % terminée, sinon taux d'avancement temporel.
// Renvoie null quand le taux est incalculable (tâche en cours sans preuve,
// sans heure réelle de début ou sans échéance).
export function computeTaskProgress(task) {
  if (task.status === STATUS.DONE) return 100
  if (task.status !== STATUS.DOING) return 0

  if (!task.startedAt || !task.lastProofAt || !task.dueDate) return null

  const start = new Date(task.startedAt).getTime()
  const proof = new Date(task.lastProofAt).getTime()
  const end = new Date(task.dueDate).getTime()
  if (end <= start) return null

  const ratio = Math.min(1, Math.max(0, (proof - start) / (end - start)))
  return Math.round(ratio * 100)
}

// Date à laquelle une tâche « compte » dans une période.
//
// AVANT : son échéance (dueDate). Problème : une tâche prévue le mois dernier
// mais terminée aujourd'hui était comptée dans le mois dernier — la courbe de
// progression montrait le PLAN, pas le travail réellement accompli.
//
// APRÈS : une tâche terminée compte le jour où elle a été terminée. Les tâches
// encore ouvertes gardent leur échéance : sans date de réalisation, il faut bien
// un jour de référence, et c'est celui où elles étaient dues (c'est ce qui garde
// les retards et les tâches à faire visibles).
function taskDate(task) {
  if (task.status === STATUS.DONE && task.completedAt) {
    const done = new Date(task.completedAt).getTime()
    if (Number.isFinite(done)) return done
  }
  if (task.dueDate) return new Date(task.dueDate).getTime()
  if (task.createdAt) return new Date(task.createdAt).getTime()
  return null
}

function filterInPeriod(tasks, days) {
  const today = startOfDay(new Date())
  const startTs = new Date(today.getTime() - (days - 1) * DAY_MS).getTime()
  const endTs = today.getTime() + DAY_MS
  return tasks.filter((task) => {
    const t = taskDate(task)
    return t !== null && t >= startTs && t < endTs
  })
}

// Catégories disjointes qui couvrent toutes les tâches de la période :
// exécutées / en retard (non terminées après l'échéance) / en cours /
// non exécutées (encore dans les temps).
function countByCategory(tasks) {
  const done = tasks.filter((t) => t.status === STATUS.DONE).length
  const delayed = tasks.filter(isTaskOverdue).length
  const doing = tasks.filter((t) => t.status === STATUS.DOING && !isTaskOverdue(t)).length
  const todo = tasks.filter((t) => t.status === STATUS.TODO && !isTaskOverdue(t)).length
  return { done, doing, todo, delayed }
}

// Poids des tâches selon la priorité (formule de progression globale) :
// urgente / haute = 1,5 ; normale = 1 ; basse = 0,5.
// Toute autre valeur (ou absence) revient au poids « normale » = 1.
export const PRIORITY_WEIGHTS = { urgent: 1.5, high: 1.5, medium: 1, low: 0.5 }

export function taskWeight(task) {
  const p = String((task && task.priority) || 'medium').trim().toLowerCase()
  return PRIORITY_WEIGHTS[p] !== undefined ? PRIORITY_WEIGHTS[p] : 1
}

// Progression globale pondérée : PG = Σ(Pi × Wi) / Σ(Wi)
//   Pi = progression individuelle de la tâche i (computeTaskProgress)
//   Wi = poids de la tâche i selon sa priorité (taskWeight)
// Les tâches à progression incalculable (null : en cours sans preuve) sont
// exclues du numérateur ET du dénominateur : elles ne sont ni comptées à 0 %
// (pénalité injuste) ni comptées à 100 %. Une tâche terminée compte toujours
// 100 % (règle : progression à 100 % = tâche terminée).
export function computeGlobalProgress(tasks) {
  let sumProgressWeight = 0
  let sumWeight = 0
  for (const task of tasks) {
    const p = computeTaskProgress(task)
    if (p === null) continue
    const w = taskWeight(task)
    sumProgressWeight += p * w
    sumWeight += w
  }
  return sumWeight > 0 ? Math.round(sumProgressWeight / sumWeight) : 0
}

// Nombre de tâches exclues du calcul global (progression incalculable :
// en cours sans preuve, sans début réel ou sans échéance). Affiché en
// complément dans le résumé pour rendre l'exclusion transparente.
export function countUnmeasuredTasks(tasks) {
  return tasks.filter((t) => computeTaskProgress(t) === null).length
}

// Moyenne de la période : désormais pondérée par priorité (computeGlobalProgress),
// alimentant tendance et bilan sans changer leurs appelants.
function averageProgress(tasks) {
  return computeGlobalProgress(tasks)
}
// --- Statistiques de progression sur une période ------------------------
export function computeProgressionStats(tasks, days = 7) {
  const periodTasks = filterInPeriod(tasks, days)
  const { done, doing, todo, delayed } = countByCategory(periodTasks)
  const total = periodTasks.length
  // « Non exécutée » compte TOUTES les tâches au statut « Non exécutée »,
  // y compris celles qui ont dépassé leur échéance : une tâche jamais
  // démarrée et en retard apparaît donc logiquement à la fois dans
  // « En retard » et dans sa case « Non exécutée » (la case « En retard »
  // reste réservée aux retards). Les catégories des autres cases restent
  // disjointes ; seul « Non exécutée » recouvre « En retard ».
  const notDone = periodTasks.filter((t) => t.status === STATUS.TODO).length
  const avgProgress = averageProgress(periodTasks)

  return {
    total,
    done,
    doing,
    todo,
    delayed,
    notDone,
    avgProgress,
    percent: avgProgress,
    donePercent: total === 0 ? 0 : Math.round((done / total) * 100),
    doingPercent: total === 0 ? 0 : Math.round((doing / total) * 100),
    delayPercent: total === 0 ? 0 : Math.round((delayed / total) * 100),
    notDonePercent: total === 0 ? 0 : Math.round((notDone / total) * 100),
  }
}

// Distribution de la période (alimente le camembert).
export function computeTodayDistribution(tasks, days = 1) {
  const periodTasks = filterInPeriod(tasks, days)
  const { done, doing, todo, delayed } = countByCategory(periodTasks)
  return {
    labels: ['Exécutées', 'En cours', 'En retard', 'Non exécutées'],
    data: [done, doing, delayed, todo],
    total: periodTasks.length,
  }
}

// Comparaison jour par jour sur la période (alimente les barres empilées).
export function computeWeekComparison(tasks, days = 7) {
  const today = startOfDay(new Date())
  const buckets = []

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS)
    const dayStart = startOfDay(day).getTime()
    const dayEnd = dayStart + DAY_MS

    const dayTasks = tasks.filter((task) => {
      const t = taskDate(task)
      return t !== null && t >= dayStart && t < dayEnd
    })
    const { done, doing, todo, delayed } = countByCategory(dayTasks)

    buckets.push({
      date: day,
      label: DAY_LABELS[day.getDay()],
      fullLabel: DAY_FULL_LABELS[day.getDay()],
      done,
      doing,
      delayed,
      notDone: todo,
      total: dayTasks.length,
    })
  }

  return buckets
}
// Tendance : progression moyenne par jour de la période, calculée sur les
// progressions individuelles (taux d'avancement temporel).
export function computeProgressionTrend(tasks, days = 7) {
  const today = startOfDay(new Date())
  const buckets = []

  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS)
    const dayStart = startOfDay(day).getTime()
    const dayEnd = dayStart + DAY_MS

    const dayTasks = tasks.filter((task) => {
      const t = taskDate(task)
      return t !== null && t >= dayStart && t < dayEnd
    })
    const done = dayTasks.filter((t) => t.status === STATUS.DONE).length
    const total = dayTasks.length
    const percent = averageProgress(dayTasks)

    buckets.push({
      date: day,
      label: DAY_LABELS[day.getDay()] + ' ' + String(day.getDate()).padStart(2, '0'),
      fullLabel: DAY_FULL_LABELS[day.getDay()] + ' ' + day.getDate(),
      percent,
      done,
      total,
    })
  }

  return buckets
}

// Bilan de la période affiché dans la carte résumé.
export function computeTodayStats(tasks, days = 1) {
  const periodTasks = filterInPeriod(tasks, days)
  const done = periodTasks.filter((t) => t.status === STATUS.DONE).length
  const total = periodTasks.length
  const percent = averageProgress(periodTasks)

  let message = ''
  if (total === 0) {
    message = "Aucune tâche pour aujourd'hui"
  } else if (percent === 100) {
    message = 'Excellent ! Toutes vos tâches de la période sont terminées.'
  } else if (percent >= 75) {
    message = 'Très bien ! Vous êtes presque au bout.'
  } else if (percent >= 50) {
    message = 'Bon début ! Continuez vos efforts.'
  } else if (percent > 0) {
    message = 'Continuez à fournir des preuves pour faire avancer vos tâches.'
  } else {
    message = 'Fournissez une preuve pour vos tâches en cours.'
  }

  return { percent, done, total, message }
}