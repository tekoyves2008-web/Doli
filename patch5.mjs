import fs from 'node:fs'
// ===== ui.js : refonte fidèle maquette Mes tâches =====
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
let ops=[]
function rep(oldS,newS,tag){
  if(!u.includes(oldS)){ console.log('MISS '+tag); ops.push('MISS '+tag); return }
  u=u.split(oldS).join(newS)
  console.log('OK '+tag); ops.push('OK '+tag)
}

// 1) Icônes des 5 cartes de comptage (style maquette : pastille ronde, pictogramme fin)
rep(`const MTASKS_COUNT_ICON = {`,
`const MTASKS_COUNT_ICON = { /*__PATCHED__*/`,
'anchor-check')
console.log('has patch marker?', u.includes('/*__PATCHED__*/'))
fs.writeFileSync(p,u,'utf8')
