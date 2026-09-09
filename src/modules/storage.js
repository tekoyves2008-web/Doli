// storage.js
// Parle à l'API des réglages : le serveur persiste tout dans SQLite,
// scopé par le compte connecté (le cookie de session part automatiquement
// avec chaque requête, inutile de le gérer ici).

export async function loadSettings() {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Impossible de charger les réglages.')
  return res.json()
}

export async function saveSettings(settings) {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  })
  if (!res.ok) throw new Error("Impossible d'enregistrer les réglages.")
  return res.json()
}
