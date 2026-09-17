// Harnais temporaire : vérifie le rendu du donut « Respect du temps » dans les
// deux thèmes (couleurs lues dans les variables CSS, halo uniquement en sombre).
const THEMES = {
  dark: {
    '--text': '#e6e8ec',
    '--text-muted': '#9199a6',
    '--pg-ring-track': '#333c50',
    '--badge-done-text': '#63d99a',
    '--badge-todo-text': '#ff8b8b',
  },
  light: {
    '--text': '#1c2536',
    '--text-muted': '#6b7689',
    '--pg-ring-track': '#e9edf4',
    '--badge-done-text': '#227a4e',
    '--badge-todo-text': '#c0392b',
  },
}

let currentTheme = 'dark'
const htmlAttrs = {}
globalThis.document = {
  documentElement: {
    dataset: { get theme() { return currentTheme } },
    getAttribute: (n) => (n === 'data-theme' ? currentTheme : htmlAttrs[n] ?? null),
    setAttribute: (n, v) => { htmlAttrs[n] = v },
    style: {},
  },
  createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {} } }),
  getElementById: (id) => getElement(id),
  querySelector: () => null,
  addEventListener() {},
}
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => THEMES[currentTheme][n] ?? '' })
globalThis.window = { devicePixelRatio: 1, addEventListener() {} }

const arcs = []
const texts = []
const shadows = []
const canvases = new Map()
function makeCtx() {
  return {
    setTransform() {}, clearRect() {}, beginPath() {}, closePath() {}, stroke() {}, fill() {},
    arc(cx, cy, r, a0, a1) { arcs.push({ r: Math.round(r), from: a0.toFixed(4), to: a1.toFixed(4), stroke: this.strokeStyle }) },
    fillText(t) { texts.push(t) },
    strokeRect() {}, fillRect() {}, moveTo() {}, lineTo() {}, bezierCurveTo() {}, rect() {}, roundRect() {},
    measureText: () => ({ width: 10 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    addColorStop() {},
    set shadowBlur(v) { shadows.push(v) }, get shadowBlur() { return 0 },
    strokeStyle: '', fillStyle: '', lineWidth: 1, lineCap: '', lineJoin: '', font: '', textAlign: '', textBaseline: '', shadowColor: '',
  }
}
function getCanvas(id) {
  if (!canvases.has(id)) {
    canvases.set(id, {
      id, width: 300, height: 300, style: {},
      getBoundingClientRect: () => ({ width: 170, height: 170 }),
      getContext: () => makeCtx(),
      setAttribute() {},
    })
  }
  return canvases.get(id)
}
const TEXT_IDS = new Set(['pgTimePct', 'pgPlanned', 'pgActual', 'pgDayPct', 'pgDayCenterLabel', 'pgDayBadge', 'pgTimeBadge', 'pgDayTitle', 'pgBannerTitle', 'pgBannerSub'])
const elements = new Map()
function getElement(id) {
  if (id === 'pgTimeDonut' || id === 'pgEvoChart') return getCanvas(id)
  if (!elements.has(id)) elements.set(id, { id, textContent: '', className: '', querySelector: () => null, prepend() {}, setAttribute() {} })
  return elements.get(id)
}

const { renderProgressionMaquette } = await import('./src/modules/ui.js')

const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()
const tasks = [
  { id: '1', title: 'A', status: 'done', startTime: iso(now - 2 * 3600000), dueDate: iso(now + 6 * 3600000), startedAt: iso(now - 1 * 3600000), completedAt: iso(now) },
  { id: '2', title: 'B', status: 'doing', dueDate: iso(now + 3600000) },
  { id: '3', title: 'C', status: 'todo', dueDate: iso(now - 3600000) },
]

for (const theme of ['dark', 'light']) {
  currentTheme = theme
  arcs.length = 0; texts.length = 0; shadows.length = 0
  renderProgressionMaquette(tasks, 1)
  const ring = arcs.find((a) => a.r < 60 && a.stroke && a.stroke !== '')
  console.log(`\n=== thème ${theme} ===`)
  console.log('arcs         :', JSON.stringify(arcs))
  console.log('centre       :', JSON.stringify(texts.slice(0, 3)))
  console.log('shadowBlur   :', JSON.stringify(shadows))
  console.log('piste attendue:', THEMES[theme]['--pg-ring-track'], '| trouvée :', arcs.map((a) => a.stroke).find((c) => c === THEMES[theme]['--pg-ring-track']) || 'AUCUNE')
}
console.log('\nOK : rendu effectué dans les deux thèmes sans plantage.')
