// loginAmbience.js — champ de logos en arrière-plan de l'écran de connexion.
//
// Principe : le semis est dessiné UNE seule fois (positions figées), puis
// seules deux variables CSS sont animées — le déplacement lié au curseur
// (--dx / --dy) et la luminosité (--o). La dérive autonome, elle, est une
// animation CSS sur un groupe intermédiaire, donc elle ne coûte aucun
// recalcul de mise en page.
//
// Volontairement sobre : monochrome, aligné, très peu contrasté. Un fond
// doit se sentir, pas se regarder.

const SVG_NS = 'http://www.w3.org/2000/svg'

// Paramètres — modifiables ici, aucun autre endroit à toucher.
const COUNT = 18
// Les logos occupent ~2,2× plus de surface qu'avant : le compte maximal et
// la surface par logo sont montés en conséquence, sinon le placement par
// passes échoue sur le tier des grands et le champ se troue.
const COUNT_MAX = 26
const COUNT_MIN = 12
const COUNT_CAP_MOBILE = 18
const AREA_PER_MARK = 36000
const SMALL_BREAKPOINT = 480

// Trois tiers de taille. L'opacité est INVERSEMENT proportionnelle à la
// taille : un grand logo très pâle et un petit plus dense portent le même
// poids visuel. C'est ce qui fait lire le semis comme un semis composé
// plutôt que comme un empilement.
const TIERS = [
  { size: 52, opacity: 0.16, gap: 150, share: 0.18 },
  { size: 34, opacity: 0.24, gap: 84, share: 0.3 },
  { size: 22, opacity: 0.34, gap: 44, share: 0.52 },
]

// Répartition sur TOUTE la surface : le centre reste un peu plus calme
// (l'œil va vers la carte) sans laisser de grands vides.
const DENSITY_BIAS = { base: 0.62, span: 0.38 }

// Dérive proportionnelle à la taille : les grands respirent plus.
const DRIFT = { ampMin: 0.18, ampMax: 0.5, dur: [18, 30], delay: [0, 15] }
const CURSOR_RADIUS = 170
const CURSOR_PUSH = 8 // déplacement max, en px
const CURSOR_GAIN = 0.04 // opacité gagnée quand le curseur approche
const EASE = 0.08 // lissage par image (~0,4 s pour rejoindre la cible)

const rand = (a, b) => a + Math.random() * (b - a)

/** Crée un <use> du symbole de marque, à la taille voulue. */
function makeIcon(size) {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('width', String(size))
  svg.setAttribute('height', String(size))
  svg.setAttribute('viewBox', '0 0 20 20')
  svg.setAttribute('aria-hidden', 'true')
  const use = document.createElementNS(SVG_NS, 'use')
  use.setAttribute('href', '#doliMark')
  svg.appendChild(use)
  return svg
}

/**
 * Répartit les logos en MÉLANGEANT les tailles.
 *
 * La version précédente posait les grands d'abord, puis les moyens, puis
 * les petits : le fond se lisait alors comme trois couches concentriques,
 * très visibles. Ici, chaque emplacement tire son tier AU HASARD, au
 * prorata des quotas restants : la hiérarchie des tailles est conservée,
 * mais les tailles s'entrelacent et le champ se lit comme une seule texture.
 *
 * Chaque logo doit respecter deux choses : l'écart minimal de son tier, et
 * l'écart réel au voisin le plus proche — sinon un petit peut se coller à
 * un grand, et la profondeur de champ perd son sens.
 */
