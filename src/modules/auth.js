// auth.js
// Comptes propres à Doli (email + mot de passe), vérifiés côté serveur.
// getSession() ne fait jamais confiance à une donnée locale : elle demande
// toujours au serveur qui est réellement connecté (cookie de session
// httpOnly).
//
// Le domaine de l'email n'est plus imposé à @gmail.com : la règle est
// désormais pilotée par le serveur (EMAIL_DOMAIN_ALLOWLIST), qui peut aussi
// n'accepter aucun domaine particulier.

async function parseErrorOrThrow(res, fallback) {
  const body = await res.json().catch(() => ({}))
  throw new Error(body.error || fallback)
}

export async function getSession() {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
  return res.json()
}

// Les inscriptions sont fermées par défaut côté serveur. Cette fonction
// permet à l'interface d'adapter son affichage au lieu de proposer un bouton
// qui échouerait systématiquement.
export async function getRegistrationPolicy() {
  const res = await fetch('/api/auth/registration')
  if (!res.ok) throw new Error('Configuration des inscriptions indisponible.')
  return res.json()
}

export async function login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) await parseErrorOrThrow(res, 'Connexion refusée.')
  return res.json()
}

export async function register({ name, email, password, confirmPassword, inviteCode = '' }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, confirmPassword, inviteCode }),
  })
  if (!res.ok) await parseErrorOrThrow(res, 'Inscription refusée.')
  return res.json()
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
}
