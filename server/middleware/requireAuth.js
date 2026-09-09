// requireAuth.js
// Bloque toute route qui l'utilise tant que la requête ne porte pas un
// cookie de session valide et non expiré. Attache l'utilisateur trouvé en
// base à req.user — c'est la SEULE source de vérité pour "qui fait cette
// requête" : jamais un champ envoyé par le frontend.

import db from '../db.js'

const getSessionStmt = db.prepare('SELECT * FROM sessions WHERE session_id = ?')
const deleteSessionStmt = db.prepare('DELETE FROM sessions WHERE session_id = ?')

export function requireAuth(req, res, next) {
  const sessionId = req.cookies?.doli_session
  if (!sessionId) return res.status(401).json({ error: 'Non connecté.' })

  const session = getSessionStmt.get(sessionId)
  if (!session) return res.status(401).json({ error: 'Session invalide.' })

  if (new Date(session.expires_at).getTime() < Date.now()) {
    deleteSessionStmt.run(sessionId)
    return res.status(401).json({ error: 'Session expirée.' })
  }

  req.user = { email: session.user_email, name: session.user_name }
  next()
}
