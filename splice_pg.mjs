import fs from 'node:fs'
const a = fs.readFileSync('pg_a.html', 'utf8')
const b = fs.readFileSync('pg_b.html', 'utf8')
const t = fs.readFileSync('index.html', 'utf8')
const s = '<section id="viewProgression"'
const e = '<section id="viewRetards"'
const i = t.indexOf(s)
const j = t.indexOf(e)
if (i < 0 || j < 0 || j <= i) { console.error('bornes introuvables', i, j); process.exit(1) }
const html = t.slice(0, i) + a + b + '\n        ' + t.slice(j)
fs.writeFileSync('index.html', html)
console.log('OK', i, j, html.length)
