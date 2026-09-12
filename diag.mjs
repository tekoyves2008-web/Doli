import fs from 'node:fs'
const u=fs.readFileSync('src/modules/ui.js','utf8')
console.log('len',u.length)
for(const k of ['MTASKS_COUNT_ICON','renderTasksCounts','renderTasksTabs','dashCardHtml','renderDashTaskCards','renderTasksSummary','effectivePriority','TASK_AVATAR_ICON','situationInfo']){
  console.log(k, u.indexOf(k))
}
console.log('--- tail ---')
console.log(JSON.stringify(u.slice(-800)))
console.log('--- around dash ---')
const i=u.indexOf('Cartes riches du dashboard')
console.log(JSON.stringify(u.slice(Math.max(0,i-200),i+600)))
