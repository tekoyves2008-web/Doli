import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
function mustContain(s,tag){ if(!u.includes(s)){ console.log('MISS '+tag); process.exitCode=1 } else console.log('FOUND '+tag) }
mustContain('const MTASKS_COUNT_ICON','count-icons')
mustContain('export function renderTasksTabs','tabs')
mustContain('export function renderTasksTable','table')
mustContain('export function renderTasksSummary','summary')
console.log('len',u.length)
