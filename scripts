import fs from 'node:fs'
const cssPath = 'src/style.css'
let css = fs.readFileSync(cssPath, 'utf8')
// 1. Police globale + accent bleu maquette en theme clair
css = css.replace(":root {\n  --font: system-ui, 'Segoe UI', Roboto, sans-serif;", ":root {\n  --font: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;")
css = css.replace('--accent: #34518f;', '--accent: #2563eb;')
css = css.replace('--bg: #f4f5f7;', '--bg: #f5f7fb;')
css = css.replace('--border: #e1e4ea;', '--border: #e6eaf1;')
css = css.replace('--text-muted: #626c7d;', '--text-muted: #6b7689;')
if (!css.includes('--task-track')) {
  css = css.replace('  --task-bg: #fafbfc;', "  --task-bg: #fafbfc;\n  --task-track: #e9edf4;\n  --chip-bg: #f1f5f9;")
}
fs.writeFileSync(cssPath, css, 'utf8')
console.log('step1 ok', css.length)