function pickSpots(count, w, h, keepOut) {
  const spots = []
  const cx = keepOut.x
  const cy = keepOut.y

  // Quota visé par tier : le mélange reste proportionnel, donc la
  // hiérarchie (beaucoup de petits, quelques grands) tient toujours.
  const quota = TIERS.map((t) => Math.max(1, Math.round(count * t.share)))
  const used = TIERS.map(() => 0)

  /** Distance au logo déjà posé le plus proche. */
  const nearest = (x, y) => {
    let d = Infinity
    for (const s of spots) {
      const dd = Math.hypot(s.x - x, s.y - y)
      if (dd < d) d = dd
    }
    return d
  }

  const clear = (x, y, gap) => {
    for (const s of spots) {
      if (Math.hypot(s.x - x, s.y - y) < gap) return false
    }
    return true
  }

  /** Tire un tier au hasard, au prorata de ce qu'il reste à poser. */
  const drawTier = () => {
    const left = TIERS.map((_, i) => Math.max(0, quota[i] - used[i]))
    const total = left.reduce((a, b) => a + b, 0)
    if (total <= 0) return -1
    let r = Math.random() * total
    for (let i = 0; i < left.length; i++) {
      r -= left[i]
      if (r <= 0) return i
    }
    return left.length - 1
  }

  for (let n = 0; n < count; n++) {
    const first = drawTier()
    if (first < 0) break
    // On tente le tier tiré ; s'il ne trouve pas sa place, on redescend vers
    // les plus petits, qui se logent plus facilement.
    const order = [first].concat(TIERS.map((_, i) => i).filter((i) => i < first))
    let done = false
    for (const t of order) {
      if (used[t] >= quota[t]) continue
      const tier = TIERS[t]
      for (let attempt = 0; attempt < 220; attempt++) {
        const x = rand(30, w - 30)
        const y = rand(30, h - 30)
        // Le cœur de la carte reste libre (titre + icône) : les logos passent
        // bien derrière la carte, mais pas sous son texte le plus important.
        if (Math.abs(x - cx) < keepOut.halfW && Math.abs(y - cy) < keepOut.halfH) continue
        // Densité : légèrement plus forte sur les bords, sans laisser de vides.
        const far = Math.min(1, Math.hypot((x - cx) / (cx || 1), (y - cy) / (cy || 1)))
        if (Math.random() > DENSITY_BIAS.base + far * DENSITY_BIAS.span) continue
        // Jamais plus près que son voisin le plus proche : un petit ne se
        // colle pas à un grand.
        const need = Math.max(tier.gap, nearest(x, y))
        if (!clear(x, y, need)) continue
        spots.push({ x, y, tier })
        used[t]++
        done = true
        break
      }
      if (done) break
    }
  }
  return spots
}
/**
 * @param {HTMLElement} screen conteneur #loginScreen
 * @param {HTMLElement} card   la carte de connexion, servant de zone à protéger
 */
