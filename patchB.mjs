import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
const start=u.indexOf('// Avatar rond coloré de la ligne')
const end=u.indexOf('// Panneau latéral « Résumé de la journée »')
console.log('range',start,end)
if(start<0||end<0){ console.log('anchors missing'); process.exit(1) }
const block=`// Avatar rond coloré de la ligne (maquette) : icône selon priorité / statut.
const TASK_AVATAR_ICON = {
  urgent: \`<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="12" height="14" rx="2"/><line x1="7" y1="7.5" x2="13" y2="7.5"/><line x1="7" y1="11" x2="13" y2="11"/><line x1="7" y1="14" x2="11" y2="14"/></svg>\`,
  high: \`<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 15.5 5 9.5 11.5 6 13.2 3.6 15.5 5.6 13 9.5z"/><line x1="4.5" y1="17" x2="9.5" y2="17"/></svg>\`,
  medium: \`<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><polyline points="4.5,10.5 8,14 15.5,6"/></svg>\`,
  low: \`<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="4.5" width="13" height="11" rx="2"/><line x1="3.5" y1="8" x2="16.5" y2="8"/><line x1="6.5" y1="3" x2="6.5" y2="6"/><line x1="13.5" y1="3" x2="13.5" y2="6"/></svg>\`,
}

const TASK_ROW_ACTION_ICON = {
  play: \`<svg viewBox="0 0 20 20" width="11" height="11" fill="currentColor" aria-hidden="true"><polygon points="6,4 16,10 6,16"/></svg>\`,
  eye: \`<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 10C4.2 6.9 6.9 5 10 5s5.8 1.9 7.5 5c-1.7 3.1-4.4 5-7.5 5S4.2 13.1 2.5 10z"/><circle cx="10" cy="10" r="2.2"/></svg>\`,
}

// « 10:00 » pour la période prévue des lignes.
function fmtTimeShort(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// « 03/09/2025 » sous la période prévue des lignes.
function fmtDayShort(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function taskKindLabel(task) {
  return effectivePriority(task) === 'low' ? 'Tâche secondaire' : 'Tâche principale'
}

// Heure courte « 8h05 » pour les libellés « Prévu : ... » des cartes.
function fmtHour(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return \`\${d.getHours()}h\${String(d.getMinutes()).padStart(2, '0')}\`
}

`
u=u.slice(0,start)+block+u.slice(end)
fs.writeFileSync(p,u,'utf8')
console.log('part avatars done',u.length)
