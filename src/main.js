// main.js
// Point d'entrée de l'application. Relie les modules entre eux, réagit
// aux événements DOM, et déclenche le re-rendu à chaque changement.

import './style.css'
import { loadSettings, saveSettings } from './modules/storage.js'
import { getAllTasks, addTask, updateTask, deleteTask, setStatus, findTask, STATUS } from './modules/tasks.js'
import {
  computeStats,
  computeTrend,
  computeStreak,
  computeWeeklyComparison,
  computeBestDay,
  computeAvgCompletionDelay,
  computeAchievements,
  computeWeeklyActivity,
  computeProjection,
} from './modules/stats.js'
import {
  computeProgressionStats,
  computeTodayDistribution,
  computeWeekComparison,
  computeProgressionTrend,
  computeTodayStats,
} from './modules/progression.js'
import { applyTheme } from './modules/theme.js'
import {
  renderTasks,
  bindTaskEvents,
  renderDashboardCounts,
  bindDashboardCounts,
  renderDashboardDistribution,
  renderDashboardPercent,
  renderBell,
  bindBellMenu,
  renderReminders,
  renderRecentTasks,
  renderTrend,
  renderStreak,
  renderWeekSummary,
  renderWeeklyComparison,
  renderBestDay,
  renderAvgDelay,
  renderProjection,
  renderWeeklyGoal,
  bindWeeklyGoalEdit,
  renderAchievements,
  bindAchievementsEdit,
  renderMotivation,
  renderWeeklyActivity,
  triggerConfetti,
  renderProgressionStats,
  renderProgressionDayDistribution,
  renderProgressionWeeklyComparison,
  renderProgressionTrend,
  renderProgressionTodayStats,
  bindProgressionFilters,
} from './modules/ui.js'
import { initAlarms } from './modules/alarms.js'
import { getSession, login, register, signOut } from './modules/auth.js'

const STATUS_FILTER_LABEL = {
  [STATUS.TODO]: 'non exécutée',
  [STATUS.DOING]: 'en cours',
  [STATUS.DONE]: 'exécutée',
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
  preuves: document.getElementById('viewPreuves'),
}
const viewTitles = {
  dashboard: 'Dashboard',
  tasks: 'Mes tâches',
  reminders: 'Rappel',
  progression: 'Progression',
  preuves: 'Preuves',
}
const reminderListEl = document.getElementById('reminderList')
const reminderNavCountEl = document.getElementById('reminderNavCount')

const progressionContainer = viewEls.progression
const progressionDayDistributionCanvas = document.getElementById('progressionDayDistributionChart')
const progressionWeeklyComparisonCanvas = document.getElementById('progressionWeeklyComparisonChart')
const progressionTrendCanvas = document.getElementById('progressionTrendChart')

const dashboardCountsEl = document.getElementById('dashboardCounts')
const dashboardDistributionEl = document.getElementById('dashboardDistribution')
const dashboardPercentEl = document.getElementById('dashboardPercent')
const dashboardTrendEl = document.getElementById('dashboardTrend')
const dashboardStreakEl = document.getElementById('dashboardStreak')
const dashboardMotivationEl = document.getElementById('dashboardMotivation')
const dashboardWeekSummaryEl = document.getElementById('dashboardWeekSummary')
const dashboardComparisonEl = document.getElementById('dashboardComparison')
const dashboardBestDayEl = document.getElementById('dashboardBestDay')
const dashboardAvgDelayEl = document.getElementById('dashboardAvgDelay')
const dashboardProjectionEl = document.getElementById('dashboardProjection')
const dashboardWeeklyGoalEl = document.getElementById('dashboardWeeklyGoal')
const dashboardAchievementsEl = document.getElementById('dashboardAchievements')
const dashboardHeatmapEl = document.getElementById('dashboardHeatmap')
const recentTasksListEl = document.getElementById('recentTasksList')
const addTaskBtn = document.getElementById('addTaskBtn')
const addTaskBtn2 = document.getElementById('addTaskBtn2')
const tasksAddRowEl = document.getElementById('tasksAddRow')

