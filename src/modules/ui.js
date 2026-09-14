// ui.js
// Transforme les donnes (tches) en HTML affich, et capte les clics
// de l'utilisateur pour les retransmettre au reste de l'application.
// Ce module est le seul  toucher au DOM pour la liste de tches.

import { STATUS } from './tasks.js'
import { computeTaskProgress } from './progression.js'

const STATUS_LABEL = {
  [STATUS.TODO]: 'Non exécutée',
  [STATUS.DOING]: 'En cours',
  [STATUS.DONE]: 'Exécutée',
}

function isOverdue(task) {
  if (!task.dueDate || task.status === STATUS.DONE) return false
  return new Date(task.dueDate) < new Date()
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function formatDateTime(value) {
  const d = new Date(value)
  return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// Corbeille pure (couvercle net + deux traits internes), plus sobre que le
// simple contour utilis prcdemment.
const DELETE_ICON = `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h12"/><path d="M8 6V4.3a1 1 0 011-1h2a1 1 0 011 1V6"/><path d="M6 6l.6 9.4A1.4 1.4 0 008 16.7h4a1.4 1.4 0 001.4-1.3L14 6"/><path d="M8.4 9v4.4"/><path d="M11.6 9v4.4"/></svg>`
function deleteButtonHtml() {
  return `<button type="button" class="task__delete" data-action="delete" aria-label="Supprimer">${DELETE_ICON}</button>`
}

// Progression individuelle d'une tâche affichée sur la carte : barre + %.
// « null » signifie que la tâche est en cours mais sans aucune preuve : on
// invite l'utilisateur à en fournir une plutôt que d'afficher 0 %.
function progressBlockHtml(task) {
  const progress = computeTaskProgress(task)
  if (progress === null) {
    return `
      <div class="task__progress">
        <span class="task__progress-value task__progress-value--wait">Progression : fournis une preuve pour la calculer</span>
      </div>`
  }
  const fillMod = progress >= 100 ? '--done' : progress >= 50 ? '--half' : '--low'
  return `
    <div class="task__progress">
      <div class="task__progress-head">
        <span class="task__progress-label">Progression</span>
        <span class="task__progress-value">${progress} %</span>
      </div>
      <div class="task__progress-track">
        <span class="task__progress-fill task__progress-fill${fillMod}" style="width: ${progress}%"></span>
      </div>
    </div>`
}

// Bouton « Fournir une preuve » : visible sur les tâches en cours, il ouvre
// la petite fenêtre « Ajouter une preuve » (import fichier / photo + preuve
// simple). L'horodatage seul reste la 3e option (taux d'avancement temporel).
function proofButtonHtml(task) {
  if (task.status !== STATUS.DOING) return ''
  const hasProof = task.proofCount > 0
  const label = hasProof ? 'Preuve ✓' : 'Fournir une preuve'
  return `<button type="button" class="task__proof" data-action="provide-proof" title="Ajouter une preuve : importer un fichier ou une photo, ou enregistrer une preuve simple">${label}</button>`
}

// Mini-menu « Ajouter une preuve » : petite fenetre deroulante proposee par
// le bouton « Fournir une preuve » — « Importer un fichier ou une photo »
// (explorateur), « Prendre une photo » (mobile), « Preuve simple »
// (horodatage, comportement historique). Reutilise les classes existantes
// .row-menu__list / .row-menu__option : aucun CSS ajoute, design inchange.
// Selecteur de fichier cache partage (jamais visible dans l'interface).
let proofFileInputEl = null
let proofFileTaskId = null
function getProofFileInput() {
  if (proofFileInputEl) return proofFileInputEl
  proofFileInputEl = document.createElement('input')
  proofFileInputEl.type = 'file'
  proofFileInputEl.hidden = true
  proofFileInputEl.setAttribute('aria-hidden', 'true')
  proofFileInputEl.tabIndex = -1
  proofFileInputEl.accept = 'image/*,.pdf,.txt,.md,.csv,.doc,.docx'
  proofFileInputEl.addEventListener('change', async () => {
    const file = proofFileInputEl.files && proofFileInputEl.files[0]
    const taskId = proofFileTaskId
    proofFileInputEl.value = ''
    proofFileInputEl.removeAttribute('capture')
    if (!file || !taskId) return
    if (file.size > 8 * 1024 * 1024) {
      window.alert('Fichier trop volumineux (8 Mo maximum).')
      return
    }
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const dataBase64 = String(dataUrl).split(',')[1] || ''
      if (window.__doliProofFileHandler) await window.__doliProofFileHandler(taskId, { fileName: file.name, mimeType: file.type || 'application/octet-stream', dataBase64 })
    } catch {
      window.alert("Impossible d'importer ce fichier.")
    }
  })
  document.body.appendChild(proofFileInputEl)
  return proofFileInputEl
}

// Ouvre l'explorateur de fichiers (ou l'appareil photo sur mobile).
export function openProofFilePicker(taskId, photoOnly = false) {
  const input = getProofFileInput()
  proofFileTaskId = taskId
  input.accept = photoOnly ? 'image/*' : 'image/*,.pdf,.txt,.md,.csv,.doc,.docx'
  if (photoOnly) input.setAttribute('capture', 'environment')
  else input.removeAttribute('capture')
  input.click()
}

export function openProofAddMenu(anchorBtn, taskId, { onSimpleProof } = {}) {
  return openProofAddMenuAtRect(anchorBtn.getBoundingClientRect(), taskId, { onSimpleProof })
}

// Même mini-menu, mais ancré sur un rectangle déjà capturé : utilisé par
// l'option « Ajouter une preuve » du menu « … », dont le parent est refermé
// (et donc repositionné à 0,0) avant l'ouverture.
export function openProofAddMenuAtRect(anchorRect, taskId, { onSimpleProof } = {}) {
  closeAllStatusMenus()
  closeAllRowMenus()
  const old = document.querySelector('.row-menu__list--proof-add')
  if (old) old.remove()
  const menu = document.createElement('div')
  menu.className = 'row-menu__list row-menu__list--proof-add is-fixed'
  menu.innerHTML = `
    <button type="button" class="row-menu__option" data-proof-choice="file">Importer un fichier ou une photo</button>
    <button type="button" class="row-menu__option" data-proof-choice="photo">Prendre une photo</button>
    <button type="button" class="row-menu__option" data-proof-choice="simple">Preuve simple (sans fichier)</button>`
  menu.hidden = false
  document.body.appendChild(menu)
  const r = anchorRect
  menu.style.top = `${Math.round(r.bottom + 6)}px`
  menu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`
  requestAnimationFrame(() => {
    const h = menu.offsetHeight
    if (r.bottom + 6 + h > window.innerHeight - 8) {
      menu.style.top = `${Math.max(8, Math.round(r.top - h - 6))}px`
    }
  })
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    menu.remove()
    // Retrait différé : le clic qui a ouvert le menu (celui sur le bouton
    // « Ajouter une preuve », phase de bouillonnement) arrive JUSTE APRÈS
    // l'ajout de ce listener — sans ce délai, onDocClick le verrait comme
    // un clic « hors menu » et refermerait aussitôt le menu, et son propre
    // listener 'click' ne recevrait jamais l'événement (menu détaché).
    setTimeout(() => {
      document.removeEventListener('click', onDocClick, true)
      document.removeEventListener('keydown', onKey)
    }, 0)
  }
  const onDocClick = (event) => {
    if (event.target.closest('.row-menu__list--proof-add')) return
    close()
  }
  const onKey = (event) => {
    if (event.key === 'Escape') close()
  }
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onKey)
  menu.addEventListener('click', async (event) => {
    const choice = event.target.closest('[data-proof-choice]')
    if (!choice) return
    event.stopPropagation()
    const kind = choice.dataset.proofChoice
    const simpleCb = onSimpleProof || window.__doliProofSimpleHandler
    close()
    if (kind === 'file') openProofFilePicker(taskId, false)
    else if (kind === 'photo') openProofFilePicker(taskId, true)
    else if (simpleCb) simpleCb(taskId)
  })
}

// Fanion color indiquant la priorit (basse/moyenne/haute), affich devant
// le titre  une forme diffrente du badge de statut pour viter toute
// confusion entre les deux informations.
const PRIORITY_LABEL = { low: 'Basse', medium: 'Moyenne', high: 'Haute' }
const FLAG_ICON = `<svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="3" x2="4" y2="17"/><path d="M4 4h11l-2.5 3L15 10H4" fill="currentColor" stroke="none"/></svg>`
function priorityFlagHtml(task) {
  const priority = task.priority || 'medium'
  return `<span class="priority-flag priority-flag--${priority}" title="Priorit ${PRIORITY_LABEL[priority]}">${FLAG_ICON}</span>`
}

// Bouton de statut + menu de choix (Non excute / En cours / Excute) :
// un clic propose les 3 statuts au lieu de faire tourner directement le badge.
function statusPickerHtml(task) {
  const options = [STATUS.TODO, STATUS.DOING, STATUS.DONE]
    .map(
      (s) =>
        `<button type="button" class="status-picker__option ${s === task.status ? 'is-current' : ''}" data-action="set-status" data-status="${s}">${STATUS_LABEL[s]}</button>`
    )
    .join('')
  return `
    <div class="status-picker">
      <button type="button" class="badge badge--${task.status}" data-action="toggle-status-menu" title="Changer le statut">${STATUS_LABEL[task.status]}</button>
      <div class="status-picker__menu" hidden>${options}</div>
    </div>
  `
}

// Badge de statut en lecture seule : mme apparence que le slecteur, mais
// sans bouton ni menu  utilis l o le statut ne doit pas tre modifiable.
function staticBadgeHtml(task) {
  return `<span class="badge badge--${task.status}">${STATUS_LABEL[task.status]}</span>`
}

function taskCardHtml(task) {
  const overdue = isOverdue(task)
  return `
    <article class="task task--${task.status} ${overdue ? 'task--overdue' : ''}" data-id="${task.id}">
      <div class="task__main">
        <h3 class="task__title">${priorityFlagHtml(task)}${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="task__desc">${escapeHtml(task.description)}</p>` : ''}
        ${task.dueDate ? `<p class="task__due">Échéance : ${formatDateTime(task.dueDate)}${overdue ? ' · en retard' : ''}</p>` : ''}
        ${task.startTime ? `<p class="task__due">Début : ${formatDateTime(task.startTime)}</p>` : ''}
        ${progressBlockHtml(task)}
      </div>
      <div class="task__actions">
        ${statusPickerHtml(task)}
        ${proofButtonHtml(task)}
        ${deleteButtonHtml()}
      </div>
    </article>
  `
}

// Format court "42 s" / "3 min 07 s" / "1 h 05 min" pour la dure coule
// entre l'instant prsent et le dbut/l'chance (dans un sens ou l'autre) ;
// les heures n'apparaissent que si le dpassement les rend ncessaires.
function formatCountdown(ms) {
  const totalSeconds = Math.round(Math.abs(ms) / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours} h ${String(minutes).padStart(2, '0')} min`
  }
  return minutes > 0 ? `${minutes} min ${String(seconds).padStart(2, '0')} s` : `${seconds} s`
}

// Carte de tche gnrique avec,  droite, les actions (statut/suppression)
// surmontant un compte  rebours  rutilise par le Rappel et les Tches
// rcentes, qui partagent ce mme mcanisme d'affichage du temps restant.
function countdownCardHtml(task, { extraLines, countdownText, overdue, editableStatus = true }) {
  return `
    <article class="task task--${task.status}" data-id="${task.id}">
      <div class="task__main">
        <h3 class="task__title">${priorityFlagHtml(task)}${escapeHtml(task.title)}</h3>
        ${task.description ? `<p class="task__desc">${escapeHtml(task.description)}</p>` : ''}
        ${extraLines}
        ${progressBlockHtml(task)}
      </div>
      <div class="task__side">
        <div class="task__actions">
          ${editableStatus ? statusPickerHtml(task) : staticBadgeHtml(task)}
          ${editableStatus ? proofButtonHtml(task) : ''}
          ${deleteButtonHtml()}
        </div>
        <p class="reminder-countdown ${overdue ? 'reminder-countdown--overdue' : ''}">${countdownText}</p>
      </div>
    </article>
  `
}

function reminderCardHtml({ task, kind, target }, now) {
  const label = kind === 'start' ? 'Dbut' : 'chance'
  const remaining = target.getTime() - now
  const overdue = remaining < 0
  const countdownText = overdue
    ? `${label} dpasse depuis ${formatCountdown(remaining)}`
    : `${label} dans ${formatCountdown(remaining)}`
  return countdownCardHtml(task, {
    extraLines: `<p class="task__due">${label} : ${formatDateTime(target)}</p>`,
    countdownText,
    overdue,
  })
}

// --- Rappel : uniquement les tches  5 min ou moins de leur dbut ou de
// leur chance ; chaque carte affiche le temps restant avant disparition.
export function renderReminders(container, reminders, now) {
  if (reminders.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucun rappel actif pour le moment.</p>`
    return
  }
  container.innerHTML = reminders.map((r) => reminderCardHtml(r, now)).join('')
}

function recentCardHtml(task, now) {
  const lastSaved = new Date(task.updatedAt || task.completedAt || task.createdAt).getTime()
  const elapsed = now - lastSaved
  const dueLine = task.dueDate ? `<p class="task__due">chance : ${formatDateTime(task.dueDate)}</p>` : ''
  const startLine = task.startTime ? `<p class="task__due">Dbut : ${formatDateTime(task.startTime)}</p>` : ''
  return countdownCardHtml(task, {
    extraLines: dueLine + startLine,
    countdownText: `il y a ${formatCountdown(elapsed)}`,
    overdue: false,
    editableStatus: false,
  })
}

// --- Tches rcentes : affiche "il y a ..." depuis l'ajout/la dernire
// modification ; la tche quitte la liste au bout de 12 h (filtre en amont).
export function renderRecentTasks(container, tasks, now) {
  if (tasks.length === 0) {
    container.innerHTML = `<p class="empty-state">Aucune tche rcente pour le moment.</p>`
    return
  }
  container.innerHTML = tasks.map((t) => recentCardHtml(t, now)).join('')
}

export function renderTasks(container, tasks, viewMode, emptyMessage) {
  container.classList.toggle('task-list--grid', viewMode === 'grid')
  container.classList.toggle('task-list--list', viewMode === 'list')

  if (tasks.length === 0) {
    container.innerHTML = `<p class="empty-state">${emptyMessage || 'Aucune tâche pour le moment. Ajoute ta première tâche ci-dessus.'}</p>`
    return
  }

  container.innerHTML = tasks.map(taskCardHtml).join('')
}

// Ferme les menus et retire le passage au premier plan des cartes qui le
// portaient  sans a, la carte reste indment au-dessus de ses voisines.
function closeAllStatusMenus(except) {
  document.querySelectorAll('.status-picker__menu').forEach((menu) => {
    if (menu !== except) menu.hidden = true
  })
  document.querySelectorAll('.task--menu-open').forEach((task) => task.classList.remove('task--menu-open'))
}

// Ferme tout menu de statut ouvert ds qu'on clique en dehors d'un slecteur.
// EXCLUT le mini-menu « Ajouter une preuve » : en portail dans <body>, il
// n'est ni dans .status-picker ni dans .row-menu, mais il gere lui-meme sa
// fermeture (onDocClick) — sans cette garde, ce listener (enregistre AVANT
// l'ouverture) le detruirait au meme clic d'ouverture.
document.addEventListener('click', (event) => {
  if (event.target.closest('.row-menu__list--proof-add')) return
  if (!event.target.closest('.status-picker')) closeAllStatusMenus()
  if (!event.target.closest('.row-menu')) closeAllRowMenus()
})

// Dlgation d'vnements : un seul listener sur le conteneur plutt
// qu'un listener par tche. Le clic sur la carte modifie la tche ; le
// badge ouvre un menu proposant les 3 statuts ; le bouton corbeille supprime.
// Ferme tous les menus « … » des lignes de tâches.
function closeAllRowMenus() {
  // Le mini-menu « Ajouter une preuve » gère lui-même sa fermeture (son
  // propre onDocClick) : closeAllRowMenus() ne doit JAMAIS le toucher, sinon
  // l'ouvrir (qui appelle cette fonction) le détruirait aussitôt.
  document.querySelectorAll('.row-menu__list:not(.row-menu__list--proof-add)').forEach((menu) => {
    menu.hidden = true
    menu.classList.remove('is-fixed')
    menu.style.top = ''
    menu.style.right = ''
    // Retour dans sa carte d'origine après le passage en « portail ».
    if (menu._home && menu.parentElement !== menu._home) {
      menu._home.appendChild(menu)
    }
  })
  document
    .querySelectorAll('.row-menu__toggle[aria-expanded="true"]')
    .forEach((btn) => btn.setAttribute('aria-expanded', 'false'))
  document.querySelectorAll('.task--menu-open').forEach((task) => task.classList.remove('task--menu-open'))
}

// Le menu « … » suit le bouton : au moindre défilement (page ou conteneur
// défilant), on le ferme — même comportement perçu que le menu « Filtrer ».
document.addEventListener('scroll', () => closeAllRowMenus(), true)

// Options du menu « … » : comme le menu est déplacé dans <body> (portail),
// il est HORS du conteneur écouté par bindTaskEvents — les clics sur
// « Ajouter une preuve » / « Supprimer » ne remonteraient jamais à la
// délégation. Ce listener global exécute donc l'action via les handlers
// mémorisés sur le menu au moment de son ouverture.
// L'option « Ajouter une preuve » ouvre EXACTEMENT le même mini-menu que le
// bouton du dashboard (openProofAddMenu : import fichier/photo + simple) :
// on capture le rectangle d'ancrage AVANT closeAllRowMenus(), car cette
// fermeture réinitialise le style du menu parent (top/right vidés) et le
// replace dans sa carte — getBoundingClientRect() pris après vaudrait 0,0
// et le mini-menu s'afficherait hors écran (bug « rien ne se passe »).
document.addEventListener('click', (event) => {
  // Le mini-menu « Ajouter une preuve » a son propre listener : on l'ignore
  // ici (il n'a pas de _actions ; sans garde, `list` serait truthy mais
  // `list._actions` falsy → return de toute façon, garde défensive).
  if (event.target.closest('.row-menu__list--proof-add')) return
  const list = event.target.closest('.row-menu__list')
  if (!list || !list._actions) return
  const homeTask = list._home ? list._home.closest('.task') : null
  if (!homeTask) return
  const id = homeTask.dataset.id
  const option = event.target.closest('[data-action="provide-proof"], [data-action="delete"]')
  if (!option) return
  const handlers = list._actions
  if (option.dataset.action === 'provide-proof') {
    closeAllRowMenus()
    // Rubrique « Mes tâches » : PETITE FENÊTRE modale avec les 3 choix
    // (même pattern que « Que faire de ce rappel ? »), pas un menu.
    if (window.__doliProofDialogHandler) window.__doliProofDialogHandler(id)
    return
  }
  if (option.dataset.action === 'delete') {
    closeAllRowMenus()
    if (handlers.onDelete) handlers.onDelete(id)
  }
})

export function bindTaskEvents(container, { onSetStatus, onEdit, onDelete, onProvideProof }) {
  container.addEventListener('click', (event) => {
    const taskEl = event.target.closest('.task')
    if (!taskEl) return
    const id = taskEl.dataset.id

    // Menu « … » : bascule l'affichage des options (preuve / suppression).
    // Positionné en « fixed » calculé depuis le bouton (comme le bouton
    // « Filtrer » du dashboard) : un positionnement absolute serait rogné
    // par le conteneur défilant (.mtasks2__tablewrap, overflow-x: auto).
    const rowToggle = event.target.closest('[data-action="toggle-row-menu"]')
    if (rowToggle) {
      const menu = rowToggle.closest('.row-menu').querySelector('.row-menu__list')
      const wasOpen = !menu.hidden
      closeAllStatusMenus()
      closeAllRowMenus()
      if (!wasOpen) {
        menu.hidden = false
        // Handlers de la liste d'origine : le menu est déplacé dans <body>
        // (portail), les clics sur ses options sont donc traités par le
        // listener global ci-dessous, qui utilise ces handlers mémorisés.
        menu._actions = { onSetStatus, onEdit, onDelete, onProvideProof }
        // « Portail » : le menu est rattaché à <body> le temps de
        // l'affichage, hors de toutes les piles (stacking contexts) des
        // cartes — garanti au-dessus de tous les autres éléments.
        if (!menu._home) menu._home = menu.parentElement
        if (menu._home && menu.parentElement !== document.body) {
          document.body.appendChild(menu)
        }
        menu.classList.add('is-fixed')
        const r = rowToggle.getBoundingClientRect()
        menu.style.top = `${Math.round(r.bottom + 6)}px`
        menu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`
        // Pas de place en dessous (dernières lignes) : se déploie vers le haut.
        requestAnimationFrame(() => {
          const h = menu.offsetHeight
          if (r.bottom + 6 + h > window.innerHeight - 8) {
            menu.style.top = `${Math.max(8, Math.round(r.top - h - 6))}px`
          }
        })
        rowToggle.setAttribute('aria-expanded', 'true')
      }
      taskEl.classList.toggle('task--menu-open', !wasOpen)
      return
    }
    if (event.target.closest('.row-menu__list')) return

    // « Voir détails » des lignes « Mes tâches » : ouvre la consultation.
    if (event.target.closest('[data-action="edit"]')) {
      closeAllStatusMenus()
      closeAllRowMenus()
      onEdit(id)
      return
    }

    const proofBtn = event.target.closest('[data-action="provide-proof"]')
    if (proofBtn) {
      closeAllStatusMenus()
      closeAllRowMenus()
      // Le bouton ouvre la petite fenêtre « Ajouter une preuve » (import
      // fichier / photo + preuve simple) — jamais d'action directe.
      // Le menu rappelle onProvideProof(id, { file }) ou (id, null).
      if (onProvideProof && onProvideProof.length >= 3) onProvideProof(id, proofBtn, { openMenu: true })
      else if (onProvideProof) onProvideProof(id, proofBtn)
      else onEdit(id)
      return
    }
    const option = event.target.closest('[data-action="set-status"]')
    if (option) {
      onSetStatus(id, option.dataset.status)
      // La carte peut ne pas être dans un menu déroulant (bouton
      // « Commencer » du dashboard) : on ferme seulement si un menu existe.
      const menu = option.closest('.status-picker__menu')
      if (menu) menu.hidden = true
      taskEl.classList.remove('task--menu-open')
      return
    }
    const toggleBtn = event.target.closest('[data-action="toggle-status-menu"]')
    if (toggleBtn) {
      const menu = toggleBtn.closest('.status-picker').querySelector('.status-picker__menu')
      const wasOpen = !menu.hidden
      closeAllStatusMenus()
      menu.hidden = wasOpen
      // Passe toute la carte au premier plan pendant que le menu est ouvert,
      // pour que son propre fond opaque cache la carte du dessous plutt
      // que de laisser le menu se mlanger  son bouton de statut.
      taskEl.classList.toggle('task--menu-open', !wasOpen)
      return
    }
    if (event.target.closest('.status-picker__menu')) return
    // Badge de statut en lecture seule (ex. Tches rcentes) : un clic
    // dessus n'ouvre pas la tche, il ne fait rien.
    if (event.target.closest('.badge')) return
    if (event.target.closest('[data-action="delete"]')) {
      closeAllStatusMenus()
      closeAllRowMenus()
      onDelete(id)
      return
    }
    onEdit(id)
  })
}

function circleHtml(stats) {
  return `<div class="stats__circle" style="--percent:${stats.percent}"><span>${stats.percent}%</span></div>`
}

// Motifs vocateurs et professionnels : coche (termin), flches de
// synchronisation (en cours, processus actif), sablier (en attente).
const STATUS_ICON = {
  done: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,13 10,18 19,7"/></svg>`,
  doing: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 0114-5.3"/><polyline points="18,3 18,7 14,7"/><path d="M20 12a8 8 0 01-14 5.3"/><polyline points="6,21 6,17 10,17"/></svg>`,
  todo: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="3" x2="18" y2="3"/><line x1="6" y1="21" x2="18" y2="21"/><path d="M8 3c0 4.5 3 6 4 7 1-1 4-2.5 4-7"/><path d="M8 21c0-4.5 3-6 4-7 1 1 4 2.5 4 7"/></svg>`,
  total: `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><line x1="8" y1="9" x2="16" y2="9"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>`,
}

// --- Dashboard : compteurs par statut, en cases cliquables pour filtrer "Mes tches" ---
export function renderDashboardCounts(el, stats, activeFilter) {
  const card = (status, label, count) => `
    <button type="button" class="status-card status-card--${status} ${activeFilter === status ? 'is-active-filter' : ''}" data-status="${status}" aria-label="${label} : ${count}">
      <span class="status-card__label">${label}</span>
      <span class="status-card__circle">${STATUS_ICON[status]}</span>
      <span class="status-card__count">${count}</span>
    </button>`
  el.innerHTML = `<div class="status-cards">
    ${card('total', 'Total prévu', stats.total)}
    ${card('done', 'Exécutées', stats.done)}
    ${card('doing', 'En cours', stats.doing)}
    ${card('todo', 'Non exécutées', stats.todo)}
  </div>`
}

// --- Panneau « Progression des tâches » en tête de "Mes tâches" ---
// Mêmes compteurs colorés que le Dashboard, mais avec % et datés du jour.
// Pure présentation : aucune logique métier.
export function renderTasksOverview(countsEl, dateEl, stats) {
  if (countsEl) {
    const pct = (n) => (stats.total === 0 ? 0 : Math.round((n / stats.total) * 100))
    const card = (status, label, count) => `
      <div class="status-card status-card--${status}">
        <span class="status-card__label">${label}</span>
        <span class="status-card__circle">${STATUS_ICON[status]}</span>
        <span class="status-card__count">${count}</span>
        <span class="status-card__pct">${pct(count)} %</span>
      </div>`
    countsEl.innerHTML = `<div class="status-cards">
      ${card('total', 'Tâches prévues', stats.total)}
      ${card('done', 'Tâches exécutées', stats.done)}
      ${card('doing', 'En cours', stats.doing)}
      ${card('todo', 'Non exécutée', stats.todo)}
    </div>`
  }
  if (dateEl) {
    const now = new Date()
    const parts = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    dateEl.textContent = parts.charAt(0).toUpperCase() + parts.slice(1)
  }
}

export function bindDashboardCounts(el, onFilterClick) {
  el.addEventListener('click', (event) => {
    const item = event.target.closest('[data-status]')
    if (item) onFilterClick(item.dataset.status)
  })
}

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

// Disque plein  trois couleurs (excutes / en cours / non excutes), avec
// le pourcentage de chaque statut crit  l'intrieur de sa portion.
function multiDiscHtml(stats) {
  if (!stats.total) {
    return `<div class="stats__disc" style="background:var(--border)"></div>`
  }

  const cx = 50
  const cy = 50
  const r = 48
  const segments = [
    { value: stats.done, color: 'var(--badge-done-text)' },
    { value: stats.doing, color: 'var(--badge-doing-text)' },
    { value: stats.todo, color: 'var(--badge-todo-text)' },
  ]

  let angle = 0
  let slices = ''
  let labels = ''
  for (const seg of segments) {
    if (seg.value <= 0) continue
    const sweep = (seg.value / stats.total) * 360

    // Un seul statut prsent (100 %) : un arc de 360 est dgnr en SVG
    // (le point de dpart et d'arrive sont identiques, donc invisible).
    // On dessine directement un disque plein dans ce cas.
    if (sweep >= 359.99) {
      slices += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${seg.color}"/>`
      labels += `<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff">100%</text>`
      break
    }

    const start = angle
    const end = angle + sweep
    const large = sweep > 180 ? 1 : 0
    const p1 = polarToCartesian(cx, cy, r, start)
    const p2 = polarToCartesian(cx, cy, r, end)
    slices += `<path d="M ${cx} ${cy} L ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y} Z" fill="${seg.color}"/>`

    const mid = start + sweep / 2
    const labelPos = polarToCartesian(cx, cy, r * 0.62, mid)
    const pct = Math.round((seg.value / stats.total) * 100)
    labels += `<text x="${labelPos.x}" y="${labelPos.y}" text-anchor="middle" dominant-baseline="middle" font-size="9" font-weight="700" fill="#fff">${pct}%</text>`
    angle = end
  }

  return `<svg class="stats__disc" viewBox="0 0 100 100">${slices}${labels}</svg>`
}

// --- Dashboard : disque de répartition et cercle de performance, libellé au-dessus de chacun ---
export function renderDashboardDistribution(el, stats) {
  el.innerHTML = `<h4 class="stats__label">Répartition</h4><div class="stats__visual">${multiDiscHtml(stats)}</div>`
}

export function renderDashboardPercent(el, stats) {
  el.innerHTML = `<h4 class="stats__label">Performance</h4><div class="stats__visual">${circleHtml(stats)}</div>`
}

// --- Dashboard : tendance des tches excutes sur les derniers jours ---
export function renderTrend(el, buckets) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const bars = buckets
    .map((b) => {
      const heightPct = Math.round((b.count / max) * 100)
      return `
        <div class="trend-bar" title="${b.count} tche${b.count > 1 ? 's' : ''} excute${b.count > 1 ? 's' : ''}  ${b.label}">
          <span class="trend-bar__count">${b.count || ''}</span>
          <span class="trend-bar__track"><span class="trend-bar__fill" style="height:${heightPct}%"></span></span>
          <span class="trend-bar__label">${b.label}</span>
        </div>`
    })
    .join('')
  el.innerHTML = `<h4 class="stats__label">Tendance (7 derniers jours)</h4><div class="trend-chart">${bars}</div>`
}

const FLAME_ICON = `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2c1 3-3 4-3 7a3 3 0 006 0c0-1-1-1.5-1-2.5 1.5 1 2.5 3 2.5 4.5a4.5 4.5 0 01-9 0C5.5 7 8 5 10 2z"/></svg>`

// --- Dashboard : srie de jours conscutifs sans tche en retard, avec record ---
export function renderStreak(el, streak, bestStreak) {
  const label = streak > 1 ? 'jours sans retard' : 'jour sans retard'
  const recordHtml = bestStreak > 0 ? `<span class="streak-badge__record">Record : ${bestStreak}</span>` : ''
  el.innerHTML = `${FLAME_ICON}<span class="streak-badge__count">${streak}</span><span class="streak-badge__label">${label}</span>${recordHtml}`
}

function formatDuration(ms) {
  const hours = ms / (60 * 60 * 1000)
  if (hours < 24) return `${Math.max(1, Math.round(hours))} h`
  return `${(hours / 24).toFixed(1).replace('.0', '')} j`
}

function miniTileHtml(label, value, hint) {
  return `
    <div class="mini-tile">
      <span class="mini-tile__label">${label}</span>
      <span class="mini-tile__value">${value}</span>
      ${hint ? `<span class="mini-tile__hint">${hint}</span>` : ''}
    </div>`
}

// --- Dashboard : rsum "cette semaine" (excutes / en retard / en cours) ---
export function renderWeekSummary(el, stats, overdueCount) {
  el.innerHTML = miniTileHtml(
    'Cette semaine',
    `${stats.done} tâche${stats.done > 1 ? 's' : ''} exécutée${stats.done > 1 ? 's' : ''}`,
    `${overdueCount} en retard · ${stats.doing} en cours`
  )
}

// --- Dashboard : comparaison avec les 7 jours précédents ---
export function renderWeeklyComparison(el, { thisWeek, lastWeek, diff }) {
  const sign = diff > 0 ? '+' : diff < 0 ? '' : ''
  el.innerHTML = miniTileHtml('Par rapport à la semaine dernière', `${sign}${diff}`, `${thisWeek} contre ${lastWeek} tâches`)
}

// --- Dashboard : jour(s) de la semaine le(s) plus productif(s) ---
export function renderBestDay(el, bestDay) {
  if (!bestDay) {
    el.innerHTML = miniTileHtml('Jour le plus productif', '', 'Pas encore de tâche exécutée')
    return
  }
  const tied = bestDay.dayLabels.length > 1
  const names = tied ? bestDay.dayLabelsShort : bestDay.dayLabels
  const label = tied ? 'Jours les plus productifs' : 'Jour le plus productif'
  el.innerHTML = miniTileHtml(label, names.join(' | '), `${bestDay.count} tâche${bestDay.count > 1 ? 's' : ''} au total`)
}

// --- Dashboard : délai moyen entre création et exécution ---
export function renderAvgDelay(el, avgMs) {
  if (avgMs === null) {
    el.innerHTML = miniTileHtml('Délai moyen', '', 'Pas encore de tâche exécutée')
    return
  }
  el.innerHTML = miniTileHtml('Délai moyen', formatDuration(avgMs), 'entre création et exécution')
}

// --- Dashboard : projection « à ce rythme » pour le mois en cours ---
export function renderProjection(el, projection) {
  el.innerHTML = miniTileHtml(
    'À ce rythme',
    `~${projection.projected} ce mois`,
    `${projection.doneThisMonth} tâches exécutées en ${projection.daysElapsed} jours`
  )
}

// --- Dashboard : objectif hebdomadaire réglable, avec barre de progression ---
export function renderWeeklyGoal(el, doneThisWeek, goal) {
  const pct = goal > 0 ? Math.min(100, Math.round((doneThisWeek / goal) * 100)) : 0
  el.innerHTML = `
    <div class="mini-tile mini-tile--goal">
      <div class="mini-tile__goal-header">
        <button type="button" class="mini-tile__edit" data-action="edit-goal" aria-label="Modifier l'objectif hebdomadaire">✎</button>
        <span class="mini-tile__label">Objectif hebdomadaire</span>
      </div>
      <span class="mini-tile__value">${doneThisWeek} / ${goal}</span>
      <div class="goal-bar"><div class="goal-bar__fill" style="width:${pct}%"></div></div>
    </div>`
}
export function bindWeeklyGoalEdit(el, onEdit) {
  el.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="edit-goal"]')) onEdit()
  })
}

