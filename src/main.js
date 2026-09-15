// main.js
// Point d'entrée de l'application. Relie les modules entre eux, réagit
// aux événements DOM, et déclenche le re-rendu à chaque changement.

import './style.css'
import { loadSettings, saveSettings } from './modules/storage.js'
import { getAllTasks, addTask, updateTask, deleteTask, setStatus, provideProof, findTask, STATUS } from './modules/tasks.js'
import {
  computeStats,
  computeStreak,
} from './modules/stats.js'
import {
  computeProgressionStats,
  computeTaskProgress,
  computeTodayDistribution,
  computeWeekComparison,
  computeProgressionTrend,
  computeTodayStats,
} from './modules/progression.js'
import { applyTheme } from './modules/theme.js'
import {
  computeRetardsStats,
  computeRetardsEvolution,
  renderRetardsBarChart,
  renderRetardsDonutChart,
  renderRetardsTable,
  formatDelay,
  formatHoursFlat,
  formatRateFR,
} from './modules/retards.js'
import {
  bindTaskEvents,
  openProofAddMenu,
  openProofFilePicker,
  renderBell,
  bindBellMenu,
  renderReminders,
  triggerConfetti,
  renderProgressionStats,
  renderProgressionDayDistribution,
  renderProgressionWeeklyComparison,
  renderProgressionTrend,
  renderProgressionTodayStats,
  bindProgressionFilters,
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
import { getSession, login, register, signOut } from './modules/auth.js'

const STATUS_FILTER_LABEL = {
  [STATUS.TODO]: 'non exécutée',
  [STATUS.DOING]: 'en cours',
  [STATUS.DONE]: 'exécutée',
  delayed: 'en retard',
}

const PROGRESSION_PERIOD_LABELS = {
  1: 'Aujourd\'hui',
  7: '1 semaine',
  14: '2 semaines',
  30: '1 mois',
  90: '3 mois',
  180: '6 mois',
  365: '1 an'
}

function updateProgressionTitles(period) {
  const label = PROGRESSION_PERIOD_LABELS[period] || 'Aujourd\'hui'
  const distributionTitle = document.getElementById('progressionDistributionTitle')
  const comparisonTitle = document.getElementById('progressionComparisonTitle')
  const trendTitle = document.getElementById('progressionTrendTitle')
  const summaryTitle = document.getElementById('progressionSummaryTitle')

  if (distributionTitle) distributionTitle.textContent = `Répartition des tâches sur ${label}`
  if (comparisonTitle) comparisonTitle.textContent = `Comparaison sur ${label}`
  if (trendTitle) trendTitle.textContent = `Évolution de la progression sur ${label}`
  if (summaryTitle) summaryTitle.textContent = `Bilan sur ${label}`
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
}
const viewTitles = {
  dashboard: 'Dashboard',
  tasks: 'Mes tâches',
  reminders: 'Rappel',
  progression: 'Progression',
  retards: 'Retards',
  preuves: 'Preuves',
}
const reminderListEl = document.getElementById('reminderList')
const reminderNavCountEl = document.getElementById('reminderNavCount')

const progressionContainer = viewEls.progression
const progressionDayDistributionCanvas = document.getElementById('progressionDayDistributionChart')
const progressionWeeklyComparisonCanvas = document.getElementById('progressionWeeklyComparisonChart')
const progressionTrendCanvas = document.getElementById('progressionTrendChart')
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
const dashViewActivityBtn = document.getElementById('dashViewActivity')
const dashLearnStatsBtn = document.getElementById('dashLearnStats')
const dashPerfLearnBtn = document.getElementById('dashViewPerf')
const addTaskBtn = document.getElementById('addTaskBtn')
const addTaskBtn3 = document.getElementById('addTaskBtn3')

const taskListEl = document.getElementById('taskList')
const taskSearchInput = document.getElementById('taskSearchInput')
const taskSortBtn = document.getElementById('taskSortBtn')
const taskSortMenu = document.getElementById('taskSortMenu')
const tasksCountsEl = document.getElementById('tasksCounts')
const tasksTabsEl = document.getElementById('tasksTabs')
const tasksTodayDateEl = document.getElementById('tasksTodayDate')
const tasksTodayWeekdayEl = document.getElementById('tasksTodayWeekday')
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

const reminderDeleteOverlay = document.getElementById('reminderDeleteOverlay')
const reminderDeleteTextEl = document.getElementById('reminderDeleteText')
const reminderDeleteFullBtn = document.getElementById('reminderDeleteFullBtn')
const reminderDeleteDismissBtn = document.getElementById('reminderDeleteDismissBtn')
const reminderDeleteCancelBtn = document.getElementById('reminderDeleteCancelBtn')

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
let settings = { theme: 'dark', viewMode: 'list', bestStreak: 0, weeklyGoal: 10, achievementThresholds: [10, 50] }
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
// l'utilisateur face à la confirmation de suppression).
let dismissedReminderIds = new Set()
// Notifications de retard retirées du menu de la cloche après un clic
// dessus ; la tâche elle-même reste inchangée (toujours en retard ailleurs).
let dismissedBellIds = new Set()

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

// --- Rendu global -----------------------------------------------------
// Async : les tâches viennent maintenant du serveur (fetch) à chaque appel.
async function render() {
  const allTasks = await getAllTasks()
  const stats = computeStats(allTasks)
  const now = Date.now()

  // --- Dashboard (maquette Doli) : tous les rendus passent par les calculs
  // existants (computeTaskProgress, situationInfo, etc.) — présentation seule.
  if (dashGreetingEl) dashGreetingEl.textContent = `Bonjour ${currentUserFirstName || ''} !`
  if (dashDateEl) {
    const parts = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    dashDateEl.textContent = parts.charAt(0).toUpperCase() + parts.slice(1)
  }

  const isLate = (t) => t.status !== STATUS.DONE && t.dueDate && new Date(t.dueDate).getTime() < now
  const delayed = allTasks.filter(isLate)
  const kpiStats = { total: allTasks.length, done: stats.done, doing: stats.doing, todo: stats.todo, delayed: delayed.length }

  // Progression globale : moyenne des progressions individuelles (0/taux/100),
  // delta affiché par rapport à la moyenne d'hier (tendance sur 2 jours).
  const progresses = allTasks.map(computeTaskProgress).filter((p) => p !== null)
  const globalPct = progresses.length ? Math.round(progresses.reduce((a, b) => a + b, 0) / progresses.length) : 0
  if (dashProgressRingEl) dashProgressRingEl.style.setProperty('--percent', globalPct)
  if (dashProgressPctEl) dashProgressPctEl.textContent = `${globalPct} %`
  const trend2 = computeProgressionTrend(allTasks, 2)
  const delta = trend2.length === 2 ? trend2[1].percent - trend2[0].percent : 0
  if (dashProgressDeltaEl) dashProgressDeltaEl.textContent = `${delta >= 0 ? '+' : ''}${delta} % par rapport à hier`

  // Performance : part des tâches hors retard.
  const perfPct = allTasks.length ? Math.round(((allTasks.length - delayed.length) / allTasks.length) * 100) : 0
  if (dashPerformanceEl) dashPerformanceEl.style.setProperty('--percent', perfPct)
  if (dashPerformancePctEl) dashPerformancePctEl.textContent = `${perfPct} %`

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
  renderDashTaskCards(dashAllTasksEl, dashTasks, now)

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
  renderTasksTabs(tasksTabsEl, tasksCounts, activeTasksFilter)
  if (tasksTodayDateEl) {
    const d = new Date()
    tasksTodayDateEl.textContent = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
  }
  if (tasksTodayWeekdayEl) {
    const d = new Date()
    const wd = d.toLocaleDateString('fr-FR', { weekday: 'long' })
    tasksTodayWeekdayEl.textContent = wd.charAt(0).toUpperCase() + wd.slice(1)
  }
  if (tasksBellCountEl) {
    const n = delayed.length
    tasksBellCountEl.hidden = n === 0
    tasksBellCountEl.textContent = n > 9 ? '9+' : String(n)
  }

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
  // Résumé de la journée (panneau latéral) : mêmes données, nouveau rendu.
  renderTasksSummary(tasksSummaryEl, allTasks)

  // Rappel : tâches entrées dans la fenêtre de 5 minutes avant leur début ou
  // leur échéance. Une fois déclenché, le rappel persiste (même en retard) et
  // ne disparaît que si la tâche est terminée ou supprimée.
  const REMINDER_WINDOW_MS = 5 * 60 * 1000
  const reminders = allTasks
    .filter((t) => t.status !== STATUS.DONE && !dismissedReminderIds.has(t.id))
    .map((t) => {
      const start = t.startTime ? new Date(t.startTime) : null
      const due = t.dueDate ? new Date(t.dueDate) : null
      const dueActive = due && due.getTime() - now <= REMINDER_WINDOW_MS
      const startActive = start && start.getTime() - now <= REMINDER_WINDOW_MS
      if (dueActive) return { task: t, kind: 'due', target: due }
      if (startActive) return { task: t, kind: 'start', target: start }
      return null
    })
    .filter(Boolean)
    .sort((a, b) => a.target - b.target)
  renderReminders(reminderListEl, reminders, now)
  reminderNavCountEl.hidden = reminders.length === 0
  reminderNavCountEl.textContent = reminders.length

  // Cloche des retards
  renderBell(bellCountEl, bellMenuEl, allTasks.filter((t) => !dismissedBellIds.has(t.id)))

  // Progression
  if (currentView === 'progression') {
    updateProgressionTitles(progressionPeriod)

    const progressionStats = computeProgressionStats(allTasks, progressionPeriod)
    renderProgressionStats(progressionStats)

    const todayDistribution = computeTodayDistribution(allTasks, progressionPeriod)
    renderProgressionDayDistribution(progressionDayDistributionCanvas, todayDistribution)

    const weekComparison = computeWeekComparison(allTasks, progressionPeriod)
    renderProgressionWeeklyComparison(progressionWeeklyComparisonCanvas, weekComparison)

    const trendData = computeProgressionTrend(allTasks, progressionPeriod)
    renderProgressionTrend(progressionTrendCanvas, trendData)

    const todayStats = computeTodayStats(allTasks, progressionPeriod)
    renderProgressionTodayStats(todayStats)
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
    const navCountEl = el('retardsNavCount')
    if (navCountEl) {
      navCountEl.textContent = retardsStats.count
      navCountEl.hidden = retardsStats.count === 0
    }
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

  // Badge du compteur dans la sidebar.
  const navCountEl = el('retardsNavCount')
  if (navCountEl) {
    navCountEl.textContent = retardsStats.count
    navCountEl.hidden = retardsStats.count === 0
  }
}

function setView(view) {
  currentView = view
  Object.entries(viewEls).forEach(([key, el]) => {
    if (el) el.hidden = key !== view
  })
  if (viewTitles[view]) viewTitleEl.textContent = viewTitles[view]
  navButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.view === view))
  // La rubrique Retards dessine sur canvas : quand sa section était cachée
  // (hidden), les canvas mesuraient 0px et restaient vides. On re-rend donc
  // une fois la section visible pour obtenir les VRAIES tailles.
  if (view === 'retards') {
    requestAnimationFrame(() => {
      getAllTasks().then(renderRetardsNow).catch(() => {})
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

// --- Progression : filtres temporels ---
if (progressionContainer) {
  bindProgressionFilters(progressionContainer, (period) => {
    progressionPeriod = period
    render()
  })
}

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
    taskEditBtn.hidden = false
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
onEl(taskEditBtn, 'click', () => {
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

  const payload = {
    title,
    description: taskDescField.value.trim(),
    dueDate: taskDueField.value || null,
    startTime: taskStartField.value || null,
    priority: taskPriorityField.value,
  }

  if (taskIdField.value) {
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
  render()
}

// Ponts utilisés par le mini-menu (dashboard) et la petite fenêtre
// (Mes tâches, …) d'ui.js (sans import circulaire).
window.__doliProofFileHandler = submitProofFile
window.__doliProofSimpleHandler = submitSimpleProof
window.__doliProofDialogHandler = openProofAddDialog

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
  render()
})

onEl(dashSearchInputEl, 'input', () => {
  dashQuery = dashSearchInputEl.value
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
onEl(dashViewActivityBtn, 'click', () => {
  setView('tasks')
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
    await setStatus(id, status)
    if (status === STATUS.DONE && task.status !== STATUS.DONE) triggerConfetti()
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
    await provideProof(id)
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
  if (taskQuickStatusEl) taskQuickStatusEl.value = finalKey
  if (taskQuickPriorityEl) taskQuickPriorityEl.value = 'all'
  if (taskPeriodFilterEl) taskPeriodFilterEl.value = 'all'
  if (taskSearchInput) taskSearchInput.value = ''
  render()
}
if (tasksCountsEl) tasksCountsEl.addEventListener('click', (event) => {
  const btn = event.target.closest('[data-count-key]')
  if (!btn) return
  applyTasksStatusFilter(btn.dataset.countKey)
})
if (tasksTabsEl) tasksTabsEl.addEventListener('click', (event) => {
  const tab = event.target.closest('[data-status-tab]')
  if (!tab) return
  applyTasksStatusFilter(tab.dataset.statusTab)
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
  if (taskQuickSortEl) taskQuickSortEl.value = 'default'
  if (taskQuickPriorityEl) taskQuickPriorityEl.value = 'all'
  if (taskQuickStatusEl) taskQuickStatusEl.value = 'all'
  if (taskPeriodFilterEl) taskPeriodFilterEl.value = 'week'
  render()
}

// Cloche de l'en-tête « Mes tâches » : ouvre le menu des retards.
onEl(tasksBellBtn, 'click', () => {
  if (!bellMenuEl) return
  if (bellMenuEl.hidden) {
    bellMenuEl.hidden = false
    if (bellOverlayEl) bellOverlayEl.hidden = false
  } else {
    bellMenuEl.hidden = true
    if (bellOverlayEl) bellOverlayEl.hidden = true
  }
})
onEl(tasksPrivacyBtn, 'click', () => {
  window.alert('Vos données restent sur votre compte : seul vous pouvez voir vos tâches, vos preuves et vos statistiques.')
})

// Menu « Trier » (à côté de la recherche) : 4 ordres d'affichage —
// Par défaut / Urgence / Priorité / Titre (A → Z). Le choix reporte le tri
// dans le select « Trier par » des filtres rapides et réordonne la liste.
function syncTasksSortControls(effectiveSort) {
  if (taskQuickSortEl && taskQuickSortEl.querySelector(`option[value="${effectiveSort}"]`)) {
    if (taskQuickSortEl.value !== effectiveSort) taskQuickSortEl.value = effectiveSort
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
  if (taskQuickSortEl) taskQuickSortEl.value = tasksQuickSort
  tasksPage = 1
  closeSortMenu()
  render()
})

// Dans le Rappel, la suppression offre un vrai choix à l'utilisateur, via
// une fenêtre à 3 boutons distincts (plus fiable qu'un confirm() natif où
// "Annuler" prête à confusion) : supprimer la tâche pour de bon, l'arrêter
// d'apparaître dans le Rappel seulement (elle reste dans "Mes tâches"), ou
// ne rien faire.
let pendingReminderDeleteId = null

async function openReminderDeleteChoice(id) {
  const task = await findTask(id)
  if (!task) return
  pendingReminderDeleteId = id
  reminderDeleteTextEl.textContent = `"${task.title}"`
  reminderDeleteOverlay.hidden = false
}
function closeReminderDeleteChoice() {
  pendingReminderDeleteId = null
  reminderDeleteOverlay.hidden = true
}
onEl(reminderDeleteFullBtn, 'click', async () => {
  if (pendingReminderDeleteId) await deleteTask(pendingReminderDeleteId)
  closeReminderDeleteChoice()
  render()
})
onEl(reminderDeleteDismissBtn, 'click', () => {
  if (pendingReminderDeleteId) dismissedReminderIds.add(pendingReminderDeleteId)
  closeReminderDeleteChoice()
  render()
})
onEl(reminderDeleteCancelBtn, 'click', closeReminderDeleteChoice)
onEl(reminderDeleteOverlay, 'click', (event) => {
  if (event.target === reminderDeleteOverlay) closeReminderDeleteChoice()
})

const reminderTaskActions = {
  ...taskActions,
  onDelete: openReminderDeleteChoice,
}
if (reminderListEl) bindTaskEvents(reminderListEl, reminderTaskActions)

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

// --- Cloche des tâches en retard ----------------------------------------
// Un overlay invisible mais bloquant empêche toute interaction avec le
// reste de la page tant que le menu est ouvert ; un clic dessus le ferme.
function openBellMenu() {
  if (!bellMenuEl || !bellOverlayEl) return
  bellMenuEl.hidden = false
  bellOverlayEl.hidden = false
}
function closeBellMenu() {
  if (!bellMenuEl || !bellOverlayEl) return
  bellMenuEl.hidden = true
  bellOverlayEl.hidden = true
}
onEl(bellBtn, 'click', () => {
  if (!bellMenuEl) return
  if (bellMenuEl.hidden) openBellMenu()
  else closeBellMenu()
})
onEl(bellOverlayEl, 'click', closeBellMenu)
if (bellMenuEl) bindBellMenu(bellMenuEl, async (id) => {
  dismissedBellIds.add(id)
  closeBellMenu()
  await revealTask(id)
  render()
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
  applyTheme(settings.theme)
  initAlarms({ getTasks: getAllTasks, updateTask })
  await render()
  // Rafraîchit le compte à rebours de la rubrique Rappel et fait apparaître /
  // disparaître les tâches qui entrent ou sortent de la fenêtre de 5 minutes.
  setInterval(render, 15000)
}

logoutBtn.addEventListener('click', async () => {
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
    })
    startApp(user)
  } catch (err) {
    showFormError(registerErrorEl, err.message)
  }
})

// getSession() interroge le serveur (cookie de session) : si une session
// valide existe déjà, pas besoin de repasser par le formulaire.
async function boot() {
  const existingSession = await getSession()
  if (existingSession) startApp(existingSession)
}

boot()
