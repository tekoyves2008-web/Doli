// check.mjs
// Contrôle automatique entre index.html et TOUS les fichiers src/.
// (main.js + modules/ui.js, modules/auth.js, ...).
//
// Protège du bug du 09/09/2026 : getElementById d'un ID absent du HTML,
// ou variable utilisée sans déclaration, fait planter le script au chargement
// -> le listener du login n'est jamais attaché -> formulaire soumis nativement
// -> URL "http://localhost:5173/?".
//
// Usage :  node check.mjs    (ou  npm run check)
// Exit code : 0 si tout va bien, 1 si un risque de plantage est détecté.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const htmlPath = path.join(ROOT, 'index.html')
const MODULE_DIR = path.join(ROOT, 'src', 'modules')
const SRC_DIR = path.join(ROOT, 'src')
// main.js : point d'entrée réellement chargé par index.html (script type=module).
const mainPath = path.join(SRC_DIR, 'main.js')

const errors = []
const warnings = []

function err(file, line, msg) { errors.push(`   ${file}:${line}  ${msg}`) }
function warn(msg) { warnings.push(`   ${msg}`) }

if (!fs.existsSync(mainPath)) { console.error('[check] introuvable : ' + mainPath); process.exit(1) }
if (!fs.existsSync(htmlPath)) { console.error('[check] introuvable : ' + htmlPath); process.exit(1) }

const mainSrc = fs.readFileSync(mainPath, 'utf8')
const mainLines = mainSrc.split('\n')
const htmlSrc = fs.readFileSync(htmlPath, 'utf8')

// ------------------------------------------------- 1) IDs absents du HTML
const htmlIds = new Set([...htmlSrc.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))

// varName -> { id, line } pour chaque getElementById() affecté à une const.
const elemVar = new Map()
mainLines.forEach((line, i) => {
  const assign = line.match(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*document\.getElementById\('([^']+)'\)/)
  if (assign) elemVar.set(assign[1], { id: assign[2], line: i + 1 })
})

const missingIds = []
for (const { id, line } of elemVar.values()) {
  if (!htmlIds.has(id)) missingIds.push(`${id} (ligne ${line})`)
}
if (missingIds.length) {
  // Simples avertissements : une absence peut être sans danger si l'élément
  // est protégé par onEl (l'étape 2 ne signale que les usages vraiment dangereux).
  warn(`IDs absents de index.html (vérifier s'ils sont protégés) : ${missingIds.join(', ')}`)
}

// --------------------------------------- 2) utilisation directe sans garde
for (const line of mainLines) {
  const use = /^\s*([A-Za-z_$][\w$]*)\s*\.\s*(?:addEventListener|appendChild|classList|innerHTML|textContent|hidden|style|focus|value|dataset|setAttribute)\s*[\(\.]/.exec(line)
  if (!use) continue
  const target = use[1]
  if (!elemVar.has(target)) continue // variable de boucle/callback
  const info = elemVar.get(target)
  if (!htmlIds.has(info.id)) {
    err('src/main.js', info.line, `"${target}" (id "${info.id}" absent du HTML) est utilisé sans garde -> plantage au chargement`)
  }
}

// ----------------------------------------------- 3) Variables non déclarées
// On retire commentaires, chaînes, templates et imports.
const code = mainSrc
  .replace(/\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/`[\s\S]*?`/g, ' ')
  .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, ' ')   // chaînes simples
  .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, ' ')   // chaînes doubles
  .replace(/import\s+\{[^}]*\}\s*from\s*['"][^'"]*['"]\s*;?/g, ' ')

