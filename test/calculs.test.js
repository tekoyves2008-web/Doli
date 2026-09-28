// test/calculs.test.js
// Tests de CARACTÉRISATION : ils figent le comportement ACTUEL des calculs.
//
// But : pouvoir corriger un défaut sans avoir peur de casser autre chose. On
// ne teste pas « ce qui devrait être vrai » mais « ce qui est vrai aujourd'hui »
// (y compris les cas limites douteux). Toute modification d'un calcul doit
// faire échouer un test ici : c'est le signal qu'il faut regarder, pas un
// défaut de la méthode.
//
// Exécution :  npm test
//
// Aucun calcul de ces modules ne touche au DOM ni au réseau : les modules
// s'importent donc tels quels dans Node.

import { test } from 'node:test'
import assert from 'node:assert/strict'

// Doit précéder les modules applicatifs : installe un DOM minimal pour que
// retards.js (qui lit le DOM au chargement) s'importe dans Node.
import './dom-stub.js'

import { STATUS, PRIORITY } from '../src/modules/tasks.js'
import { severityIndexForRate, computeTaskDelays, taskProgressRatio, computeTaskPerformance, computeGlobalPerformance } from '../src/modules/performance.js'
import { computeTaskProgress, taskWeight, computeGlobalProgress, countUnmeasuredTasks, computeProgressionStats, computeWeekComparison } from '../src/modules/progression.js'
import { computeStats, computeTrend, computeStreak } from '../src/modules/stats.js'
import { normalizePriority, formatDelay, computeDelayedTasks, computeRetardsStats } from '../src/modules/retards.js'

// --- Fixtures ---------------------------------------------------------------
const H = 3600 * 1000
const base = Date.parse('2026-03-10T09:00:00Z')

/** Tâche terminée exactement à `hours` après le début prévu, échéance à +6 h. */
function doneTask(over = {}) {
  return {
    id: 't1', title: 'Tâche', description: '', status: STATUS.DONE, priority: PRIORITY.MEDIUM,
    startTime: new Date(base).toISOString(),
    dueDate: new Date(base + 6 * H).toISOString(),
    createdAt: new Date(base - H).toISOString(),
    completedAt: new Date(base + 6 * H).toISOString(),
    startedAt: new Date(base).toISOString(),
    lastProofAt: new Date(base + 3 * H).toISOString(),
    proofCount: 2, ...over,
  }
}

function openTask(over = {}) {
  return {
    id: 't2', title: 'Tâche', description: '', status: STATUS.TODO, priority: PRIORITY.MEDIUM,
    startTime: new Date(base).toISOString(),
    dueDate: new Date(base + 6 * H).toISOString(),
    createdAt: new Date(base - H).toISOString(),
    completedAt: null, startedAt: null, lastProofAt: null, proofCount: 0, ...over,
  }
}

// --- Aides « aujourd'hui » ---------------------------------------------------
// Plusieurs calculs (tendance, série, retards) indexent leurs seaux sur la
// date DU JOUR : leurs tests ont besoin de tâches réellement datées d'aujourd'hui,
// pas de la date fixe `base` ci-dessus — qui sert aux calculs purement
// mathématiques, où « maintenant » est fourni en paramètre.
const startOfToday = new Date()
startOfToday.setHours(0, 0, 0, 0)
const T0 = startOfToday.getTime()
const daysAgo = (n) => new Date(T0 - n * H * 24).toISOString()
const daysAhead = (n) => new Date(T0 + n * H * 24).toISOString()

// --- Progression individuelle ----------------------------------------------
test('computeTaskProgress : terminated = 100, never started = 0', () => {
  assert.equal(computeTaskProgress(doneTask()), 100)
  assert.equal(computeTaskProgress(openTask()), 0)
})

test('computeTaskProgress : in progress WITHOUT proof is unmeasurable (null)', () => {
  const t = openTask({ status: STATUS.DOING, startedAt: new Date(base).toISOString() })
  assert.equal(computeTaskProgress(t), null)
})

