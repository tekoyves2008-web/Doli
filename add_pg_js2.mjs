import fs from 'node:fs'
const p1 = fs.readFileSync('pg_js1.txt', 'utf8')
const p2 = fs.readFileSync('pg_js2.txt', 'utf8')
const p3 = fs.readFileSync('pg_js3.txt', 'utf8')
let t = fs.readFileSync('src/modules/ui.js', 'utf8')
const anchor = '// --- Progression : graphique de rpartition du jour ---'
if (!t.includes(anchor)) { console.error('ancre ui introuvable'); process.exit(1) }
t = t.replace(anchor, p1 + p2 + p3 + '\n' + anchor)
fs.writeFileSync('src/modules/ui.js', t)
console.log('ui OK')
