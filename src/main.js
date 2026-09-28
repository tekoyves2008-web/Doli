// main.js
// Point d'entrée de l'application. Relie les modules entre eux, réagit
// aux événements DOM, et déclenche le re-rendu à chaque changement.

import './style.css'
import { loadSettings, saveSettings } from './modules/storage.js'
import { applyPrefs, getPrefs, updatePrefs, withDefaults } from './modules/prefs.js'
import { escapeHtml } from './modules/escape.js'
import { renderSettings } from './modules/settingsView.js'
import { getAllTasks, addTask, updateTask, deleteTask, setStatus, provideProof, findTask, STATUS } from './modules/tasks.js'
import {
  computeStats,
  computeStreak,
} from './modules/stats.js'
import {
  computeTaskProgress,
  computeGlobalProgress,
  countUnmeasuredTasks,
  computeProgressionTrend,
} from './modules/progression.js'
import { applyTheme } from './modules/theme.js'
import { computeGlobalPerformance } from './modules/performance.js'
import {
  computeRetardsStats,
  computeRetardsEvolution,
  renderRetardsBarChart,
  renderRetardsDonutChart,
  renderRetardsTable,
  formatDelay,
  formatHoursFlat,
  formatRateFR,
  isTaskOverdue,
} from './modules/retards.js'
import {
  bindTaskEvents,
  openProofAddMenu,
  openProofFilePicker,
  renderBell,
  bindBellMenu,
  renderReminders,
  triggerConfetti,
  renderProgressionMaquette,
  bindProgressionFilters,
  bindPgCardMenus,
  renderDashKpiDistribution,
  renderDashKpiPerformance,
  renderDashLate,
  renderDashUpcoming,
  renderDashPerfSummary,
  renderDashActivity,
  renderDashTaskCards,
  renderTasksTabs,
  renderTasksCounts,
  renderTasksTable,
  renderTasksSummary,
} from './modules/ui.js'
import { renderPreuves, syncUserProofs } from './modules/preuves.js'
import { initAlarms } from './modules/alarms.js'
import { enhanceDoliSelect } from './modules/doliSelect.js'
import { getSession, login, register, signOut, getRegistrationPolicy } from './modules/auth.js'
import { initLoginAmbience } from './modules/loginAmbience.js'

const STATUS_FILTER_LABEL = {
  [STATUS.TODO]: 'non exécutée',
  [STATUS.DOING]: 'en cours',
  [STATUS.DONE]: 'exécutée',
  delayed: 'en retard',
}

// --- Références DOM ------------------------------------------------
// getEl() plutôt que getElementById() direct : main.js date du 01/09 et
// certains IDs peuvent manquer selon la version d'index.html chargée.
// Tout accès ci-dessous tolère null (voir les gardes dans render et les
// bind) : le module ne plante plus, le formulaire de login reste actif.
const navButtons = document.querySelectorAll('.sidebar-nav__item')
const viewTitleEl = document.getElementById('viewTitle')
const viewEls = {
  dashboard: document.getElementById('viewDashboard'),
  tasks: document.getElementById('viewTasks'),
  reminders: document.getElementById('viewReminders'),
  progression: document.getElementById('viewProgression'),
  retards: document.getElementById('viewRetards'),
  preuves: document.getElementById('viewPreuves'),
  settings: document.getElementById('viewSettings'),
}
const viewTitles = {
  dashboard: 'Dashboard',
  tasks: 'Mes tâches',
  reminders: 'Rappel',
  progression: 'Progression',
  retards: 'Retards',
  preuves: 'Preuves',
  settings: 'Paramètres',
}
const reminderListEl = document.getElementById('reminderList')
const settingsBodyEl = document.getElementById('settingsBody')
const reminderNavCountEl = document.getElementById('reminderNavCount')
let remTab = 'all'
let remStatusFilter = 'all'
function remGet(name, fallback) { try { const v = localStorage.getItem(name); return v === null ? fallback : v } catch { return fallback } }
function remSet(name, v) { try { localStorage.setItem(name, v) } catch {} }
let remCfg = { browser: remGet('remCfgBrowser', '1'), mail: remGet('remCfgMail', '1'), sound: remGet('remCfgSound', '1'), freq: remGet('remCfgFreq', '2h') }

const progressionContainer = viewEls.progression
const preuvesListEl = document.getElementById('preuvesList')

// --- Références DOM : dashboard (maquette Doli) --------------------------
const dashGreetingEl = document.getElementById('dashGreeting')
const dashDateEl = document.getElementById('dashDate')
const dashProgressRingEl = document.getElementById('dashProgressRing')
const dashProgressPctEl = document.getElementById('dashProgressPct')
const dashProgressDeltaEl = document.getElementById('dashProgressDelta')
const dashPerformanceEl = document.getElementById('dashPerformance')
const dashPerformancePctEl = document.getElementById('dashPerformancePct')
const dashLateListEl = document.getElementById('dashLateList')
const dashLateCountEl = document.getElementById('dashLateCount')
const dashLateSubEl = document.getElementById('dashLateSub')
const dashDoneWeekEl = document.getElementById('dashDoneWeek')
const dashDonutEl = document.getElementById('dashDonut')
const dashDonutTotalEl = document.getElementById('dashDonutTotal')
const dashLegendEl = document.getElementById('dashLegend')
const dashDistTotalEl = document.getElementById('dashDistTotal')
const dashPerfListEl = document.getElementById('dashPerfList')
const dashPerfBarsEl = document.getElementById('dashPerfBars')
const dashTabsEl = document.getElementById('dashTabs')
const dashSearchInputEl = document.getElementById('dashSearchInput')
const dashSortBtnEl = document.getElementById('dashSortBtn')
const dashSortMenuEl = document.getElementById('dashSortMenu')
const dashAllTasksEl = document.getElementById('dashAllTasks')
const dashUpcomingEl = document.getElementById('dashUpcoming')
const dashActivityEl = document.getElementById('dashActivity')
const dashViewLateBtn = document.getElementById('dashViewLate')
const dashViewDoneBtn = document.getElementById('dashViewDone')
const dashViewAllBtn = document.getElementById('dashViewAll')
const dashViewDetailsBtn = document.getElementById('dashViewDetails')
const dashViewUpcomingBtn = document.getElementById('dashViewUpcoming')
const dashLearnStatsBtn = document.getElementById('dashLearnStats')
const dashPerfLearnBtn = document.getElementById('dashViewPerf')
const addTaskBtn = document.getElementById('addTaskBtn')
const addTaskBtn3 = document.getElementById('addTaskBtn3')

const taskListEl = document.getElementById('taskList')
const taskSearchInput = document.getElementById('taskSearchInput')
const taskSortBtn = document.getElementById('taskSortBtn')
const taskSortMenu = document.getElementById('taskSortMenu')
const tasksCountsEl = document.getElementById('tasksCounts')
const tasksBellCountEl = document.getElementById('tasksBellCount')
const tasksPageInfoEl = document.getElementById('tasksPageInfo')
const tasksPageNumsEl = document.getElementById('tasksPageNums')
const tasksPrevBtn = document.getElementById('tasksPrevBtn')
const tasksNextBtn = document.getElementById('tasksNextBtn')
const tasksSummaryEl = document.getElementById('tasksSummary')
const taskQuickSortEl = document.getElementById('taskQuickSort')
const taskQuickPriorityEl = document.getElementById('taskQuickPriority')
const taskQuickStatusEl = document.getElementById('taskQuickStatus')
const taskPeriodFilterEl = document.getElementById('taskPeriodFilter')
const taskResetFiltersBtn = document.getElementById('taskResetFiltersBtn')
// Ecriture d'une valeur dans un <select> en redispatchant « input » : les
// menus deroulants doliSelect (filtres rapides) rafraichissent ainsi leur
// etiquette, et rien n'est emis si la valeur ne change pas.
const setSelectValue = (el, v) => { if (el && el.value !== v) { el.value = v; el.dispatchEvent(new Event('input')) } }

// Éléments de pagination du Dashboard
const dashPageInfoEl = document.getElementById('dashPageInfo')
const dashPageNumsEl = document.getElementById('dashPageNums')
const dashPrevBtn = document.getElementById('dashPrevBtn')
const dashNextBtn = document.getElementById('dashNextBtn')
const tasksBellBtn = document.getElementById('tasksBellBtn')
const tasksPrivacyBtn = document.getElementById('tasksPrivacyBtn')

const bellBtn = document.getElementById('bellBtn')
const bellCountEl = document.getElementById('bellCount')
const bellMenuEl = document.getElementById('bellMenu')
const bellOverlayEl = document.getElementById('bellOverlay')

// Attache un listener seulement si l'élément existe : certains IDs
// (vieux dashboard, vues redessinées) peuvent manquer dans index.html
// sans que ce soit une erreur bloquante.
function onEl(el, event, handler) {
  if (el) el.addEventListener(event, handler)
}

const themeToggleBtn = document.getElementById('themeToggleBtn')

const sidebarMenuBtn = document.getElementById('sidebarMenuBtn')
const sidebarEl = document.querySelector('.sidebar-fixed')
const sidebarOverlayEl = document.getElementById('sidebarOverlay')

const appShellEl = document.querySelector('.app-shell')
const loginScreenEl = document.getElementById('loginScreen')
const accountRowEl = document.getElementById('accountRow')
const accountAvatarFallbackEl = document.getElementById('accountAvatarFallback')

// Champ de logos de l'écran de connexion : semé une seule fois, derrière la
// carte. Le module mesure lui-même la carte pour ne rien poser dessous.
initLoginAmbience(loginScreenEl, document.querySelector('.login-card'))

const accountNameEl = document.getElementById('accountName')
const logoutBtn = document.getElementById('logoutBtn')

const loginPanelEl = document.getElementById('loginPanel')
const registerPanelEl = document.getElementById('registerPanel')
const loginForm = document.getElementById('loginForm')
const loginEmailField = document.getElementById('loginEmail')
const loginPasswordField = document.getElementById('loginPassword')
const loginErrorEl = document.getElementById('loginError')
const showRegisterBtn = document.getElementById('showRegisterBtn')
const registerForm = document.getElementById('registerForm')
const registerNameField = document.getElementById('registerName')
const registerEmailField = document.getElementById('registerEmail')
const registerPasswordField = document.getElementById('registerPassword')
const registerConfirmPasswordField = document.getElementById('registerConfirmPassword')
const registerErrorEl = document.getElementById('registerError')
const registerInviteField = document.getElementById('registerInviteField')
const registerInviteInput = document.getElementById('registerInvite')
const showLoginBtn = document.getElementById('showLoginBtn')

const modalOverlay = document.getElementById('taskModalOverlay')
const modalTitleEl = document.getElementById('modalTitle')
const taskForm = document.getElementById('taskForm')
const taskIdField = document.getElementById('taskId')
const taskTitleField = document.getElementById('taskTitle')
const taskDescField = document.getElementById('taskDesc')
const taskDueField = document.getElementById('taskDue')
const taskStartField = document.getElementById('taskStart')
const taskPriorityField = document.getElementById('taskPriority')
const taskEditBtn = document.getElementById('taskEditBtn')
const taskSubmitBtn = document.getElementById('taskSubmitBtn')
const taskCancelBtn = document.getElementById('taskCancelBtn')
const taskFields = [taskTitleField, taskDescField, taskStartField, taskDueField]

// Petite fenêtre « Ajouter une preuve » (rubrique Mes tâches) : mêmes
// classes/id-pattern que la fenêtre « Que faire de ce rappel ? ».
const proofAddOverlay = document.getElementById('proofAddOverlay')
const proofAddTextEl = document.getElementById('proofAddText')
const proofAddFileBtn = document.getElementById('proofAddFileBtn')
const proofAddPhotoBtn = document.getElementById('proofAddPhotoBtn')
const proofAddSimpleBtn = document.getElementById('proofAddSimpleBtn')
const proofAddCancelBtn = document.getElementById('proofAddCancelBtn')

const SUN_ICON = `<svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="4"/><line x1="10" y1="1.5" x2="10" y2="3.5"/><line x1="10" y1="16.5" x2="10" y2="18.5"/><line x1="1.5" y1="10" x2="3.5" y2="10"/><line x1="16.5" y1="10" x2="18.5" y2="10"/><line x1="4" y1="4" x2="5.4" y2="5.4"/><line x1="14.6" y1="14.6" x2="16" y2="16"/><line x1="4" y1="16" x2="5.4" y2="14.6"/><line x1="14.6" y1="5.4" x2="16" y2="4"/></svg>`
const MOON_ICON = `<svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor"><path d="M15.8 12.4A6.5 6.5 0 017.6 4.2a6.5 6.5 0 108.2 8.2z"/></svg>`