// --- Dashboard : paliers symboliques débloqués ---
export function renderAchievements(el, { totalDone, thresholds }) {
  const badges = thresholds
    .map((t) => {
      const pct = Math.min(100, Math.round((totalDone / t.threshold) * 100))
      return `
        <div class="achievement ${t.unlocked ? 'achievement--unlocked' : ''}" title="${totalDone} / ${t.threshold} tâches exécutées">
          <span class="achievement__fill" style="height:${pct}%"></span>
          <span class="achievement__number">${t.threshold}</span>
        </div>`
    })
    .join('')
  el.innerHTML = `
    <div class="mini-tile__goal-header">
      <button type="button" class="mini-tile__edit" data-action="edit-thresholds" aria-label="Modifier les paliers">✎</button>
      <span class="mini-tile__label">Paliers</span>
    </div>
    <div class="achievements">${badges}</div>
    <span class="mini-tile__hint">${totalDone} tâche${totalDone > 1 ? 's' : ''} exécutée${totalDone > 1 ? 's' : ''} actuellement</span>`
}
export function bindAchievementsEdit(el, onEdit) {
  el.addEventListener('click', (event) => {
    if (event.target.closest('[data-action="edit-thresholds"]')) onEdit()
  })
}

// --- Dashboard : message motivant selon le taux d'exécution ---
export function renderMotivation(el, percent, total, firstName) {
  let message
  if (total === 0) message = 'Ajoute ta première tâche pour commencer.'
  else if (percent >= 80) message = 'Excellent rythme, continue comme ça !'
  else if (percent >= 50) message = 'Bonne progression, encore un effort.'
  else if (percent >= 20) message = 'Le plus dur est de commencer, tu y es déjà.'
  else message = 'Reprends la main sur tes tâches, une à la fois.'
  const prefix = firstName ? `${escapeHtml(firstName)}, ` : ''
  el.innerHTML = `<p class="motivation-banner__text">${prefix}${message}</p>`
}