const declared = new Set()
for (const m of code.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1])
for (const m of code.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)) declared.add(m[1])
// Paramètres de fonctions (toutes signatures : nommées, anonymes, fléchées).
for (const m of code.matchAll(/\b(?:async\s+)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) {
  for (const p of m[1].split(',')) { const t = p.trim().split('=')[0].split(':')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) declared.add(t) }
}
for (const m of code.matchAll(/\(([^)]*)\)\s*=>/g)) {
  for (const p of m[1].split(',')) { const t = p.trim().split('=')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) declared.add(t) }
}
// Callbacks fléchés à paramètre unique non parenthesé :  `((x) => {`  ou  `x => {`
for (const m of code.matchAll(/([A-Za-z_$][\w$]*)\s*=>\s*\{/g)) {
  declared.add(m[1])
}
for (const m of code.matchAll(/\(\(([A-Za-z_$][\w$]*)\)\s*=>\s*\{/g)) {
  declared.add(m[1])
}
for (const m of mainSrc.matchAll(/import\s+\{([^}]*)\}\s*from/g)) {
  for (const n of m[1].split(',')) { const t = n.trim().split(/\s+as\s+/).pop(); if (t) declared.add(t) }
}

const RESERVED = new Set('break case catch class const continue debugger default delete do else enum export extends false finally for function if import in instanceof new null return super switch this throw true try typeof var void while with yield let static async await get set of'.split(' '))
const NATIVE = new Set('Array Boolean Date Error JSON Map Math Number Object Promise RegExp Set String Symbol console document window globalThis fetch parseInt parseFloat isNaN isFinite encodeURIComponent encodeURI decodeURIComponent decodeURI Infinity NaN process require module exports arguments undefined alert confirm prompt structuredClone'.split(' '))

const problems = {}
// Lookahead : exclut les identifiants suivis d'un `=` (assignation), d'une
// virgule, `;`, `:`, d'un `.` (propriété) ou d'un `(` (appel/definition de
// fonction) — mais PAS suivi de `)` : un identifiant en condition `if (X)` est
// une vraie référence de variable (c'est le cas du bug du 09/09).
for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\b(?!\s*[=,;:.(])/g)) {
  const name = m[1]
  // On ne garde que les noms "composés" (contiennent une majuscule interne ou
  // un underscore) : ce sont les vraies variables de code. Les minuscules
  // simples type event/status/name sont des paramètres ou propriétés banales.
  if (!/[A-Z_]/.test(name)) continue
  // Propriété d'objet (précédée d'un '.') ou clé de méthode ': function'
  const before = code.slice(Math.max(0, m.index - 12), m.index)
  if (before.trimEnd().endsWith('.')) continue
  if (declared.has(name) || RESERVED.has(name) || NATIVE.has(name)) continue
  if (name.length === 1) continue
  problems[name] = true
}
for (const name of Object.keys(problems).sort()) {
  err('src/main.js', '?', `Variable utilisée mais jamais déclarée : "${name}"`)
}

// -------------------------- 4) imports nommés <-> exports des modules
// Protège du bug du 17/09/2026 : `computeProgressionTrend` était utilisé dans
// main.js sans être importé -> ReferenceError au premier render() -> dashboard,
// mes tâches, rappel et preuves restaient vides. Un import nommé absent fait
// planter le module AVANT toute exécution : on le détecte ici, statiquement.
function listJsFiles(dir) {
  const out = []
  if (!fs.existsSync(dir)) return out
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) { if (entry.name !== 'node_modules') out.push(...listJsFiles(full)) }
    else if (entry.name.endsWith('.js')) out.push(full)
  }
  return out
}

const exportCache = new Map()
function exportsOf(file) {
  if (exportCache.has(file)) return exportCache.get(file)
  const names = new Set()
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1])
  for (const m of src.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const part of m[1].split(',')) {
      const t = part.trim()
      if (!t) continue
      const alias = t.split(/\s+as\s+/)
      names.add((alias[1] || alias[0]).trim())
    }
  }
  if (/(^|\n)\s*export\s+default\b/.test(src)) names.add('default')
  exportCache.set(file, names)
  return names
}

function resolveModule(fromFile, spec) {
  const base = path.resolve(path.dirname(fromFile), spec)
  const candidates = [base, `${base}.js`, path.join(base, 'index.js')]
  return candidates.find((c) => fs.existsSync(c) && fs.statSync(c).isFile()) || null
}

for (const file of listJsFiles(SRC_DIR)) {
  const rel = path.relative(ROOT, file)
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const spec = m[2]
    if (!spec.startsWith('.')) continue
    const resolved = resolveModule(file, spec)
    if (!resolved) { err(rel, '?', `module introuvable : "${spec}"`); continue }
    const available = exportsOf(resolved)
    for (const part of m[1].split(',')) {
      const raw = part.trim()
      if (!raw || raw.startsWith('*')) continue
      const imported = raw.split(/\s+as\s+/)[0].trim()
      if (!imported) continue
      if (!available.has(imported)) {
        err(rel, '?', `"${imported}" est importé de "${spec}" mais n'est pas exporté -> ReferenceError au chargement`)
      }
    }
  }
}