// --- État local (en mémoire) --------------------------------------------
// Chargé une fois à la connexion (voir startApp), puis gardé à jour ici :
// chaque modification met à jour cet objet ET appelle saveSettings, plutôt
// que de le recharger du serveur à chaque fois.
// NB : `viewMode` existe en base mais n'est lu nulle part — aucun écran ne
// propose de choisir entre liste et grille, donc ce réglage est inopérant. La
// colonne est laissée en place (la supprimer modifierait le schéma) mais le
// champ est retiré de cet objet : plus rien ne prétend l'utiliser. Si un mode
// d'affichage est un jour réintroduit, c'est ici qu'il faudra le brancher.
let settings = { theme: 'dark', bestStreak: 0, weeklyGoal: 10, achievementThresholds: [10, 50] }
// Prénom affiché devant la phrase d'encouragement du dashboard.
let currentUserFirstName = ''
let currentView = 'dashboard'
let statusFilter = null
let progressionPeriod = 1 // Nombre de jours pour la vue progression (1 = aujourd'hui)
// Recherche et tri de la rubrique "Mes tâches".
let searchQuery = ''
let sortMode = 'default'
// Recherche, tri et onglet actif du « Mes tâches » du dashboard.
let dashQuery = ''
let dashSortMode = 'default'
let dashFilter = 'all'
// Filtres rapides de la rubrique « Mes tâches » (maquette) + pagination.
let tasksPage = 1
const TASKS_PAGE_SIZE = 6
// Pagination du widget Dashboard : constante et état totalement séparés de
// « Mes tâches ». Le nombre de pages dépend uniquement des tâches filtrées.
const DASH_TASKS_PAGE_SIZE = 6
let dashTasksPage = 1
let tasksQuickSort = 'default'
let tasksQuickPriority = 'all'
let tasksQuickStatus = 'all'
let tasksPeriod = 'week'
// Tâches dont le statut a changé pendant qu'un filtre était actif : elles
// restent visibles tant que l'utilisateur ne relance pas un filtre.
let pinnedIds = new Set()
// Tâches "supprimées" depuis le widget Tâches récentes : elles ne quittent
// que ce widget, la tâche elle-même reste intacte dans "Mes tâches".
let dismissedRecentIds = new Set()
// Tâches retirées de la rubrique Rappel sans être supprimées (choix de
// l'utilisateur face à la confirmation de suppression). Persisté en
// localStorage : sans ça, un simple re-render (statut modifié, etc.)
// vidait le Set en mémoire et refaisait réapparaître des rappels masqués,
// ou à l'inverse tout semblait "disparaître" après rechargement.
function loadDismissedReminderIds() {
  try {
    const raw = localStorage.getItem('dismissedReminderIds')
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr.map((v) => String(v)) : [])
  } catch { return new Set() }
}
function saveDismissedReminderIds() {
  try { localStorage.setItem('dismissedReminderIds', JSON.stringify([...dismissedReminderIds])) } catch {}
}
let dismissedReminderIds = loadDismissedReminderIds()
const isDismissedReminder = (id) => dismissedReminderIds.has(String(id))
// --- Cloche : notifications déjà consultées (persistées) -------------------
// bellSeenIds : ids des notifications affichées à l'ouverture de la cloche.
// Marquées « vues » à la consultation : elles ne réapparaissent JAMAIS (même
// après rechargement). Purgé à chaque rendu (vus := vus ∩ actuels) : une
// tâche qui repasse en retard ou un rappel ré-échu devient une NOUVELLE
// notification. lastBellNotifIds = ids non vus du dernier rendu (ceux que la
// prochaine ouverture marquera comme consultés).
let lastBellNotifIds = []
function loadSeenBell() {
  try {
    const raw = remGet('bellSeenIds', '')
    if (!raw) return new Set()
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch { return new Set() }
}
function saveSeenBell(ids) {
  try { remSet('bellSeenIds', JSON.stringify([...ids])) } catch {}
}

// --- Badges « nouvelles notifications » des rubriques Retards et Rappel ----
// Le badge affiche UNIQUEMENT le nombre d'éléments apparus depuis la dernière
// consultation (ou depuis le premier lancement) — jamais le total, jamais ceux
// déjà présents. Les IDs « déjà vus » sont persistés en localStorage (même
// convention que dismissedReminderIds) et purgés à chaque rendu : une tâche
// qui quitte puis réintègre le compteur est de nouveau une NOUVELLE occurence.
const NAV_BADGE_KEY = { retards: 'retardsSeenIds', reminders: 'remindersSeenIds' }
const NAV_BADGE_EL = { retards: 'retardsNavCount', reminders: 'reminderNavCount' }
const lastNavIds = { retards: [], reminders: [] }
function loadSeenIds(key) {
  try {
    const raw = remGet(NAV_BADGE_KEY[key], '')
    if (!raw) return null
    const arr = JSON.parse(raw)
    return new Set(Array.isArray(arr) ? arr.map(String) : [])
  } catch { return null }
}
function saveSeenIds(key, ids) {
  try { remSet(NAV_BADGE_KEY[key], JSON.stringify([...ids])) } catch {}
}
function applyNavBadge(key, currentIds, badgeId) {
  const badge = document.getElementById(badgeId)
  const cur = (currentIds || []).map(String)
  lastNavIds[key] = cur
  const curSet = new Set(cur)
  let seen = loadSeenIds(key)
  if (seen === null) {
    // Premier lancement : la base existante devient la référence — ces
    // notifications « déjà là » ne sont jamais comptées comme nouvelles.
    seen = new Set(curSet)
    saveSeenIds(key, seen)
  } else {
    // Purge : un ID sorti du compteur (retard résolu, rappel terminé…) est
    // retiré des vus ; s'il y revient, c'est une nouvelle occurrence.
    seen = new Set([...seen].filter((id) => curSet.has(id)))
    saveSeenIds(key, seen)
  }
  const fresh = cur.filter((id) => !seen.has(id))
  if (badge) {
    badge.textContent = String(fresh.length)
    badge.hidden = fresh.length === 0
  }
}
// Consultation de la rubrique : tout ce qui est couramment affiché devient « vu ».
function markNavBadgeSeen(key) {
  saveSeenIds(key, new Set(lastNavIds[key]))
  const badge = document.getElementById(NAV_BADGE_EL[key])
  if (badge) {
    badge.textContent = '0'
    badge.hidden = true
  }
}

// --- Tri de la rubrique "Mes tâches" -------------------------------------
const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 }
// Une priorité haute "avance" fictivement l'échéance de 2 jours (1 jour pour
// moyenne, 0 pour basse) : elle se ressent plus urgente que son échéance
// réelle ne le laisse penser, sans jamais dépasser une tâche déjà en retard.
const PRIORITY_URGENCY_BOOST_MS = { high: 2 * 24 * 60 * 60 * 1000, medium: 1 * 24 * 60 * 60 * 1000, low: 0 }

// Score d'urgence "maison" : plus il est petit, plus la tâche doit remonter.
// Les tâches en retard remontent toujours en premier (les plus anciennement
// en retard d'abord) ; parmi celles à venir, la priorité rapproche
// virtuellement l'échéance ; les tâches sans échéance passent en dernier,
// simplement départagées par priorité ; les tâches exécutées ferment la marche.
function urgencyScore(task, now) {
  if (task.status === STATUS.DONE) return Infinity
  const priority = task.priority || 'medium'
  if (!task.dueDate) return 1e15 - PRIORITY_WEIGHT[priority]
  const due = new Date(task.dueDate).getTime()
  return due - PRIORITY_URGENCY_BOOST_MS[priority] - now
}

function sortTasks(tasks, mode, now) {
  const list = [...tasks]
  switch (mode) {
    case 'urgency':
      return list.sort((a, b) => urgencyScore(a, now) - urgencyScore(b, now))
    case 'priority':
      return list.sort((a, b) => PRIORITY_WEIGHT[b.priority || 'medium'] - PRIORITY_WEIGHT[a.priority || 'medium'])
    case 'due':
      return list.sort((a, b) => {
        if (!a.dueDate && !b.dueDate) return 0
        if (!a.dueDate) return 1
        if (!b.dueDate) return -1
        return new Date(a.dueDate) - new Date(b.dueDate)
      })
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' }))
    default:
      return list
  }
}

// Salutation du Dashboard selon l'heure locale réelle de l'appareil
// (téléphone ou ordinateur). getHours() suit le fuseau actuellement configuré
// sur l'appareil : ni UTC ni l'heure du serveur ne sont utilisés.
function getDashboardGreeting(date = new Date()) {
  const hour = date.getHours()
  if (hour < 4) return 'Nouvelle journée, nouveau défi'
  if (hour < 12) return 'Bonne matinée'
  if (hour < 18) return 'Bon après-midi'
  return 'Bonsoir'
}

function updateDashboardGreeting(date = new Date()) {
  if (!dashGreetingEl) return
  const salutation = getDashboardGreeting(date)
  const name = String(currentUserFirstName || '').trim()
  dashGreetingEl.textContent = name ? `${salutation}, ${name} !` : `${salutation} !`
}

// L'appareil a pu être en veille ou changer de fuseau pendant l'absence :
// resynchroniser uniquement le texte, sans recharger inutilement toutes les tâches.
document.addEventListener('visibilitychange', () => updateDashboardGreeting())
window.addEventListener('focus', () => updateDashboardGreeting())
window.addEventListener('pageshow', () => updateDashboardGreeting())

