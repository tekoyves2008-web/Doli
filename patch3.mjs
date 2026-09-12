import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
function rep(oldS,newS,tag){
  if(!u.includes(oldS)){ console.log('MISS '+tag); return }
  u=u.replace(oldS,newS)
  console.log('OK '+tag)
}
// --- 1. icones cartes comptage : style maquette (document bleu, check vert, play orange, horloge rouge, pause grise)
rep("all: `<svg viewBox=\"0 0 20 20\" width=\"18\" height=\"18\"",
"all: `<svg viewBox=\"0 0 20 20\" width=\"20\" height=\"20\"", 'icons-size')
// --- 2. Priorites : 4 libelles maquette
rep("const MTASK_PRIORITY_LABEL = { low: 'Basse', medium: 'Moyenne', high: 'Haute' }",
"const MTASK_PRIORITY_LABEL = { urgent: 'Urgente', high: 'Haute', medium: 'Normale', normal: 'Normale', low: 'Basse' }", 'prio-label')
// --- 3. kind : principale si urgent/high sinon secondaire
rep("return task.priority === 'high' ? 'Tâche principale' : 'Tâche secondaire'",
"return task.priority === 'high' || task.priority === 'urgent' ? 'Tâche principale' : 'Tâche secondaire'", 'kind')
// --- 4. fmtTimeShort avec : et 00
rep("return `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`",
"return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`", 'hm')
fs.writeFileSync(p,u,'utf8')
console.log('ui patch A done',u.length)
