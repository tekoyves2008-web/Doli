// auth.js
// Comptes propres à Doli (email @gmail.com + mot de passe Doli), vérifiés
// côté serveur. getSession() ne fait jamais confiance à une donnée locale :
// elle demande toujours au serveur qui est réellement connecté (cookie de
// session httpOnly).

async function parseErrorOrThrow(res, fallback) {
  const body = await res.json().catch(() => ({}))
  throw new Error(body.error || fallback)
}

export async function getSession() {
  const res = await fetch('/api/auth/me')
  if (!res.ok) return null
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

export async function register({ name, email, password, confirmPassword }) {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email, password, confirmPassword }),
  })
  if (!res.ok) await parseErrorOrThrow(res, 'Inscription refusée.')
  return res.json()
}

export async function signOut() {
  await fetch('/api/auth/logout', { method: 'POST' })
}