test('computeTaskProgress : in progress = elapsed time / planned duration', () => {
  // début réel T0, échéance T0+6h, preuve à T0+3h => 50 %
  const t = openTask({
    status: STATUS.DOING,
    startedAt: new Date(base).toISOString(),
    lastProofAt: new Date(base + 3 * H).toISOString(),
  })
  assert.equal(computeTaskProgress(t), 50)
})

test('computeTaskProgress : proof AFTER the deadline is clamped to 100', () => {
  const t = openTask({
    status: STATUS.DOING,
    startedAt: new Date(base).toISOString(),
    lastProofAt: new Date(base + 50 * H).toISOString(),
  })
  assert.equal(computeTaskProgress(t), 100)
})

test('computeTaskProgress : planned end BEFORE real start is unmeasurable (null)', () => {
  const t = openTask({
    status: STATUS.DOING,
    startedAt: new Date(base + 10 * H).toISOString(),
    lastProofAt: new Date(base + 11 * H).toISOString(),
  })
  assert.equal(computeTaskProgress(t), null)
})

// --- Weighting by priority --------------------------------------------------
test('taskWeight : urgent/high 1.5, medium 1, low 0.5, unknown 1', () => {
  assert.equal(taskWeight({ priority: 'urgent' }), 1.5)
  assert.equal(taskWeight({ priority: 'high' }), 1.5)
  assert.equal(taskWeight({ priority: 'medium' }), 1)
  assert.equal(taskWeight({ priority: 'low' }), 0.5)
  assert.equal(taskWeight({ priority: 'nonsense' }), 1)
  assert.equal(taskWeight({}), 1)
})

test('computeGlobalProgress : unmeasurable tasks are EXCLUDED from both sums', () => {
  const measuring = doneTask()                                  // 100 %
  const unmeasurable = openTask({ status: STATUS.DOING, startedAt: new Date(base).toISOString() })
  // 100 % alone, the doing task with no proof must not drag it to 50 %.
  assert.equal(computeGlobalProgress([measuring, unmeasurable]), 100)
  assert.equal(countUnmeasuredTasks([measuring, unmeasurable]), 1)
  assert.equal(computeGlobalProgress([]), 0)
})

// --- Performance ------------------------------------------------------------
test('severityIndexForRate : seuils exprimés en POURCENTAGE de retard', () => {
  // Le paramètre est un pourcentage (TR), pas un ratio : 0 / 25 / 50 / 100 / 150.
  assert.equal(severityIndexForRate(0), 0)
  assert.equal(severityIndexForRate(-5), 0)     // clampé à 0
  assert.equal(severityIndexForRate(0.1), 0.1)  // <= 25 %
  assert.equal(severityIndexForRate(30), 0.25)  // <= 50 %
  assert.equal(severityIndexForRate(70), 0.5)   // <= 100 %
  assert.equal(severityIndexForRate(120), 0.75) // <= 150 %
  assert.equal(severityIndexForRate(200), 1)
  assert.equal(severityIndexForRate('inconnu'), 0, 'une valeur illisible vaut 0')
})

test('computeTaskDelays : finishing EARLY is not penalised (RD/RF clamped to 0)', () => {
  // Finie 3 h AVANT l'échéance -> aucun retard, aucune pénalité.
  const d = computeTaskDelays(doneTask({ completedAt: new Date(base + 3 * H).toISOString() }), base + 7 * H)
  assert.equal(d.valid, true)
  assert.equal(d.RD, 0)   // démarrée à l'heure prévue
  assert.equal(d.RF, 0)   // terminée en avance
  assert.equal(d.RG, 0)
  assert.equal(d.TR, 0)
  assert.equal(d.IG, 0)
})

test('computeTaskDelays : finishing exactly ON the deadline is not late', () => {
  // completedAt == dueDate : c'est le cas limite, il ne doit pas y avoir de retard.
  const d = computeTaskDelays(doneTask(), base + 7 * H)
  assert.equal(d.RF, 0)
  assert.equal(d.TR, 0)
})

