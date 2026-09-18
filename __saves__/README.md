# Sauvegardes Gestionnaire de tâche

## Date de création
2026-09-18

## Fichiers sauvegardés
Ce répertoire contient des copies sûres des fichiers modifiés :
- `index.html` — copie du fichier principal
- `style.css` — copie du fichier CSS dans `src/`

## Comment restaurer
1. Copier `__saves__/index.html` → `index.html`
2. Copier `__saves__/style.css` → `src/style.css`
3. Relancer `npm run dev` (ou `npm run build`)

## Nettoyage
Vous pouvez supprimer ce répertoire `__saves__` quand vous avez terminé.
Il peut être ajouté à `.gitignore` si vous ne voulez pas le committer.