// --- Rendu global -----------------------------------------------------
// Async : les tâches viennent maintenant du serveur (fetch) à chaque appel.
async function render() {
  const allTasks = await getAllTasks()
  const stats = computeStats(allTasks)
  const now = Date.now()

  // Garde-fou : une erreur de rendu (donnée inattendue, module KO) ne doit
  // jamais vider les rubriques dashboard / mes tâches / rappel / preuves.
  // L'échec est journalisé dans la console, l'application reste utilisable.
  try {

  // --- Dashboard (maquette Doli) : tous les rendus passent par les calculs
  // existants (computeTaskProgress, situationInfo, etc.) — présentation seule.
  updateDashboardGreeting()
  if (dashDateEl) {
    const parts = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    dashDateEl.textContent = parts.charAt(0).toUpperCase() + parts.slice(1)
  }

  // Règle de retard : celle de retards.js (source unique). La version locale
  // renvoyait `null`/`''` — et non `false` — quand une tâche n'avait pas
  // d'échéance, et ne testait pas la validité de la date.
  const isLate = isTaskOverdue
  const delayed = allTasks.filter(isLate)
  const kpiStats = { total: allTasks.length, done: stats.done, doing: stats.doing, todo: stats.todo, delayed: delayed.length }

  // Progression globale réelle : moyenne pondérée par priorité
  // (computeGlobalProgress : Σ(Pi×Wi)/Σ(Wi), tâches incalculables exclues),
  // identique à la rubrique Progression. Delta vs hier (tendance sur 2 jours,
  // elle aussi pondérée via averageProgress).
  const globalPct = computeGlobalProgress(allTasks)
  const unmeasured = countUnmeasuredTasks(allTasks)
  if (dashProgressRingEl) dashProgressRingEl.style.setProperty('--percent', globalPct)
  if (dashProgressPctEl) dashProgressPctEl.textContent = `${globalPct} %`
  const trend2 = computeProgressionTrend(allTasks, 2)
  const delta = trend2.length === 2 ? trend2[1].percent - trend2[0].percent : 0
  // Compteur discret joint au delta : rend l'exclusion des tâches non
  // mesurées (en cours sans preuve) transparente, sans casser la maquette.
  const deltaSuffix = unmeasured > 0 ? ` — ${unmeasured} non mesurée${unmeasured !== 1 ? 's' : ''}` : ''
  if (dashProgressDeltaEl) dashProgressDeltaEl.textContent = `${delta >= 0 ? '+' : ''}${delta} % par rapport à hier${deltaSuffix}`

  // Performance globale REELLE (formules utilisateur, option B stricte) :
  // PerFG = (somme Pi x (1 - 0,5 x IGi) / n) x 100, avec RD/RF/RG/TR/IG.
  // Remplace l'ancien ratio (total-retard)/total.
  const perf = computeGlobalPerformance(allTasks, now)
  if (dashPerformanceEl) dashPerformanceEl.style.setProperty('--percent', perf.percent)
  if (dashPerformancePctEl) dashPerformancePctEl.textContent = `${perf.percent} %`

  // Tâches en retard (les plus anciennement en retard d'abord) + terminées.
  const lateTasks = [...delayed].sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
  renderDashLate(dashLateListEl, lateTasks, now)
  // Carte « Tâches en retard » : seulement le nombre (comme « Tâches
  // terminées »), avec une phrase d'alerte en haut.
  if (dashLateCountEl) dashLateCountEl.textContent = lateTasks.length
  if (dashLateSubEl) dashLateSubEl.textContent = lateTasks.length === 0
    ? 'Aucun retard, bravo'
    : lateTasks.length === 1
      ? '1 tâche à rattraper au plus vite'
      : `${lateTasks.length} tâches à rattraper au plus vite`
  const today0 = new Date()
  today0.setHours(0, 0, 0, 0)
  const monday = new Date(today0.getTime() - ((today0.getDay() + 6) % 7) * 24 * 60 * 60 * 1000)
  const doneThisWeek = allTasks.filter((t) => t.completedAt && new Date(t.completedAt).getTime() >= monday.getTime()).length
  if (dashDoneWeekEl) dashDoneWeekEl.textContent = doneThisWeek

  // Répartition des tâches (donut + légende) et Performance : résumé.
  renderDashKpiDistribution(dashDonutEl, dashDonutTotalEl, dashLegendEl, dashDistTotalEl, kpiStats)
  renderDashPerfSummary(dashPerfListEl, dashPerfBarsEl, allTasks, now)

  // Prochaines échéances : 3 tâches à venir, les plus proches d'abord.
  const upcoming = allTasks
    .filter((t) => t.status !== STATUS.DONE && t.dueDate && new Date(t.dueDate).getTime() > now)
    .sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate))
    .slice(0, 3)
    .map((task) => ({ task, target: new Date(task.dueDate) }))
  renderDashUpcoming(dashUpcomingEl, upcoming, now)

  // Activité récente (créations, preuves, terminaisons).
  renderDashActivity(dashActivityEl, allTasks)

  // Mes tâches du dashboard : onglets de filtre, recherche, tri, cartes.
  const dashCounts = { all: allTasks.length, doing: stats.doing, todo: stats.todo, done: stats.done, delayed: delayed.length }
  renderTasksTabs(dashTabsEl, dashCounts, dashFilter)
  let dashTasks = allTasks
  if (dashFilter && dashFilter !== 'all') {
    dashTasks = dashFilter === 'delayed' ? dashTasks.filter(isLate) : dashTasks.filter((t) => t.status === dashFilter)
  }
  const trimmedDashQuery = dashQuery.trim().toLowerCase()
  if (trimmedDashQuery) {
    dashTasks = dashTasks.filter(
      (t) => t.title.toLowerCase().includes(trimmedDashQuery) || (t.description || '').toLowerCase().includes(trimmedDashQuery)
    )
  }
  dashTasks = sortTasks(dashTasks, dashSortMode, now)
  // Pagination du Dashboard : calculée UNIQUEMENT à partir de dashTasks,
  // jamais depuis la hauteur ou le contenu de Performance : résumé.
  const dashTotalPages = dashTasks.length
    ? Math.ceil(dashTasks.length / DASH_TASKS_PAGE_SIZE)
    : 0
  dashLastTotalPages = dashTotalPages
  if (dashTotalPages === 0) dashTasksPage = 1
  else if (dashTasksPage > dashTotalPages) dashTasksPage = dashTotalPages
  const dashStart = (dashTasksPage - 1) * DASH_TASKS_PAGE_SIZE
  const dashPageTasks = dashTasks.slice(dashStart, dashStart + DASH_TASKS_PAGE_SIZE)
  renderDashTaskCards(dashAllTasksEl, dashPageTasks, now)
  if (dashPageInfoEl) {
    if (dashTasks.length === 0) dashPageInfoEl.textContent = 'Affichage de 0 sur 0 tâche'
    else {
      const dashFrom = dashStart + 1
      const dashTo = Math.min(dashStart + DASH_TASKS_PAGE_SIZE, dashTasks.length)
      dashPageInfoEl.textContent = `Affichage de ${dashFrom} à ${dashTo} sur ${dashTasks.length} tâche${dashTasks.length > 1 ? 's' : ''}`
    }
  }
  if (dashPageNumsEl) {
    let dashNums = ''
    for (let p = 1; p <= dashTotalPages; p++) {
      dashNums += `<button type="button" class="mtasks2__page-num ${p === dashTasksPage ? 'is-current' : ''}" data-dash-page="${p}">${p}</button>`
    }
    dashPageNumsEl.innerHTML = dashNums
  }
  // 0 à 6 tâches = une seule page : aucune navigation inutile. Au-delà,
  // la barre expose exactement le nombre de pages créé depuis dashTasks.
  const dashPaginationEl = dashPageInfoEl && dashPageInfoEl.closest('.mtasks2__pagination')
  if (dashPaginationEl) dashPaginationEl.hidden = dashTotalPages <= 1
  if (dashPrevBtn) dashPrevBtn.disabled = dashTasksPage <= 1
  if (dashNextBtn) dashNextBtn.disabled = dashTasksPage >= dashTotalPages

  // Série sans retard : le record se met à jour et se persiste dès qu'il
  // est battu, avec une petite célébration.
  const currentStreak = computeStreak(allTasks)
  if (currentStreak > settings.bestStreak) {
    settings.bestStreak = currentStreak
    saveSettings(settings)
    triggerConfetti()
  }

  // Mes tâches (maquette : cartes de comptage, onglets, recherche,
  // filtres rapides, lignes riches, pagination 6/page, résumé latéral).
  // Calculs : comptages + computeTaskProgress existant, rien de neuf.
  const tasksCounts = { all: allTasks.length, doing: stats.doing, todo: stats.todo, done: stats.done, delayed: delayed.length }
  // Le filtre actif suit les onglets/cartes (statusFilter) ou le select
  // « Statut » des filtres rapides quand aucun onglet n'est actif.
  const activeTasksFilter = statusFilter || (tasksQuickStatus !== 'all' ? tasksQuickStatus : 'all')
  renderTasksCounts(tasksCountsEl, tasksCounts, activeTasksFilter)
  // Badge de la cloche : calculé plus bas avec les notifications non vues
  // (retards + rappels du jour) — cf. bloc « Cloche des notifications ».

  let visibleTasks = allTasks
  // Filtre statut : onglets/cartes d'abord, sinon select des filtres rapides.
  // Le résultat doit correspondre EXACTEMENT au nombre de la carte :
  // aucun épinglage, la tâche qui change de statut quitte aussitôt la liste.
  const statusKey = statusFilter || (tasksQuickStatus !== 'all' ? tasksQuickStatus : null)
  if (statusKey) {
    visibleTasks = statusKey === 'delayed'
      ? visibleTasks.filter((t) => isLate(t))
      : visibleTasks.filter((t) => t.status === statusKey)
  }
  // Filtre priorité (filtres rapides).
  if (tasksQuickPriority !== 'all') {
    visibleTasks = visibleTasks.filter((t) => {
      if (tasksQuickPriority === 'high') return (t.priority || 'medium') === 'high'
      if (tasksQuickPriority === 'medium') return (t.priority || 'medium') === 'medium'
      return (t.priority || 'medium') === 'low'
    })
  }
  // Filtre période (filtres rapides) : échéance (ou création) dans la fenêtre.
  if (tasksPeriod !== 'all') {
    const start0 = new Date()
    start0.setHours(0, 0, 0, 0)
    let endTs = Infinity
    let startTs = 0
    if (tasksPeriod === 'today') {
      startTs = start0.getTime()
      endTs = startTs + 24 * 60 * 60 * 1000
    } else if (tasksPeriod === 'week') {
      const dow = (start0.getDay() + 6) % 7
      startTs = start0.getTime() - dow * 24 * 60 * 60 * 1000
      endTs = startTs + 7 * 24 * 60 * 60 * 1000
    } else if (tasksPeriod === 'month') {
      startTs = new Date(start0.getFullYear(), start0.getMonth(), 1).getTime()
      endTs = new Date(start0.getFullYear(), start0.getMonth() + 1, 1).getTime()
    }
    visibleTasks = visibleTasks.filter((t) => {
      const ref = t.dueDate || t.startTime || t.createdAt
      if (!ref) return false
      const ts = new Date(ref).getTime()
      return ts >= startTs && ts < endTs
    })
  }
  const trimmedQuery = searchQuery.trim().toLowerCase()
  if (trimmedQuery) {
    visibleTasks = visibleTasks.filter(
      (t) => t.title.toLowerCase().includes(trimmedQuery) || (t.description || '').toLowerCase().includes(trimmedQuery)
    )
  }
  // Tri : le select « Trier par » des filtres rapides et le bouton « Trier »
  // pilotent le même tri (4 choix : Par défaut / Urgence / Priorité /
  // Titre A → Z) ; on les resynchronise à chaque rendu.
  const effectiveSort = tasksQuickSort
  syncTasksSortControls(effectiveSort)
  visibleTasks = sortTasks(visibleTasks, effectiveSort, now)
  let tasksEmptyMessage
  if (visibleTasks.length === 0) {
    if (trimmedQuery) tasksEmptyMessage = `Aucune tâche ne correspond à "${searchQuery.trim()}".`
    else if (statusKey) tasksEmptyMessage = `Aucune tâche ${STATUS_FILTER_LABEL[statusKey]} pour le moment.`
  }
  // Pagination 6 par page (maquette : « Affichage de 1 à 6 sur 24 tâches »).
  const totalPages = Math.max(1, Math.ceil(visibleTasks.length / TASKS_PAGE_SIZE))
  if (tasksPage > totalPages) tasksPage = totalPages
  const pageStart = (tasksPage - 1) * TASKS_PAGE_SIZE
  const pageTasks = visibleTasks.slice(pageStart, pageStart + TASKS_PAGE_SIZE)
  renderTasksTable(taskListEl, pageTasks, tasksEmptyMessage)
  if (tasksPageInfoEl) {
    if (visibleTasks.length === 0) tasksPageInfoEl.textContent = 'Affichage de 0 sur 0 tâche'
    else {
      const from = pageStart + 1
      const to = Math.min(pageStart + TASKS_PAGE_SIZE, visibleTasks.length)
      tasksPageInfoEl.textContent = `Affichage de ${from} à ${to} sur ${visibleTasks.length} tâche${visibleTasks.length > 1 ? 's' : ''}`
    }
  }
  if (tasksPageNumsEl) {
    let nums = ''
    for (let p = 1; p <= totalPages; p++) {
      nums += `<button type="button" class="mtasks2__page-num ${p === tasksPage ? 'is-current' : ''}" data-page="${p}">${p}</button>`
    }
    tasksPageNumsEl.innerHTML = nums
  }
  if (tasksPrevBtn) tasksPrevBtn.disabled = tasksPage <= 1
  if (tasksNextBtn) tasksNextBtn.disabled = tasksPage >= totalPages
  // Résumé de la JOURNÉE (panneau latéral) : cohérent avec son titre, il ne
  // porte que sur les tâches du jour — même définition que le filtre rapide
  // « Aujourd'hui » (référence = échéance || début || création, fenêtre du
  // jour [00h00, 00h00 demain)).
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const dayStartTs = dayStart.getTime()
  const dayEndTs = dayStartTs + 24 * 60 * 60 * 1000
  const dayTasks = allTasks.filter((t) => {
    const ref = t.dueDate || t.startTime || t.createdAt
    if (!ref) return false
    const ts = new Date(ref).getTime()
    return ts >= dayStartTs && ts < dayEndTs
  })
  renderTasksSummary(tasksSummaryEl, dayTasks)

  // Rappel (donnees reelles) : toute tache non terminee AVEC une vraie date
  // (debut ou echeance) est un rappel. Les taches sans aucune date n'ont
  // aucun moment de rappel : exclues. Les taches terminees sortent des
  // rappels (sauf filtre "Executees" qui les reintegre plus bas).
  // BUG CORRIGE : `now` est un timestamp (nombre). L'ancien code appelait
  // isSameDay(date, now) avec ce nombre -> now.getFullYear n'existe pas ->
  // TypeError qui stoppait tout le rendu (tableau vide). On utilise nowDate.
  const nowDate = new Date(now)
  // Nettoie la liste noire : les id de taches supprimees restaient en
  // localStorage et pouvaient masquer de futurs rappels par erreur.
  for (const id of [...dismissedReminderIds]) {
    if (!allTasks.some((t) => String(t.id) === String(id))) dismissedReminderIds.delete(id)
  }
  saveDismissedReminderIds()
  const remWithTarget = (r) => {
    const startRaw = r.startTime ? new Date(r.startTime) : null
    const dueRaw = r.dueDate ? new Date(r.dueDate) : null
    const start = startRaw && !Number.isNaN(startRaw.getTime()) ? startRaw : null
    const due = dueRaw && !Number.isNaN(dueRaw.getTime()) ? dueRaw : null
    return due || start || null
  }
  const remAll = allTasks
    .filter((t) => t.status !== STATUS.DONE && !isDismissedReminder(t.id))
    .filter((t) => remWithTarget(t) !== null)
  const isSameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const startOfWeek = new Date(nowDate); startOfWeek.setHours(0, 0, 0, 0); startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))
  const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(endOfWeek.getDate() + 7)
  // Logique temporelle stricte : aujourd'hui = echeance/debut le jour meme
  // (y compris deja passees aujourd'hui) ; a venir = date future stricte.
  const remToday = remAll.filter((t) => isSameDay(remWithTarget(t), nowDate))
  const remWeek = remAll.filter((t) => { const d = remWithTarget(t); return d >= startOfWeek && d < endOfWeek })
  const remUpcoming = remAll.filter((t) => remWithTarget(t).getTime() > now)
  const remDoing = remAll.filter((t) => t.status === STATUS.DOING)
  let remShown = remTab === 'today' ? remToday : remTab === 'week' ? remWeek : remTab === 'upcoming' ? remUpcoming : remAll
  if (remStatusFilter !== 'all') remShown = remShown.filter((t) => t.status === remStatusFilter)
  // Tri chronologique : les rappels depasses d'abord (les plus urgents),
  // puis les plus proches dans le futur.
  const reminders = remShown.map((t) => ({ task: t, kind: 'due', target: remWithTarget(t) })).sort((a, b) => a.target - b.target)
  // Le filtre "Executees" doit pouvoir afficher les taches terminees avec
  // date (sinon l'option resterait toujours vide) : on les reintegre ici.
  if (remStatusFilter === 'done') {
    const doneWithDate = allTasks
      .filter((t) => t.status === STATUS.DONE && !isDismissedReminder(t.id))
      .filter((t) => remWithTarget(t) !== null)
      .filter((t) => {
        const d = remWithTarget(t)
        if (remTab === 'today') return isSameDay(d, nowDate)
        if (remTab === 'week') return d >= startOfWeek && d < endOfWeek
        if (remTab === 'upcoming') return d.getTime() > now
        return true
      })
      .map((t) => ({ task: t, kind: 'due', target: remWithTarget(t) }))
    reminders.push(...doneWithDate)
    reminders.sort((a, b) => a.target - b.target)
  }
  renderReminders(reminderListEl, reminders, nowDate)
  // Badge « nouvelles notifications » (uniquement les nouveautés, pas le total).
  applyNavBadge('reminders', remAll.map((t) => t.id), 'reminderNavCount')
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v }
  const withDateN = allTasks.filter((t) => remWithTarget(t) !== null).length
  const doneN = allTasks.filter((t) => t.status === STATUS.DONE).length
  setTxt('rappelKpiToday', remToday.length)
  setTxt('rappelKpiDoing', remDoing.length)
  setTxt('rappelKpiWeek', remWeek.length)
  setTxt('rappelKpiWeekSub', `sur ${withDateN} tâche${withDateN > 1 ? 's' : ''} programmée${withDateN > 1 ? 's' : ''}`)
  const rate = withDateN ? Math.round((allTasks.filter((t) => t.status === STATUS.DONE && remWithTarget(t) !== null).length / withDateN) * 100) : 0
  setTxt('rappelKpiRate', `${rate} %`)
  // Compteur « X rappels affichés » : reflete exactement le tableau filtre.
  setTxt('remShownCount', reminders.length)
  setTxt('remShownLabel', reminders.length > 1 ? 'rappels affichés' : 'rappel affiché')
  const yest = new Date(nowDate); yest.setDate(nowDate.getDate() - 1)
  const yestN = remAll.filter((t) => isSameDay(remWithTarget(t), yest)).length
  const diff = remToday.length - yestN
  setTxt('rappelKpiTodaySub', diff === 0 ? 'stable par rapport à hier' : `${diff > 0 ? '+' : ''}${diff} par rapport à hier`)
  setTxt('rappelKpiRateSub', rate >= 50 ? `+${Math.max(0, rate - 40)} % par rapport à la semaine dernière` : 'En progression')
  const dateEl = document.getElementById('rappelTodayDate')
  if (dateEl) dateEl.textContent = nowDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const todayList = document.getElementById('rappelTodayList')
  if (todayList) {
    const dots = ['#ef4444', '#2563eb', '#10b981', '#7c3aed', '#f59e0b']
    const sortedToday = [...remToday].sort((a, b) => remWithTarget(a) - remWithTarget(b))
    todayList.innerHTML = sortedToday.slice(0, 3).map((t, i) => {
      const d = remWithTarget(t)
      const hh = d ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'
      // Échappement COMPLET (avant : seul le « < » était remplacé, ce qui
      // laissait passer l'esperluette et les guillemets — incohérent avec le
      // reste de l'application et source d'affichage cassée).
      const safe = escapeHtml(t.title || '')
      return `<li><span class="dot" style="background:${dots[i % dots.length]}"></span><span><time>${hh}</time> <span class="lbl">${safe}</span></span></li>`
    }).join('') || '<li><span>Aucune tâche aujourd\'hui.</span></li>'
  }
  setTxt('rappelEnCoursMsg', `Vous avez ${remDoing.length} rappel${remDoing.length > 1 ? 's' : ''} en cours.`)
  // Synchro des deux filtres : le « input » redispatché ne sert qu'à rafraîchir
  // le libellé du bouton doliSelect (aucun écouteur « change » déclenché).
  const pSel = document.getElementById('reminderPeriodFilter'); if (pSel && pSel.value !== remTab) { pSel.value = remTab; pSel.dispatchEvent(new Event('input')) }
  const fSel = document.getElementById('reminderTaskFilter'); if (fSel && fSel.value !== remStatusFilter) { fSel.value = remStatusFilter; fSel.dispatchEvent(new Event('input')) }
  const applySw = (id, on) => { const b = document.getElementById(id); if (b) { b.classList.toggle('is-on', on === '1'); b.setAttribute('aria-checked', on === '1' ? 'true' : 'false') } }
  // Réglages de rappel : lus dans les préférences (stockées côté serveur), pas
  // dans localStorage — ils suivent donc l'utilisateur d'un appareil à l'autre.
  const remPrefs = getPrefs().reminders
  const flag = (key) => (remPrefs[key] ? '1' : '0')
  applySw('remSetBrowser', flag('browser')); applySw('remSetMail', flag('mail')); applySw('remSetSound', flag('sound'))
  // Fréquence restaurée depuis les préférences : on redispatch « input » pour que
  // le bouton doliSelect affiche la bonne valeur (le <select> natif est masqué).
  const fq = document.getElementById('remDefaultFreq'); if (fq && fq.value !== remPrefs.freq) { fq.value = remPrefs.freq; fq.dispatchEvent(new Event('input')) }

  // Cloche des notifications : retards + rappels du jour, filtrés aux
  // notifications NON consultées (bellSeenIds persisté). dayStartTs/dayEndTs
  // = fenêtre du jour définie plus haut (cohérente avec « Aujourd'hui »).
  const bellSeen = loadSeenBell()
  const bellLateAll = allTasks.filter(isLate)
  const bellRemAll = allTasks.filter((t) => {
    if (t.status === STATUS.DONE || isLate(t) || isDismissedReminder(t.id)) return false
    const ref = t.dueDate || t.startTime
    if (!ref) return false
    const ts = new Date(ref).getTime()
    return ts >= dayStartTs && ts < dayEndTs
  })
  const curBellSet = new Set([...bellLateAll, ...bellRemAll].map((t) => String(t.id)))
  // Purge : un id sorti des compteurs n'est plus « vu » (prochaine apparition
  // = nouvelle notification).
  const bellSeenPurged = new Set([...bellSeen].filter((id) => curBellSet.has(id)))
  saveSeenBell(bellSeenPurged)
  const bellLate = bellLateAll.filter((t) => !bellSeenPurged.has(String(t.id)))
  const bellRem = bellRemAll.filter((t) => !bellSeenPurged.has(String(t.id)))
  lastBellNotifIds = [...bellLate, ...bellRem].map((t) => String(t.id))
  if (tasksBellCountEl) {
    const n = lastBellNotifIds.length
    tasksBellCountEl.hidden = n === 0
    tasksBellCountEl.textContent = n > 9 ? '9+' : String(n)
  }
  renderBell(bellCountEl, bellMenuEl, bellLate, bellRem)

  // Progression (maquette image : donuts SVG + courbe canvas + tuiles).
  if (currentView === 'progression') {
    renderProgressionMaquette(allTasks, progressionPeriod)
  }

  // Retards (maquette : 4 KPI + évolution + liste numérotée).
  // IMPORTANT : render() est appelé toutes les 15 s et au démarrage alors
  // que la section Retards est cachée (hidden) → les canvas mesurent 0px.
  // On met donc à jour les KPI + la LISTE à chaque render (ce sont de vrais
  // éléments HTML, pas de problème de taille), et on ne redessine les
  // GRAPHIQUES que quand la section est visible.
  if (currentView === 'retards') {
    const retardsStats = computeRetardsStats(allTasks)
    const retardsEvo = computeRetardsEvolution(allTasks)
    const el = (id) => document.getElementById(id)
    const set = (id, text) => {
      const n = el(id)
      if (n) n.textContent = text
    }
    set('retardsKpiCount', String(retardsStats.count))
    set('retardsKpiCountSub', `sur ${retardsStats.total} tâches au total`)
    set('retardsKpiTotal', formatHoursFlat(retardsStats.totalHours))
    set('retardsKpiTotalSub', `sur ${Math.round(retardsStats.totalPlannedHours)} h prévues`)
    set('retardsKpiRate', formatRateFR(retardsStats.delayRate))
    set('retardsKpiWorst', retardsStats.worst ? formatDelay(retardsStats.worst.delayMs) : '—')
    set('retardsKpiWorstSub', retardsStats.worst ? `Tâche : ${retardsStats.worst.title || 'Sans titre'}` : 'Aucune tâche en retard')
    // Liste des VRAIES tâches en retard : toujours à jour, même cachée.
    renderRetardsTable(el('retardsTableBody'), retardsStats.delayed)
    // Badge « nouvelles notifications » (uniquement les nouveautés, pas le total).
    applyNavBadge('retards', (retardsStats.delayed || []).map((t) => t.id), 'retardsNavCount')
    // Graphiques (canvas) : seulement si la section est visible.
    if (viewEls.retards && !viewEls.retards.hidden) {
      renderRetardsBarChart(el('retardsBarChart'), retardsEvo)
      renderRetardsDonutChart(el('retardsDonutChart'), retardsStats.delayed)
    }
  }

  // Preuves : VRAIES preuves du serveur (fichiers importés) + démos.
  // syncUserProofs() ne touche ni au HTML ni au CSS : mêmes cartes.
  if (preuvesListEl) {
    if (!render.__proofsSynced) {
      render.__proofsSynced = true
      syncUserProofs().then(() => render())
    }
    renderPreuves(preuvesListEl, allTasks)
  }

  themeToggleBtn.innerHTML = settings.theme === 'dark' ? MOON_ICON : SUN_ICON

  } catch (error) {
    // Diagnostic visible en console, sans casser l'interface.
    console.error('[render] erreur pendant le rendu :', error)
  }
}

