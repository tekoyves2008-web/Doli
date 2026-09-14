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

// Retard en millisecondes d'une tâche en retard.
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

// Liste des tâches en retard, triée par retard décroissant, enrichie.
export function computeDelayedTasks(tasks) {
  return tasks
    .filter(isOverdue)
    .map((task) => ({
      ...task,
      delayMs: delayMs(task),
      delayHours: delayMs(task) / HOUR_MS,
    }))
    .sort((a, b) => b.delayMs - a.delayMs)
}

// KPI affichés en haut de la rubrique.
export function computeRetardsStats(tasks) {
  const delayed = computeDelayedTasks(tasks)
  const total = tasks.length
  const totalHours = delayed.reduce((sum, t) => sum + t.delayHours, 0)
  const avgHours = delayed.length ? totalHours / delayed.length : 0
  const worst = delayed[0] || null
  return {
    delayed,
    total,
    count: delayed.length,
    countPercent: total === 0 ? 0 : Math.round((delayed.length / total) * 100),
    totalHours,
    avgHours,
    worst,
  }
}

const PRIORITY_LABELS = { high: 'Haute', medium: 'Moyenne', low: 'Basse' }
const PRIORITY_COLORS = { high: '#ff8b8b', medium: '#ffb75c', low: '#9199a6' }

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

// Graphique en barres : heures de retard par tâche.
export function renderRetardsBarChart(canvas, delayed) {
  if (!canvas) return
  const { ctx, width, height } = prepareCanvas(canvas)
  const { bg, text, muted } = themeColors()
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  if (delayed.length === 0) {
    ctx.fillStyle = muted
    ctx.font = '13px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Aucun retard', width / 2, height / 2)
    return
  }

  // Au plus 7 barres : les retards les plus longs d'abord.
  const items = delayed.slice(0, 7)
  const maxHours = Math.max(...items.map((t) => t.delayHours), 1)
  const padLeft = 34
  const padBottom = 34
  const chartWidth = width - padLeft - 12
  const chartHeight = height - padBottom - 12
  const slot = chartWidth / items.length
  const barWidth = Math.min(slot * 0.55, 44)

  ctx.strokeStyle = muted
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padLeft, height - padBottom)
  ctx.lineTo(width - 12, height - padBottom)
  ctx.stroke()

  items.forEach((task, index) => {
    const h = (task.delayHours / maxHours) * chartHeight
    const x = padLeft + slot * index + (slot - barWidth) / 2
    const y = height - padBottom - h

    // Barre : couleur selon la priorité de la tâche.
    ctx.fillStyle = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.low
    ctx.beginPath()
    const r = Math.min(4, barWidth / 2)
    ctx.moveTo(x, height - padBottom)
    ctx.lineTo(x, y + r)
    ctx.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI)
    ctx.lineTo(x + barWidth - r, y)
    ctx.arc(x + barWidth - r, y + r, r, 1.5 * Math.PI, 2 * Math.PI)
    ctx.lineTo(x + barWidth, height - padBottom)
    ctx.closePath()
    ctx.fill()

    // Valeur au-dessus de la barre.
    ctx.fillStyle = text
    ctx.font = 'bold 10px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const label = task.delayHours < 1
      ? `${Math.round(task.delayHours * 60)}m`
      : `${task.delayHours.toFixed(1)}h`
    ctx.fillText(label, x + barWidth / 2, y - 2)

    // Nom de la tâche (tronqué) sous l'axe.
    ctx.fillStyle = muted
    ctx.font = '10px Inter, sans-serif'
    ctx.textBaseline = 'top'
    let name = task.title || 'Sans titre'
    while (name.length > 3 && ctx.measureText(name + '…').width > slot - 4) name = name.slice(0, -1)
    if (name.length > 12) name = name.slice(0, 12) + '…'
    ctx.fillText(name, padLeft + slot * index + slot / 2, height - padBottom + 6)
  })

  // Axe vertical (heures).
  ctx.fillStyle = muted
  ctx.font = '10px Inter, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= 4; i++) {
    const value = (maxHours / 4) * i
    const y = height - padBottom - (value / maxHours) * chartHeight
    ctx.fillText(value < 1 ? '' : `${Math.round(value)}h`, padLeft - 6, y)
  }
}
// Donut : répartition des retards par priorité, avec légende.
export function renderRetardsDonutChart(canvas, delayed) {
  if (!canvas) return
  const { ctx, width, height } = prepareCanvas(canvas)
  const { bg, text, muted } = themeColors()
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, width, height)

  const groups = ['high', 'medium', 'low'].map((p) => ({
    label: PRIORITY_LABELS[p],
    color: PRIORITY_COLORS[p],
    count: delayed.filter((t) => (t.priority || 'medium') === p).length,
  }))
  const total = groups.reduce((a, g) => a + g.count, 0)

  const legendWidth = 130
  const chartWidth = width - legendWidth - 20
  const centerX = chartWidth / 2 + 10
  const centerY = height / 2
  const radius = Math.min(chartWidth / 2 - 20, height / 2 - 20)

  if (total === 0) {
    ctx.fillStyle = muted
    ctx.font = '13px Inter, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Aucun retard', centerX, centerY)
    return
  }

  let angle = -Math.PI / 2
  groups.forEach((group) => {
    if (group.count === 0) return
    const slice = (group.count / total) * 2 * Math.PI
    ctx.fillStyle = group.color
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, angle, angle + slice)
    ctx.closePath()
    ctx.fill()
    angle += slice
  })

  // Trou du donut + total au centre.
  ctx.fillStyle = bg
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.45, 0, 2 * Math.PI)
  ctx.fill()
  ctx.fillStyle = text
  ctx.font = 'bold 16px Inter, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(total, centerX, centerY - 6)
  ctx.font = '10px Inter, sans-serif'
  ctx.fillStyle = muted
  ctx.fillText('retards', centerX, centerY + 10)

  // Légende à droite.
  const itemHeight = 34
  const startX = (height - groups.length * itemHeight) / 2 + itemHeight / 2
  groups.forEach((group, index) => {
    const y = startX + index * itemHeight
    ctx.fillStyle = group.color
    ctx.fillRect(width - legendWidth + 14, y - 7, 12, 12)
    ctx.fillStyle = text
    ctx.font = '600 11px Inter, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(group.label, width - legendWidth + 34, y - 5)
    ctx.fillStyle = group.color
    ctx.font = 'bold 12px Inter, sans-serif'
    ctx.fillText(`${group.count}`, width - legendWidth + 34, y + 8)
  })
}

// Tableau des retards.
export function renderRetardsTable(tbody, delayed) {
  if (!tbody) return
  if (delayed.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="retards-table__empty">Aucune tâche en retard 🎉</td></tr>`
    return
  }
  tbody.innerHTML = delayed
    .map((task) => {
      const priority = task.priority || 'medium'
      const due = task.dueDate
        ? new Date(task.dueDate).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
        : '—'
      return `<tr>
        <td class="retards-table__task">${escapeHtml(task.title || 'Sans titre')}</td>
        <td><span class="retards-prio retards-prio--${priority}">${PRIORITY_LABELS[priority]}</span></td>
        <td class="retards-table__due">${due}</td>
        <td class="retards-table__delay">${formatDelay(task.delayMs)}</td>
      </tr>`
    })
    .join('')
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