// settingsView.js — construit la rubrique Paramètres.
//
// L'interface est décrite par un schéma (SEGMENTS) et fabriquée avec
// createElement : aucune valeur n'est concaténée dans du HTML. Ajouter un
// réglage = ajouter une ligne au schéma, sans toucher au rendu.
//
// Chaque changement appelle updatePrefs(), qui applique tout de suite puis
// sauvegarde côté serveur. Les contrôles se resynchronisent après coup, donc
// une réinitialisation reste cohérente.

import { getPrefs, updatePrefs, resetPrefs } from './prefs.js'

const SEGMENTS = [
  {
    key: 'density',
    label: 'Densité',
    hint: 'Resserre les listes pour en afficher davantage.',
    options: [
      { value: 'comfortable', label: 'Confortable' },
      { value: 'compact', label: 'Compacte' },
    ],
  },
  {
    key: 'contrast',
    label: 'Contraste',
    hint: 'Renforce les bordures et le texte secondaire.',
    options: [
      { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'Élevé' },
    ],
  },
]

function h(tag, props = {}, children = []) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null) continue
    if (k === 'class') el.className = v
    else if (k === 'text') el.textContent = v
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v)
    else el.setAttribute(k, v)
  }
  for (const c of children) if (c) el.append(c)
  return el
}

function labelBlock(cfg) {
  const txt = h('div', { class: 'st__txt' }, [h('span', { class: 'st__label', text: cfg.label })])
  if (cfg.hint) txt.append(h('span', { class: 'st__hint', text: cfg.hint }))
  return txt
}

function buildSegment(cfg, syncs) {
  const group = h('div', { class: 'seg', role: 'group', 'aria-label': cfg.label })
  // La valeur d'origine est conservée telle quelle : on ne convertit rien,
  // donc aucun risque de transformer 'compact' en NaN.
  cfg.options.forEach((o) => {
    const btn = h('button', {
      type: 'button',
      class: 'seg__btn',
      'data-value': String(o.value),
      'aria-pressed': 'false',
      onclick: () => {
        updatePrefs({ [cfg.key]: o.value })
        syncs.forEach((f) => f())
      },
    }, [h('span', { text: o.label })])
    group.append(btn)
  })
  const sync = () => {
    const cur = String(getPrefs()[cfg.key])
    for (const btn of group.children) {
      const on = btn.dataset.value === cur
      btn.classList.toggle('is-on', on)
      btn.setAttribute('aria-pressed', String(on))
    }
  }
  return { el: h('div', { class: 'st__row' }, [labelBlock(cfg), group]), sync }
}

// Aucun interrupteur pour l'instant : chaque réglage exposé doit avoir un effet
// réellement câblé dans style.css. Le composant d'interrupteur (.sw) reviendra
// avec le premier réglage à bascule.

// --- Carte « Objectifs » ----------------------------------------------------
// Ces deux réglages vivent dans `settings` (colonne dédiée en base), pas dans
// `prefs`. Ils étaient modifiables via une fenêtre ouverte depuis le Dashboard,
// mais les boutons qui l'ouvraient n'étaient plus rendus : les réglages sont
// donc devenus INATTEIGNABLES. On les réexpose ici, au même endroit que la
// densité et le contraste, par l'intermédiaire des rappels fournis par main.js.
function buildNumber(label, value, min, onCommit) {
  const input = h('input', {
    type: 'number',
    class: 'st-num',
    min: String(min),
    step: '1',
    value: String(value),
    onchange: (e) => {
      const n = parseInt(e.target.value, 10)
      if (!Number.isFinite(n) || n < min) {
        e.target.value = String(value)   // valeur refusée : on restaure
        return
      }
      onCommit(n)
    },
  })
  return h('div', { class: 'st-numfield' }, [
    h('label', { class: 'st-numfield__label', text: label }),
    input,
  ])
}

function buildGoalsCard(api) {
  const s = api.getSettings()
  const rows = [
    h('div', { class: 'st__row st__row--stack' }, [
      h('div', { class: 'st__txt' }, [
        h('span', { class: 'st__label', text: 'Objectif hebdomadaire' }),
        h('span', { class: 'st__hint', text: 'Nombre de tâches que vous voulez terminer chaque semaine.' }),
      ]),
      h('div', { class: 'st-numfields' }, [
        buildNumber('Tâches par semaine', s.weeklyGoal, 1, (n) => api.save({ weeklyGoal: n })),
      ]),
    ]),
    h('div', { class: 'st__row st__row--stack' }, [
      h('div', { class: 'st__txt' }, [
        h('span', { class: 'st__label', text: 'Paliers de déblocage' }),
        h('span', { class: 'st__hint', text: 'Les deux seuils qui débloquent vos badges de progression.' }),
      ]),
      h('div', { class: 'st-numfields' }, [
        buildNumber('Premier palier', s.achievementThresholds[0], 1, (n) => api.save({ achievementThresholds: [n, api.getSettings().achievementThresholds[1]] })),
        buildNumber('Deuxième palier', s.achievementThresholds[1], 1, (n) => api.save({ achievementThresholds: [api.getSettings().achievementThresholds[0], n] })),
      ]),
    ]),
  ]
  return card(svg(ICO_GOALS), 'Objectifs', 'Ces valeurs servent au calcul de vos statistiques.', rows)
}