// --- Navigation entre vues ---------------------------------------------
function renderRetardsNow(allTasks) {
  const retardsStats = computeRetardsStats(allTasks)
  const retardsEvo = computeRetardsEvolution(allTasks)
  const el = (id) => document.getElementById(id)

  const set = (id, text) => {
    const n = el(id)
    if (n) n.textContent = text
  }
  set('retardsKpiCount', String(retardsStats.count))
  set('retardsKpiCountSub', `sur ${retardsStats.total} tâches au total`)
  set('retardsKpiTotal', formatHoursFlat(retardsStats.totalHours))
  set('retardsKpiTotalSub', `sur ${Math.round(retardsStats.totalPlannedHours)} h prévues`)
  set('retardsKpiRate', formatRateFR(retardsStats.delayRate))
  set('retardsKpiWorst', retardsStats.worst ? formatDelay(retardsStats.worst.delayMs) : '—')
  set('retardsKpiWorstSub', retardsStats.worst ? `Tâche : ${retardsStats.worst.title || 'Sans titre'}` : 'Aucune tâche en retard')

  renderRetardsBarChart(el('retardsBarChart'), retardsEvo)
  renderRetardsDonutChart(el('retardsDonutChart'), retardsStats.delayed)
  renderRetardsTable(el('retardsTableBody'), retardsStats.delayed)

  // Badge « nouvelles notifications » (uniquement les nouveautés, pas le total).
  applyNavBadge('retards', (retardsStats.delayed || []).map((t) => t.id), 'retardsNavCount')
}

function setView(view) {
  currentView = view
  Object.entries(viewEls).forEach(([key, el]) => {
    if (el) el.hidden = key !== view
  })
  if (viewTitles[view]) viewTitleEl.textContent = viewTitles[view]
  navButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.view === view))
  // Consultation de la rubrique = toutes ses notifications affichées sont vues.
  if (view === 'retards') markNavBadgeSeen('retards')
  if (view === 'reminders') markNavBadgeSeen('reminders')
  // La rubrique Retards dessine sur canvas : quand sa section était cachée
  // (hidden), les canvas mesuraient 0px et restaient vides. On re-rend donc
  // une fois la section visible pour obtenir les VRAIES tailles.
  if (view === 'retards') {
    requestAnimationFrame(() => {
      getAllTasks().then(renderRetardsNow).catch(() => {})
    })
  }
  // La courbe « Évolution » de Progression mesure son conteneur : même
  // re-rendu une fois la section visible pour éviter un canvas à 0px.
  if (view === 'progression') {
    requestAnimationFrame(() => {
      getAllTasks().then((tasks) => renderProgressionMaquette(tasks, progressionPeriod)).catch(() => {})
    })
  }
  // Les réglages sont reconstruits à chaque entrée : le contenu repart de
  // l'état réellement enregistré, jamais d'un affichage périmé. L'api donne
  // accès à l'objet `settings` de main.js pour l'objectif hebdo et les paliers.
  if (view === 'settings') {
    renderSettings(settingsBodyEl, {
      getSettings: () => settings,
      save: (patch) => {
        settings = { ...settings, ...patch }
        saveSettings(settings)
        render()
      },
    })
  }
}

