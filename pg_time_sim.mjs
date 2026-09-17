// Harnais temporaire : simule le DOM/canvas juste assez pour exécuter
// renderProgressionMaquette() et vérifier le rendu du donut « Respect du temps ».
const arcs = []
const texts = []
let stroke = null

function makeCtx(canvas) {
  const base = {
    measureText: (t) => ({ width: String(t).length * 6 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    arc: (...a) => arcs.push({ id: canvas.id, stroke, a }),
    fillText: (t, x, y) => texts.push({ id: canvas.id, t, x: Math.round(x), y: Math.round(y), fill: base.fillStyle }),
    setTransform() {}, clearRect() {}, fillRect() {}, beginPath() {}, stroke() {}, fill() {},
    moveTo() {}, lineTo() {}, bezierCurveTo() {}, closePath() {}, rect() {}, roundRect() {},
    fillStyle: '', strokeStyle: '', font: '', textAlign: '', textBaseline: '', lineWidth: 0, lineCap: '',
  }
  return new Proxy(base, {
    set(target, prop, value) {
      if (prop === 'strokeStyle') stroke = value
      target[prop] = value
      return true
    },
    get(target, prop) {
      if (prop === 'strokeStyle') return stroke
      const value = target[prop]
      return typeof value === 'function' ? value : (value ?? (() => {}))
    },
  })
}

const canvases = new Map()
function getCanvas(id) {
  if (!canvases.has(id)) {
    const canvas = { id, width: 300, height: 300, style: {} }
    canvas.getContext = () => makeCtx(canvas)
    canvas.getBoundingClientRect = () => ({ width: 170, height: 170 })
    canvases.set(id, canvas)
  }
  return canvases.get(id)
}

const elements = new Map()
function getElement(id) {
  if (canvases.has(id)) return canvases.get(id)
  if (!elements.has(id)) {
    elements.set(id, {
      id, textContent: '', className: '', style: {},
      setAttribute() {}, getAttribute: () => null, prepend() {}, querySelector: () => null,
      addEventListener() {}, innerHTML: '',
    })
  }
  return elements.get(id)
}

const CSS_VARS = {
  '--text': '#1c2536', '--text-muted': '#6b7689', '--task-track': '#e9edf4',
  '--badge-done-text': '#227a4e', '--badge-todo-text': '#c0392b', '--accent': '#2563eb',
}
globalThis.window = { devicePixelRatio: 2, addEventListener: () => {}, matchMedia: () => ({ matches: false, addEventListener: () => {} }) }
globalThis.getComputedStyle = () => ({ getPropertyValue: (n) => CSS_VARS[n] ?? '' })
globalThis.addEventListener = () => {}
globalThis.requestAnimationFrame = (cb) => cb(0)
globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} }
globalThis.document = {
  getElementById: getElement,
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  createElement: () => getElement('tmp' + Math.random()),
  body: { addEventListener: () => {}, classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
  documentElement: { dataset: { theme: 'light' }, getAttribute: () => 'light', classList: { add: () => {}, remove: () => {}, toggle: () => {} } },
}

const { renderProgressionMaquette } = await import('./src/modules/ui.js')

const now = Date.now()
const iso = (ms) => new Date(ms).toISOString()
const tasks = [
  // 2 h prévues, 1 h réellement passée → 50 % du temps prévu.
  { status: 'done', startTime: iso(now - 3 * 3600000), dueDate: iso(now + 5 * 3600000), completedAt: iso(now - 3600000), createdAt: iso(now - 3 * 3600000), startedAt: iso(now - 2 * 3600000) },
]

console.log('--- Cas 1 : planning tenu (50 % du temps prévu) ---')
renderProgressionMaquette(tasks, 1)
console.log('arcs pgTimeDonut :', arcs.filter((a) => a.id === 'pgTimeDonut').map((a) => ({ stroke: a.stroke, from: a.a[3].toFixed(4), to: a.a[4].toFixed(4) })))
console.log('textes centraux  :', texts.filter((t) => t.id === 'pgTimeDonut').map((t) => t.t))
console.log('pgTimePct        :', getElement('pgTimePct').textContent, '| pgPlanned :', getElement('pgPlanned').textContent, '| pgActual :', getElement('pgActual').textContent)
console.log('badge            :', getElement('pgTimeBadge').textContent)

console.log('\n--- Cas 2 : dépassement (200 % du temps prévu) ---')
arcs.length = 0; texts.length = 0
tasks[0] = { ...tasks[0], startedAt: iso(now - 4 * 3600000), completedAt: iso(now) }
renderProgressionMaquette(tasks, 1)
console.log('arcs pgTimeDonut :', arcs.filter((a) => a.id === 'pgTimeDonut').map((a) => ({ stroke: a.stroke, from: a.a[3].toFixed(4), to: a.a[4].toFixed(4) })))
console.log('textes centraux  :', texts.filter((t) => t.id === 'pgTimeDonut').map((t) => t.t))
console.log('badge            :', getElement('pgTimeBadge').textContent)

console.log('\n--- Cas 3 : aucune échéance (anneau neutre complet) ---')
arcs.length = 0; texts.length = 0
renderProgressionMaquette([], 1)
console.log('arcs pgTimeDonut :', arcs.filter((a) => a.id === 'pgTimeDonut').map((a) => ({ stroke: a.stroke, from: a.a[3].toFixed(4), to: a.a[4].toFixed(4) })))
console.log('textes centraux  :', texts.filter((t) => t.id === 'pgTimeDonut').map((t) => t.t))
console.log('badge            :', getElement('pgTimeBadge').textContent)
console.log('\nOK : aucun plantage de rendu.')