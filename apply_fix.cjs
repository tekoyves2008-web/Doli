const fs = require('fs');
const path = 'c:/Users/user/Gestionnaire de tâche/src/modules/ui.js';
let content = fs.readFileSync(path, 'utf8');

// Remplacer le bouton Continuer
const old1 = `        ? \`<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof">Continuer</button>
           <button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve</button>\``;
const new1 = `        ? \`<button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve</button>\``;

if (content.includes(old1)) {
  content = content.replace(old1, new1);
  console.log('Remplacement 1 OK: Continuer supprimé');
} else {
  console.log('ERREUR: old1 not found');
  const idx = content.indexOf('Continuer');
  if (idx >= 0) console.log('Contexte:', JSON.stringify(content.substring(idx-50, idx+100)));
}

// Remplacer l'affichage En retard
const old2 = '<div class="dtask__situation mtask__situation--${sit.cls}">${sit.text} · ${sit.sub}</div>';
const new2 = '<div class="dtask__situation mtask__situation--${sit.cls}">${sit.text === \'En retard\' || sit.text === \'En retard modéré\' ? \'\' : sit.text} · ${sit.sub}</div>';

if (content.includes(old2)) {
  content = content.replace(old2, new2);
  console.log('Remplacement 2 OK: "En retard" masqué');
} else {
  console.log('ERREUR: old2 not found');
  const idx = content.indexOf('dtask__situation');
  if (idx >= 0) console.log('Contexte:', JSON.stringify(content.substring(idx-20, idx+150)));
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fichier sauvegardé');
