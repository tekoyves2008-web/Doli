// theme.js
// Applique le thème (sombre / clair) au document. Le principe : on pose un
// attribut data-theme sur <html>, et c'est le CSS (style.css) qui réagit à
// cet attribut pour changer toutes les couleurs via des variables CSS. Ce
// module ne connaît aucune couleur et ne persiste rien lui-même — la
// persistance (via l'API des réglages) reste gérée par main.js, qui est
// déjà seul propriétaire de l'objet `settings` en mémoire.

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}
