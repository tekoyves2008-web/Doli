// performance.js
// Logique de calcul de la PERFORMANCE (formules utilisateur, option B stricte) :
//   RD = DR - DP_heure ; RF = FR - FP ; RG = max(RF, RD)
//   DP_duree = FP - DP_heure ; TR = (RG / DP_duree) x 100
//   IG : 0 / 0.10 / 0.25 / 0.50 / 0.75 / 1 (seuils TR 0/25/50/100/150%)
//   Perfi = Pi x (1 - 0,5 x IGi) ; PerFG = (somme Perfi / n) x 100
// Mapping : DR=startedAt (defaut startTime), DP_heure=startTime (defaut
// createdAt), FR=completedAt si done sinon lastProofAt sinon now, FP=dueDate.
// Pi : todo->0, done->1, doing->TAT plafonne a 1 ; doing sans preuve->EXCLUE.
// Retards negatifs (en avance) clampes a 0. Pur calcul, zero DOM.

import { STATUS } from './tasks.js'
import { computeTaskProgress } from './progression.js'

export const DELAY_PENALTY = 0.5

export function severityIndexForRate(trPercent) {
  const tr = Number(trPercent)
  if (!Number.isFinite(tr) || tr <= 0) return 0
  if (tr <= 25) return 0.1
  if (tr <= 50) return 0.25
  if (tr <= 100) return 0.5
  if (tr <= 150) return 0.75
  return 1
}

function toMs(value) {
  if (value === null || value === undefined || value === '') return null
  const ms = new Date(value).getTime()
  return Number.isFinite(ms) ? ms : null
}

// Retards d'une tache (ms + % + IG). valid:false si FP ou DP_duree invalide.
export function computeTaskDelays(task, now = Date.now()) {
  const nowMs = typeof now === 'number' ? now : toMs(now) ?? Date.now()
  const dpHeure = toMs(task.startTime) ?? toMs(task.createdAt)
  const fp = toMs(task.dueDate)
  if (fp === null || dpHeure === null) {
    return { valid: false, reason: 'missing-planned-dates', RD: 0, RF: 0, RG: 0, TR: 0, IG: 0, DPduree: 0 }
  }
  const dpDuree = fp - dpHeure
  if (!(dpDuree > 0)) {
    return { valid: false, reason: 'invalid-planned-duration', RD: 0, RF: 0, RG: 0, TR: 0, IG: 0, DPduree: dpDuree }
  }
  const drMs = toMs(task.startedAt) ?? dpHeure
  const frMs = task.status === STATUS.DONE
    ? (toMs(task.completedAt) ?? toMs(task.lastProofAt) ?? nowMs)
    : (toMs(task.lastProofAt) ?? nowMs)
  const RD = Math.max(0, drMs - dpHeure)
  const RF = Math.max(0, frMs - fp)
  const RG = Math.max(RF, RD)
  const TR = (RG / dpDuree) * 100
  const IG = severityIndexForRate(TR)
  return { valid: true, reason: null, DR: drMs, DPheure: dpHeure, FR: frMs, FP: fp, DPduree: dpDuree, RD, RF, RG, TR, IG }
}

// Pi dans [0,1]. doing sans preuve -> excluded:true (transitoire, non penalise).
export function taskProgressRatio(task) {
  if (task.status === STATUS.DONE) return { ratio: 1, excluded: false }
  if (task.status !== STATUS.DOING) return { ratio: 0, excluded: false }
  const pct = computeTaskProgress(task)
  if (pct === null) return { ratio: 0, excluded: true }
  return { ratio: Math.min(1, Math.max(0, pct / 100)), excluded: false }
}

// Perfi = Pi x (1 - 0,5 x IGi). Exclue si doing sans preuve ou dates invalides.
export function computeTaskPerformance(task, now = Date.now()) {
  const prog = taskProgressRatio(task)
  if (prog.excluded) return { Pi: prog.ratio, IGi: 0, Perfi: 0, excluded: true, delays: null }
  const delays = computeTaskDelays(task, now)
  if (!delays.valid) return { Pi: prog.ratio, IGi: 0, Perfi: 0, excluded: true, delays, reason: delays.reason }
  const IGi = delays.IG
  const Perfi = prog.ratio * (1 - DELAY_PENALTY * IGi)
  return { Pi: prog.ratio, IGi, Perfi, excluded: false, delays }
}

// PerFG = (somme Perfi / n) x 100. n = taches evaluees (exclues hors n).
export function computeGlobalPerformance(tasks, now = Date.now()) {
  const list = Array.isArray(tasks) ? tasks : []
  let sum = 0
  let n = 0
  let excluded = 0
  let delayedCount = 0
  let trSum = 0
  let trCount = 0
  let maxIG = 0
  const details = []
  for (const task of list) {
    const perf = computeTaskPerformance(task, now)
    if (perf.excluded) { excluded++; continue }
    sum += perf.Perfi
    n++
    if (perf.delays && perf.delays.RG > 0) delayedCount++
    if (perf.delays) {
      trSum += perf.delays.TR
      trCount++
      if (perf.delays.IG > maxIG) maxIG = perf.delays.IG
    }
    details.push({ id: task.id ?? null, title: task.title ?? '', Pi: perf.Pi, IGi: perf.IGi, Perfi: perf.Perfi })
  }
  const percent = n === 0 ? 0 : Math.round((sum / n) * 100)
  return {
    percent, n, excluded, delayedCount,
    avgTR: trCount === 0 ? 0 : Math.round((trSum / trCount) * 10) / 10,
    maxIG, details,
  }
}

// Top des taches les plus en retard (section Performance, 3 lignes max).
export function topDelayedTasks(tasks, now = Date.now(), limit = 3) {
  const list = Array.isArray(tasks) ? tasks : []
  return list
    .map((task) => ({ task, delays: computeTaskDelays(task, now) }))
    .filter((e) => e.delays.valid && e.delays.RG > 0)
    .sort((a, b) => b.delays.TR - a.delays.TR)
    .slice(0, limit)
}

// NOTE : ce module avait sa propre copie de formatage de durée (« 2 h 30 »),
// identique à formatDelay() dans retards.js. Elle est supprimée : les deux
// versions pouvaient diverger à terme et afficher deux rendus différents du
// même délai. Les appelants utilisent désormais celle de retards.js.