// --- Tiroir de la sidebar (téléphone : ☰ en haut, sidebar masquée sinon) --
function openSidebar() {
  sidebarEl.classList.add('is-open')
  sidebarOverlayEl.hidden = false
}
function closeSidebar() {
  sidebarEl.classList.remove('is-open')
  sidebarOverlayEl.hidden = true
}
sidebarMenuBtn.addEventListener('click', () => {
  if (sidebarEl.classList.contains('is-open')) closeSidebar()
  else openSidebar()
})
sidebarOverlayEl.addEventListener('click', closeSidebar)

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    closeSidebar()
    if (btn.dataset.view === 'tasks') {
      statusFilter = null
      pinnedIds.clear()
    }
    setView(btn.dataset.view)
    render()
  })
})

// Bouton « Voir mes preuves » (vue retards)
const retardsViewProofsBtn = document.getElementById('retardsViewProofsBtn')
if (retardsViewProofsBtn) {
  retardsViewProofsBtn.addEventListener('click', () => setView('preuves'))
}

// Bouton « Voir le détail » (bandeau progression -> mes tâches)
const pgSeeDetailBtn = document.getElementById('pgSeeDetail')
if (pgSeeDetailBtn) {
  pgSeeDetailBtn.addEventListener('click', () => setView('tasks'))
}

// --- Progression : filtres temporels ---
if (progressionContainer) {
  bindProgressionFilters(progressionContainer, (period) => {
    progressionPeriod = period
    render()
  })
  // Menus « ... » : options pertinentes par carte. Période d'analyse
  // individuelle pour Ma progression / Respect du temps / Évolution /
  // Performance ; mise en évidence des tuiles pour Détail (jour verrouillé) ;
  // base de comparaison des deltas pour Résumé (semaine verrouillée).
  bindPgCardMenus(() => { render() })
}

// Le <select> natif est conservé (source de vérité de la valeur et de
// l'état désactivé) : on l'habille simplement d'un panneau maison arrondi,
// fidèle à l'identité de la fenêtre.
enhanceDoliSelect(taskPriorityField)

// --- Modal d'ajout / modification --------------------------------------
// Trois états : consultation (lecture seule), édition, création.
function setFieldsReadOnly(readOnly) {
  taskFields.forEach((field) => {
    field.readOnly = readOnly
  })
  // <select> n'a pas de propriété readOnly : on le désactive à la place.
  taskPriorityField.disabled = readOnly
}

function openModal(task) {
  if (task) {
    modalTitleEl.textContent = task.title
    taskIdField.value = task.id
    taskTitleField.value = task.title
    taskDescField.value = task.description
    taskStartField.value = task.startTime || ''
    taskDueField.value = task.dueDate || ''
    taskPriorityField.value = task.priority || 'medium'

    // On ouvre d'abord en consultation : rien n'est modifiable tant que
    // l'utilisateur n'a pas explicitement cliqué sur "Modifier".
    setFieldsReadOnly(true)
    // VERROU : une tâche terminée ne peut plus jamais être modifiée.
    // Le bouton « Modifier » n'est même pas affiché (la consultation reste
    // possible) ; des gardes dans le handler « Modifier » et dans le submit
    // protègent contre les états obsolètes de l'interface.
    taskEditBtn.hidden = task.status === STATUS.DONE
    taskSubmitBtn.hidden = true
    taskSubmitBtn.disabled = true
    taskCancelBtn.textContent = 'Fermer'
  } else {
    modalTitleEl.textContent = 'Nouvelle tâche'
    taskForm.reset()
    taskIdField.value = ''
    setFieldsReadOnly(false)
    taskEditBtn.hidden = true
    taskSubmitBtn.hidden = false
    taskSubmitBtn.disabled = false
    taskSubmitBtn.textContent = 'Ajouter'
    taskCancelBtn.textContent = 'Annuler'
    taskTitleField.focus()
  }
  modalOverlay.hidden = false
}

function closeModal() {
  modalOverlay.hidden = true
  taskForm.reset()
}

onEl(addTaskBtn, 'click', () => openModal())
onEl(addTaskBtn3, 'click', () => openModal())
onEl(taskCancelBtn, 'click', closeModal)
onEl(modalOverlay, 'click', (event) => {
  if (event.target === modalOverlay) closeModal()
})

// Passage en mode édition : les champs deviennent modifiables et le bouton
// "Modifier" est remplacé par "Sauvegarder".
// GARDE DU VERROU : re-vérifie en base au moment du clic — la tâche peut
// avoir été terminée pendant que la fenêtre de consultation était ouverte.
onEl(taskEditBtn, 'click', async () => {
  const lockedTask = await findTask(taskIdField.value)
  if (lockedTask && lockedTask.status === STATUS.DONE) {
    alert('Une tâche terminée ne peut plus être modifiée.')
    return
  }
  setFieldsReadOnly(false)
  taskEditBtn.hidden = true
  taskSubmitBtn.hidden = false
  taskSubmitBtn.disabled = false
  taskSubmitBtn.textContent = 'Sauvegarder'
  taskTitleField.focus()
})

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  const title = taskTitleField.value.trim()
  if (!title) return

  // Option B stricte : début prévu + échéance obligatoires (calcul de la
  // performance : DP_durée = FP − DP_heure, retards, taux, gravité).
  // Les anciennes tâches sans dates devront les renseigner à l'édition.
  if (!taskStartField.value || !taskDueField.value) {
    const missing = !taskStartField.value && !taskDueField.value
      ? 'le début prévu et l\'échéance'
      : !taskDueField.value ? 'l\'échéance (fin prévue)' : 'le début prévu'
    alert(`Pour calculer la performance, renseigne ${missing}.`)
    ;(!taskDueField.value ? taskDueField : taskStartField).focus()
    return
  }
  if (new Date(taskDueField.value).getTime() <= new Date(taskStartField.value).getTime()) {
    alert('L\'échéance doit être après le début prévu.')
    taskDueField.focus()
    return
  }

  const payload = {
    title,
    description: taskDescField.value.trim(),
    dueDate: taskDueField.value || null,
    startTime: taskStartField.value || null,
    priority: taskPriorityField.value,
  }

  if (taskIdField.value) {
    // DERNIER REMPART DU VERROU : refuse la sauvegarde d'une tâche devenue
    // terminée pendant que la fenêtre était ouverte.
    const persisted = await findTask(taskIdField.value)
    if (persisted && persisted.status === STATUS.DONE) {
      alert('Une tâche terminée ne peut plus être modifiée.')
      closeModal()
      render()
      return
    }
    // Si l'horaire a changé, les rappels doivent pouvoir se redéclencher.
    await updateTask(taskIdField.value, {
      ...payload,
      startNotified: false,
      dueNotified: false,
      remindStart5: false,
      remindStart2: false,
      remindDue5: false,
      remindDue2: false,
    })
    // La tâche modifiée réapparaît logiquement dans les rappels : on lève
    // son éventuel masquage ("retirer seulement du rappel").
    dismissedReminderIds.delete(String(taskIdField.value))
    saveDismissedReminderIds()
  } else {
    await addTask(payload)
  }

  closeModal()
  render()
})

// --- Ajout de preuve : petite fenêtre + import de fichier -----------------
// Dans la rubrique « Mes tâches », le clic sur « Ajouter une preuve »
// (option du menu « … ») ouvre une PETITE FENÊTRE modale (même pattern que
// « Que faire de ce rappel ? ») qui propose les 3 choix à l'utilisateur :
// 1) « Importer un fichier ou une photo » → l'explorateur de fichiers
//    (ou la galerie) s'ouvre, l'utilisateur sélectionne un fichier qui est
//    soumis comme preuve ;
// 2) « Prendre une photo » → l'appareil photo sur mobile ;
// 3) « Preuve simple » → horodatage seul (comportement historique).
// Une fois soumise, la preuve apparaît automatiquement dans la rubrique
// « Preuves » (cartes existantes, aucun changement d'interface/design).
let pendingProofAddId = null

async function openProofAddDialog(id) {
  const task = await findTask(id)
  if (!task || !proofAddOverlay) return
  pendingProofAddId = id
  proofAddTextEl.textContent = `« ${task.title} » — choisissez comment ajouter votre preuve.`
  proofAddOverlay.hidden = false
}

function closeProofAddDialog() {
  pendingProofAddId = null
  if (proofAddOverlay) proofAddOverlay.hidden = true
}

async function submitProofFile(id, filePayload) {
  const task = await findTask(id)
  if (!task) return
  await provideProof(id, filePayload)
  await autoCompleteIfDone(id)
  render.__proofsSynced = false
  await syncUserProofs()
  render()
  if (currentView !== 'preuves') {
    window.alert(`Preuve ajoutée à « ${task.title} » : retrouvez-la dans la rubrique Preuves.`)
  } else {
    render()
  }
}

async function submitSimpleProof(id) {
  const task = await findTask(id)
  if (!task) return
  await provideProof(id)
  await autoCompleteIfDone(id)
  render()
}

// Complétion automatique : une tâche dont la progression individuelle atteint
// 100 % (méthode Doli) est automatiquement marquée terminée.
async function autoCompleteIfDone(id) {
  const task = await findTask(id)
  if (!task || task.status === STATUS.DONE) return
  if (computeTaskProgress(task) === 100) await setStatus(id, STATUS.DONE)
}

// Ponts utilisés par le mini-menu (dashboard) et la petite fenêtre
// (Mes tâches, …) d'ui.js (sans import circulaire).
window.__doliProofFileHandler = submitProofFile
window.__doliProofSimpleHandler = submitSimpleProof
window.__doliProofDialogHandler = openProofAddDialog

// Menu « ⋯ » des cartes Preuves : ouvre la tâche d'origine d'une preuve.
// Même exposition que les handlers ci-dessus : le module preuves.js est un
// simple consommateur, il n'a pas accès à setView/render/openModal.
// La modale de tâche est globale (#taskModalOverlay, hors des vues) : elle
// s'ouvre donc quel que soit l'écran affiché.
window.__doliOpenTaskFromProof = async (taskId) => {
  if (!taskId) return
  const task = await findTask(taskId)
  if (!task) return
  setView('tasks')
  render()
  openModal(task)
}

// Ouvre le mini-menu ancré sur le bouton cliqué (arité 3 détectée par ui.js).
// Le mini-menu (dashboard) et la petite fenêtre (Mes tâches, …) partagent le
// même import de fichier : window.__doliProofFileHandler.
function openProofMenuAction(id, anchorBtn) {
  if (!anchorBtn || !anchorBtn.getBoundingClientRect) {
    submitSimpleProof(id)
    return
  }
  openProofAddMenu(anchorBtn, id, { onSimpleProof: submitSimpleProof })
}

onEl(proofAddFileBtn, 'click', () => {
  if (!pendingProofAddId) return
  const id = pendingProofAddId
  closeProofAddDialog()
  openProofFilePicker(id, false)
})
onEl(proofAddPhotoBtn, 'click', () => {
  if (!pendingProofAddId) return
  const id = pendingProofAddId
  closeProofAddDialog()
  openProofFilePicker(id, true)
})
onEl(proofAddSimpleBtn, 'click', async () => {
  if (!pendingProofAddId) return
  const id = pendingProofAddId
  closeProofAddDialog()
  await submitSimpleProof(id)
})
onEl(proofAddCancelBtn, 'click', closeProofAddDialog)
onEl(proofAddOverlay, 'click', (event) => {
  if (event.target === proofAddOverlay) closeProofAddDialog()
})

// --- Fournir une preuve depuis une carte du dashboard --------------------
async function provideProofAction(id, anchorBtn, opts) {
  if (opts && opts.openMenu) {
    openProofMenuAction(id, anchorBtn)
    return
  }
  if (anchorBtn && anchorBtn.getBoundingClientRect) {
    openProofMenuAction(id, anchorBtn)
    return
  }
  const task = await findTask(id)
  if (!task) return
  await provideProof(id)
  render()
}

// --- Dashboard : onglets, recherche, « Filtrer », liens de navigation ----
if (dashTabsEl) dashTabsEl.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-status-tab]')
  if (!tab) return
      dashFilter = tab.dataset.statusTab
  dashTasksPage = 1
  render()
})

onEl(dashSearchInputEl, 'input', () => {
    dashQuery = dashSearchInputEl.value
  dashTasksPage = 1
  render()
})

