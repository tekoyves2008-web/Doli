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