import fs from 'fs';
const path = 'c:/Users/user/Gestionnaire de tâche/src/modules/ui.js';
let content = fs.readFileSync(path, 'utf8');

// La ligne 2269 dans renderTasksTable a été modifiée par erreur
// Elle doit afficher le bouton "Continuer" avec l'icône SVG
// Actuellement (après le mauvais remplacement), elle a perdu l'icône SVG
// Reparaître le bouton complet avec SVG

// Chercher la ligne problématique dans renderTasksTable
const lines = content.split('\r\n');
for (let i = 0; i < lines.length; i++) {
  // Dans renderTasksTable, la ligne 2268-2269 définit actionBtn
  // Après notre modification, elle ressemble à:
  // ? '<button type="button" class="mtask__btn" data-action="provide-proof"><svg .../> Continuer</button>'
  // Elle devrait être:
  // ? '<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof"><svg .../> Continuer</button>'
  
  if (lines[i].includes('actionBtn = task.status === STATUS.DOING') || 
      (lines[i].includes('? \\') && lines[i].includes('Continuer</button>') && !lines[i].includes('mtask__btn--primary'))) {
    // Cette ligne est dans renderTasksTable et a perdu mtask__btn--primary
    console.log('Ligne ' + (i+1) + ' (renderTasksTable) - restauration mtask__btn--primary');
    // La ligne actuelle (après notre script): 
    // ? '<button type="button" class="mtask__btn" data-action="provide-proof">...Continuer</button>'
    // Il faut ajouter mtask__btn--primary
    lines[i] = lines[i].replace(
      /class="mtask__btn" data-action="provide-proof">/,
      'class="mtask__btn mtask__btn--primary" data-action="provide-proof">'
    );
  }
}

content = lines.join('\r\n');
fs.writeFileSync(path, content, 'utf8');
console.log('Restauration terminee');
