import fs from 'node:fs'
const p='index.html'
let h=fs.readFileSync(p,'utf8')
if(!h.includes('fonts.googleapis.com')){
  h=h.replace('<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />',
  '<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n    <link rel=\"preconnect\" href=\"https://fonts.googleapis.com\" />\n    <link rel=\"preconnect\" href=\"https://fonts.gstatic.com\" crossorigin />\n    <link href=\"https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap\" rel=\"stylesheet\" />')
  fs.writeFileSync(p,h,'utf8')
  console.log('font link added')
} else console.log('font already present')
