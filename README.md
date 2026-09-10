## 🛡️ Tout est en place : le bug est réglé ET un garde-fou automatique est installé

### La cause du `http://localhost:5173/?` (réglée)
Deux lignes vestiges dans `src/main.js` référençaient des variables **jamais déclarées** (`dashboardWeeklyGoalEl`, `dashboardAchievementsEl`). Au chargement, `if (dashboardWeeklyGoalEl)` levait une `ReferenceError`, plantait tout le script **avant** l'attachement du listener de connexion, et le formulaire se soumettait de façon native → URL avec `?`.

### La protection installée : `npm run check`
J'ai créé **`check.mjs`** (+ script `check` dans `package.json`). À chaque fois, il vérifie :
1. **Variables non déclarées** → détecte exactement le bug du 09/09.
2. **`getElementById` d'un ID absent du HTML utilisé sans garde** → risque de plantage.
3. Il **échoue (exit 1)** si un risque est trouvé, et n'affiche qu'un **avertissement non bloquant** si l'absence est protégée (comme `dashViewPerf`).

### J'ai prouvé qu'il marche
- État sain → `✅ Aucun risque` (exit 0).
- Bug **injecté volontairement** (`dashboardWeeklyGoalEl`) → `❌ détecté` (exit 1).
- Après retrait → de nouveau propre, build OK (13 modules).

### 🔒 Pour que ça ne revienne jamais
- **Git** te protège : chaque modification est sauvegardée, tu peux revenir en arrière.
- **`npm run check`** détecte ce type de régression automatiquement.

👉 Utilise l'app : **http://localhost:5173/** (le login fonctionne).