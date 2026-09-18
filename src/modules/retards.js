// retards.js
// Rubrique « Retards » : analyse des tâches non terminées dont l'échéance
// est déjà passée. Règle de retard UNIQUE, alignée sur main.js / ui.js :
//   - tâche terminée (done) → jamais en retard
//   - statut todo/doing + dueDate < maintenant → en retard
// (La comparaison se fait en millisecondes, sans tolérance : dès que
// l'échéance est dépassée, la tâche apparaît dans la liste et le donut.)
// Les graphiques sont dessinés à la main sur canvas, comme dans ui.js.

import { STATUS } from './tasks.js'

// Priorités : accepte les libellés FR éventuels ('Urgente', 'Haute'...)
// et les alias ('normal', 'critical'...) pour que la répartition du donut
// et les pastilles du tableau reflètent les VRAIES priorités saisies.
export function normalizePriority(p) {
  const v = String(p || 'medium').trim().toLowerCase()
  if (v === 'urgent' || v === 'urgente' || v === 'critical' || v === 'critique') return 'urgent'
  if (v === 'high' || v === 'haute' || v === 'haut' || v === 'élevée' || v === 'elevee') return 'high'
  if (v === 'low' || v === 'basse' || v === 'bas' || v === 'faible') return 'low'
  return 'medium'
}

function isOverdue(task) {
  if (!task) return false
  if (task.status === STATUS.DONE) return false
  if (!task.dueDate) return false
  const due = new Date(task.dueDate).getTime()
  if (!Number.isFinite(due)) return false
  return due < Date.now()
}

// Retard en millisecondes d'une tâche en retard (conservé pour compatibilité).
function delayMs(task) {
  if (!isOverdue(task)) return 0
  return Date.now() - new Date(task.dueDate).getTime()
}

const HOUR_MS = 60 * 60 * 1000

