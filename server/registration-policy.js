// registration-policy.js
// Règles d'inscription, isolées pour être testables et lisibles d'un coup.
//
// Pourquoi un module à part : ces règles étaient (« au pire »)
// @gmail.com uniquement, sans aucune porte d'entrée. Toute personne
// découvrant l'adresse du site pouvait donc créer un compte.
//
// Les fonctions lisent process.env AU MOMENT DE L'APPEL (et non dans des
// const au chargement) : c'est ce qui permet de les tester avec des
// configurations différentes dans un seul processus, sans lancer un
// sous-processus par cas.

import crypto from 'node:crypto'

// Format d'email générique. L'ancienne règle n'acceptait que @gmail.com, ce
// qui excluait la majorité des utilisateurs d'une application partagée.
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

export function isEmailWellFormed(email) {
  return EMAIL_REGEX.test(String(email).trim())
}

export function allowedDomains() {
  return (process.env.EMAIL_DOMAIN_ALLOWLIST || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
}

// Une liste vide signifie « tous les domaines acceptés » : c'est le choix par
// défaut, l'exploitant peut la restreindre quand il le souhaite.
export function isDomainAllowed(email) {
  const list = allowedDomains()
  if (list.length === 0) return true
  const domain = String(email).trim().toLowerCase().split('@')[1]
  return list.includes(domain)
}

// Les inscriptions sont FERMÉES par défaut : c'est la protection la plus
// simple contre quelqu'un qui découvre l'adresse du site.
export function isRegistrationOpen() {
  return process.env.ALLOW_REGISTRATION === 'true'
}

export function requiresInviteCode() {
  return Boolean(process.env.REGISTRATION_SECRET)
}

// Comparaison en temps constant : elle ne révèle pas le code caractère par
// caractère en mesurant le temps de réponse.
export function isInviteCodeValid(provided) {
  const secret = process.env.REGISTRATION_SECRET || ''
  if (!secret) return true
  const a = Buffer.from(String(provided ?? ''))
  const b = Buffer.from(secret)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

export function registrationPolicy() {
  return {
    open: isRegistrationOpen(),
    requiresInvite: requiresInviteCode(),
    allowedDomains: allowedDomains(),
  }
}