const CONFETTI_COLORS = ['var(--accent)', 'var(--badge-done-text)', 'var(--badge-doing-text)', 'var(--badge-todo-text)']

// Petite clbration visuelle (confettis CSS, sans dpendance) : dclenche
//  l'excution d'une tche ou  un nouveau record de srie.
export function triggerConfetti() {
  const container = document.createElement('div')
  container.className = 'confetti-burst'
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement('span')
    piece.className = 'confetti-piece'
    piece.style.left = `${Math.random() * 100}%`
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    piece.style.animationDelay = `${Math.random() * 0.2}s`
    piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 160)}px`)
    container.appendChild(piece)
  }
  document.body.appendChild(container)
  setTimeout(() => container.remove(), 1400)
}

function formatDayMonth(date) {
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

// --- Dashboard : activité des 4 dernières semaines, une barre horizontale
// par semaine (semaine en cours en haut) plutôt qu'une grille jour par jour ---
export function renderWeeklyActivity(el, buckets) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const total = buckets.reduce((sum, b) => sum + b.count, 0)

  const rows = buckets
    .map((b, i) => {
      const widthPct = Math.round((b.count / max) * 100)
      const lastDay = new Date(b.end.getTime() - 24 * 60 * 60 * 1000)
      const label = i === 0 ? 'Cette semaine' : i === 1 ? 'Semaine dernière' : `${formatDayMonth(b.start)}  ${formatDayMonth(lastDay)}`
      return `
        <div class="week-row">
          <span class="week-row__label">${label}</span>
          <span class="week-row__track"><span class="week-row__fill" style="width:${widthPct}%"></span></span>
          <span class="week-row__count">${b.count}</span>
        </div>`
    })
    .join('')

  el.innerHTML = `
    <h4 class="stats__label">Activité (4 dernières semaines)</h4>
    <p class="heatmap-summary">${total} tâche${total > 1 ? 's' : ''} exécutée${total > 1 ? 's' : ''} sur cette période</p>
    <div class="week-rows">${rows}</div>
  `
}

// --- Cloche : menu déroulant des tâches en retard ---
export function renderBell(countEl, menuEl, tasks) {
  const overdue = tasks.filter(isOverdue)

  if (overdue.length === 0) {
    countEl.hidden = true
    menuEl.innerHTML = `<p class="bell__empty">Aucune tâche en retard.</p>`
    return
  }

  countEl.hidden = false
  countEl.textContent = overdue.length
  menuEl.innerHTML = `<ul class="bell__list">${overdue
    .map((t) => `<li><button type="button" class="bell__item" data-id="${t.id}">${escapeHtml(t.title)}</button></li>`)
    .join('')}</ul>`
}

export function bindBellMenu(menuEl, onSelect) {
  menuEl.addEventListener('click', (event) => {
    const item = event.target.closest('.bell__item')
    if (item) onSelect(item.dataset.id)
  })
}

// --- Progression : affichage des statistiques ---
export function renderProgressionStats(stats, period) {
  document.getElementById('progressionStatTotal').textContent = stats.total
  document.getElementById('progressionStatTotalPercent').textContent = '100%'
  
  document.getElementById('progressionStatDone').textContent = stats.done
  document.getElementById('progressionStatDonePercent').textContent = `${stats.donePercent}%`
  
  document.getElementById('progressionStatDoing').textContent = stats.doing
  document.getElementById('progressionStatDoingPercent').textContent = `${stats.doingPercent}%`
  
  document.getElementById('progressionStatDelay').textContent = stats.delayed
  document.getElementById('progressionStatDelayPercent').textContent = `${stats.delayPercent}%`
  
  document.getElementById('progressionStatNotDone').textContent = stats.notDone
  document.getElementById('progressionStatNotDonePercent').textContent = `${stats.notDonePercent}%`
}

function prepareCanvasForHiDpi(canvas) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  const rect = canvas.getBoundingClientRect()
  const cssWidth = Math.max(rect.width || canvas.width || 400, 1)
  const cssHeight = Math.max(rect.height || canvas.height || 300, 1)
  const targetWidth = Math.round(cssWidth * dpr)
  const targetHeight = Math.round(cssHeight * dpr)

  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth
    canvas.height = targetHeight
  }

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width: cssWidth, height: cssHeight }
}

// --- Progression : graphique de rpartition du jour ---
export function renderProgressionDayDistribution(canvas, distribution) {
  if (!canvas) return
  
  const { ctx, width, height } = prepareCanvasForHiDpi(canvas)
  const legendWidth = 130
  const chartWidth = width - legendWidth - 20
  const centerX = chartWidth / 2 + 10
  const centerY = height / 2
  const radius = Math.min(chartWidth / 2 - 20, height / 2 - 30)

  // Détecter le thème
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const bgColor = isDark ? '#1a1d26' : '#ffffff'
  const textColor = isDark ? '#e6e8ec' : '#1c2536'
  const mutedColor = isDark ? '#9199a6' : '#626c7d'
  const centerBgColor = isDark ? '#1a1d26' : '#ffffff'

  // Couleurs
  const colors = ['#63d99a', '#ffb75c', '#ff8b8b', '#9199a6']
  
  let currentAngle = -Math.PI / 2
  const total = distribution.data.reduce((a, b) => a + b, 0)

  // Effacer le canvas
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, width, height)

  if (total === 0) {
    ctx.fillStyle = mutedColor
    ctx.font = '14px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Aucune tâche', centerX, centerY)
    return
  }

  // Dessiner les parts du pie chart
  distribution.data.forEach((value, index) => {
    const sliceAngle = (value / total) * 2 * Math.PI
    
    // Remplissage de la part
    ctx.fillStyle = colors[index]
    ctx.beginPath()
    ctx.moveTo(centerX, centerY)
    ctx.arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle)
    ctx.closePath()
    ctx.fill()

    currentAngle += sliceAngle
  })

  // Cercle blanc au centre
  ctx.fillStyle = centerBgColor
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius * 0.4, 0, 2 * Math.PI)
  ctx.fill()

  // Texte au centre
  ctx.fillStyle = textColor
  ctx.font = 'bold 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(total, centerX, centerY - 6)
  ctx.font = '11px sans-serif'
  ctx.fillStyle = mutedColor
  ctx.fillText('tâches', centerX, centerY + 12)

  // Légende à droite du cercle : un carré coloré par statut, avec son
  // libellé sur la ligne du haut et le nombre de tâches juste en dessous.
  // Espacement vertical généreux et couleurs distinctes pour que chaque
  // statut se repère d'un coup d'œil.
  const legendItemHeight = 36
  const swatchSize = 14
  const legendX = width - legendWidth + 14
  const legendStartY = (height - distribution.labels.length * legendItemHeight) / 2 + legendItemHeight / 2

  distribution.labels.forEach((label, index) => {
    const legendY = legendStartY + index * legendItemHeight

    // Carré de couleur du statut, centré verticalement sur son groupe.
    ctx.fillStyle = colors[index]
    ctx.fillRect(legendX, legendY - swatchSize / 2, swatchSize, swatchSize)

    // Libellé du statut.
    ctx.fillStyle = textColor
    ctx.font = '600 12px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${label}`, legendX + swatchSize + 12, legendY - 6)

    // Nombre de tâches, dans la couleur du statut pour renforcer la
    // distinction entre les catégories.
    ctx.fillStyle = colors[index]
    ctx.font = 'bold 13px sans-serif'
    ctx.fillText(`${distribution.data[index]}`, legendX + swatchSize + 12, legendY + 9)
  })
}