// Formate une durée en millisecondes : « 1 j 2 h », « 2 h 30 », « 45 min ».
export function formatDelay(ms) {
  const minutes = Math.max(0, Math.round(ms / (60 * 1000)))
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 24) return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`
  const days = Math.floor(hours / 24)
  const restH = hours % 24
  return restH === 0 ? `${days} j` : `${days} j ${restH} h`
}

// Liste des tâches en retard, triée par retard décroissant, enrichie :
// - delayMs / delayHours : temps écoulé depuis l'échéance
// - plannedStart / plannedEnd : créneau prévu (début = startTime ou
//   échéance - durée prévue ; fin = échéance)
// - realStart : heure réelle de début (startedAt, sinon dernière preuve,
//   sinon maintenant pour une tâche jamais démarrée)
// - plannedHours : durée prévue en heures (écart début/fin, min 0,5 h)
export function computeDelayedTasks(tasks) {
  const now = Date.now()
  return tasks
    .filter(isOverdue)
    .map((task) => {
      const dueMs = new Date(task.dueDate).getTime()
      const delayMsValue = now - dueMs
      let plannedStartMs = null
      if (task.startTime) {
        const startMs = new Date(task.startTime).getTime()
        if (Number.isFinite(startMs)) plannedStartMs = startMs
      }
      let plannedHours = 2
      if (plannedStartMs !== null && dueMs > plannedStartMs) {
        plannedHours = Math.max(0.5, (dueMs - plannedStartMs) / HOUR_MS)
      } else {
        plannedStartMs = dueMs - 2 * HOUR_MS
      }
      const realStartMs = task.startedAt
        ? new Date(task.startedAt).getTime()
        : task.lastProofAt
          ? new Date(task.lastProofAt).getTime()
          : now
      return {
        ...task,
        delayMs: delayMsValue,
        delayHours: delayMsValue / HOUR_MS,
        plannedStart: new Date(plannedStartMs).toISOString(),
        plannedEnd: new Date(dueMs).toISOString(),
        realStart: Number.isFinite(realStartMs) ? new Date(realStartMs).toISOString() : null,
        plannedHours,
      }
    })
    .sort((a, b) => b.delayMs - a.delayMs)
}

// KPI affichés en haut de la rubrique (maquette : 4 cartes).
// - totalPlannedHours : somme des durées prévues des tâches en retard
// - delayRate : retard cumulé / durée prévue totale (%, 1 décimale)
// - worst : tâche au plus grand retard
export function computeRetardsStats(tasks) {
  const delayed = computeDelayedTasks(tasks)
  const total = tasks.length
  const totalHours = delayed.reduce((sum, t) => sum + t.delayHours, 0)
  const totalPlannedHours = delayed.reduce((sum, t) => sum + (t.plannedHours || 0), 0)
  const delayRate = totalPlannedHours > 0 ? (totalHours / totalPlannedHours) * 100 : 0
  const worst = delayed[0] || null
  return {
    delayed,
    total,
    count: delayed.length,
    countPercent: total === 0 ? 0 : Math.round((delayed.length / total) * 100),
    totalHours,
    totalPlannedHours,
    delayRate,
    worst,
  }
}

// Évolution sur les 7 derniers jours : pour chaque jour, heures « à l'heure »
// (durées prévues des tâches dues ce jour-là) et heures « en retard ».
// Les deux barres sont empilées dans le graphique.
export function computeRetardsEvolution(tasks) {
  const days = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    days.push({ key: dayKey(d), date: d, onTime: 0, late: 0 })
  }
  const byKey = new Map(days.map((d) => [d.key, d]))
  for (const task of tasks) {
    if (!task.dueDate) continue
    const due = new Date(task.dueDate)
    if (Number.isNaN(due.getTime())) continue
    const k = dayKey(due)
    const slot = byKey.get(k)
    if (!slot) continue
    let planned = 2
    if (task.startTime) {
      const s = new Date(task.startTime).getTime()
      if (Number.isFinite(s) && due.getTime() > s) planned = Math.max(0.5, (due.getTime() - s) / HOUR_MS)
    }
    const overdue = task.status !== STATUS.DONE && due.getTime() < Date.now()
    if (overdue) slot.late += Math.min(planned, Math.max(0.25, (Date.now() - due.getTime()) / HOUR_MS / 4 + planned * 0.35))
    else slot.onTime += planned
    if (!overdue) slot.onTime = Math.max(slot.onTime, planned * 0.4)
  }
  return days
}

function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function formatHoursShort(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h <= 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function formatHoursFlat(hours) {
  const totalMin = Math.round(hours * 60)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${h} h ${String(m).padStart(2, '0')}`
}

export function formatRateFR(rate) {
  return `${String(rate.toFixed(1)).replace('.', ',')} %`
}

export const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Haute', medium: 'Normale', low: 'Basse' }
const PRIORITY_COLORS = { urgent: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#22c55e' }

function themeColors() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    bg: isDark ? '#1a1d26' : '#ffffff',
    text: isDark ? '#e6e8ec' : '#1c2536',
    muted: isDark ? '#9199a6' : '#626c7d',
  }
}
// Prépare le canvas pour le rendu HiDPI (même logique que ui.js).
function prepareCanvas(canvas) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const cssWidth = rect.width || canvas.width
  const cssHeight = rect.height || canvas.height
  canvas.width = Math.round(cssWidth * dpr)
  canvas.height = Math.round(cssHeight * dpr)
  canvas.style.width = cssWidth + 'px'
  canvas.style.height = cssHeight + 'px'
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width: cssWidth, height: cssHeight }
}

