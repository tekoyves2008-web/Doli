// settings-sql.js
// Requête d'écriture de la ligne de réglages, extraite du fichier de route.
//
// Pourquoi un module à part : cette requête oubliait un jour la colonne
// `prefs` (dans l'INSERT et dans le DO UPDATE). better-sqlite3 ignore
// silencieusement un paramètre nommé absent de la requête — donc le PUT
// renvoyait 200, l'interface affichait « enregistré », et les préférences
// disparaissaient au rechargement. Aucun test ne le voyait, car le test
// reproduisait sa PROPRE copie du SQL : les deux avaient pu diverger.
//
// En isolant la requête ici, le test l'importe au lieu de la recopier :
// il protège réellement le code exécuté en production.

export const UPSERT_SETTINGS_SQL = `
  INSERT INTO settings (user_email, theme, view_mode, best_streak, weekly_goal, achievement_thresholds, prefs)
  VALUES (@user_email, @theme, @view_mode, @best_streak, @weekly_goal, @achievement_thresholds, @prefs)
  ON CONFLICT(user_email) DO UPDATE SET
    theme = excluded.theme,
    view_mode = excluded.view_mode,
    best_streak = excluded.best_streak,
    weekly_goal = excluded.weekly_goal,
    achievement_thresholds = excluded.achievement_thresholds,
    prefs = excluded.prefs
`