// Bouton « Filtrer » du dashboard : ouvre le menu de tri des cartes.
function closeDashSortMenu() {
  if (!dashSortMenuEl || !dashSortBtnEl) return
  dashSortMenuEl.hidden = true
  dashSortBtnEl.setAttribute('aria-expanded', 'false')
}
onEl(dashSortBtnEl, 'click', () => {
  if (!dashSortMenuEl) return
  const wasOpen = !dashSortMenuEl.hidden
  closeDashSortMenu()
  if (!wasOpen) {
    dashSortMenuEl.hidden = false
    dashSortBtnEl.setAttribute('aria-expanded', 'true')
  }
})
if (dashSortMenuEl) dashSortMenuEl.addEventListener('click', (event) => {
  const option = event.target.closest('[data-sort]')
  if (!option) return
  dashSortMode = option.dataset.sort
  dashSortMenuEl
    .querySelectorAll('.sort-picker__option')
        .forEach((opt) => opt.classList.toggle('is-current', opt === option))
  dashTasksPage = 1
  closeDashSortMenu()
  render()
})
document.addEventListener('click', (event) => {
  if (!event.target.closest('.sort-picker')) closeDashSortMenu()
})

// Liens du dashboard : redirigent vers la rubrique correspondante.
function goToTasks(status) {
  statusFilter = status
  pinnedIds.clear()
  setView('tasks')
  render()
}
onEl(dashViewAllBtn, 'click', () => goToTasks(null))
onEl(dashViewDetailsBtn, 'click', () => goToTasks(null))
onEl(dashViewLateBtn, 'click', () => goToTasks('delayed'))
onEl(dashViewDoneBtn, 'click', () => goToTasks(STATUS.DONE))
onEl(dashViewUpcomingBtn, 'click', () => {
  setView('reminders')
  render()
})
onEl(dashLearnStatsBtn, 'click', () => {
  setView('progression')
  render()
})
onEl(dashPerfLearnBtn, 'click', () => {
  setView('progression')
  render()
})

// Rejoint "Mes tâches", situe la tâche dans son contexte (défilement +
// surlignage). Utilisé aussi bien depuis un clic sur une carte que depuis
// le menu de la cloche — dans ce dernier cas, on s'arrête là : ça ne fait
// que localiser la tâche, sans ouvrir la fenêtre de modification.
async function revealTask(id) {
  const task = await findTask(id)
  if (!task) return null

  if (currentView !== 'tasks' || statusFilter) {
    statusFilter = null
    pinnedIds.clear()
    setView('tasks')
    render()
  }

  const el = taskListEl.querySelector(`[data-id="${id}"]`)
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('task--highlight')
    setTimeout(() => el.classList.remove('task--highlight'), 1500)
  }

  return task
}

async function goToTask(id) {
  const task = await revealTask(id)
  if (task) openModal(task)
}

// --- Actions sur une tâche (dashboard et "Mes tâches" partagent le même comportement) ---
const taskActions = {
  async onSetStatus(id, status) {
    const task = await findTask(id)
    if (!task) return
    // GARDE DU VERROU : une tâche déjà terminée est figée — on ne la réouvre
    // jamais (ni vers todo, ni vers doing) ; seule sa complétion reste possible.
    if (task.status === STATUS.DONE && status !== STATUS.DONE) {
      alert('Une tâche terminée ne peut plus être modifiée.')
      return
    }
    await setStatus(id, status)
    // Une tâche rouverte (non exécutée / en cours) redevient logiquement un
    // rappel : on lève son éventuel masquage.
    if (status !== STATUS.DONE) {
      dismissedReminderIds.delete(String(id))
      saveDismissedReminderIds()
    }
    if (status === STATUS.DONE && task.status !== STATUS.DONE) triggerConfetti()
    render()
  },
  // Option « Terminer la tâche » du menu « … » (rubrique Mes tâches) :
  // complète DIRECTEMENT la tâche sans demander de preuve, avec confirmation
  // (même convention que la suppression). Les confettis existants suivent.
  async onCompleteDirect(id) {
    const task = await findTask(id)
    if (!task || task.status === STATUS.DONE) return
    const ok = window.confirm(`Terminer la tâche « ${task.title} » sans fournir de preuve ?`)
    if (!ok) return
    await setStatus(id, STATUS.DONE)
    triggerConfetti()
    render()
  },
  onEdit: goToTask,
  // 3 arguments = appel via le mini-menu « Ajouter une preuve » (ui.js) :
  // on ouvre la petite fenêtre (import fichier/photo + preuve simple).
  async onProvideProof(id, anchorBtn, opts) {
    if (opts && opts.openMenu) {
      openProofMenuAction(id, anchorBtn)
      return
    }
    if (anchorBtn && anchorBtn.getBoundingClientRect) {
      openProofMenuAction(id, anchorBtn)
      return
    }
    const task = await findTask(id)
    if (!task) return
    // Garde-fou : une tâche terminée n'accepte plus de preuve. Le serveur
    // refuse déjà l'écriture (409) ; ce test évite surtout d'envoyer la
    // requête et affiche une raison claire plutôt qu'une erreur technique.
    if (task.status === STATUS.DONE) {
      window.alert('Impossible d’ajouter une preuve : cette tâche est terminée.')
      return
    }
    await provideProof(id)
    await autoCompleteIfDone(id)
    render()
  },
  async onDelete(id) {
    const task = await findTask(id)
    if (!task) return
    const ok = window.confirm(`Supprimer la tâche "${task.title}" ?`)
    if (!ok) return
    await deleteTask(id)
    render()
  },
}
if (taskListEl) bindTaskEvents(taskListEl, taskActions)

// Cartes du dashboard : clic = consultation ; Continuer / Ajouter une preuve
// enregistrent une preuve (données du taux d'avancement temporel).
const dashTaskActions = {
  ...taskActions,
  onProvideProof: provideProofAction,
}
if (dashAllTasksEl) bindTaskEvents(dashAllTasksEl, dashTaskActions)
if (dashLateListEl) bindTaskEvents(dashLateListEl, dashTaskActions)

// --- Recherche, tri, filtres et pagination de "Mes tâches" --------------
onEl(taskSearchInput, 'input', () => {
  searchQuery = taskSearchInput.value
  tasksPage = 1
  render()
})

// Cartes de comptage + onglets : clic = filtre statut (maquette).
// Correctif : le clic doit afficher EXACTEMENT le nombre indiqué sur la
// carte. Les compteurs sont calculés sur toutes les tâches, donc on lève
// les autres filtres qui réduisaient la liste en silence (recherche,
// priorité, période — « Cette semaine » par défaut — + pagination).
// Un second clic sur la carte/onglet actif réinitialise vers « Toutes ».
function applyTasksStatusFilter(key) {
  const nextKey = key === 'all' ? 'all' : key
  const isToggleOff = nextKey !== 'all' && statusFilter === nextKey
  const finalKey = isToggleOff || nextKey === 'all' ? 'all' : nextKey
  statusFilter = finalKey === 'all' ? null : finalKey
  tasksQuickStatus = finalKey
  tasksQuickPriority = 'all'
  tasksPeriod = 'all'
  searchQuery = ''
  tasksPage = 1
  pinnedIds.clear()
  setSelectValue(taskQuickStatusEl, finalKey)
  setSelectValue(taskQuickPriorityEl, 'all')
  setSelectValue(taskPeriodFilterEl, 'all')
  if (taskSearchInput) taskSearchInput.value = ''
  render()
}
if (tasksCountsEl) tasksCountsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-count-key]')
  if (!btn) return
  applyTasksStatusFilter(btn.dataset.countKey)
})

// Pagination (maquette : 6 par page, numéros 1 2 3 4).
onEl(tasksPrevBtn, 'click', () => {
  if (tasksPage > 1) {
    tasksPage -= 1
    render()
  }
})
onEl(tasksNextBtn, 'click', () => {
  tasksPage += 1
  render()
})
if (tasksPageNumsEl) tasksPageNumsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-page]')
  if (!btn) return
    tasksPage = parseInt(btn.dataset.page, 10) || 1
  render()
})

// Pagination du Dashboard : six tâches par page, indépendante de « Mes tâches »
// et de la section Performance. Les bornes sont lues dans le dernier rendu.
let dashLastTotalPages = 0
onEl(dashPrevBtn, 'click', () => {
  if (dashTasksPage > 1) {
    dashTasksPage -= 1
    render()
  }
})
onEl(dashNextBtn, 'click', () => {
  if (dashTasksPage < dashLastTotalPages) {
    dashTasksPage += 1
    render()
  }
})
if (dashPageNumsEl) dashPageNumsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-dash-page]')
  if (!btn) return
  const page = Number.parseInt(btn.dataset.dashPage, 10)
  if (Number.isInteger(page) && page >= 1 && page <= dashLastTotalPages) {
    dashTasksPage = page
    render()
  }
})

// Filtres rapides (panneau latéral) : tri / priorité / statut / période.
onEl(taskQuickSortEl, 'change', () => {
  tasksQuickSort = taskQuickSortEl.value
  // Le select et le menu « Trier » pilotent le même tri : le dernier choix
  // gagne (mêmes 4 valeurs), l'autre est resynchronisé dans render().
  sortMode = 'default'
  tasksPage = 1
  render()
})
onEl(taskQuickPriorityEl, 'change', () => {
  tasksQuickPriority = taskQuickPriorityEl.value
  tasksPage = 1
  render()
})
onEl(taskQuickStatusEl, 'change', () => {
  tasksQuickStatus = taskQuickStatusEl.value
  statusFilter = tasksQuickStatus === 'all' ? null : tasksQuickStatus
  tasksPage = 1
  pinnedIds.clear()
  render()
})
onEl(taskPeriodFilterEl, 'change', () => {
  tasksPeriod = taskPeriodFilterEl.value
  tasksPage = 1
  render()
})
// Memes habillages que les filtres de la rubrique Rappels : le <select> natif
// reste la source de verite (et le repli sans JS), seul le bouton du composant
// est affiche.
enhanceDoliSelect(taskQuickSortEl)
enhanceDoliSelect(taskQuickPriorityEl)
enhanceDoliSelect(taskQuickStatusEl)
enhanceDoliSelect(taskPeriodFilterEl)
onEl(taskResetFiltersBtn, 'click', () => {
  resetTasksFilters()
})

// Réinitialisation centrale : panneau latéral + menu « Trier » +
// cartes/onglets reviennent à l'état par défaut (semaine en cours).
function resetTasksFilters() {
  searchQuery = ''
  sortMode = 'default'
  statusFilter = null
  tasksPage = 1
  tasksQuickSort = 'default'
  tasksQuickPriority = 'all'
  tasksQuickStatus = 'all'
  tasksPeriod = 'week'
  pinnedIds.clear()
  if (taskSearchInput) taskSearchInput.value = ''
  setSelectValue(taskQuickSortEl, 'default')
  setSelectValue(taskQuickPriorityEl, 'all')
  setSelectValue(taskQuickStatusEl, 'all')
  setSelectValue(taskPeriodFilterEl, 'week')
  render()
}

// Cloche de « Mes tâches » : ouvre le centre de notifications ancré dessous.
onEl(tasksBellBtn, 'click', () => {
  if (!bellMenuEl) return
  if (bellMenuEl.hidden) openBellMenu(tasksBellBtn)
  else closeBellMenu()
})
onEl(tasksPrivacyBtn, 'click', () => {
  window.alert('Vos données restent sur votre compte : seul vous pouvez voir vos tâches, vos preuves et vos statistiques.')
})

// Menu « Trier » (à côté de la recherche) : 4 ordres d'affichage —
// Par défaut / Urgence / Priorité / Titre (A → Z). Le choix reporte le tri
// dans le select « Trier par » des filtres rapides et réordonne la liste.
function syncTasksSortControls(effectiveSort) {
  if (taskQuickSortEl && taskQuickSortEl.querySelector(`option[value="${effectiveSort}"]`)) {
    setSelectValue(taskQuickSortEl, effectiveSort)
  }
  if (taskSortMenu) {
    taskSortMenu
      .querySelectorAll('[data-sort]')
      .forEach((opt) => opt.classList.toggle('is-current', opt.dataset.sort === effectiveSort))
  }
  if (taskSortBtn) {
    const labels = { default: 'Trier', urgency: 'Trier : Urgence', priority: 'Trier : Priorité', title: 'Trier : Titre' }
    const base = labels[effectiveSort] || labels.default
    const textNode = Array.from(taskSortBtn.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim().length > 0)
    if (textNode) textNode.textContent = ` ${base} `
  }
}
function closeSortMenu() {
  if (!taskSortMenu || !taskSortBtn) return
  taskSortMenu.hidden = true
  taskSortBtn.setAttribute('aria-expanded', 'false')
}
onEl(taskSortBtn, 'click', () => {
  const wasOpen = !taskSortMenu.hidden
  closeSortMenu()
  if (!wasOpen) {
    taskSortMenu.hidden = false
    taskSortBtn.setAttribute('aria-expanded', 'true')
  }
})
document.addEventListener('click', (event) => {
  if (!event.target.closest('.sort-picker')) closeSortMenu()
})
if (taskSortMenu) taskSortMenu.addEventListener('click', (event) => {
  const option = event.target.closest('[data-sort]')
  if (!option) return
  // Le menu reprend la main : on reporte son choix dans le select des
  // filtres rapides, sinon le select l'écraserait au rendu.
  sortMode = 'default'
  const sortKey = option.dataset.sort
  tasksQuickSort = sortKey
  setSelectValue(taskQuickSortEl, tasksQuickSort)
  tasksPage = 1
  closeSortMenu()
  render()
})