export function initLoginAmbience(screen, card) {
  if (!screen) return
  const field = document.createElementNS(SVG_NS, 'svg')
  field.setAttribute('class', 'login-screen__marks')
  field.setAttribute('aria-hidden', 'true')
  screen.insertBefore(field, screen.firstChild)

  const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const small = window.innerWidth < SMALL_BREAKPOINT
  const reactive = !calm && !small

  // La carte doit être mesurée : on en garde seulement le CENTRE libre,
  // juste ce qu'il faut pour que le titre et l'icône restent nets. Le reste
  // du semis passe DERRIÈRE la carte — c'est le verre translucide qui
  // l'adoucit, pas un trou dans le champ.
  requestAnimationFrame(() => {
    const r = screen.getBoundingClientRect()
    const c = card ? card.getBoundingClientRect() : null
    const keepOut = c
      ? {
          x: c.left + c.width / 2 - r.left,
          y: c.top + c.height / 2 - r.top,
          halfW: 86,
          halfH: 66,
        }
      : { x: r.width / 2, y: r.height / 2, halfW: 86, halfH: 66 }

    // Combien de logos ? La surface disponible décide : 34 sur un grand
    // écran, 20 au plafond sur portable, 14 minimum pour que le fond reste
    // habité. Un compte fixe déborderait ou laisserait de grands vides.
    const raw = Math.round((r.width * r.height) / AREA_PER_MARK)
    const count = small
      ? Math.min(COUNT_CAP_MOBILE, raw)
      : Math.max(COUNT_MIN, Math.min(COUNT_MAX, raw))

    const spots = pickSpots(count, r.width, r.height, keepOut)

    const marks = []
    spots.forEach((spot) => {
      const tier = spot.tier
      const g = document.createElementNS(SVG_NS, 'g')
      g.setAttribute('class', 'login-mark')

      // Groupe intermédiaire : c'est lui qui porte la dérive CSS, sans
      // jamais entrer en conflit avec le transform posé par le script.
      const drift = document.createElementNS(SVG_NS, 'g')
      if (!calm) {
        drift.setAttribute('class', 'login-mark__drift')
        // Amplitude proportionnelle à la taille : les grands respirent plus.
        drift.style.setProperty('--amp', (tier.size * rand(DRIFT.ampMin, DRIFT.ampMax)).toFixed(1) + 'px')
        drift.style.setProperty('--dur', rand(DRIFT.dur[0], DRIFT.dur[1]) + 's')
        drift.style.setProperty('--delay', '-' + rand(DRIFT.delay[0], DRIFT.delay[1]) + 's')
        drift.style.setProperty('--x', rand(0, 100).toFixed(0) + 'px')
        drift.style.setProperty('--y', rand(0, 100).toFixed(0) + 'px')
      }
      drift.appendChild(makeIcon(tier.size))
      g.appendChild(drift)

      g.style.setProperty('--x', spot.x.toFixed(1) + 'px')
      g.style.setProperty('--y', spot.y.toFixed(1) + 'px')
      g.style.setProperty('--o', String(tier.opacity))
      // Profondeur de champ : appliquée au tier moyen, donc stable d'un
      // rechargement à l'autre (et désactivée sur mobile, où elle coûte cher).
      if (!small && tier === TIERS[1]) g.classList.add('login-mark--far')

      field.appendChild(g)
      marks.push({
        el: g, x: spot.x, y: spot.y,
        base: tier.opacity, o: tier.opacity,
        dx: 0, dy: 0, tx: 0, ty: 0, to: tier.opacity,
      })
    })

    if (reactive) attachCursor(marks, r)
  })
}

/** Fuite douce + gain de luminosite quand le curseur approche. */
function attachCursor(marks, bounds) {
  let tx = -9999
  let ty = -9999
  let running = false

  function onMove(e) {
    tx = e.clientX - bounds.left
    ty = e.clientY - bounds.top
    if (!running) { running = true; requestAnimationFrame(tick) }
  }

  function tick() {
    let moving = false
    for (const m of marks) {
      const d = Math.hypot(m.x - tx, m.y - ty)
      if (d < CURSOR_RADIUS) {
        const k = 1 - d / CURSOR_RADIUS
        const push = k * CURSOR_PUSH
        m.tx = ((m.x - tx) / (d || 1)) * push
        m.ty = ((m.y - ty) / (d || 1)) * push
        m.to = m.base + CURSOR_GAIN * k
        moving = true
      } else {
        m.tx = 0; m.ty = 0; m.to = m.base
      }
      m.dx += (m.tx - m.dx) * EASE
      m.dy += (m.ty - m.dy) * EASE
      const o = m.base + (m.to - m.base) * EASE
      if (Math.abs(m.dx) > 0.05 || Math.abs(m.dy) > 0.05 || Math.abs(o - m.o) > 0.002) {
        m.el.style.setProperty('--dx', m.dx.toFixed(2) + 'px')
        m.el.style.setProperty('--dy', m.dy.toFixed(2) + 'px')
        m.o = o
        m.el.style.setProperty('--o', o.toFixed(3))
      }
    }
    if (moving) requestAnimationFrame(tick)
    else running = false
  }

  window.addEventListener('mousemove', onMove, { passive: true })
}

