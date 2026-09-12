import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
// ---------- 1. ICONES CARTES ----------
const oldIcons=`const MTASKS_COUNT_ICON = {
  all: \`<svg viewBox="0 0 20 20" width="20" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="12" height="14" rx="2"/><line x1="7" y1="7" x2="13" y2="7"/><line x1="7" y1="10.5" x2="13" y2="10.5"/><line x1="7" y1="14" x2="11" y2="14"/></svg>\`,
  done: \`<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="7,10 9.2,12.2 13.5,7.5"/></svg>\`,
  doing: \`<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polygon points="8.3,7 13.5,10 8.3,13" fill="currentColor" stroke="none"/></svg>\`,
  delayed: \`<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="10,5.8 10,10 12.8,11.6"/></svg>\`,
  todo: \`<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="10" cy="10" r="7.5"/><line x1="7.5" y1="10" x2="7.5" y2="10"/><line x1="12.5" y1="10" x2="12.5" y2="10"/></svg>\`,
}`
if(u.includes(oldIcons)){
  const newIcons=`const MTASKS_COUNT_ICON = {
  all: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3.5" width="14" height="17" rx="2.5"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>\`,
  done: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8.5,12.2 11,14.7 15.8,9.5"/></svg>\`,
  doing: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="10,8.5 16,12 10,15.5" fill="currentColor" stroke="none"/></svg>\`,
  delayed: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15.2,14"/></svg>\`,
  todo: \`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><line x1="9.5" y1="12" x2="9.5" y2="12"/><line x1="14.5" y1="12" x2="14.5" y2="12"/></svg>\`,
}`
  u=u.split(oldIcons).join(newIcons)
  console.log('OK icons')
} else console.log('MISS icons - print snippet:', JSON.stringify(u.slice(u.indexOf('const MTASKS_COUNT_ICON'),u.indexOf('const MTASKS_COUNT_ICON')+600)))
fs.writeFileSync(p,u,'utf8')
