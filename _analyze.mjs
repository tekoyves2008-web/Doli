import fs from 'fs'
const src = fs.readFileSync('c:/Users/user/Gestionnaire de tâche/src/main.js', 'utf8')
const lines = src.split('\n')
const out = []

// 1) Imports inutilisés
const importBlock = src.slice(src.indexOf('import'), src.indexOf('const STATUS_FILTER_LABEL'))
const importNames = new Set()
for (const m of src.matchAll(/import\s+\{([^}]*)\}\s+from/g)) {
  for (const n of m[1].split(',')) {
    const t = n.trim()
    if (t) importNames.add(t)
  }
}
let importUsed = src
importUsed = importUsed.replace(/import\s+\{[^}]*\}\s+from\s+['"][^'"]+['"]\s*/g, '')
const unusedImports = [...importNames].filter((n) => !importUsed.includes(n))
out.push('=== IMPORTS NON UTILISES ===\n' + (unusedImports.length ? unusedImports.join('\n') : '(aucun)'))

// 2) Variables utilisées mais jamais déclarées (approximation lexicale)
const declared = new Set()
for (const m of src.matchAll(/\b(?:const|let|var|function|async\s+function)\s+([A-Za-z_$][\w$]*)/g)) {
  declared.add(m[1])
}
for (const m of src.matchAll(/\b(?:\w+)\(/g)) {
  const name = m[0].replace('(', '')
  if (/^[A-Z]/.test(name)) declared.add(name) // constructeurs/React-like évités en majuscule
}
// imports comptent comme déclarés
for (const n of importNames) declared.add(n)
// paramètres de fonction internes (approx: ceux après const sont OK)

out.push('\n=== VARIABLES (motifs) ---')
fs.writeFileSync('c:/Users/user/Gestionnaire de tâche/_anal.txt', out.join('\n'))
console.log(out.join('\n'))