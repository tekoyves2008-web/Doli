// test/ecriture-settings.test.js
// Vérifie que les préférences sont RÉELLEMENT écrites en base.
//
// Pourquoi ce test existe : la requête d'insertion des réglages oubliait la
// colonne `prefs`. better-sqlite3 ignore silencieusement un paramètre nommé
// absent de la requête : le PUT renvoyait 200, l'interface affichait
// « enregistré », et les préférences disparaissaient au rechargement. Aucun
// test ne le voyait, parce que les autres tests ne touchaient pas la base.
//
// Le test reproduit la MÊME requête que server/routes/settings.js, sur une
// base temporaire, puis relit et vérifie que la valeur est revenue.
//
// Exécution : npm test   (inclut test/*.test.js)

import { test } from 'node:test'
import assert from 'node:assert/strict'
import Database from 'better-sqlite3'
// Le SQL est IMPORTÉ, pas recopié : ce test protège le code réellement exécuté.
import { UPSERT_SETTINGS_SQL } from '../server/settings-sql.js'

function makeDb() {
  const db = new Database(':memory:')
  db.exec(`
    CREATE TABLE settings (
      user_email TEXT PRIMARY KEY,
      theme TEXT NOT NULL DEFAULT 'dark',
      view_mode TEXT NOT NULL DEFAULT 'list',
      best_streak INTEGER NOT NULL DEFAULT 0,
      weekly_goal INTEGER NOT NULL DEFAULT 10,
      achievement_thresholds TEXT NOT NULL DEFAULT '[10,50]',
      prefs TEXT NOT NULL DEFAULT '{}'
    );
  `)
  return db
}

const upsert = (db) => db.prepare(UPSERT_SETTINGS_SQL)
const getStmt = (db) => db.prepare('SELECT * FROM settings WHERE user_email = ?')

test('la requête d’écriture porte bien la colonne prefs', () => {
  // Garde-fou direct : si quelqu'un retire `prefs` du SQL, ce test le dit
  // avant même que les suivants n'échouent de façon moins lisible.
  assert.match(UPSERT_SETTINGS_SQL, /prefs\)/, 'la colonne prefs doit être dans l’INSERT')
  assert.match(UPSERT_SETTINGS_SQL, /@prefs\)/, 'le paramètre @prefs doit être dans les VALUES')
  assert.match(UPSERT_SETTINGS_SQL, /prefs\s*=\s*excluded\.prefs/, 'le DO UPDATE doit écrire prefs')
})

test('les préférences sont bien écrites à la création de la ligne', () => {
  const db = makeDb()
  upsert(db).run({
    user_email: 'a@test.fr',
    theme: 'light',
    view_mode: 'list',
    best_streak: 0,
    weekly_goal: 10,
    achievement_thresholds: '[10,50]',
    prefs: JSON.stringify({ density: 'compact', contrast: 'high' }),
  })
  const row = getStmt(db).get('a@test.fr')
  assert.deepEqual(JSON.parse(row.prefs), { density: 'compact', contrast: 'high' })
  db.close()
})

test('les préférences sont bien mises à jour sur une ligne existante', () => {
  const db = makeDb()
  const stmt = upsert(db)
  const base = {
    user_email: 'b@test.fr',
    theme: 'dark', view_mode: 'list', best_streak: 0,
    weekly_goal: 10, achievement_thresholds: '[10,50]',
  }
  stmt.run({ ...base, prefs: JSON.stringify({ density: 'comfortable' }) })

  // Deuxième appel : c'est le DO UPDATE qui doit écrire.
  stmt.run({ ...base, theme: 'light', prefs: JSON.stringify({ density: 'compact' }) })

  const row = getStmt(db).get('b@test.fr')
  assert.equal(row.theme, 'light', 'le thème est bien mis à jour')
  assert.equal(JSON.parse(row.prefs).density, 'compact', 'la préférence est bien mise à jour')
  db.close()
})

test('un envoi partiel ne perd pas les autres réglages', () => {
  const db = makeDb()
  const stmt = upsert(db)
  // L'application envoie { prefs } seul quand l'utilisateur change un
  // réglage d'apparence : le thème et l'objectif doivent survivre.
  const current = { theme: 'light', view_mode: 'list', best_streak: 0, weekly_goal: 7, achievement_thresholds: '[5,20]' }
  stmt.run({ user_email: 'c@test.fr', ...current, prefs: JSON.stringify({ density: 'compact' }) })
  stmt.run({ user_email: 'c@test.fr', ...current, prefs: JSON.stringify({ density: 'compact', contrast: 'high' }) })

  const row = getStmt(db).get('c@test.fr')
  assert.equal(row.weekly_goal, 7, 'l’objectif hebdomadaire est intact')
  assert.equal(JSON.parse(row.prefs).contrast, 'high')
  db.close()
})
