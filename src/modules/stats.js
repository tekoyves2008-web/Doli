// stats.js
// Calcule les statistiques affichées dans la sidebar :
// pourcentage de tâches exécutées par rapport au total prévu.

import { STATUS } from './tasks.js'

export function computeStats(tasks) {
  const total = tasks.length
  const done = tasks.filter((t) => t.status === STATUS.DONE).length
  const doing = tasks.filter((t) => t.status === STATUS.DOING).length
  const todo = tasks.filter((t) => t.status === STATUS.TODO).length

  const percent = total === 0 ? 0 : Math.round((done / total) * 100)

  return { total, done, doing, todo, percent }
}

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const DAY_FULL_LABELS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']
const ACHIEVEMENT_THRESHOLDS = [10, 50]

function startOfDay(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

// Nombre de tâches exécutées par jour, sur les `days` derniers jours
// (aujourd'hui inclus), pour visualiser une tendance plutôt qu'un instantané.
export function computeTrend(tasks, days = 7) {
  const today = startOfDay(new Date())
  const buckets = []
  for (let i = days - 1; i >= 0; i--) {
    const day = new Date(today.getTime() - i * DAY_MS)
    buckets.push({ date: day, label: DAY_LABELS[day.getDay()], count: 0 })
  }
  const firstDay = buckets[0].date.getTime()
  for (const task of tasks) {
    if (!task.completedAt) continue
    const completedDay = startOfDay(task.completedAt).getTime()
    if (completedDay < firstDay) continue
    const bucket = buckets.find((b) => b.date.getTime() === completedDay)
    if (bucket) bucket.count++
  }
  return buckets
}

// Nombre de jours consécutifs (jusqu'à aujourd'hui) sans qu'aucune tâche
// due ce jour-là n'ait été laissée en retard. Un jour sans échéance ne casse
// pas la série ; elle s'arrête au premier jour ayant eu un retard.
export function computeStreak(tasks) {
  const today = startOfDay(new Date())
  const now = Date.now()
  let streak = 0
  for (let i = 0; i < 365; i++) {
    const dayStart = today.getTime() - i * DAY_MS
    const dayEnd = dayStart + DAY_MS
    const dueThatDay = tasks.filter((t) => {
      if (!t.dueDate) return false
      const due = new Date(t.dueDate).getTime()
      return due >= dayStart && due < dayEnd
    })
    const hadLate = dueThatDay.some((t) => {
      const due = new Date(t.dueDate).getTime()
      if (t.completedAt) return new Date(t.completedAt).getTime() > due
      return due < now // en retard seulement si l'échéance est déjà passée
    })
    if (hadLate) break
    streak++
  }
  return streak
}

// Tâches exécutées sur les 7 derniers jours vs les 7 jours précédents.
export function computeWeeklyComparison(tasks) {
  const today = startOfDay(new Date())
  const thisWeekStart = today.getTime() - 6 * DAY_MS
  const lastWeekStart = today.getTime() - 13 * DAY_MS
  let thisWeek = 0
  let lastWeek = 0
  for (const t of tasks) {
    if (!t.completedAt) continue
    const day = startOfDay(t.completedAt).getTime()
    if (day >= thisWeekStart) thisWeek++
    else if (day >= lastWeekStart && day < thisWeekStart) lastWeek++
  }
  return { thisWeek, lastWeek, diff: thisWeek - lastWeek }
}

// Jour(s) de la semaine où le plus de tâches ont été exécutées, toutes dates
// confondues. Plusieurs jours peuvent être à égalité : tous sont renvoyés.
// Retourne null s'il n'y a encore aucune tâche exécutée.
export function computeBestDay(tasks) {
  const totals = [0, 0, 0, 0, 0, 0, 0]
  let any = false
  for (const t of tasks) {
    if (!t.completedAt) continue
    any = true
    totals[new Date(t.completedAt).getDay()]++
  }
  if (!any) return null
  const max = Math.max(...totals)
  const bestIndexes = totals.map((count, index) => (count === max ? index : -1)).filter((i) => i !== -1)
  return {
    dayLabels: bestIndexes.map((i) => DAY_FULL_LABELS[i]),
    dayLabelsShort: bestIndexes.map((i) => DAY_LABELS[i]),
    count: max,
  }
}

// Délai moyen (en millisecondes) entre la création d'une tâche et son
// exécution. Retourne null s'il n'y a encore aucune tâche exécutée.
export function computeAvgCompletionDelay(tasks) {
  const delays = tasks
    .filter((t) => t.completedAt && t.createdAt)
    .map((t) => new Date(t.completedAt).getTime() - new Date(t.createdAt).getTime())
    .filter((ms) => ms >= 0)
  if (delays.length === 0) return null
  return delays.reduce((a, b) => a + b, 0) / delays.length
}

// Paliers symboliques débloqués selon le nombre de tâches actuellement
// exécutées (pas un compteur historique cumulé : supprimer une tâche
// exécutée peut donc reprendre un palier).
export function computeAchievements(tasks, thresholds = ACHIEVEMENT_THRESHOLDS) {
  const totalDone = tasks.filter((t) => t.status === STATUS.DONE).length
  return {
    totalDone,
    thresholds: thresholds.map((threshold) => ({ threshold, unlocked: totalDone >= threshold })),
  }
}

// Total de tâches exécutées par semaine glissante (7 jours), sur les
// `weeks` dernières semaines. buckets[0] = semaine en cours (les 7 derniers
// jours), buckets[weeks - 1] = la plus ancienne.
export function computeWeeklyActivity(tasks, weeks = 4) {
  const today = startOfDay(new Date())
  const buckets = []
  for (let w = 0; w < weeks; w++) {
    const end = new Date(today.getTime() - w * 7 * DAY_MS + DAY_MS)
    const start = new Date(end.getTime() - 7 * DAY_MS)
    buckets.push({ start, end, count: 0 })
  }
  for (const t of tasks) {
    if (!t.completedAt) continue
    const time = new Date(t.completedAt).getTime()
    const bucket = buckets.find((b) => time >= b.start.getTime() && time < b.end.getTime())
    if (bucket) bucket.count++
  }
  return buckets
}

// Projection "à ce rythme" : extrapole, à partir du rythme quotidien moyen
// depuis le début du mois, le nombre de tâches qui seraient exécutées d'ici
// la fin du mois.
export function computeProjection(tasks) {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysElapsed = Math.floor((startOfDay(now).getTime() - monthStart.getTime()) / DAY_MS) + 1
  const doneThisMonth = tasks.filter((t) => t.completedAt && new Date(t.completedAt) >= monthStart).length
  const dailyRate = doneThisMonth / daysElapsed
  return { doneThisMonth, projected: Math.round(dailyRate * daysInMonth), daysInMonth, daysElapsed }
}
