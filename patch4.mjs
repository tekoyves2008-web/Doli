import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
let n=0
function rep(oldS,newS,tag){
  if(!u.includes(oldS)){ console.log('MISS '+tag); return }
  u=u.split(oldS).join(newS); n++
  console.log('OK '+tag)
}
// priorites 4 niveaux
rep("const MTASK_PRIORITY_LABEL = { low: 'Basse', medium: 'Normale', high: 'Haute' }",
"const MTASK_PRIORITY_LABEL = { urgent: 'Urgente', high: 'Haute', medium: 'Normale', normal: 'Normale', low: 'Basse' }\nfunction effectivePriority(task) {\n  const pr = (task.priority || 'medium').toLowerCase()\n  if (pr === 'urgent' || pr === 'urgente' || pr === 'critical') return 'urgent'\n  if (pr === 'high' || pr === 'haute' || pr === 'haut') return 'high'\n  if (pr === 'low' || pr === 'basse' || pr === 'bas') return 'low'\n  return 'medium'\n}", 'prio4')
// format heure 10:00 deja fait precedemment ; verifier fmtDayShort reste JJ/MM/AAAA
console.log('fmt check', u.includes('day: \'2-digit\', month: \'2-digit\', year: \'numeric\''))
fs.writeFileSync(p,u,'utf8')
console.log('done',n)