// --- Progression : graphique de comparaison hebdomadaire ---
export function renderProgressionWeeklyComparison(canvas, weekData) {
  if (!canvas) return
  
  const { ctx, width, height } = prepareCanvasForHiDpi(canvas)
  const padding = 60
  const plotWidth = width - padding * 2
  const plotHeight = height - padding * 2
  const barWidth = plotWidth / weekData.length * 0.65
  const barSpacing = plotWidth / weekData.length
  
  // Détecter le thème
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const bgColor = isDark ? '#1a1d26' : '#ffffff'
  const textColor = isDark ? '#e6e8ec' : '#1c2536'
  const mutedColor = isDark ? '#9199a6' : '#626c7d'
  const axisColor = isDark ? '#2b2f3a' : '#e1e4ea'
  
  // Couleurs
  const colorMap = {
    done: '#63d99a',
    doing: '#ffb75c',
    delayed: '#ff8b8b',
    notDone: '#9199a6'
  }

  // Effacer
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Trouver le max pour la hauteur
  const maxTotal = Math.max(...weekData.map(d => d.total), 1)

  // Axes
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding, height - padding)
  ctx.lineTo(width - padding, height - padding)
  ctx.stroke()
  
  ctx.beginPath()
  ctx.moveTo(padding, padding)
  ctx.lineTo(padding, height - padding)
  ctx.stroke()

  // Grille horizontale
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 0.5
  for (let i = 1; i < 5; i++) {
    const y = height - padding - (plotHeight / 5) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }

  // Barres empiles
  weekData.forEach((day, index) => {
    const x = padding + index * barSpacing + (barSpacing - barWidth) / 2
    let y = canvas.height - padding
    
    const scale = plotHeight / maxTotal
    
    // Excutes (vert)
    const doneHeight = day.done * scale
    ctx.fillStyle = colorMap.done
    ctx.fillRect(x, y - doneHeight, barWidth, doneHeight)
    y -= doneHeight

    // En cours (orange)
    const doingHeight = day.doing * scale
    ctx.fillStyle = colorMap.doing
    ctx.fillRect(x, y - doingHeight, barWidth, doingHeight)
    y -= doingHeight

    // En retard (rouge)
    const delayHeight = day.delayed * scale
    ctx.fillStyle = colorMap.delayed
    ctx.fillRect(x, y - delayHeight, barWidth, delayHeight)
    y -= delayHeight

    // Non excutes (gris)
    const notDoneHeight = day.notDone * scale
    ctx.fillStyle = colorMap.notDone
    ctx.fillRect(x, y - notDoneHeight, barWidth, notDoneHeight)

    // Libell du jour (abrégé)
    ctx.fillStyle = mutedColor
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const dayLabel = day.label.substring(0, 3)
    ctx.fillText(dayLabel, x + barWidth / 2, height - padding + 8)
  })

  // Légende en haut
  const legendY = 16
  let legendX = padding
  const labels = [
    { status: 'done', text: 'Exécutées' },
    { status: 'doing', text: 'En cours' },
    { status: 'delayed', text: 'En retard' },
    { status: 'notDone', text: 'Non exécutées' }
  ]
  
  labels.forEach(({ status, text }, index) => {
    ctx.fillStyle = colorMap[status]
    ctx.fillRect(legendX, legendY - 8, 10, 10)
    ctx.fillStyle = textColor
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, legendX + 16, legendY - 2)
    legendX += 115
  })
}

