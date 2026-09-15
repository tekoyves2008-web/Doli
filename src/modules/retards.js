// retards.js
// Rubrique « Retards » : analyse des tâches non terminées dont l'échéance
// est déjà passée. Même règle de retard que progression.js (isOverdue) :
//   - tâche terminée (done)  → jamais en retard
//   - sinon, en retard si dueDate < maintenant
// Les graphiques sont dessinés à la main sur canvas, comme dans ui.js.

import { STATUS } from './tasks.js'

function isOverdue(task) {
  if (task.status === STATUS.DONE) return false
  if (!task.dueDate) return false
  return new Date(task.dueDate).getTime() < Date.now()
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

const PRIORITY_LABELS = { urgent: 'Urgente', high: 'Haute', medium: 'Normale', low: 'Basse' }
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
  const padTop = 14
  const chartWidth = width - padLeft - 14
  const chartHeight = height - padBottom - padTop
  const slot = items.length ? chartWidth / items.length : chartWidth
  const barWidth = Math.min(slot * 0.52, 40)

  ctx.font = '11px Inter, sans-serif'
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
    ctx.fillText(`${Math.round(value)}h`, padLeft - 8, y)
  }
  ctx.fillStyle = muted
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('Heures', 2, padTop - 2)

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
  const { text, muted } = themeColors()
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const order = ['urgent', 'high', 'medium', 'low']
  const groups = order.map((p) => ({
    key: p,
    label: PRIORITY_LABELS[p],
    color: PRIORITY_COLORS[p],
    count: delayed.filter((t) => normalizePriority(t.priority) === p).length,
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

  if (total === 0) {
    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = thick
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius - thick / 2, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.fillStyle = text
    ctx.font = "800 26px 'Plus Jakarta Sans', Inter, sans-serif"
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('0', centerX, centerY - 12)
    ctx.font = '500 11px Inter, sans-serif'
    ctx.fillStyle = muted
    ctx.fillText('tâches', centerX, centerY + 6)
    ctx.fillText('en retard', centerX, centerY + 20)
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

  // Total au centre.
  ctx.fillStyle = text
  ctx.font = "800 28px 'Plus Jakarta Sans', Inter, sans-serif"
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(String(total), centerX, centerY - 12)
  ctx.font = '500 11px Inter, sans-serif'
  ctx.fillStyle = muted
  ctx.fillText('tâches', centerX, centerY + 8)
  ctx.fillText('en retard', centerX, centerY + 22)

  renderDonutLegend(groups, total)
}

function normalizePriority(p) {
  if (p === 'urgent' || p === 'high' || p === 'medium' || p === 'low') return p
  return 'medium'
}

export function donutGroups(delayed) {
  const order = ['urgent', 'high', 'medium', 'low']
  return order.map((p) => ({
    key: p,
    label: PRIORITY_LABELS[p],
    color: PRIORITY_COLORS[p],
    count: delayed.filter((t) => normalizePriority(t.priority) === p).length,
  }))
}

function renderDonutLegend(groups, total) {
  const legend = document.getElementById('retardsDonutLegend')
  if (!legend) return
  legend.innerHTML = groups
    .map((g) => {
      const pct = total > 0 ? Math.round((g.count / total) * 100) : 0
      return `<div class="retards-leg"><span class="retards-leg__dot" style="background:${g.color}"></span><span class="retards-leg__label">${escapeHtml(g.label)}</span><span class="retards-leg__val">${g.count} (${pct} %)</span></div>`
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
      const icon = priorityIcon(priority)
      return `<tr data-id="${escapeHtml(task.id || '')}">
        <td class="c-num">${i + 1}</td>
        <td class="retards-t2__title"><span class="retards-t2__ico retards-t2__ico--${priority}">${icon}</span><span>${escapeHtml(task.title || 'Sans titre')}</span></td>
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

function priorityIcon(priority) {
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