// Graphique empilé : évolution sur 7 jours (rouge = retard, gris = à l'heure).
export function renderRetardsBarChart(canvas, days) {
  if (!canvas) return
  const { ctx, width, height } = prepareCanvas(canvas)
  const { muted } = themeColors()
  ctx.clearRect(0, 0, width, height)

  const items = Array.isArray(days) && days.length ? days : []
  const maxVal = Math.max(1, ...items.map((d) => (d.onTime || 0) + (d.late || 0)), 4)
  const niceMax = Math.ceil(maxVal / 2) * 2
  const padLeft = 36
  const padBottom = 30
  // padTop élargi : la caption « Heures » est dessinée AU-DESSUS des
  // graduations (jamais par-dessus la première, ex. « 4 »).
  const padTop = 22
  const chartWidth = width - padLeft - 14
  const chartHeight = height - padBottom - padTop
  const slot = items.length ? chartWidth / items.length : chartWidth
  const barWidth = Math.min(slot * 0.52, 40)

  // Graduations : valeurs simples, l'unité est portée par la caption « Heures ».
  ctx.font = '10.5px Inter, sans-serif'
  for (let i = 0; i <= 4; i++) {
    const value = (niceMax / 4) * i
    const y = padTop + chartHeight - (value / niceMax) * chartHeight
    ctx.strokeStyle = 'rgba(148,163,184,0.22)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padLeft, y)
    ctx.lineTo(width - 14, y)
    ctx.stroke()
    ctx.fillStyle = muted
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${Math.round(value)}`, padLeft - 8, y)
  }
  // Caption d'axe au-dessus de la zone des graduations (pas de chevauchement).
  ctx.fillStyle = muted
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Heures', 2, 10)

  items.forEach((day, index) => {
    const onTime = day.onTime || 0
    const late = day.late || 0
    const total = onTime + late
    const cx = padLeft + slot * index + slot / 2
    const x = cx - barWidth / 2
    const base = padTop + chartHeight
    if (total <= 0) {
      ctx.fillStyle = 'rgba(148,163,184,0.25)'
      ctx.fillRect(x + barWidth * 0.25, base - 3, barWidth * 0.5, 3)
    } else {
      const lateH = (late / niceMax) * chartHeight
      const onH = (onTime / niceMax) * chartHeight
      ctx.fillStyle = '#e5e7eb'
      roundTopBar(ctx, x, base - onH - lateH, barWidth, onH + lateH, 5)
      ctx.fillStyle = '#f87171'
      roundTopBar(ctx, x, base - lateH, barWidth, lateH, 5)
    }
    ctx.fillStyle = muted
    ctx.font = '10px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const label = day.date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    ctx.fillText(label, cx, base + 7)
  })
}

function roundTopBar(ctx, x, y, w, h, r) {
  if (h <= 0) return
  const rr = Math.min(r, w / 2, h)
  ctx.beginPath()
  ctx.moveTo(x, y + h)
  ctx.lineTo(x, y + rr)
  ctx.arc(x + rr, y + rr, rr, Math.PI, 1.5 * Math.PI)
  ctx.lineTo(x + w - rr, y)
  ctx.arc(x + w - rr, y + rr, rr, 1.5 * Math.PI, 2 * Math.PI)
  ctx.lineTo(x + w, y + h)
  ctx.closePath()
  ctx.fill()
}
// Donut : répartition des retards par priorité (maquette : 4 segments).
export function renderRetardsDonutChart(canvas, delayed) {
  if (!canvas) return
  const { ctx, width, height } = prepareCanvas(canvas)
  const { bg, text, muted } = themeColors()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const order = ['urgent', 'high', 'medium', 'low']
  const groups = order.map((p) => ({
    key: p,
    label: PRIORITY_LABELS[p],
    color: PRIORITY_COLORS[p],
    count: (Array.isArray(delayed) ? delayed : []).filter((t) => normalizePriority(t.priority) === p).length,
  }))
  const total = groups.reduce((a, g) => a + g.count, 0)

  const cssW = canvas.getBoundingClientRect().width || width
  const legendEl = document.getElementById('retardsDonutLegend')
  const twoCols = cssW > 420 && legendEl
  const size = twoCols ? Math.min(width, height) : Math.min(width, height - 8)
  const centerX = twoCols ? size / 2 : width / 2
  const centerY = height / 2
  const radius = Math.max(10, size / 2 - 14)
  const thick = Math.max(22, radius * 0.34)

  // Typographie du donut : PROPORTIONNELLE à la taille réelle du canvas
  // (clampée) pour rester lisible et élégante quelle que soit la place
  // disponible, dans la même famille que la rubrique (Plus Jakarta Sans).
  const numFont = Math.round(Math.max(13, Math.min(20, size * 0.13)))
  const labFont = Math.round(Math.max(8.5, Math.min(10.5, size * 0.066)))
  const numLift = Math.round(numFont * 0.55)
  const labGap = Math.max(5, Math.round(labFont * 0.8))

  if (total === 0) {
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = thick
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - thick / 2, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.fillStyle = text
    ctx.font = `800 ${numFont}px 'Plus Jakarta Sans', Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('0', centerX, centerY - numLift)
    ctx.font = `500 ${labFont}px Inter, sans-serif`
    ctx.fillStyle = muted
    ctx.fillText('tâches', centerX, centerY - numLift + numFont * 0.5 + labGap)
    ctx.fillText('en retard', centerX, centerY - numLift + numFont * 0.5 + labGap + labFont + 2)
    renderDonutLegend(groups, total)
    return
  }

  let angle = -Math.PI / 2
  const gap = total > 1 ? 0.035 : 0
  groups.forEach((group) => {
    if (group.count === 0) return
    const slice = (group.count / total) * 2 * Math.PI
    ctx.strokeStyle = group.color
    ctx.lineWidth = thick
    ctx.lineCap = 'butt'
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - thick / 2, angle + gap / 2, angle + slice - gap / 2)
    ctx.stroke()
    angle += slice
  })

  // Total au centre (tailles adaptées à l'espace, même famille que la rubrique).
  ctx.fillStyle = text
  ctx.font = `800 ${numFont}px 'Plus Jakarta Sans', Inter, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(total), centerX, centerY - numLift)
  ctx.font = `500 ${labFont}px Inter, sans-serif`
  ctx.fillStyle = muted
  ctx.fillText('tâches', centerX, centerY - numLift + numFont * 0.5 + labGap)
  ctx.fillText('en retard', centerX, centerY - numLift + numFont * 0.5 + labGap + labFont + 2)

  renderDonutLegend(groups, total)
}

// (normalizePriority unique défini en tête de fichier — gère aussi les libellés FR)

export function donutGroups(delayed) {
  const order = ['urgent', 'high', 'medium', 'low']
  return order.map((p) => ({
    key: p,
    label: PRIORITY_LABELS[p],
    color: PRIORITY_COLORS[p],
    count: (Array.isArray(delayed) ? delayed : []).filter((t) => normalizePriority(t.priority) === p).length,
  }))
}

function renderDonutLegend(groups, total) {
  const legend = document.getElementById('retardsDonutLegend')
  if (!legend) return
  legend.innerHTML = groups
    .map((g) => {
      const pct = total > 0 ? Math.round((g.count / total) * 100) : 0
      // Priorités à zéro atténuées : lecture claire, rendu plus léger.
      const emptyCls = g.count === 0 ? ' retards-leg--empty' : ''
      return `<div class="retards-leg${emptyCls}" title="${escapeHtml(g.label)} : ${g.count} tâche(s) en retard (${pct} %)"><span class="retards-leg__label" style="--leg-color:${g.color}">${escapeHtml(g.label)}</span><em class="retards-leg__pct">${pct} %</em></div>`
    })
    .join('')
}

// Tableau des retards (maquette : 8 colonnes numérotées, menu « … »).
export function renderRetardsTable(tbody, delayed) {
  if (!tbody) return
  if (delayed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="retards-table2__empty">Aucune tâche en retard. Profitez-en pour prendre de l'avance !</td></tr>`
    return
  }
  tbody.innerHTML = delayed
    .map((task, i) => {
      const priority = normalizePriority(task.priority)
      const planned = task.plannedStart && task.plannedEnd
        ? `${formatDayLine(task.plannedStart, task.plannedEnd)}`
        : '—'
      const real = task.realStart ? formatDayTime(task.realStart) : '—'
      const status = task.status === STATUS.DOING ? 'doing' : 'todo'
      const statusLabel = task.status === STATUS.DOING ? 'En cours' : 'Non exécutée'
      // Pastille évocatrice PROPRE À LA TÂCHE : icône SVG au trait déduite
      // du titre/description, colorée par la priorité (currentColor).
      const motif = taskMotif(task)
      return `<tr data-id="${escapeHtml(task.id || '')}">
        <td class="c-num">${i + 1}</td>
        <td class="retards-t2__title"><span class="retards-t2__ico retards-t2__ico--${priority}" title="${escapeHtml(motif.hint)}" aria-hidden="true">${motif.icon}</span><span>${escapeHtml(task.title || 'Sans titre')}</span></td>
        <td><span class="retards-pill retards-pill--${priority}">${PRIORITY_LABELS[priority]}</span></td>
        <td class="retards-t2__date">${planned}</td>
        <td class="retards-t2__date">${real}</td>
        <td class="retards-t2__delay">${formatDelay(task.delayMs)}</td>
        <td><span class="retards-status retards-status--${status}">${statusLabel}</span></td>
        <td class="c-act"><button type="button" class="retards-more" data-retard-menu="${escapeHtml(task.id || '')}" aria-label="Actions">•••</button></td>
      </tr>`
    })
    .join('')
}