// --- Progression : graphique de tendance ---
export function renderProgressionTrend(canvas, trendData) {
  if (!canvas) return
  
  const { ctx, width, height } = prepareCanvasForHiDpi(canvas)
  const padding = { top: 50, right: 40, bottom: 50, left: 50 }
  const plotWidth = width - padding.left - padding.right
  const plotHeight = height - padding.top - padding.bottom

  // Détecter le thème
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
  const bgColor = isDark ? '#1a1d26' : '#ffffff'
  const textColor = isDark ? '#e6e8ec' : '#1c2536'
  const mutedColor = isDark ? '#9199a6' : '#626c7d'
  const axisColor = isDark ? '#2b2f3a' : '#e1e4ea'
  const accentColor = isDark ? '#6c8cff' : '#34518f'

  // Effacer
  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // Axes
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding.left, height - padding.bottom)
  ctx.lineTo(width - padding.right, height - padding.bottom)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(padding.left, height - padding.bottom)
  ctx.lineTo(padding.left, padding.top)
  ctx.stroke()

  // Grille horizontale
  ctx.strokeStyle = axisColor
  ctx.lineWidth = 0.5
  for (let i = 0; i <= 4; i++) {
    const y = height - padding.bottom - (plotHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
  }

  // Points et ligne
  if (trendData.length > 0) {
    const maxPercent = 100
    const xStep = plotWidth / (trendData.length - 1 || 1)

    // Tracer la ligne
    ctx.strokeStyle = accentColor
    ctx.lineWidth = 2.5
    ctx.beginPath()

    trendData.forEach((point, index) => {
      const x = padding.left + index * xStep
      const y = height - padding.bottom - (point.percent / maxPercent) * plotHeight

      if (index === 0) {
        ctx.moveTo(x, y)
      } else {
        ctx.lineTo(x, y)
      }
    })
    ctx.stroke()

    // Points de données
    ctx.fillStyle = accentColor
    trendData.forEach((point, index) => {
      const x = padding.left + index * xStep
      const y = height - padding.bottom - (point.percent / maxPercent) * plotHeight

      ctx.beginPath()
      ctx.arc(x, y, 4, 0, 2 * Math.PI)
      ctx.fill()

      // Pourcentage au-dessus du point
      ctx.fillStyle = textColor
      ctx.font = 'bold 11px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'bottom'
      ctx.fillText(`${point.percent}%`, x, y - 12)
      ctx.fillStyle = accentColor
    })

    // Libellés X
    ctx.fillStyle = mutedColor
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    trendData.forEach((point, index) => {
      const x = padding.left + index * xStep
      ctx.fillText(point.label, x, height - padding.bottom + 8)
    })
  }

  // Libellés Y
  ctx.fillStyle = mutedColor
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let i = 0; i <= 4; i++) {
    const y = height - padding.bottom - (plotHeight / 4) * i
    ctx.fillText(`${i * 25}%`, padding.left - 10, y)
  }
}

