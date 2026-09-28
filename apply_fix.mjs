import fs from 'fs';
const path = 'c:/Users/user/Gestionnaire de tâche/src/modules/ui.js';
let content = fs.readFileSync(path, 'utf8');

// Remplacer le bouton Continuer (CRLF)
const old1 = `        ? \`<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof">Continuer</button>\r
           <button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve</button>\``;
const new1 = `        ? \`<button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve</button>\``;

if (content.includes(old1)) {
  content = content.replace(old1, new1);
  console.log('Remplacement 1 OK: Continuer supprimé');
} else {
  console.log('ERREUR: old1 not found, recherche directe...');
  // Chercher et remplacer manuellement
  const lines = content.split('\r\n');
  let modified = false;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('Continuer</button>') && lines[i].includes('mtask__btn--primary')) {
      // Cette ligne contient le bouton Continuer
      lines[i] = lines[i].replace(
        /<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof">Continuer<\/button>\r?\n?.*<button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve<\/button>/,
        '<button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve</button>'
      );
      modified = true;
      console.log('Ligne ' + (i+1) + ' modifiée');
    }
  }
  if (modified) {
    content = lines.join('\r\n');
    console.log('Remplacement 1 OK (méthode ligne)');
  }
}

// Remplacer l'affichage En retard
const old2 = '<div class="dtask__situation mtask__situation--${sit.cls}">${sit.text} · ${sit.sub}</div>';
const new2 = '<div class="dtask__situation mtask__situation--${sit.cls}">${sit.text === \'En retard\' || sit.text === \'En retard modéré\' ? \'\' : sit.text} · ${sit.sub}</div>';

if (content.includes(old2)) {
  content = content.replace(old2, new2);
  console.log('Remplacement 2 OK: "En retard" masqué');
} else {
  console.log('ERREUR: old2 not found, recherche directe...');
  const lines = content.split('\r\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('dtask__situation') && lines[i].includes('${sit.text}')) {
      lines[i] = lines[i].replace(
        /\${sit\.text} · \${sit\.sub}/,
        '${sit.text === \'En retard\' || sit.text === \'En retard modéré\' ? \'\' : sit.text} · ${sit.sub}'
      );
      console.log('Ligne ' + (i+1) + ' modifiée (situation)');
    }
  }
  content = lines.join('\r\n');
  console.log('Remplacement 2 OK (méthode ligne)');
}

fs.writeFileSync(path, content, 'utf8');
console.log('Fichier sauvegardé');