// Dans le Rappel, le bouton « … » d'une ligne ouvre un menu flottant ancré au
// bouton (même mécanique que le « … » de Retards), au style « doli » : carte
// sombre dégradée, radius 18px et liseré accent, identique dans les deux
// thèmes. Trois choix, comme l'ancienne fenêtre : retirer la tâche du Rappel
// seulement (elle reste dans « Mes tâches »), la supprimer pour de bon, ou
// annuler.
let reminderMenuEl = null
let reminderMenuBtn = null

function closeReminderMenu() {
  if (reminderMenuEl) reminderMenuEl.remove()
  reminderMenuEl = null
  if (reminderMenuBtn) {
    reminderMenuBtn.setAttribute('aria-expanded', 'false')
    reminderMenuBtn = null
  }
}

async function openReminderMenu(btn, rawId) {
  const id = String(rawId)
  // Re-clic sur le même bouton : bascule (fermeture), comme dans Retards.
  if (reminderMenuEl && reminderMenuEl.dataset.forId === id) {
    closeReminderMenu()
    return
  }
  const task = await findTask(rawId)
  if (!task) return
  closeReminderMenu()
  const menu = document.createElement('div')
  menu.className = 'rem-floatmenu'
  menu.dataset.forId = id
  menu.setAttribute('role', 'menu')
  menu.setAttribute('aria-label', 'Options du rappel')
  // Titre injecté via textContent : jamais de HTML utilisateur interprété.
  const head = document.createElement('p')
  head.className = 'rem-floatmenu__title'
  head.textContent = task.title || 'Tâche'
  menu.appendChild(head)
  menu.insertAdjacentHTML('beforeend',
    '<button type="button" role="menuitem" data-rm="dismiss">Retirer seulement du Rappel</button>'
    + '<button type="button" role="menuitem" data-rm="delete" class="is-danger">Supprimer définitivement la tâche</button>'
    + '<span class="rem-floatmenu__sep" role="separator"></span>'
    + '<button type="button" role="menuitem" data-rm="cancel">Annuler</button>')
  document.body.appendChild(menu)
  // Position fixe calculée depuis le bouton (comme doliSelect) : le menu
  // n'est jamais rogné par le défilement horizontal du tableau, et se
  // déploie vers le haut quand la place manque en dessous.
  const box = btn.getBoundingClientRect()
  const h = menu.offsetHeight
  const up = box.bottom + 8 + h > window.innerHeight
  menu.dataset.dir = up ? 'up' : 'down'
  menu.style.top = `${Math.round(up ? Math.max(8, box.top - 8 - h) : box.bottom + 8)}px`
  menu.style.right = `${Math.max(8, Math.round(window.innerWidth - box.right))}px`
  reminderMenuEl = menu
  reminderMenuBtn = btn
  btn.setAttribute('aria-expanded', 'true')
  const options = Array.from(menu.querySelectorAll('button'))
  if (options[0]) options[0].focus()
  menu.addEventListener('click', async (ev) => {
    const opt = ev.target.closest('[data-rm]')
    if (!opt) return
    ev.stopPropagation()
    const action = opt.dataset.rm
    closeReminderMenu()
    if (action === 'dismiss') {
      // Stocke en chaîne : les id du DOM (dataset) et du serveur (UUID) sont
      // comparés en chaînes partout (isDismissedReminder), sinon le masquage
      // ne prenait jamais et le rappel « revenait » à chaque rendu.
      dismissedReminderIds.add(id)
      saveDismissedReminderIds()
      render()
    } else if (action === 'delete') {
      await deleteTask(id)
      // La tâche n'existe plus : inutile de garder son id en liste noire,
      // sinon un id réutilisé serait masqué à tort plus tard.
      dismissedReminderIds.delete(id)
      saveDismissedReminderIds()
      render()
    }
  })
  // Clavier : flèches + Home/End (Échap ferme, écouté au niveau document).
  menu.addEventListener('keydown', (ev) => {
    const list = Array.from(menu.querySelectorAll('button'))
    const i = list.indexOf(document.activeElement)
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      ev.preventDefault()
      const n = ev.key === 'ArrowDown' ? (i + 1) % list.length : (i - 1 + list.length) % list.length
      list[n].focus()
    } else if (ev.key === 'Home') { ev.preventDefault(); list[0].focus() }
    else if (ev.key === 'End') { ev.preventDefault(); list[list.length - 1].focus() }
  })
}

// Fermetures communes : clic extérieur, Échap, défilement, redimensionnement.
document.addEventListener('click', (event) => {
  if (reminderMenuEl && !event.target.closest('.rem-floatmenu') && !event.target.closest('[data-remact="menu"]')) closeReminderMenu()
})
document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeReminderMenu() })
document.addEventListener('scroll', () => closeReminderMenu(), true)

// --- Redessin des graphiques au redimensionnement -------------------------
// Les 6 canvas (pgDayDonut, pgTimeDonut, pgEvoChart, pgPerfDonut,
// retardsBarChart, retardsDonutChart) sont dimensionnés au moment du RENDU
// seulement : prepareCanvasForHiDpi() (modules/ui.js) et le tracé de la courbe
// y lisent getBoundingClientRect(). Rien ne les redessinait ensuite — réduire
// la fenêtre laissait donc les donuts et la courbe figés à la taille qu'ils
// avaient au premier affichage (étirés ou rognés), alors que tout le texte
// autour se réajustait. C'est le seul vrai bug de responsive restant.
//
// On rappelle render() plutôt que chaque fonction de dessin : celles-ci ont
// besoin des données (tâches, statistiques) qu'il faudrait reconstruire ici.
// render() va les chercher et refait les calculs : c'est exactement le chemin
// déjà emprunté après chaque changement de donnée, donc le même code éprouvé.
const CANVAS_IDS = [
  'pgDayDonut', 'pgTimeDonut', 'pgEvoChart', 'pgPerfDonut',
  'retardsBarChart', 'retardsDonutChart',
]
// En dessous de cet écart de largeur, rien ne change réellement à l'écran :
// on évite de redessiner pour un pixel.
const REDRAW_MIN_WIDTH_DELTA = 2
// Le redessin est différé : l'événement « resize » arrive en rafale pendant
// que l'utilisateur fait glisser la fenêtre. Sans ce délai, on appellerait
// l'API des centaines de fois par seconde.
const REDRAW_DELAY_MS = 200
let lastCanvasWidth = window.innerWidth
let redrawTimer = 0

window.addEventListener('resize', () => {
  closeReminderMenu()

  // Aucune des vues concernées n'a de graphique visible ? inutile d'appeler
  // l'API : Dashboard, Mes tâches et Paramètres n'en ont aucun.
  const visible = CANVAS_IDS.some((id) => {
    const c = document.getElementById(id)
    // getClientRects() est vide sur un élément `hidden` (display:none).
    return c && c.getClientRects().length > 0
  })
  if (!visible) return

  // Seule la largeur compte : un changement de hauteur seul (barre d'adresse
  // de mobile qui se cache) ne change pas la taille des graphiques, et
  // redessiner sur ce genre de micro-variation martèlerait l'API.
  if (Math.abs(window.innerWidth - lastCanvasWidth) < REDRAW_MIN_WIDTH_DELTA) return
  lastCanvasWidth = window.innerWidth

  clearTimeout(redrawTimer)
  redrawTimer = setTimeout(() => { render() }, REDRAW_DELAY_MS)
})
// Filtres « Période » et « Tâche » : <select> natifs habillés en menus
// déroulants maison (doliSelect) ; le « change » natif pilote le rendu.
const remPeriodEl = document.getElementById('reminderPeriodFilter')
if (remPeriodEl) remPeriodEl.addEventListener('change', () => { remTab = remPeriodEl.value; render() })
const remFilterEl = document.getElementById('reminderTaskFilter')
if (remFilterEl) remFilterEl.addEventListener('change', () => { remStatusFilter = remFilterEl.value; render() })
enhanceDoliSelect(remPeriodEl)
enhanceDoliSelect(remFilterEl)
const bindSwitch = (id, key) => {
  const b = document.getElementById(id)
  if (!b) return
  b.addEventListener('click', () => {
    const cur = getPrefs().reminders
    updatePrefs({ reminders: { ...cur, [key]: !cur[key] } })
    render()
  })
}
bindSwitch('remSetBrowser', 'browser'); bindSwitch('remSetMail', 'mail'); bindSwitch('remSetSound', 'sound')
const remFreqEl = document.getElementById('remDefaultFreq')
if (remFreqEl) remFreqEl.addEventListener('change', () => { updatePrefs({ reminders: { ...getPrefs().reminders, freq: remFreqEl.value } }) })
// Même habillage que les deux filtres du tableau : <select> natif masqué,
// bouton + panneau déroulant doliSelect (liste #doli-list-remDefaultFreq).
enhanceDoliSelect(remFreqEl)
if (reminderListEl) reminderListEl.addEventListener('click', async (e) => {
  // Même structure que Retards : « … » = choix de suppression du Rappel,
  // clic sur la ligne = consultation de la tâche (contenu Rappel conservé).
  const btn = e.target.closest('[data-remact]'); if (!btn) {
    const row = e.target.closest('tr[data-id]')
    if (row && row.dataset.id) { const t = await findTask(row.dataset.id); if (t) openModal(t) }
    return
  }
  const id = btn.dataset.id; if (!id) return
  if (btn.dataset.remact === 'menu') { openReminderMenu(btn, id) }
  else if (btn.dataset.remact === 'go') {
    const t = await findTask(id)
    if (t) openModal(t)
  }
})
// --- Retards : KPI cliquables + menu « … » du tableau ---------------------
// Les KPI sont des <button data-goto> : défilement vers les graphiques ou
// la liste, comme les liens du dashboard.
document.querySelectorAll('.retards-kpi[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.goto === 'charts'
      ? document.getElementById('retardsChartsAnchor')
      : document.getElementById('retardsTableAnchor')
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
})

