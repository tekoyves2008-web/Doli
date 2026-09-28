// test-migration-prefs.mjs — vérifie la migration `prefs` SANS toucher aux
// données réelles. Lancer : node test-migration-prefs.mjs
//
//  1. Ouvre __saves__/doli.sqlite en LECTURE SEULE : prouve que la sauvegarde
//     est exploitable et affiche l'état AVANT migration.
//  2. Recrée un schéma vierge dans le dossier temporaire, applique la même
//     migration, puis la réapplique : prouve qu'elle est idempotente.

import Database from 'better-sqlite3'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs'

const cols = (db, table) => db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name)
const ok = (m) => console.log('  OK  ' + m)
const ko = (m) => { console.log('  KO  ' + m); process.exitCode = 1 }

// --- 1. La sauvegarde -------------------------------------------------
const backup = path.join(process.cwd(), '__saves__', 'doli.sqlite')
console.log('\n[1] Sauvegarde : ' + backup)
if (!fs.existsSync(backup)) {
  console.log('  KO  fichier absent')
  process.exit(1)
}
const bdb = new Database(backup, { readonly: true, fileMustExist: true })
const tables = bdb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((t) => t.name)
ok('tables : ' + tables.join(', '))
ok('colonnes settings AVANT : ' + cols(bdb, 'settings').join(', '))
if (tables.includes('tasks')) {
  const n = bdb.prepare('SELECT COUNT(*) c FROM tasks').get().c
  ok('tâches dans la sauvegarde : ' + n)
  const done = bdb.prepare("SELECT COUNT(*) c FROM tasks WHERE status='done'").get().c
  ok('dont terminées : ' + done)
}
if (tables.includes('settings')) {
  const n = bdb.prepare('SELECT COUNT(*) c FROM settings').get().c
  ok('lignes settings : ' + n)
  const before = bdb.prepare('SELECT * FROM settings LIMIT 1').get()
  if (before) ok('échantillon : ' + JSON.stringify(before).slice(0, 120))
}
bdb.close()

// --- 2. Migration sur un schéma vierge -------------------------------
console.log('\n[2] Migration sur une base neuve')
const tmp = path.join(os.tmpdir(), 'doli-test-migration.sqlite')
for (const f of [tmp, tmp + '-wal', tmp + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f)
const db = new Database(tmp)
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE settings (
  user_email TEXT PRIMARY KEY, theme TEXT NOT NULL DEFAULT 'dark',
  view_mode TEXT NOT NULL DEFAULT 'list', best_streak INTEGER NOT NULL DEFAULT 0,
  weekly_goal INTEGER NOT NULL DEFAULT 10,
  achievement_thresholds TEXT NOT NULL DEFAULT '[10,50]');`)
db.prepare('INSERT INTO settings (user_email) VALUES (?)').run('avant@moi.fr')
ok('colonne prefs ABSENTE avant migration : ' + !cols(db, 'settings').includes('prefs'))

// Migration — identique à server/db.js
const c = db.prepare('PRAGMA table_info(settings)').all().map((x) => x.name)
if (!c.includes('prefs')) db.exec("ALTER TABLE settings ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}'")
ok('colonne prefs présente après migration : ' + cols(db, 'settings').includes('prefs'))

// Idempotence : on la rejoue, elle doit être sans effet
const c2 = db.prepare('PRAGMA table_info(settings)').all().map((x) => x.name)
if (!c2.includes('prefs')) db.exec("ALTER TABLE settings ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}'")
ok('migration rejouée sans erreur')
const row = db.prepare('SELECT * FROM settings WHERE user_email = ?').get('avant@moi.fr')
ok('donnée préexistante conservée : ' + JSON.stringify(row))
db.close()
for (const f of [tmp, tmp + '-wal', tmp + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f)

console.log('\n' + (process.exitCode ? '=> ECHEC' : '=> MIGRATION SANS RISQUE'))