// --- Rubrique Preuves : l'historique des preuves par tâche ---
export function renderPreuves(container, tasks) {
  const withProofs = tasks.filter((t) => t.proofCount > 0)
  if (withProofs.length === 0) {
    container.innerHTML = `
      <div class="preuves-empty">
        <svg viewBox="0 0 20 20" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h8v15l-4-2-4 2z"/><path d="M8.5 9l1.2 1.2L12 7.4"/></svg>
        <h3>Aucune preuve pour le moment</h3>
        <p>Fournis une preuve sur une tâche en cours pour la voir apparaître ici.</p>
      </div>`
    return
  }

  const sorted = [...withProofs].sort((a, b) => new Date(b.lastProofAt) - new Date(a.lastProofAt))
  container.innerHTML = sorted
    .map((task) => {
      const progress = computeTaskProgress(task)
      const fillMod = progress === null ? '--low' : progress >= 100 ? '--done' : progress >= 50 ? '--half' : '--low'
      return `
        <div class="preuve-item">
          <div class="preuve-item__head">
            <h4 class="preuve-item__title">${escapeHtml(task.title)}</h4>
            <span class="preuve-item__count">${task.proofCount} preuve${task.proofCount > 1 ? 's' : ''}</span>
          </div>
          <p class="preuve-item__meta">Dernière preuve : ${formatDateTime(task.lastProofAt)}</p>
          <div class="preuve-item__body">
            <div class="preuve-item__track"><span class="preuve-item__fill task__progress-fill${fillMod}" style="width: ${progress ?? 0}%"></span></div>
            <span class="preuve-item__pct">${progress === null ? 'incalculable' : `${progress} %`}</span>
          </div>
        </div>`
    })
    .join('')
}

// --- Progression : rsum du jour ---
export function renderProgressionTodayStats(todayStats) {
  const percentEl = document.getElementById('progressionTodayPercent')
  const labelEl = document.getElementById('progressionTodayLabel')
  const barEl = document.getElementById('progressionProgressBar')
  const messageEl = document.getElementById('progressionMessage')

  if (percentEl) percentEl.textContent = `${todayStats.percent}%`
  if (labelEl) labelEl.textContent = `${todayStats.done} tche${todayStats.done !== 1 ? 's' : ''} excute${todayStats.done !== 1 ? 's' : ''} sur ${todayStats.total}`
  
  if (barEl) {
    barEl.style.setProperty('--progress', `${todayStats.percent}%`)
  }
  
  if (messageEl) messageEl.textContent = todayStats.message
}

// --- Progression : bind des filtres ---
// --- Progression : bind des filtres avec dropdown ---
export function bindProgressionFilters(container, onFilterChange) {
  const filterBtn = document.getElementById('progressionFilterBtn')
  const filterMenu = document.getElementById('progressionFilterMenu')
  const filterItems = filterMenu.querySelectorAll('.period-menu-item')

  // Ouvrir/fermer le dropdown
  if (filterBtn) {
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      const isOpen = !filterMenu.hidden
      filterMenu.hidden = isOpen
      filterBtn.setAttribute('aria-expanded', !isOpen)
    })
  }

  // Gerer les clics sur les items du menu
  filterItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation()
      const period = parseInt(item.dataset.period)
      
      // Mettre à jour l'état actif
      filterItems.forEach((i) => i.classList.remove('is-active'))
      item.classList.add('is-active')
      
      // Mettre à jour le sous-titre avec la période sélectionnée
      const periodLabels = {
        1: 'Aujourd\'hui',
        7: 'Cette semaine',
        14: '2 dernières semaines',
        30: 'Ce mois',
        90: '3 derniers mois',
        180: '6 derniers mois',
        365: 'Cette année'
      }
      const subtitleEl = document.querySelector('.progression-subtitle')
      if (subtitleEl) {
        subtitleEl.textContent = periodLabels[period] || 'Aujourd\'hui'
      }
      
      // Fermer le menu
      filterMenu.hidden = true
      filterBtn.setAttribute('aria-expanded', 'false')
      
      // Appeler le callback
      onFilterChange(period)
    })
  })

  // Fermer le dropdown quand on clique ailleurs
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.progression-period-selector')) {
      filterMenu.hidden = true
      filterBtn.setAttribute('aria-expanded', 'false')
    }
  })
}

// --- Vue « Mes tâches » façon tableau professionnel (maquette Doli) ---
// Pure présentation : l'avancement utilise computeTaskProgress (méthode
// Doli existante), aucune base de calcul n'est modifiée.

const MTASK_PRIORITY_LABEL = { urgent: 'Urgente', high: 'Haute', medium: 'Normale', normal: 'Normale', low: 'Basse' }
function effectivePriority(task) {
  const pr = (task.priority || 'medium').toLowerCase()
  if (pr === 'urgent' || pr === 'urgente' || pr === 'critical') return 'urgent'
  if (pr === 'high' || pr === 'haute' || pr === 'haut') return 'high'
  if (pr === 'low' || pr === 'basse' || pr === 'bas') return 'low'
  return 'medium'
}

// Avatar rond coloré de la ligne (maquette) : icône selon priorité.
const TASK_AVATAR_ICON = {
  urgent: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="12" height="14" rx="2"/><line x1="7" y1="7.5" x2="13" y2="7.5"/><line x1="7" y1="11" x2="13" y2="11"/></svg>`,
  high: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 15l-1.5-6L11 5.5 13 3l2 2.5L11.5 9z"/><line x1="4.5" y1="17" x2="9" y2="17"/></svg>`,
  medium: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4.5,10.5 8,14 15.5,6"/></svg>`,
  normal: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4.5,10.5 8,14 15.5,6"/></svg>`,
  low: `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="13" height="10" rx="2"/><line x1="3.5" y1="8" x2="16.5" y2="8"/><line x1="6.5" y1="3.5" x2="6.5" y2="6.5"/><line x1="13.5" y1="3.5" x2="13.5" y2="6.5"/></svg>`,
}