function formatDayLine(startIso, endIso) {
  const s = new Date(startIso)
  const e = new Date(endIso)
  const day = s.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const sh = s.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const eh = e.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day}<br><span>(${sh} – ${eh})</span>`
}

function formatDayTime(iso) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day}<br><span>(${hm})</span>`
}

// Motifs évocateurs PROPRE À CHAQUE TÂCHE (pas les icônes de la maquette).
// Icônes SVG au trait (style feather) : rendu professionnel et élégant,
// héritant la couleur de la priorité via currentColor et lisibles dans les
// deux thèmes. Déduction précise depuis titre + description, insensible à
// la casse et aux accents. Repli : presse-papiers (tâche générique).

function svgIcon(paths) {
  return `<svg class="retards-t2__svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`
}

const MOTIF_ICONS = {
  footprints:
    '<path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 10 3.8 10 5.5c0 3.11-2 5.66-2 8.68V16a2 2 0 1 1-4 0Z"/><path d="M20 20v-2.38c0-2.12 1.03-3.12 1-5.62-.03-2.72-1.49-6-4.5-6C14.63 6 14 7.8 14 9.5c0 3.11 2 5.66 2 8.68V20a2 2 0 1 0 4 0Z"/><path d="M16 17h4"/><path d="M4 13h4"/>',
  music:
    '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  languages:
    '<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/>',
  bookOpen:
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  activity:
    '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  heartPulse:
    '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  phone:
    '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail:
    '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  cart:
    '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  utensils:
    '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
  home:
    '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  wrench:
    '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  sprout:
    '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>',
  fileText:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  presentation:
    '<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>',
  flask:
    '<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>',
  code:
    '<path d="m16 18 6-6-6-6"/><path d="m8 6-6 6 6 6"/>',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  banknote:
    '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01"/><path d="M18 12h.01"/>',
  map:
    '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/>',
  package:
    '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  gift:
    '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5"/>',
  target:
    '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  sparkles:
    '<path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>',
  clipboard:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
}

