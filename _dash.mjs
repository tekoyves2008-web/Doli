import fs from 'fs'
const lines = fs.readFileSync('c:/Users/user/Gestionnaire de tâche/src/main.js', 'utf8').split('\n')
const out = []
lines.forEach((l, i) => {
  if (/[dD]ashboard[A-Za-z]*/.test(l)) {
    out.push((i + 1) + ': ' + l.trim())
  }
})
fs.writeFileSync('c:/Users/user/Gestionnaire de tâche/_dash.txt', out.join('\n'))