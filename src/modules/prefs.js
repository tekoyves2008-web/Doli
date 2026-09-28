// prefs.js — préférences libres de l'utilisateur.
//
// Tout est stocké dans la colonne `prefs` (un JSON) de la table settings :
// ce module ne fait qu'une chose par réglage, l'appliquer au document via
// des attributs data-*. Les autres modules n'ont donc jamais besoin de
// lire `prefs` eux-mêmes — un seul point d'application, rien à oublier.

import { saveSettings } from './storage.js'

// Valeurs par défaut. Toute clé absente du blob en base retombe ici, donc un
// réglage ajouté plus tard fonctionne sans migration ni colonnes nouvelles.
//
// Volontairement réduit : on n'expose ici que des réglages dont l'effet est
// RÉELLEMENT câblé (prefs.js applique l'attribut, style.css l'exploite).
// Un interrupteur qui ne ferait rien serait pire qu'un réglage absent.
export const DEFAULT_PREFS = {
  // Le thème n'est PAS ici : il vit déjà dans settings.theme (colonne dédiée,
  // avec son bouton dans la sidebar). Deux endroits pour le même réglage
  // finiraient par se contredire — ici on n'applique que du CSS.
  density: 'comfortable', // 'comfortable' | 'compact'
  contrast: 'normal', // 'normal' | 'high'
  // Réglages de rappel. Ils vivaient dans localStorage, donc attachés à UN
  // navigateur : changer d'appareil ou vider les données du navigateur les
  // faisait disparaître. Passés ici, ils sont stockés côté serveur et suivent
  // l'utilisateur.
  reminders: { browser: true, mail: true, sound: true, freq: '2h' },
}

let current = { ...DEFAULT_PREFS }
let saveTimer = null

/** Complète les préférences chargées avec les valeurs par défaut. */
export function withDefaults(prefs) {
  const out = { ...DEFAULT_PREFS }
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
    for (const key of Object.keys(DEFAULT_PREFS)) {
      if (prefs[key] !== undefined) out[key] = prefs[key]
    }
  }
  return out
}

/** Instance courante (lecture seule côté appelant). */
export function getPrefs() {
  return { ...current }
}

/**
 * Applique les préférences au document. C'est le SEUL point d'application :
 * tout passe par des attributs data-* sur <html>, que style.css interprète.
 * Le thème n'en fait pas partie (voir DEFAULT_PREFS).
 */
export function applyPrefs(prefs) {
  current = withDefaults(prefs)
  const root = document.documentElement
  root.dataset.density = current.density
  root.dataset.contrast = current.contrast
}

/**
 * Enregistre une modification. La sauvegarde est différée (400 ms) : ni un
 * curseur ni une bascule n'envoient une requête par geste.
 *
 * On n'envoie QUE `prefs` : la route serveur fusionne clé par clé et préserve
 * les autres réglages (theme, weeklyGoal…), donc cette écriture ne peut pas
 * écraser ceux que l'application gère par ailleurs.
 */
export async function updatePrefs(patch) {
  current = { ...current, ...patch }
  applyPrefs(current)
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveSettings({ prefs: { ...current } }).catch(() => {})
  }, 400)
  return { ...current }
}

/** Remet toutes les préférences à leur valeur par défaut. */
export function resetPrefs() {
  return updatePrefs({ ...DEFAULT_PREFS })
}