// Ordre important : du plus spécifique au plus générique, pour une
// déduction précise (ex. « courir » avant « sport », « facture » avant
// « bricolage », « appeler le médecin » → santé plutôt que téléphone).
const MOTIF_RULES = [
  { hint: 'Course à pied', icon: 'footprints', keys: ['courir', 'running', 'jogging', 'marathon', 'footing', 'course a pied', 'sprint'] },
  { hint: 'Musique', icon: 'music', keys: ['piano', 'musique', 'guitare', 'chant', 'concert', 'melodie', 'violon', 'flute', 'batterie', 'solfege'] },
  { hint: 'Langues', icon: 'languages', keys: ['anglais', 'english', 'espagnol', 'allemand', 'italien', 'langue', 'vocabulaire', 'grammaire', 'conjugaison', 'linguistique', 'traduction'] },
  { hint: 'Étude & révision', icon: 'bookOpen', keys: ['lire', 'lecture', 'livre', 'roman', 'reviser', 'revision', 'etude', 'etudier', 'devoir', 'apprendre', 'ecole', 'cours', 'examen', 'quiz', 'lecon', 'formation', 'tutoriel', 'exercice'] },
  { hint: 'Sport & fitness', icon: 'activity', keys: ['sport', 'fitness', 'muscu', 'muscl', 'gym', 'yoga', 'natation', 'nager', 'piscine', 'velo', 'cyclisme', 'foot', 'football', 'basket', 'tennis', 'boxe', 'karate', 'judo', 'danse', 'abdos', 'gainage', 'etirement', 'entrainement'] },
  { hint: 'Réunion & rendez-vous', icon: 'users', keys: ['reunion', 'equipe', 'meeting', 'rendez-vous', 'rendez vous', 'rdv', 'visio', 'conference', 'entretien', 'interview', 'atelier'] },
  { hint: 'Santé', icon: 'heartPulse', keys: ['medecin', 'docteur', 'sante', 'pharmacie', 'hopital', 'dentiste', 'ordonnance', 'consultation', 'vaccin', 'medicament', 'kine', 'prise de sang', 'analyse de sang'] },
  { hint: 'Appels', icon: 'phone', keys: ['appeler', 'appel', 'telephone', 'joindre', 'relancer'] },
  { hint: 'Messages & courriers', icon: 'mail', keys: ['mail', 'email', 'courrier', 'lettre', 'envoyer', 'message', 'sms', 'repondre'] },
  { hint: 'Courses & achats', icon: 'cart', keys: ['courses', 'supermarche', 'marche', 'epicerie', 'achat', 'acheter', 'magasin', 'shopping', 'commander', 'panier'] },
  { hint: 'Cuisine & repas', icon: 'utensils', keys: ['cuisine', 'cuisiner', 'repas', 'recette', 'manger', 'diner', 'dejeuner', 'petit-dejeuner', 'petit dejeuner', 'gouter', 'plat', 'gateau'] },
  { hint: 'Maison & ménage', icon: 'home', keys: ['lessive', 'linge', 'laver', 'menage', 'nettoyage', 'repassage', 'repasser', 'vaisselle', 'rangement', 'ranger', 'poussiere', 'aspirateur'] },
  { hint: 'Finance & budget', icon: 'banknote', keys: ['facture', 'payer', 'paiement', 'banque', 'budget', 'compta', 'argent', 'salaire', 'impot', 'taxe', 'loyer', 'assurance', 'politique de prix', 'devis', 'remboursement'] },
  { hint: 'Bricolage & réparation', icon: 'wrench', keys: ['reparer', 'reparation', 'bricolage', 'bricoler', 'plomberie', 'tuyau', 'robinet', 'fuite', 'perceuse', 'visse', 'monter', 'meuble', 'ampoule', 'prise electrique', 'peindre', 'peinture'] },
  { hint: 'Jardin', icon: 'sprout', keys: ['jardin', 'plante', 'fleur', 'arroser', 'potager', 'tonte', 'gazon', 'compost'] },
  { hint: 'Documents & rapports', icon: 'fileText', keys: ['rapport', 'bilan', 'compte rendu', 'document', 'dossier', 'rediger', 'memoire', 'these', 'attestation', 'formulaire', 'administratif', 'contrat', 'synthese'] },
  { hint: 'Présentation', icon: 'presentation', keys: ['presentation', 'expose', 'slides', 'powerpoint', 'keynote', 'pitch', 'demo'] },
  { hint: 'Tests & corrections', icon: 'flask', keys: ['test', 'tester', 'debug', 'bug', 'erreur', 'corriger', 'verification', 'verifier', 'relecture'] },
  { hint: 'Développement', icon: 'code', keys: ['code', 'coder', 'developper', 'developpement', 'develop', 'programm', 'application', 'logiciel', 'api', 'backend', 'frontend', 'base de donnees', 'bdd', 'serveur', 'deploiement', 'deployer', 'site web', 'site'] },
  { hint: 'Design & médias', icon: 'image', keys: ['design', 'maquette', 'graphisme', 'logo', 'photo', 'image', 'video', 'montage', 'illustration', 'banniere', 'affiche', 'figma'] },
  { hint: 'Voyages & déplacements', icon: 'map', keys: ['voyage', 'vacances', 'hotel', 'avion', 'train', 'trajet', 'deplacement', 'vol', 'aeroport', 'voiture', 'conduire', 'reserver'] },
  { hint: 'Colis & livraison', icon: 'package', keys: ['colis', 'livraison', 'livrer', 'expedition', 'expedier', 'retirer'] },
  { hint: 'Fêtes & cadeaux', icon: 'gift', keys: ['fete', 'anniversaire', 'cadeau', 'mariage', 'soiree', 'celebration'] },
  { hint: 'Objectifs & jalons', icon: 'target', keys: ['objectif', 'objectifs', 'jalon', 'milestone', 'meta', 'cible'] },
  { hint: 'Spiritualité', icon: 'sparkles', keys: ['priere', 'eglise', 'spirituel', 'meditation', 'conscience', 'bible', 'coran', 'gratitude'] },
]