// « 10:00 » court pour la période prévue des lignes.
function fmtTimeShort(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

// « 03/09/2025 » court sous la période prévue des lignes.
function fmtDayShort(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function taskKindLabel(task) {
  return effectivePriority(task) === 'low' ? 'Tâche secondaire' : 'Tâche principale'
}

// Heure courte « 8h05 » pour les libellés « Prévu : ... » des cartes.
function fmtHour(value) {
  if (!value) return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// Situation de la tâche au moment T : textes exacts de la maquette.
function situationInfo(task, now) {
  if (task.status === STATUS.DONE) {
    return { cls: 'done', text: 'Terminée', sub: 'Excellente' }
  }
  const due = task.dueDate ? new Date(task.dueDate) : null
  if (due && due.getTime() < now) {
    const ms = now - due.getTime()
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    if (h >= 2) {
      const delay = `Retard : ${h}h${String(m).padStart(2, '0')}`
      return { cls: 'late', text: 'En retard', sub: delay }
    }
    if (h >= 1 || m >= 30) {
      const delay = h > 0 ? `Retard : ${m + h * 60} min` : `Retard : ${m} min`
      return { cls: 'latemod', text: 'En retard modéré', sub: delay }
    }
    const delay = h > 0 ? `Retard : ${h}h${String(m).padStart(2, '0')}` : `Retard : ${m} min`
    return { cls: 'late', text: 'En retard', sub: delay }
  }
  const start = task.startTime ? new Date(task.startTime) : null
  if (start && start.getTime() > now) {
    return {
      cls: 'soon',
      text: 'À venir',
      sub: `Commence à ${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
    }
  }
  return { cls: 'ok', text: 'Dans les délais', sub: 'Tout va bien' }
}

// Cartes de comptage (maquette « Mes tâches ») : Toutes / Terminées /
// En cours / En retard / Non exécutées — nombre coloré + icône ronde +
// « X % du total ». Clic = filtre statut. Calculs : simples comptages.
const MTASKS_COUNT_ICON = {
  all: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="12" height="14" rx="2"/><line x1="7" y1="7" x2="13" y2="7"/><line x1="7" y1="10.2" x2="13" y2="10.2"/><line x1="7" y1="13.5" x2="11" y2="13.5"/></svg>`,
  done: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="7,10.2 9.3,12.5 13.4,7.6"/></svg>`,
  doing: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polygon points="8.2,7 13.6,10 8.2,13" fill="currentColor" stroke="none"/></svg>`,
  delayed: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="10,5.6 10,10 12.9,11.7"/></svg>`,
  todo: `<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="10" cy="10" r="7.5"/><line x1="7.6" y1="10" x2="7.6" y2="10"/><line x1="12.4" y1="10" x2="12.4" y2="10"/></svg>`,
}
export function renderTasksCounts(el, counts, activeFilter) {
  if (!el) return
  const pct = (n) => (counts.all === 0 ? 0 : Math.round((n / counts.all) * 100))
  const card = (key, statusClass, label, count) => `
    <button type="button" class="mtasks2-count mtasks2-count--${statusClass} ${activeFilter === key ? 'is-active' : ''}" data-count-key="${key}">
      <span class="mtasks2-count__top"><span class="mtasks2-count__label">${label}</span><span class="mtasks2-count__icon">${MTASKS_COUNT_ICON[key]}</span></span>
      <span class="mtasks2-count__num">${count}</span>
      <span class="mtasks2-count__pct">${pct(count)} % du total</span>
    </button>`
  el.innerHTML = `
    ${card('all', 'total', 'Toutes les tâches', counts.all)}
    ${card('done', 'done', 'Terminées', counts.done)}
    ${card('doing', 'doing', 'En cours', counts.doing)}
    ${card('delayed', 'late', 'En retard', counts.delayed)}
    ${card('todo', 'todo', 'Non exécutées', counts.todo)}`
}

// Onglets de filtres rapides (maquette : « Toutes (24) », « En cours (4) »…).
export function renderTasksTabs(el, counts, activeFilter) {
  if (!el) return
  const tab = (key, label, count) => `
    <button type="button" role="tab" aria-selected="${activeFilter === key ? 'true' : 'false'}" class="mtasks2-tab ${activeFilter === key ? 'is-active' : ''}" data-status-tab="${key}">${label} <span class="mtasks2-tab__count">(${count})</span></button>`
  el.innerHTML = `
    ${tab('all', 'Toutes', counts.all)}
    ${tab('doing', 'En cours', counts.doing)}
    ${tab('done', 'Terminées', counts.done)}
    ${tab('delayed', 'En retard', counts.delayed)}
    ${tab('todo', 'Non exécutées', counts.todo)}`
}

// --- Cartes riches du dashboard (maquette Doli) --------------------------
// Priorité · Prévu · Avancement estimé · Statut · Situation · boutons.
// La classe .task en premier élément garde la délégation d'événements
// existante (bindTaskEvents) : Continuer / Ajouter une preuve déclenchent
// data-action="provide-proof", la carte entière ouvre la consultation.
function dashCardHtml(task, now) {
  const progress = computeTaskProgress(task)
  const fillMod = progress === null ? '--low' : progress >= 100 ? '--done' : progress >= 50 ? '--half' : '--low'
  const progressPct = progress === null ? '—' : `${progress} %`
  const sit = situationInfo(task, now)
  const priority = task.priority || 'medium'
  const overdueRow = sit.cls === 'late' ? ' mtask--overdue' : ''
  // Statut affiché : terminée / en retard, sinon le libellé du statut brut.
  const statusLabel = task.status === STATUS.DONE
    ? 'Terminée'
    : sit.cls === 'late'
      ? 'En retard'
      : STATUS_LABEL[task.status]
  const isDoing = task.status === STATUS.DOING
  // En cours : Continuer + Ajouter une preuve (toutes deux fournissent une
  // preuve) ; les autres : consultation seule (clic carte / Voir les détails).
  const btns = isDoing
    ? `<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof">Continuer</button>
       <button type="button" class="mtask__btn" data-action="provide-proof">Ajouter une preuve</button>`
    : `<button type="button" class="mtask__btn">Voir les détails</button>`
  const start = fmtHour(task.startTime)
  const end = fmtHour(task.dueDate)
  const prévu = start && end
    ? `Prévu : ${start} - ${end}`
    : end
      ? `Prévu avant ${end}`
      : start
        ? `Prévu : ${start}`
        : 'Sans horaire prévu'
  return `
    <article class="task dtask dtask--${task.status}${overdueRow}" data-id="${task.id}">
      <div class="dtask__main">
        <div class="dtask__title">${escapeHtml(task.title)}</div>
        <span class="dtask__meta">Priorité : <span class="mtask__priority mtask__priority--${priority}">${MTASK_PRIORITY_LABEL[priority]}</span></span>
        <span class="dtask__meta">${prévu}</span>
      </div>
      <div class="dtask__mid">
        <span class="dtask__adv-label">Avancement estimé</span>
        <div class="mtask__progress">
          <div class="mtask__progress-track"><span class="task__progress-fill task__progress-fill${fillMod}" style="width:${progress ?? 0}%"></span><span class="mtask__progress-pct">${progressPct}</span></div>
        </div>
        <span class="dtask__status-label">Statut</span>
        <span class="dtask__status">${statusLabel}</span>
      </div>
      <div class="dtask__side">
        <span class="dtask__meta">Situation</span>
        <span class="mtask__situation mtask__situation--${sit.cls}">${sit.text} · ${sit.sub}</span>
        <div class="dtask__btns">${btns}</div>
      </div>
    </article>`
}

// --- Dashboard « Mes tâches » : liste verticale de cartes pleine largeur ---
export function renderDashTaskCards(container, tasks, now) {
  if (!container) return
  if (tasks.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucune tâche à afficher.</p>'
    return
  }
  container.innerHTML = tasks.map((task) => dashCardHtml(task, now)).join('')
}

export function renderTasksTable(container, tasks, emptyMessage) {
  if (!container) return
  if (tasks.length === 0) {
    container.innerHTML = `<p class="empty-state">${escapeHtml(emptyMessage || 'Aucune tâche pour le moment. Ajoute ta première tâche.')}</p>`
    return
  }

  container.innerHTML = tasks
    .map((task) => {
      const now = Date.now()
      const progress = computeTaskProgress(task)
      const fillMod = progress === null ? '--low' : progress >= 100 ? '--done' : progress >= 50 ? '--half' : '--low'
      const progressPct = progress === null ? '0 %' : `${progress} %`
      const progressLabel =
        task.status === STATUS.DONE
          ? 'Terminée'
          : task.status === STATUS.TODO
            ? 'Non exécutée'
            : 'En cours'
      const sit = situationInfo(task, now)
      const priority = effectivePriority(task)
      const overdueRow = sit.cls === 'late' ? ' mtask--overdue' : ''
      const startHM = fmtTimeShort(task.startTime)
      const endHM = fmtTimeShort(task.dueDate)
      const dayLabel = fmtDayShort(task.startTime || task.dueDate)
      const avatarCls = task.status === STATUS.DONE ? 'done' : sit.cls === 'late' ? 'late' : priority === 'high' ? 'urgent' : priority
      const avatarIcon = task.status === STATUS.DONE
        ? `<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4.5,10.5 8,14 15.5,6"/></svg>`
        : TASK_AVATAR_ICON[priority] || TASK_AVATAR_ICON.medium
      const actionBtn = task.status === STATUS.DOING
        ? '<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof"><svg viewBox="0 0 20 20" width="10" height="10" fill="currentColor"><polygon points="6,4 16,10 6,16"/></svg> Continuer</button>'
        : task.status === STATUS.TODO
          ? '<button type="button" class="mtask__btn mtask__btn--primary" data-action="set-status" data-status="doing"><svg viewBox="0 0 20 20" width="10" height="10" fill="currentColor"><polygon points="6,4 16,10 6,16"/></svg> Commencer</button>'
          : ''
      return `
      <article class="task mtasks2-row mtask--${task.status}${overdueRow}" data-id="${task.id}">
        <div class="mtasks2-cell mtasks2-cell--task">
          <span class="mtasks2-avatar mtasks2-avatar--${avatarCls}">${avatarIcon}</span>
          <span class="mtasks2-task-text">
            <span class="mtask__title">${escapeHtml(task.title)}</span>
            <span class="mtask__kind">${taskKindLabel(task)}</span>
          </span>
        </div>
        <div class="mtasks2-cell"><span class="mtask__priority mtask__priority--${priority}">${MTASK_PRIORITY_LABEL[priority]}</span></div>
        <div class="mtasks2-cell mtask__period">
          <span class="mtask__period-cols"><span class="mtask__period-col"><em>Début</em><strong>${startHM}</strong></span><span class="mtask__period-col"><em>Fin</em><strong>${endHM}</strong></span></span>
          <span class="mtask__period-day">${dayLabel}</span>
        </div>
        <div class="mtasks2-cell mtask__adv">
          <div class="mtask__progress">
            <span class="mtask__progress-pct">${progressPct}</span>
            <div class="mtask__progress-track"><span class="task__progress-fill task__progress-fill${fillMod}" style="width:${progress ?? 0}%"></span></div>
          </div>
          <span class="mtask__progress-status mtask__progress-status--${task.status}">${progressLabel}</span>
        </div>
        <div class="mtasks2-cell"><span class="mtask__situation mtask__situation--${sit.cls}"><span class="mtask__situation-line mtask__situation-top"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="10,6 10,10 13,12"/></svg>${sit.text}</span><span class="mtask__situation-line mtask__situation-sub"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7.5"/><polyline points="10,6 10,10 13,12"/></svg>${sit.sub}</span></span></div>
        <div class="mtasks2-cell mtasks2-cell--actions mtask__actions">
          ${actionBtn}
          <span class="mtask__actions-row">
            <button type="button" class="mtask__btn" data-action="edit">Voir détails</button>
            <div class="row-menu">
              <button type="button" class="row-menu__toggle" data-action="toggle-row-menu" aria-label="Options de la tâche">⋯</button>
              <div class="row-menu__list" hidden>
                <button type="button" class="row-menu__option" data-action="provide-proof">Ajouter une preuve</button>
                <button type="button" class="row-menu__option row-menu__option--danger" data-action="delete">Supprimer</button>
              </div>
            </div>
          </span>
        </div>
      </article>`
    })
    .join('')
}
// Panneau latéral « Résumé de la journée » : avancement par statut
// (jauges), situation (retard / dans les délais / à venir) et message
// d'encouragement. Calculs : computeTaskProgress existant, rien de neuf.
export function renderTasksSummary(el, tasks) {
  if (!el) return
  const now = Date.now()

  const doing = tasks.filter((t) => t.status === STATUS.DOING)
  const done = tasks.filter((t) => t.status === STATUS.DONE)
  const todo = tasks.filter((t) => t.status === STATUS.TODO)
  const late = tasks.filter((t) => isOverdue(t))

  const doingProgresses = doing.map(computeTaskProgress).filter((p) => p !== null)
  const doingPct = doingProgresses.length
    ? Math.round(doingProgresses.reduce((a, b) => a + b, 0) / doingProgresses.length)
    : 0
  const allProgresses = tasks.map(computeTaskProgress).filter((p) => p !== null)
  const globalPct = allProgresses.length
    ? Math.round(allProgresses.reduce((a, b) => a + b, 0) / allProgresses.length)
    : 0

  // Prochain démarrage à venir (le plus proche).
  const upcoming = tasks
    .map((t) => (t.startTime ? new Date(t.startTime) : null))
    .filter((d) => d && d.getTime() > now)
    .sort((a, b) => a - b)[0]

  const gauge = (cls, label, pct, count) => `
    <div class="mtask-gauge mtask-gauge--${cls}">
      <div class="mtask-gauge__head">
        <span class="mtask-gauge__label">${label}</span>
        <span class="mtask-gauge__pct">${pct} %</span>
      </div>
      <div class="mtask-gauge__track"><span class="mtask-gauge__fill" style="width:${pct}%"></span></div>
      <span class="mtask-gauge__count">${count} tâche${count !== 1 ? 's' : ''}</span>
    </div>`

  const message =
    tasks.length === 0
      ? { title: 'Aucune tâche pour le moment', text: 'Ajoute ta première tâche pour démarrer ta journée.' }
      : globalPct === 100
        ? { title: 'Parfait !', text: 'Toutes vos tâches de la journée sont terminées. Excellente journée !' }
        : globalPct >= 50
          ? { title: 'Vous êtes sur la bonne voie !', text: 'Continuez vos efforts pour atteindre vos objectifs quotidiens.' }
          : { title: 'C\'est parti !', text: 'Fournissez des preuves sur vos tâches en cours pour faire avancer votre journée.' }

  el.innerHTML = `
    <div class="mtasks2__day-ring">
      <div class="mtasks2__ring" style="--pct:${globalPct}">
        <span><strong>${globalPct} %</strong><em>Objectif du jour</em></span>
      </div>
      <ul class="mtasks2__legend">
        <li><i style="background:var(--badge-done-text)"></i>Terminées<b>${done.length}</b></li>
        <li><i style="background:var(--badge-doing-text)"></i>En cours<b>${doing.length}</b></li>
        <li><i style="background:var(--badge-todo-text)"></i>En retard<b>${late.length}</b></li>
        <li><i style="background:var(--text-muted)"></i>À venir<b>${todo.length}</b></li>
      </ul>
    </div>
    <div class="mtasks2__motivation">
      <span class="mtasks2__motivation-icon" aria-hidden="true">🏆</span>
      <span><strong>${message.title}</strong><p>${message.text}</p></span>
    </div>`
}
// --- Dashboard (maquette Doli) : rendus ---------------------------------
// Réutilisation des calculs existants (computeTaskProgress, etc.) :
// présentation uniquement.

// Donut de répartition (conic-gradient) + légende par statut.
export function renderDashKpiDistribution(donutEl, totalEl, legendEl, footerEl, stats) {
  if (!donutEl) return
  const total = stats.total || 0
  const segments = []
  let acc = 0
  const parts = [
    ['var(--badge-done-text)', stats.done],
    ['var(--badge-doing-text)', stats.doing],
    ['var(--text-muted)', stats.todo],
    ['var(--badge-todo-text)', stats.delayed],
  ]
  const base = total === 0 ? 1 : total
  parts.forEach(([color, count]) => {
    const start = (acc / base) * 100
    acc += count
    const end = (acc / base) * 100
    segments.push(`${color} ${start}% ${end}%`)
  })
  if (total === 0) segments.push('var(--bg-hover) 0% 100%')
  donutEl.style.background = `conic-gradient(${segments.join(', ')})`
  if (totalEl) totalEl.textContent = total
  if (legendEl) {
    const item = (color, label, count) => `
      <li><span class="dash-legend__dot" style="background:${color}"></span>${label} <strong>${count}</strong></li>`
    legendEl.innerHTML = `
      ${item('var(--badge-done-text)', 'Exécutées', stats.done)}
      ${item('var(--badge-doing-text)', 'En Cours', stats.doing)}
      ${item('var(--text-muted)', 'Non exécutées', stats.todo)}
      ${item('var(--badge-todo-text)', 'En retard', stats.delayed)}`
  }
  if (footerEl) footerEl.textContent = `Total : ${total} tâches`
}

// Bloc « Performance : résumé » intégré aux KPIs (côte à côte Répartition).
export function renderDashKpiPerformance(listEl, barsEl, tasks, now) {
  if (!listEl || !barsEl) return
  const total = tasks.length
  const base = total === 0 ? 1 : total
  let inTime = 0
  let lateSmall = 0
  let lateBig = 0
  tasks.forEach((task) => {
    if (task.status === STATUS.DONE) {
      inTime += 1
      return
    }
    if (task.dueDate && new Date(task.dueDate).getTime() < now) {
      const ms = now - new Date(task.dueDate).getTime()
      if (ms >= 60 * 60 * 1000) lateBig += 1
      else lateSmall += 1
      return
    }
    inTime += 1
  })
  const bar = (cls, label, count) => `
    <div class="dash-perf-bar dash-perf-bar--${cls}">
      <div class="dash-perf-bar__head">
        <span>${label}</span>
        <strong>${Math.round((count / base) * 100)} %</strong>
      </div>
      <div class="dash-perf-bar__track"><span style="width:${Math.round((count / base) * 100)}%"></span></div>
    </div>`
  listEl.innerHTML = `
    <li><span class="dash-perf-dot dash-perf-dot--ok"></span>${inTime} tâche${inTime !== 1 ? 's' : ''} réalisée${inTime !== 1 ? 's' : ''} dans les délais</li>
    <li><span class="dash-perf-dot dash-perf-dot--mid"></span>${lateSmall} en retard modéré</li>
    <li><span class="dash-perf-dot dash-perf-dot--bad"></span>${lateBig} en retard important</li>`
  barsEl.innerHTML = `
    ${bar('ok', 'Dans les délais', inTime)}
    ${bar('mid', 'Retard modéré', lateSmall)}
    ${bar('bad', 'Retard important', lateBig)}`
}

// Mini-liste « Tâches en retard » : cartes détaillées (même rendu que
// « Mes tâches »), comme sur la maquette Doli.
export function renderDashLate(el, tasks, now) {
  if (!el) return
  if (tasks.length === 0) {
    el.innerHTML = '<p class="dash-minilist__empty">Aucune tâche en retard. Tout va bien !</p>'
    return
  }
  el.innerHTML = tasks.map((task) => dashCardHtml(task, now)).join('')
}

// Mini-liste « Prochaines échéances » : Aujourd'hui/Demain à HH:MM + compte
// à rebours formaté (réutilise formatCountdown existant).
export function renderDashUpcoming(el, items, now) {
  if (!el) return
  if (items.length === 0) {
    el.innerHTML = '<p class="dash-minilist__empty">Aucune échéance à venir.</p>'
    return
  }
  const today0 = new Date()
  today0.setHours(0, 0, 0, 0)
  const dayMs = 24 * 60 * 60 * 1000
  el.innerHTML = items
    .map(({ task, target }) => {
      const dayIndex = Math.floor((target.getTime() - today0.getTime()) / dayMs)
      let dayLabel
      if (dayIndex <= 0) dayLabel = "Aujourd'hui"
      else if (dayIndex === 1) dayLabel = 'Demain'
      else dayLabel = target.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'short' })
      const time = target.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      return `
      <div class="dash-mini">
        <span class="dash-mini__title">${escapeHtml(task.title)}</span>
        <span class="dash-mini__meta">${dayLabel} à ${time}</span>
        <span class="dash-mini__countdown">${formatCountdown(target.getTime() - now)}</span>
      </div>`
    })
    .join('')
}

// Résumé performance : compte par situation + 3 jauges en % du total.
export function renderDashPerfSummary(listEl, barsEl, tasks, now) {
  if (!listEl || !barsEl) return
  const total = tasks.length
  const base = total === 0 ? 1 : total
  let inTime = 0
  let lateSmall = 0
  let lateBig = 0
  tasks.forEach((task) => {
    if (task.status === STATUS.DONE) {
      inTime += 1
      return
    }
    if (task.dueDate && new Date(task.dueDate).getTime() < now) {
      const ms = now - new Date(task.dueDate).getTime()
      if (ms >= 60 * 60 * 1000) lateBig += 1
      else lateSmall += 1
      return
    }
    inTime += 1
  })
  const bar = (cls, label, count) => `
    <div class="dash-perf-bar dash-perf-bar--${cls}">
      <div class="dash-perf-bar__head">
        <span>${label}</span>
        <strong>${Math.round((count / base) * 100)} %</strong>
      </div>
      <div class="dash-perf-bar__track"><span style="width:${Math.round((count / base) * 100)}%"></span></div>
    </div>`
  listEl.innerHTML = `
    <li><span class="dash-perf-dot dash-perf-dot--ok"></span>${inTime} tâche${inTime !== 1 ? 's' : ''} réalisée${inTime !== 1 ? 's' : ''} dans les délais</li>
    <li><span class="dash-perf-dot dash-perf-dot--mid"></span>${lateSmall} en retard modéré</li>
    <li><span class="dash-perf-dot dash-perf-dot--bad"></span>${lateBig} en retard important</li>`
  barsEl.innerHTML = `
    ${bar('ok', 'Dans les délais', inTime)}
    ${bar('mid', 'Retard modéré', lateSmall)}
    ${bar('bad', 'Retard important', lateBig)}`
}

// Activité récente : création / preuve / terminaison, les plus récentes.
export function renderDashActivity(el, tasks) {
  if (!el) return
  const events = []
  tasks.forEach((task) => {
    const title = escapeHtml(task.title)
    if (task.createdAt) events.push({ ts: task.createdAt, cls: 'create', text: `Vous avez créé la tâche « ${title} »` })
    if (task.lastProofAt) events.push({ ts: task.lastProofAt, cls: 'proof', text: `Vous avez ajouté une preuve — « ${title} »` })
    if (task.completedAt) events.push({ ts: task.completedAt, cls: 'done', text: `Vous avez terminé la tâche « ${title} »` })
  })
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts))
  const top = events.slice(0, 4)
  if (top.length === 0) {
    el.innerHTML = '<p class="dash-minilist__empty">Aucune activité pour le moment.</p>'
    return
  }
  const since = (ts) => {
    const ms = Date.now() - new Date(ts).getTime()
    const min = Math.floor(ms / 60000)
    if (min < 1) return "à l'instant"
    if (min < 60) return `Il y a ${min} min`
    const h = Math.floor(min / 60)
    if (h < 24) return `Il y a ${h} h`
    return `Il y a ${Math.floor(h / 24)} j`
  }
  const ICONS = {
    create: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="10" y1="4" x2="10" y2="16"/><line x1="4" y1="10" x2="16" y2="10"/></svg>',
    proof: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3l7 3-7 3"/><path d="M7 3h3"/><circle cx="12" cy="6" r="1.3"/><path d="M1 8h8l2 3-5 2"/></svg>',
    done: '<svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5,13 10,18 19,7"/></svg>',
  }
  el.innerHTML = top
    .map((e) => `
      <div class="dash-activity__item dash-activity__item--${e.cls}">
        <span class="dash-activity__icon">${ICONS[e.cls]}</span>
        <span class="dash-activity__text">${e.text}</span>
        <span class="dash-activity__time">${since(e.ts)}</span>
      </div>`)
    .join('')
}
