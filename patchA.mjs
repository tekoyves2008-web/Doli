import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
const start=u.indexOf('const MTASKS_COUNT_ICON')
const end=u.indexOf('// Panneau latéral « Résumé de la journée »')
console.log('range',start,end)
if(start<0||end<0){ console.log('anchors missing'); process.exit(1) }
const block=`const MTASKS_COUNT_ICON = {
  all: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>\`,
  done: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5,12.2 11,14.7 15.8,9.5"/></svg>\`,
  doing: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="10,8.5 16,12 10,15.5" fill="currentColor" stroke="none"/></svg>\`,
  delayed: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.2,14"/></svg>\`,
  todo: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="9.5" y1="12" x2="9.5" y2="12"/><line x1="14.5" y1="12" x2="14.5" y2="12"/></svg>\`,
}
export function renderTasksCounts(el, counts, activeFilter) {
  if (!el) return
  const pct = (n) => (counts.all === 0 ? 0 : Math.round((n / counts.all) * 100))
  const card = (key, statusClass, label, count) => \`
    <button type="button" class="mtasks2-count mtasks2-count--\${statusClass} \${activeFilter === key ? 'is-active' : ''}" data-count-key="\${key}">
      <span class="mtasks2-count__top"><span class="mtasks2-count__label">\${label}</span><span class="mtasks2-count__icon">\${MTASKS_COUNT_ICON[key]}</span></span>
      <span class="mtasks2-count__num">\${count}</span>
      <span class="mtasks2-count__pct">\${pct(count)}% du total</span>
    </button>\`
  el.innerHTML = \`
    \${card('all', 'total', 'Toutes les tâches', counts.all)}
    \${card('done', 'done', 'Terminées', counts.done)}
    \${card('doing', 'doing', 'En cours', counts.doing)}
    \${card('delayed', 'late', 'En retard', counts.delayed)}
    \${card('todo', 'todo', 'Non exécutées', counts.todo)}\`
}

// Onglets de filtres façon maquette : pastilles avec compteur.
export function renderTasksTabs(el, counts, activeFilter) {
  if (!el) return
  const tab = (key, label, count) => \`
    <button type="button" role="tab" aria-selected="\${activeFilter === key ? 'true' : 'false'}" class="mtasks2-tab \${activeFilter === key ? 'is-active' : ''}" data-status-tab="\${key}">\${label} <span class="mtasks2-tab__count">(\${count})</span></button>\`
  el.innerHTML = \`
    \${tab('all', 'Toutes', counts.all)}
    \${tab('doing', 'En cours', counts.doing)}
    \${tab('done', 'Terminées', counts.done)}
    \${tab('delayed', 'En retard', counts.delayed)}
    \${tab('todo', 'Non exécutées', counts.todo)}\`
}

`
u=u.slice(0,start)+block+u.slice(end)
fs.writeFileSync(p,u,'utf8')
console.log('part1 done',u.length)