function card(icon, title, desc, rows) {
  const head = h('div', { class: 'st-card__head' }, [
    h('span', { class: 'st-card__ico', 'aria-hidden': 'true' }, [icon]),
    h('div', { class: 'st-card__headtext' }, [
      h('h3', { class: 'st-card__title', text: title }),
      desc ? h('p', { class: 'st-card__desc', text: desc }) : null,
    ]),
  ])
  return h('section', { class: 'st-card' }, [head, h('div', { class: 'st-card__rows' }, rows)])
}

// Icônes 24x24, stroke 2 : même convention que les en-têtes des autres rubriques.
const svg = (paths) => {
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  el.setAttribute('viewBox', '0 0 24 24')
  el.setAttribute('width', '17')
  el.setAttribute('height', '17')
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', 'currentColor')
  el.setAttribute('stroke-width', '2')
  el.setAttribute('stroke-linecap', 'round')
  el.setAttribute('stroke-linejoin', 'round')
  for (const d of paths) {
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    p.setAttribute('d', d)
    el.append(p)
  }
  return el
}

const ICO_APPEARANCE = ['M4 7h16', 'M4 12h10', 'M4 17h6']
const ICO_THEME = ['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 3v18']
const ICO_GOALS = ['M12 21a9 9 0 100-18 9 9 0 000 18z', 'M12 17a5 5 0 100-10 5 5 0 000 10z', 'M12 13a1 1 0 100-2 1 1 0 000 2z']
const ICO_RESET = ['M3.5 12a8.5 8.5 0 108.5-8.5', 'M3.5 4.5V9H8']

/**
 * (Re)construit la rubrique. Appelée à chaque entrée dans la vue : le DOM est
 * petit, et surtout il repart de l'état réel des préférences — impossible
 * d'afficher un réglage périmé.
 */
export function renderSettings(root, api) {
  if (!root) return
  const syncs = []
  const rows = []
  for (const cfg of SEGMENTS) {
    const { el, sync } = buildSegment(cfg, syncs)
    syncs.push(sync)
    rows.push(el)
  }

  // --- Bouton de réinitialisation -------------------------------------------
  // Un vrai composant, pas un <button> nu : la classe « .btn » n'existe pas
  // dans ce projet (tout est en BEM), d'où .st-reset.
  const btnLabel = h('span', { class: 'st-reset__label', text: 'Rétablir les réglages par défaut' })
  const btnIcon = h('span', { class: 'st-reset__ico', 'aria-hidden': 'true' }, [svg(ICO_RESET)])
  const btn = h('button', { type: 'button', class: 'st-reset' }, [btnIcon, btnLabel])
  const status = h('span', { class: 'st-saved', role: 'status' })

  btn.addEventListener('click', async () => {
    if (btn.disabled) return
    btn.disabled = true
    status.textContent = ''
    status.classList.add('is-busy')
    status.textContent = 'Enregistrement…'
    try {
      await resetPrefs()
      syncs.forEach((f) => f())
      // Retour visible : sans lui, rien ne distingue le clic d'un bouton mort.
      status.classList.remove('is-busy')
      status.classList.add('is-ok')
      status.textContent = 'Réglages rétablis'
      setTimeout(() => {
        status.classList.remove('is-ok')
        status.textContent = 'Enregistré automatiquement'
      }, 2200)
    } finally {
      btn.disabled = false
    }
  })

  root.textContent = ''
  root.append(
    card(svg(ICO_APPEARANCE), 'Apparence', 'Ces réglages s’appliquent immédiatement et sont enregistrés pour vous.', rows),
    api ? buildGoalsCard(api) : null,
    card(svg(ICO_THEME), 'Thème', null, [
      h('p', { class: 'st-note', text: 'Le thème clair ou sombre se change avec le bouton situé en bas de la barre latérale.' }),
    ]),
    h('div', { class: 'st-actions' }, [btn, status]),
  )
  // On remplit les contrôles depuis l'état réel, une fois le DOM en place.
  syncs.forEach((f) => f())
}
