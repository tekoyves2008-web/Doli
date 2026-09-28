// escape.js
// UN SEUL point d'échappement HTML pour toute l'application.
//
// Pourquoi un module dédié : la même fonction existait en trois copies
// (ui.js, retards.js, preuves.js) et une quatrième version approximative en
// main.js qui n'échappait que le « < ». Quatre règles de protection
// différentes pour le même problème : c'est ainsi qu'on finit par laisser
// passer une injection un jour. Ici, il n'y a plus qu'une règle.
//
// Méthode volontairement SANS DOM (un simple remplacement de caractères) :
// elle fonctionne aussi bien dans Node, donc les tests peuvent l'exécuter.

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Échappe le texte destiné à être injecté dans du HTML via innerHTML.
 * Les 5 caractères significatifs sont traités, dans l'ordre : l'esperluette
 * en premier, sinon elle serait ré-échappée par les remplacements suivants.
 */
export function escapeHtml(text) {
  if (text === null || text === undefined) return ''
  return String(text).replace(/[&<>"']/g, (c) => HTML_ENTITIES[c])
}
