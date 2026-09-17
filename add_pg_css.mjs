import fs from 'node:fs'
const css1 = fs.readFileSync('pg_css1.txt', 'utf8')
const css2 = fs.readFileSync('pg_css2.txt', 'utf8')
const css3 = fs.readFileSync('pg_css3.txt', 'utf8')
const pgCss = css1 + css2 + css3
let t = fs.readFileSync('src/style.css', 'utf8')
const marker = '/* ===== Maquette Retards'
if (!t.includes(marker)) { console.error('marqueur retards introuvable'); process.exit(1) }
t = t.replace(marker, pgCss + '\n' + marker)
fs.writeFileSync('src/style.css', t)
console.log('CSS OK', pgCss.length, t.length)