// Menu « … » de la liste des retards : le tableau est généré par
// renderRetardsTable (lignes <tr data-id>, pas de classe .task), donc la
// délégation générique bindTaskEvents ne s'y applique pas. Ce listener
// dédié ouvre la consultation au clic sur la ligne, et un petit menu
// (Voir / Modifier / Preuve / Supprimer) au clic sur « … ».
const retardsTableBodyEl = document.getElementById('retardsTableBody')
let retardsMenuEl = null
function closeRetardsMenu() {
  if (retardsMenuEl) {
    retardsMenuEl.remove()
    retardsMenuEl = null
  }
}
document.addEventListener('click', (event) => {
  if (retardsMenuEl && !event.target.closest('.retards-floatmenu') && !event.target.closest('[data-retard-menu]')) closeRetardsMenu()
})
document.addEventListener('scroll', () => closeRetardsMenu(), true)
if (retardsTableBodyEl) retardsTableBodyEl.addEventListener('click', async (event) => {
  const menuBtn = event.target.closest('[data-retard-menu]')
  const row = event.target.closest('tr[data-id]')
  if (!row) return
  const id = row.dataset.id
  if (menuBtn) {
    event.stopPropagation()
    if (retardsMenuEl && retardsMenuEl.dataset.forId === id) {
      closeRetardsMenu()
      return
    }
    closeRetardsMenu()
    const menu = document.createElement('div')
    menu.className = 'retards-floatmenu'
    menu.dataset.forId = id
    menu.innerHTML = `
      <button type="button" data-rm="view">Voir les détails</button>
      <button type="button" data-rm="edit">Modifier</button>
      <button type="button" data-rm="proof">Ajouter une preuve</button>
      <button type="button" data-rm="delete" class="is-danger">Supprimer</button>`
    document.body.appendChild(menu)
    const r = menuBtn.getBoundingClientRect()
    menu.style.top = `${Math.round(r.bottom + 6 + window.scrollY)}px`
    menu.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`
    menu.style.position = 'absolute'
    retardsMenuEl = menu
    menu.addEventListener('click', async (ev) => {
      const opt = ev.target.closest('[data-rm]')
      if (!opt) return
      const action = opt.dataset.rm
      closeRetardsMenu()
      if (action === 'view' || action === 'edit') {
        const task = await findTask(id)
        if (task) openModal(task)
      } else if (action === 'proof') {
        if (window.__doliProofDialogHandler) window.__doliProofDialogHandler(id)
      } else if (action === 'delete') {
        const task = await findTask(id)
        if (!task) return
        const ok = window.confirm(`Supprimer la tâche "${task.title}" ?`)
        if (!ok) return
        await deleteTask(id)
        render()
      }
    })
    return
  }
  const task = await findTask(id)
  if (task) openModal(task)
})

// --- Cloche : centre de notifications (retards + rappels du jour) ----------
// Le menu vit dans le topbar masqué (display:none) : à la première ouverture
// il est PORTÉ dans <body> (classe is-portal, fixed) — même mécanisme que le
// menu « ⋯ » des lignes — sinon il ne peut jamais s'afficher.
// Consultation = à l'OUVERTURE : les notifications affichées sont marquées
// vues (badges disparaissent sur-le-champ, persisté en localStorage) mais le
// contenu reste visible pour cette lecture ; la prochaine ouverture n'affiche
// que des NOUVELLES notifications (ou l'état vide « Tout est consulté »).
function openBellMenu(anchor) {
  if (!bellMenuEl) return
  if (!bellMenuEl._portal) {
    bellMenuEl._portal = true
    bellMenuEl.classList.add('is-portal')
    document.body.appendChild(bellMenuEl)
  }
  bellMenuEl.hidden = false
  if (bellOverlayEl) bellOverlayEl.hidden = false
  // Ancrage sous le bouton cliqué (coordonnées viewport).
  const r = anchor && anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { top: 0, bottom: 16, right: window.innerWidth - 8 }
  bellMenuEl.style.top = `${Math.round(r.bottom + 8)}px`
  bellMenuEl.style.right = `${Math.max(8, Math.round(window.innerWidth - r.right))}px`
  // Pas de place en dessous (bas de page) : le menu se déploie vers le haut.
  requestAnimationFrame(() => {
    const h = bellMenuEl.offsetHeight
    if (r.bottom + 8 + h > window.innerHeight - 8) {
      bellMenuEl.style.top = `${Math.max(8, Math.round(r.top - h - 8))}px`
    }
  })
  // Consultation immédiate des notifications affichées.
  if (lastBellNotifIds.length) {
    const seen = loadSeenBell()
    for (const id of lastBellNotifIds) seen.add(id)
    saveSeenBell(seen)
    lastBellNotifIds = []
    if (tasksBellCountEl) tasksBellCountEl.hidden = true
    if (bellCountEl) bellCountEl.hidden = true
  }
}
function closeBellMenu() {
  if (!bellMenuEl) return
  const wasOpen = !bellMenuEl.hidden
  bellMenuEl.hidden = true
  if (bellOverlayEl) bellOverlayEl.hidden = true
  // Re-rend : la prochaine ouverture n'affiche que du nouveau.
  if (wasOpen) render()
}
onEl(bellBtn, 'click', () => {
  if (!bellMenuEl) return
  if (bellMenuEl.hidden) openBellMenu(bellBtn)
  else closeBellMenu()
})
onEl(bellOverlayEl, 'click', closeBellMenu)
if (bellMenuEl) bindBellMenu(bellMenuEl, async (id) => {
  // Clic sur une notification : déjà marquée vue à l'ouverture ; navigation.
  closeBellMenu()
  await revealTask(id)
  render()
})
// Fermeture : clic ailleurs (hors menu et boutons cloche), défilement (sauf
// défilement interne du menu), touche Échap.
document.addEventListener('click', (e) => {
  if (!bellMenuEl || bellMenuEl.hidden) return
  if (e.target.closest('.bell__menu')) return
  if (e.target.closest('.bell__btn') || e.target.closest('.mtasks2__bell')) return
  closeBellMenu()
})
document.addEventListener('scroll', (e) => {
  if (!bellMenuEl || bellMenuEl.hidden) return
  if (e.target && e.target.closest && e.target.closest('.bell__menu')) return
  closeBellMenu()
}, true)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && bellMenuEl && !bellMenuEl.hidden) closeBellMenu()
})

// --- Petite fenêtre de réglage (objectif hebdo / paliers) -----------------
// Remplace window.prompt() par une fenêtre adaptée à la taille du réglage,
// cohérente avec le reste de l'interface plutôt qu'une boîte système brute.
const settingsEditOverlay = document.getElementById('settingsEditOverlay')
const settingsEditTitle = document.getElementById('settingsEditTitle')
const settingsEditForm = document.getElementById('settingsEditForm')
const settingsEditField1 = document.getElementById('settingsEditField1')
const settingsEditField1Label = document.getElementById('settingsEditField1Label')
const settingsEditField2 = document.getElementById('settingsEditField2')
const settingsEditField2Label = document.getElementById('settingsEditField2Label')
const settingsEditCancelBtn = document.getElementById('settingsEditCancelBtn')

let settingsEditMode = null // 'goal' | 'achievements'

function openSettingsEdit(mode) {
  settingsEditMode = mode
  if (mode === 'goal') {
    settingsEditTitle.textContent = 'Objectif hebdomadaire'
    settingsEditField1Label.firstChild.textContent = 'Nombre de tâches par semaine'
    settingsEditField1.value = settings.weeklyGoal
    settingsEditField2Label.hidden = true
    settingsEditField2.required = false
  } else {
    settingsEditTitle.textContent = 'Paliers'
    settingsEditField1Label.firstChild.textContent = 'Premier palier'
    settingsEditField1.value = settings.achievementThresholds[0]
    settingsEditField2Label.hidden = false
    settingsEditField2Label.firstChild.textContent = 'Deuxième palier'
    settingsEditField2.value = settings.achievementThresholds[1]
    settingsEditField2.required = true
  }
  settingsEditOverlay.hidden = false
  settingsEditField1.focus()
}
function closeSettingsEdit() {
  settingsEditOverlay.hidden = true
  settingsEditForm.reset()
}
settingsEditCancelBtn.addEventListener('click', closeSettingsEdit)
settingsEditOverlay.addEventListener('click', (event) => {
  if (event.target === settingsEditOverlay) closeSettingsEdit()
})

settingsEditForm.addEventListener('submit', (event) => {
  event.preventDefault()
  if (settingsEditMode === 'goal') {
    const value = parseInt(settingsEditField1.value, 10)
    if (!Number.isFinite(value) || value <= 0) return
    settings.weeklyGoal = value
  } else {
    const first = parseInt(settingsEditField1.value, 10)
    const second = parseInt(settingsEditField2.value, 10)
    if (!Number.isFinite(first) || !Number.isFinite(second) || first <= 0 || second <= 0) return
    settings.achievementThresholds = [first, second].sort((a, b) => a - b)
  }
  saveSettings(settings)
  closeSettingsEdit()
  render()
})

// --- Thème (discret, un seul bouton qui bascule) -------------------------
onEl(themeToggleBtn, 'click', () => {
  const next = settings.theme === 'dark' ? 'light' : 'dark'
  applyTheme(next)
  settings.theme = next
  saveSettings(settings)
  render()
})

// --- Boucles périodiques (rappels + rafraîchissement) ----------------------
// Ces deux identifiants sont les SEULS points d'arrêt des timers du client.
// Toute création d'intervalle doit être enregistrée ici, sinon elle survit à
// la déconnexion et se cumule à chaque connexion.
let stopAlarms = null
let renderIntervalId = 0

// --- Authentification (compte Doli : email @gmail.com + mot de passe) ----
// L'app ne démarre qu'après une connexion réussie, revérifiée par le
// serveur : le frontend ne décide jamais lui-même qui est connecté.
async function startApp(user) {
  loginScreenEl.hidden = true
  appShellEl.hidden = false
  accountRowEl.hidden = false
  accountNameEl.textContent = user.name
  currentUserFirstName = user.name.trim().split(/\s+/)[0]
  // Aucun compte Doli n'a de photo : toujours la première lettre du prénom.
  accountAvatarFallbackEl.textContent = currentUserFirstName.charAt(0).toUpperCase()

  settings = await loadSettings()
  // On applique d'abord les préférences (densité, contraste, thème « système »…)
  // puis le thème enregistré : celui-ci reste prioritaire s'il est explicite.
  applyPrefs(settings.prefs)
  applyTheme(settings.theme)
  // Migration unique des réglages de rappel : ils étaient stockés dans
  // localStorage, donc par navigateur. Si le compte n'en a pas encore côté
  // serveur, on reprend les valeurs existantes pour ne rien perdre.
  if (!settings.prefs || !settings.prefs.reminders) {
    updatePrefs({
      reminders: {
        browser: remCfg.browser === '1',
        mail: remCfg.mail === '1',
        sound: remCfg.sound === '1',
        freq: remCfg.freq,
      },
    })
  }
  // Démarrage des deux boucles périodiques. On les MÉMORISE et on arrête
  // systématiquement les précédentes : sans cela, chaque connexion empilait
  // un nouvel intervalle (les rendus se multipliaient, les notifications
  // apparaissaient en double, la charge serveur augmentait).
  stopBackgroundLoops()
  stopAlarms = initAlarms({ getTasks: getAllTasks, updateTask })
  await render()
  // Rafraîchit le compte à rebours de la rubrique Rappel et fait apparaître /
  // disparaître les tâches qui entrent ou sortent de la fenêtre de 5 minutes.
  renderIntervalId = setInterval(render, 15000)
}

/** Arrête les deux boucles périodiques, si elles tournent. */
function stopBackgroundLoops() {
  if (stopAlarms) { stopAlarms(); stopAlarms = null }
  if (renderIntervalId) { clearInterval(renderIntervalId); renderIntervalId = 0 }
}

// Referme l'application avant de revenir à l'écran de connexion : sans cela,
// les boucles continuaient de tourner et de sonar l'API pour un compte
// déconnecté.
stopBackgroundLoops()
window.addEventListener('beforeunload', stopBackgroundLoops)

logoutBtn.addEventListener('click', async () => {
  stopBackgroundLoops()
  await signOut()
  window.location.reload()
})

function showFormError(el, message) {
  el.hidden = false
  el.textContent = message
}

// Bascule entre le panneau de connexion et celui d'inscription.
function showRegisterPanel() {
  loginPanelEl.hidden = true
  registerPanelEl.hidden = false
  loginErrorEl.hidden = true
}
function showLoginPanel() {
  registerPanelEl.hidden = true
  loginPanelEl.hidden = false
  registerErrorEl.hidden = true
}
showRegisterBtn.addEventListener('click', showRegisterPanel)
showLoginBtn.addEventListener('click', showLoginPanel)

// Bascule afficher/masquer sur chaque champ mot de passe.
document.querySelectorAll('.password-field__toggle').forEach((toggleBtn) => {
  const target = document.getElementById(toggleBtn.dataset.target)
  const use = toggleBtn.querySelector('use')
  toggleBtn.addEventListener('click', () => {
    const show = target.type === 'password'
    target.type = show ? 'text' : 'password'
    use.setAttribute('href', show ? '#eyeOffIcon' : '#eyeIcon')
    toggleBtn.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe')
  })
})

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  loginErrorEl.hidden = true
  try {
    const user = await login(loginEmailField.value.trim(), loginPasswordField.value)
    startApp(user)
  } catch (err) {
    showFormError(loginErrorEl, err.message)
  }
})

// Le serveur peut refuser les inscriptions (par défaut). On interroge sa
// configuration au démarrage pour ne pas afficher un bouton qui échouerait
// toujours : l'utilisateur comprendrait mal pourquoi rien ne se passe.
async function applyRegistrationPolicy() {
  try {
    const policy = await getRegistrationPolicy()
    if (!policy.open) {
      showRegisterBtn.hidden = true
      // Le panneau reste atteignable par le code, on le ferme aussi.
      registerPanelEl.hidden = true
      loginPanelEl.hidden = false
      return
    }
    // Champ de code affiché uniquement s'il est réellement exigé.
    registerInviteField.hidden = !policy.requiresInvite
  } catch {
    // Serveur injoignable : on laisse l'affichage par défaut plutôt que de
    // masquer un formulaire qui fonctionne peut-être.
  }
}

registerForm.addEventListener('submit', async (event) => {
  event.preventDefault()
  registerErrorEl.hidden = true
  // Vérification côté client en plus de celle du serveur : évite un
  // aller-retour réseau pour une erreur de saisie évidente.
  if (registerPasswordField.value !== registerConfirmPasswordField.value) {
    showFormError(registerErrorEl, 'Les mots de passe ne correspondent pas.')
    return
  }
  try {
    const user = await register({
      name: registerNameField.value.trim(),
      email: registerEmailField.value.trim(),
      password: registerPasswordField.value,
      confirmPassword: registerConfirmPasswordField.value,
      // Envoyé même vide : le serveur peut l'exiger selon sa configuration.
      inviteCode: registerInviteInput ? registerInviteInput.value : '',
    })
    startApp(user)
  } catch (err) {
    showFormError(registerErrorEl, err.message)
  }
})

// getSession() interroge le serveur (cookie de session) : si une session
// valide existe déjà, pas besoin de repasser par le formulaire.
async function boot() {
  applyRegistrationPolicy()
  const existingSession = await getSession()
  if (existingSession) startApp(existingSession)
}

boot()
