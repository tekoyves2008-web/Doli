import fs from 'fs'
const base = 'c:/Users/user/Gestionnaire de tâche/'
const s = fs.readFileSync(base + 'src/main.js', 'utf8')
const ids = [...new Set([...s.matchAll(/getElementById\('([^']+)'\)/g)].map((m) => m[1]))].sort()
const h = fs.readFileSync(base + 'index.html', 'utf8')
const hid = new Set([...h.matchAll(/id="([^"]+)"/g)].map((m) => m[1]))
const missing = ids.filter((id) => !hid.has(id))
const out = ['=== IDS main.js absents de index.html ===\n']
out.push(missing.length ? missing.join('\n') : '(aucun)')
out.push('\n=== Tous les getElementById de main.js ===\n' + ids.join('\n'))
fs.writeFileSync(base + '_diff.txt', out.join('\n'))