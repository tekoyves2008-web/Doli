import fs from 'fs'
const src = fs.readFileSync('c:/Users/user/Gestionnaire de tâche/src/main.js', 'utf8')

// Retirer tout le code source pour ne garder que la version sans imports/commentaires
const code = src
  .replace(/\/\/.*$/gm, '') // retirer commentaires ligne
  .replace(/\/\*[\s\S]*?\*\//g, '') // retirer commentaires bloc
  .replace(/import\s+\{[^}]*\}\s*from\s*['"][^'"]*['"]\s*;?/g, '') // retirer imports (déclarés séparément)

const declared = new Set()
for (const m of code.matchAll(/\b(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1])
for (const m of code.matchAll(/\b(?:async\s+function|function)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1])
// imports
for (const m of src.matchAll(/import\s+\{[^}]*\}\s+from/g)) {
  for (const n of m[0].matchAll(/([A-Za-z_$][\w$]*)/g)) declared.add(n[1])
}
// paramètres de fonctions (approx) — on ignore car rarement `null`
// variables capturées ou hors-champ

// Identifier les identifiants en position d'appel `ident(` susceptibles d'être non définis
const used = new Set()
for (const m of code.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) used.add(m[1])
// identifiants seuls (non déclarés) hors réservés
const RESERVED = new Set(['return','if','else','for','while','function','new','typeof','delete','in','of','throw','try','catch','finally','switch','case','default','break','continue','var','let','const','class','extends','super','this','do','import','export','yield','await','async','void','instanceof','null','undefined','true','false','get','set','static','from','filters','of'])
const problems = [...used].filter((u) => !declared.has(u) && !RESERVED.has(u)).sort()

fs.writeFileSync('c:/Users/user/Gestionnaire de tâche/_idents.txt', 'DECLARED(n=' + declared.size + ')\nUTILISES_NON_DECLARES:\n' + (problems.length ? problems.join('\n') : '(aucun)'))
console.log('DECLARED', declared.size, 'PROBLEMS', problems.length)