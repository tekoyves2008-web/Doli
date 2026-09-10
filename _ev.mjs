import fs from 'fs'
const lines = fs.readFileSync('c:/Users/user/Gestionnaire de tâche/src/main.js', 'utf8').split('\n')
const out = []
lines.forEach((l, i) => {
  const t = l.trim()
  if (t.includes('addEventListener') && !t.includes('onEl(')) {
    out.push((i + 1) + ': ' + t)
  }
})
fs.writeFileSync('c:/Users/user/Gestionnaire de tâche/_ev.txt', out.join('\n'))