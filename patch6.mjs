import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
// --- Situation maquette exacte ---
const oldSit=`// Situation de la tâche au moment T : terminée / en retard / à venir / OK.
function situationInfo(task, now) {
  if (task.status === STATUS.DONE) {
    return { cls: 'done', text: 'Terminée', sub: 'Excellente' }
  }
  const due = task.dueDate ? new Date(task.dueDate) : null
  if (due && due.getTime() < now) {
    const ms = now - due.getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    const delay = h > 0 ? \`Retard \${h}h\${String(m).padStart(2, '0')}\` : \`Retard \${m} min\`
    return { cls: 'late', text: 'En retard', sub: delay }
  }
  const start = task.startTime ? new Date(task.startTime) : null
  if (start && start.getTime() > now) {
    return {
      cls: 'soon',
      text: 'À venir',
      sub: \`Commence à \${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\`,
    }
  }
  return { cls: 'ok', text: 'Dans les délais', sub: 'Tout va bien' }
}`
const newSit=`// Situation de la tâche au moment T : textes exacts de la maquette.
function situationInfo(task, now) {
  if (task.status === STATUS.DONE) {
    return { cls: 'done', text: 'Terminée', sub: 'Excellente' }
  }
  const due = task.dueDate ? new Date(task.dueDate) : null
  if (due && due.getTime() < now) {
    const ms = now - due.getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h >= 2) {
      const delay = \`Retard : \${h}h\${String(m).padStart(2, '0')}\`
      return { cls: 'late', text: 'En retard', sub: delay }
    }
    if (h >= 1 || m >= 30) {
      const delay = h > 0 ? \`Retard : \${m + h * 60} min\` : \`Retard : \${m} min\`
      return { cls: 'latemod', text: 'En retard modéré', sub: delay }
    }
    const delay = h > 0 ? \`Retard : \${h}h\${String(m).padStart(2, '0')}\` : \`Retard : \${m} min\`
    return { cls: 'late', text: 'En retard', sub: delay }
  }
  const start = task.startTime ? new Date(task.startTime) : null
  if (start && start.getTime() > now) {
    return {
      cls: 'soon',
      text: 'À venir',
      sub: \`Commence à \${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\`,
    }
  }
  return { cls: 'ok', text: 'Dans les délais', sub: 'Tout va bien' }
}`
if(!u.includes(oldSit)){ console.log('MISS situation bloc - fallback simple'); }
else { u=u.split(oldSit).join(newSit); console.log('OK situation') }
fs.writeFileSync(p,u,'utf8')
console.log('done sit', u.length)