// --------------------- 5) symbole utilisé dans main.js mais ni déclaré ni importé
// (le bug ci-dessus sous sa forme « utilisation sans import » : main.js se
// chargeait, puis plantait à l'exécution de render()).
const mainImported = new Set()
for (const m of mainSrc.matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
  for (const part of m[1].split(',')) {
    const t = part.trim().split(/\s+as\s+/).pop()
    if (t) mainImported.add(t.trim())
  }
}
const KNOWN_ROOTS = new Set(['Math', 'Date', 'JSON', 'Object', 'Array', 'Number', 'String', 'Promise', 'Set', 'Map', 'RegExp', 'Error', 'Boolean', 'Symbol', 'Intl', 'URL', 'URLSearchParams', 'FormData', 'Blob', 'File', 'FileReader', 'Image', 'TextEncoder', 'TextDecoder', 'AbortController', 'CustomEvent', 'Event', 'KeyboardEvent', 'MouseEvent', 'PointerEvent', 'MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'DOMParser', 'Notification', 'Audio', 'HTMLElement', 'Node', 'Element', 'Document', 'Window', 'Storage', 'requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask', 'getComputedStyle', 'matchMedia', 'postMessage', 'getSelection', 'createImageBitmap', 'requestIdleCallback', 'cancelIdleCallback', 'structuredClone', 'fetch'])
;(function () {
  const stripped = mainSrc
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/`[\s\S]*?`/g, ' ')
    .replace(/'[^'\\]*(?:\\.[^'\\]*)*'/g, ' ')
    .replace(/"[^"\\]*(?:\\.[^"\\]*)*"/g, ' ')
    .replace(/import\s+[^;]*from\s*['"][^'"]*['"]\s*;?/g, ' ')
  const local = new Set()
  for (const m of stripped.matchAll(/\b(?:const|let|var|class)\s+([A-Za-z_$][\w$]*)/g)) local.add(m[1])
  for (const m of stripped.matchAll(/\b(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g)) local.add(m[1])
  for (const m of stripped.matchAll(/\b(?:async\s+)?function(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^)]*)\)/g)) {
    for (const p of m[1].split(',')) { const t = p.trim().split('=')[0].split(':')[0].trim(); if (/^[A-Za-z_$][\w$]*$/.test(t)) local.add(t) }
  }
  for (const m of stripped.matchAll(/\(?([A-Za-z_$][\w$]*)\)?\s*=>/g)) local.add(m[1])
  const seen = {}
  // Définition de raccourci de méthode (`nom(...) {` dans un objet) : ce n'est
  // PAS un appel -> on regarde ce qui suit la parenthèse fermante.
  const isDefinition = (text, openParen) => {
    let depth = 0
    for (let i = openParen; i < text.length; i++) {
      if (text[i] === '(') depth++
      else if (text[i] === ')') {
        depth--
        if (depth === 0) return /^\s*\{/.test(text.slice(i + 1, i + 8))
      }
    }
    return false
  }
  // Identifiants « camelCase » appelés comme fonction : un nom tout en
  // minuscules est presque toujours un mot-clé ou une propriété, on ne retient
  // donc que les noms contenant une majuscule interne (ex. computeXxx).
  for (const m of stripped.matchAll(/\b([A-Za-z_$][A-Za-z0-9_$]*[A-Z][A-Za-z0-9_$]*)\s*\(/g)) {
    const name = m[1]
    if (local.has(name) || mainImported.has(name) || KNOWN_ROOTS.has(name) || RESERVED.has(name) || NATIVE.has(name)) continue
    const before = stripped.slice(Math.max(0, m.index - 20), m.index)
    if (before.trimEnd().endsWith('.') || before.trimEnd().endsWith('function') || before.trimEnd().endsWith('new')) continue
    if (isDefinition(stripped, m.index + m[0].lastIndexOf('('))) continue
    seen[name] = true
  }
  for (const name of Object.keys(seen).sort()) {
    err('src/main.js', '?', `"${name}()" est appelé mais jamais déclaré ni importé -> plantage à l'exécution`)
  }
})()

// ---------------------------------------------------------------- Sortie
console.log('\n=== Contrôle de cohérence index.html <-> main.js ===\n')
if (warnings.length) {
  console.log('ℹ️  Avertissements (non bloquants) :')
  warnings.forEach((w) => console.log(w))
  console.log('')
}
if (errors.length) {
  console.log('❌ Risque(s) de plantage au chargement :\n')
  errors.forEach((e) => console.log(e))
  console.log('\n→ Un plantage de main.js fait réapparaître le bug de connexion (URL /?). Corrige avant de lancer.')
  process.exit(1)
} else {
  console.log('✅ Aucun risque de plantage détecté : tous les éléments utilisés sans garde existent dans index.html, aucune variable non déclarée.')
  process.exit(0)
}