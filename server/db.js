// db.js
// Seul module du backend qui parle directement à SQLite (via better-sqlite3,
// synchrone — pas besoin d'await pour lire/écrire). Crée les tables au
// démarrage si elles n'existent pas encore.

import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// DB_PATH permet de viser un autre fichier que celui du dépôt (tests,
// sauvegardes, déploiement). Sans cette variable, le comportement est
// exactement celui d'avant : server/doli.sqlite.
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'doli.sqlite'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    due_date TEXT,
    start_time TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT,
    completed_at TEXT,
    started_at TEXT,
    start_notified INTEGER NOT NULL DEFAULT 0,
    due_notified INTEGER NOT NULL DEFAULT 0,
    remind_start_5 INTEGER NOT NULL DEFAULT 0,
    remind_start_2 INTEGER NOT NULL DEFAULT 0,
    remind_due_5 INTEGER NOT NULL DEFAULT 0,
    remind_due_2 INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user_email ON tasks(user_email);

  -- Preuves d'exécution : chaque clique sur « Fournir une preuve » d'une tâche
  -- en cours enregistre un horodatage. C'est la dernière preuve fournie qui
  -- sert de « temps réel » dans le calcul du taux d'avancement temporel.
  CREATE TABLE IF NOT EXISTS proofs (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    user_email TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_proofs_task_created ON proofs(task_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_proofs_user_created ON proofs(user_email, created_at);

  CREATE TABLE IF NOT EXISTS settings (
    user_email TEXT PRIMARY KEY,
    theme TEXT NOT NULL DEFAULT 'dark',
    view_mode TEXT NOT NULL DEFAULT 'list',
    best_streak INTEGER NOT NULL DEFAULT 0,
    weekly_goal INTEGER NOT NULL DEFAULT 10,
    achievement_thresholds TEXT NOT NULL DEFAULT '[10,50]'
  );

  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_email TEXT NOT NULL,
    user_name TEXT,
    expires_at TEXT NOT NULL
  );

  -- Comptes Doli (email + mot de passe propre à l'app, jamais le vrai mot
  -- de passe Google — voir server/routes/auth.js pour le hachage).
  CREATE TABLE IF NOT EXISTS users (
    email TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`)

// Migration pour les bases existantes : la colonne started_at (heure réelle
// de début d'une tâche) a été ajoutée après la première version du schéma.
const taskColumns = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name)
if (!taskColumns.includes('started_at')) {
  db.exec('ALTER TABLE tasks ADD COLUMN started_at TEXT')
}

// Migration pour les bases existantes : les preuves peuvent désormais porter
// un vrai fichier (nom + type + taille + contenu base64), importé depuis le
// bouton « Ajouter une preuve » (explorateur / appareil photo).
const proofColumns = db.prepare('PRAGMA table_info(proofs)').all().map((c) => c.name)
for (const [col, def] of [['file_name', 'TEXT'], ['mime_type', 'TEXT'], ['size_bytes', 'INTEGER'], ['data_base64', 'TEXT']]) {
  if (!proofColumns.includes(col)) db.exec(`ALTER TABLE proofs ADD COLUMN ${col} ${def}`)
}

// Migration pour les bases existantes : les préférences libres de
// l'utilisateur sont stockées en JSON dans UNE seule colonne. On préfère un
// blob à une colonne par réglage : une seule migration, puis on peut ajouter
// autant d'options que nécessaire sans jamais retoucher le schéma.
const settingsCols = db.prepare('PRAGMA table_info(settings)').all().map((c) => c.name)
if (!settingsCols.includes('prefs')) {
  db.exec("ALTER TABLE settings ADD COLUMN prefs TEXT NOT NULL DEFAULT '{}'")
}

export default db