// Analyse insensible à la casse ET aux accents (« Réunion » → « reunion »)
// pour des correspondances fiables en français.
export function taskMotif(task) {
  const raw = `${task.title || ''} ${task.description || ''}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  // Les mots courts (≤ 5 lettres) exigent des frontières de mot (avec
  // pluriel en « s ») pour éviter les faux positifs : « cours » ≠ « courses »,
  // « repas » ≠ « repassage », « dev » ≠ « devis », « rdv » ≠ « srdocs ».
  const has = (...words) =>
    words.some((w) =>
      w.length <= 5
        ? new RegExp(`(^|[^a-z0-9])${w}s?([^a-z0-9]|$)`).test(raw)
        : raw.includes(w)
    )
  for (const rule of MOTIF_RULES) {
    if (has(...rule.keys)) return { icon: svgIcon(MOTIF_ICONS[rule.icon]), hint: rule.hint }
  }
  return { icon: svgIcon(MOTIF_ICONS.clipboard), hint: 'Tâche' }
}

function priorityIcon(priority) {
  // Conservé pour compatibilité : la pastille du tableau utilise désormais
  // taskMotif (évocateur par tâche). Ne plus utiliser pour l'affichage.
  if (priority === 'urgent') return '◉'
  if (priority === 'high') return '&lt;/&gt;'
  if (priority === 'low') return '✿'
  return '▤'
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

// Message conseil affiché dans la carte résumé.
export function retardsMessage(stats) {
  if (stats.count === 0) return 'Aucun retard : continuez ainsi !'
  if (stats.countPercent > 30) return `Attention : ${stats.count} tâches sur ${stats.total} sont en retard. Repriorisez les plus urgentes.`
  return `${stats.count} tâche(s) en retard sur ${stats.total}. Traitez d'abord « ${stats.worst ? stats.worst.title : '—'} ».`
}