test('computeTaskDelays : finishing late produces a positive delay', () => {
  // Échéance à T0+6 h, finie à T0+9 h => retard de 3 h sur 6 h prévues = 50 %.
  const d = computeTaskDelays(doneTask({ completedAt: new Date(base + 9 * H).toISOString() }), base + 9 * H)
  assert.equal(d.RF, 3 * H)
  assert.equal(d.TR, 50)
  assert.equal(d.IG, 0.25)
})

test('computeTaskDelays : missing planned dates => invalid, not a crash', () => {
  const d = computeTaskDelays(openTask({ startTime: null, dueDate: null }))
  assert.equal(d.valid, false)
  assert.equal(d.reason, 'missing-planned-dates')
})

test('computeTaskDelays : zero/negative planned duration => invalid', () => {
  const d = computeTaskDelays(openTask({ dueDate: new Date(base).toISOString() }))
  assert.equal(d.valid, false)
  assert.equal(d.reason, 'invalid-planned-duration')
})

test('taskProgressRatio : in progress WITHOUT proof is excluded, not zero', () => {
  const r = taskProgressRatio(openTask({ status: STATUS.DOING, startedAt: new Date(base).toISOString() }))
  assert.deepEqual(r, { ratio: 0, excluded: true })
})

test('computeGlobalPerformance : reports how many tasks it excluded', () => {
  const r = computeGlobalPerformance([
    doneTask(),
    openTask({ id: 't3', status: STATUS.DOING, startedAt: new Date(base).toISOString() }),
  ], base + 7 * H)
  assert.equal(r.n, 1)
  assert.equal(r.excluded, 1)
})

// --- Retards ----------------------------------------------------------------
test('normalizePriority : synonyms are folded onto the four real priorities', () => {
  assert.equal(normalizePriority('urgent'), 'urgent')
  assert.equal(normalizePriority('urgente'), 'urgent')
  assert.equal(normalizePriority('critique'), 'urgent')
  assert.equal(normalizePriority('HAUTE'), 'high')
  assert.equal(normalizePriority('élevée'), 'high')
  assert.equal(normalizePriority('faible'), 'low')
  assert.equal(normalizePriority('moyen'), 'medium')
  assert.equal(normalizePriority(undefined), 'medium')
  assert.equal(normalizePriority('nawak'), 'medium')
})

test('formatDelay : human readable durations', () => {
  assert.equal(formatDelay(45 * 60 * 1000), '45 min')
  assert.equal(formatDelay(150 * 60 * 1000), '2 h 30')
  assert.equal(formatDelay(26 * H), '1 j 2 h')
  assert.equal(formatDelay(0), '0 min')
})

test('computeDelayedTasks : only unfinished tasks past their deadline', () => {
  // Comme computeRetardsStats, la fonction lit Date.now() sans paramètre :
  // les dates sont donc relatives à aujourd'hui.
  const out = computeDelayedTasks([
    openTask({ id: 'late', dueDate: daysAgo(1) }),      // échue, non faite -> en retard
    openTask({ id: 'future', dueDate: daysAhead(2) }),   // échéance future -> exclue
    doneTask({ id: 'done' }),                             // terminée -> jamais en retard
    openTask({ id: 'nodue', dueDate: null }),            // sans échéance -> exclue
  ])
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'late')
  assert.ok(out[0].delayMs > 0)
})

test('computeDelayedTasks : invalid date is NOT considered late', () => {
  const broken = openTask({ id: 'broken', dueDate: 'pas-une-date' })
  assert.equal(computeDelayedTasks([broken]).length, 0)
})