const taskListEl = document.getElementById('taskList')
const taskSearchInput = document.getElementById('taskSearchInput')
const taskSortBtn = document.getElementById('taskSortBtn')
const taskSortMenu = document.getElementById('taskSortMenu')

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

  // Dashboard
  renderDashboardCounts(dashboardCountsEl, stats, statusFilter)
  renderDashboardDistribution(dashboardDistributionEl, stats)
  renderDashboardPercent(dashboardPercentEl, stats)
  renderTrend(dashboardTrendEl, computeTrend(allTasks))
  renderMotivation(dashboardMotivationEl, stats.percent, stats.total, currentUserFirstName)

  // Série sans retard : le record se met à jour et se persiste dès qu'il
  // est battu, avec une petite célébration.
  const currentStreak = computeStreak(allTasks)
  if (currentStreak > settings.bestStreak) {
    settings.bestStreak = currentStreak
    saveSettings(settings)
    triggerConfetti()
  }
  renderStreak(dashboardStreakEl, currentStreak, settings.bestStreak)

  const overdueCount = allTasks.filter((t) => t.dueDate && t.status !== STATUS.DONE && new Date(t.dueDate) < new Date()).length
  renderWeekSummary(dashboardWeekSummaryEl, stats, overdueCount)

  const weeklyComparison = computeWeeklyComparison(allTasks)
  renderWeeklyComparison(dashboardComparisonEl, weeklyComparison)
  renderWeeklyGoal(dashboardWeeklyGoalEl, weeklyComparison.thisWeek, settings.weeklyGoal)

  renderBestDay(dashboardBestDayEl, computeBestDay(allTasks))
  renderAvgDelay(dashboardAvgDelayEl, computeAvgCompletionDelay(allTasks))
  renderProjection(dashboardProjectionEl, computeProjection(allTasks))
  renderAchievements(dashboardAchievementsEl, computeAchievements(allTasks, settings.achievementThresholds))
  renderWeeklyActivity(dashboardHeatmapEl, computeWeeklyActivity(allTasks))

  const RECENT_WINDOW_MS = 12 * 60 * 60 * 1000 // 12 heures
  const now = Date.now()
  const lastSaved = (t) => new Date(t.updatedAt || t.completedAt || t.createdAt).getTime()
  const recent = allTasks
    .filter((t) => !dismissedRecentIds.has(t.id) && now - lastSaved(t) <= RECENT_WINDOW_MS)
    .sort((a, b) => lastSaved(b) - lastSaved(a))
    .slice(0, 5)
  renderRecentTasks(recentTasksListEl, recent, now)
  addTaskBtn.hidden = allTasks.length > 0

  // Mes tâches
  let visibleTasks = allTasks
  if (statusFilter) {
    visibleTasks = visibleTasks.filter((t) => t.status === statusFilter || pinnedIds.has(t.id))
  }
  const trimmedQuery = searchQuery.trim().toLowerCase()
  if (trimmedQuery) {
    visibleTasks = visibleTasks.filter(
      (t) => t.title.toLowerCase().includes(trimmedQuery) || t.description.toLowerCase().includes(trimmedQuery)
    )
  }
  visibleTasks = sortTasks(visibleTasks, sortMode, now)
  let tasksEmptyMessage
  if (visibleTasks.length === 0) {
    if (trimmedQuery) tasksEmptyMessage = `Aucune tâche ne correspond à "${searchQuery.trim()}".`
    else if (statusFilter) tasksEmptyMessage = `Aucune tâche ${STATUS_FILTER_LABEL[statusFilter]} pour le moment.`
  }
  renderTasks(taskListEl, visibleTasks, 'list', tasksEmptyMessage)
  // Le bouton d'ajout disparaît dès qu'un filtre par statut est actif (seules
  // les tâches correspondantes doivent apparaître), ainsi que lorsqu'une
  // recherche ne renvoie aucun résultat.
  tasksAddRowEl.hidden = statusFilter !== null || (trimmedQuery.length > 0 && visibleTasks.length === 0)

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

  themeToggleBtn.innerHTML = settings.theme === 'dark' ? MOON_ICON : SUN_ICON
}

// --- Navigation entre vues ---------------------------------------------
function setView(view) {
  currentView = view
  Object.entries(viewEls).forEach(([key, el]) => {
    if (el) el.hidden = key !== view
  })
  if (viewTitles[view]) viewTitleEl.textContent = viewTitles[view]
  navButtons.forEach((btn) => btn.classList.toggle('is-active', btn.dataset.view === view))
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
onEl(addTaskBtn2, 'click', () => openModal())
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

// --- Filtre par section (Exécutées / En cours / Non exécutées) --------
if (dashboardCountsEl) {
  bindDashboardCounts(dashboardCountsEl, (status) => {
    statusFilter = status === 'total' ? null : status
    pinnedIds.clear()
    setView('tasks')
    render()
  })
}

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
    if (statusFilter && task.status === statusFilter) pinnedIds.add(id)
    await setStatus(id, status)
    if (status === STATUS.DONE && task.status !== STATUS.DONE) triggerConfetti()
    render()
  },
  onEdit: goToTask,
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

// --- Recherche et tri de "Mes tâches" ------------------------------------
onEl(taskSearchInput, 'input', () => {
  searchQuery = taskSearchInput.value
  render()
})

// Le bouton affiche toujours "Trier" (pas la valeur sélectionnée) ; toutes
// les options, y compris "Par défaut", apparaissent dans le menu déroulant.
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
  sortMode = option.dataset.sort
  taskSortMenu
    .querySelectorAll('.sort-picker__option')
    .forEach((opt) => opt.classList.toggle('is-current', opt === option))
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

// Dans "Tâches récentes", supprimer ne fait que retirer la tâche de ce
// widget : elle reste bien présente et intacte dans "Mes tâches".
const recentTaskActions = {
  ...taskActions,
  onDelete(id) {
    dismissedRecentIds.add(id)
    render()
  },
}
if (recentTasksListEl) bindTaskEvents(recentTasksListEl, recentTaskActions)

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

if (dashboardWeeklyGoalEl) bindWeeklyGoalEdit(dashboardWeeklyGoalEl, () => openSettingsEdit('goal'))
if (dashboardAchievementsEl) bindAchievementsEdit(dashboardAchievementsEl, () => openSettingsEdit('achievements'))

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