test('computeRetardsStats : counts and rate on a known set', () => {
  // ATTENTION : computeRetardsStats n'accepte pas de date injectable, il lit
  // Date.now() (contrairement à computeDelayedTasks). Les tâches ci-dessous
  // sont donc datées par rapport à AUJOURD'HUI.
  const stats = computeRetardsStats([
    openTask({ id: 'a', dueDate: daysAgo(1) }),        // échue, non faite -> en retard
    openTask({ id: 'b', dueDate: daysAhead(2) }),      // échéance future -> pas en retard
    doneTask({ id: 'c', dueDate: daysAgo(3) }),        // terminée -> jamais en retard
  ])
  assert.equal(stats.count, 1)
  assert.equal(stats.total, 3)
})

// --- Statistiques globales --------------------------------------------------
test('computeStats : splits by status and computes the completion rate', () => {
  const s = computeStats([doneTask(), openTask(), openTask({ id: 't3', status: STATUS.DOING })])
  assert.deepEqual(s, { total: 3, done: 1, doing: 1, todo: 1, percent: 33 })
  assert.deepEqual(computeStats([]), { total: 0, done: 0, doing: 0, todo: 0, percent: 0 })
})

test('computeTrend : 7 daily buckets, counted on the COMPLETION date', () => {
  const t = computeTrend([doneTask({ completedAt: daysAgo(0) })], 7)
  assert.equal(t.length, 7)
  assert.equal(t[6].count, 1, 'une tâche terminée aujourd’hui est comptée dans le dernier seau')
  assert.equal(t[0].count, 0)
  assert.equal(t.reduce((a, b) => a + b.count, 0), 1)
})

test('computeTrend : a task completed 10 days ago falls OUTSIDE the 7-day window', () => {
  const t = computeTrend([doneTask({ completedAt: daysAgo(10) })], 7)
  assert.equal(t.reduce((a, b) => a + b.count, 0), 0)
})

test('computeStreak : a missed deadline yesterday breaks the series at 1', () => {
  // Aujourd'hui : aucune échéance -> jour neutre, la série vaut 1.
  // Hier : une tâche non exécutée et échue -> la série s'arrête.
  const s = computeStreak([openTask({ dueDate: daysAgo(1) })])
  assert.equal(s, 1)
})

test('computeStreak : a day with no deadline does not break the series', () => {
  assert.equal(computeStreak([]), 365, 'sans aucune échéance, rien n’interrompt la série')
})

test('computeStreak : a task completed on time is NOT a miss', () => {
  // Échéance et fin au même instant : completedAt > due est faux, donc la
  // journée ne compte pas comme un raté et la série n'est jamais interrompue.
  const d = daysAgo(2)
  assert.equal(computeStreak([openTask({ dueDate: d, completedAt: d })]), 365)
})

// --- Périodes : une tâche terminée compte le jour où elle a été finie -------
// Règle appliquée par taskDate() dans progression.js.
test('computeProgressionStats : a finished task belongs to its COMPLETION day', () => {
  // Prévue il y a 10 jours, terminée aujourd'hui : elle doit compter dans la
  // période du jour (c'est le travail réellement accompli), pas dans celle
  // de son échéance.
  const task = doneTask({ dueDate: daysAgo(10), completedAt: daysAgo(0) })
  const s = computeProgressionStats([task], 1)
  assert.equal(s.total, 1, 'elle appartient à la période du jour')
  assert.equal(s.done, 1)
})

test('computeProgressionStats : an OPEN task still belongs to its due date', () => {
  // Une tâche non terminée n'a pas de date de réalisation : elle reste
  // rattachée à son échéance, sinon les retards cesseraient d'être visibles.
  const s = computeProgressionStats([openTask({ dueDate: daysAgo(0) })], 1)
  assert.equal(s.total, 1)
  assert.equal(s.delayed, 1, 'échue aujourd’hui et non faite => en retard')
})

test('computeWeekComparison : buckets split by the day a task was finished', () => {
  const buckets = computeWeekComparison([doneTask({ completedAt: daysAgo(0) })], 7)
  assert.equal(buckets.length, 7)
  assert.equal(buckets[6].done, 1, 'le dernier seau est celui d’aujourd’hui')
  assert.equal(buckets.reduce((a, b) => a + b.total, 0), 1)
})



