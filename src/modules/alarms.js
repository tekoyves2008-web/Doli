// alarms.js
// Vérifie périodiquement si l'heure de début ou d'échéance d'une tâche
// approche ou est atteinte, et déclenche une notification navigateur
// (Notification API). Ne fonctionne que pendant que l'onglet Doli est ouvert.

const FIVE_MIN_MS = 5 * 60 * 1000
const TWO_MIN_MS = 2 * 60 * 1000

// La demande d'autorisation est asynchrone : on la déclenche dès le
// chargement de l'application (voir initAlarms) pour qu'elle soit déjà
// résolue au moment du premier rappel, et non plus au moment de notifier.
function requestPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    return Notification.requestPermission()
  }
  return Promise.resolve(typeof Notification !== 'undefined' ? Notification.permission : 'denied')
}

// Affiche la notification et la referme dès que l'utilisateur clique dessus
// (comportement non garanti par défaut selon les navigateurs).
function showNotification(title, body) {
  const notification = new Notification(title, { body })
  notification.onclick = () => notification.close()
}

// Un rappel déclenché doit obligatoirement se traduire par une notification :
// si l'autorisation est encore en attente, on affiche dès qu'elle est
// résolue au lieu de l'ignorer silencieusement.
function notify(title, body) {
  if (!('Notification' in window)) return
  if (Notification.permission === 'granted') {
    showNotification(title, body)
    return
  }
  if (Notification.permission === 'default') {
    requestPermission().then((permission) => {
      if (permission === 'granted') showNotification(title, body)
    })
  }
}

// Le titre de la notification signale sans ambiguïté sa nature : "Rappel"
// pour les avertissements à 5 min / 2 min, "Tâche non exécutée" au moment où
// le début ou l'échéance est effectivement atteint sans que la tâche soit
// terminée.
function checkAlarms(tasks, updateTask) {
  const now = new Date()
  for (const task of tasks) {
    if (task.startTime) {
      const start = new Date(task.startTime)
      if (!task.remindStart5 && now >= new Date(start.getTime() - FIVE_MIN_MS)) {
        notify('Rappel', `"${task.title}" débute dans 5 minutes`)
        updateTask(task.id, { remindStart5: true })
      }
      if (!task.remindStart2 && now >= new Date(start.getTime() - TWO_MIN_MS)) {
        notify('Rappel', `"${task.title}" débute dans 2 minutes`)
        updateTask(task.id, { remindStart2: true })
      }
      if (!task.startNotified && now >= start) {
        notify('Tâche non exécutée', `"${task.title}" devait débuter maintenant`)
        updateTask(task.id, { startNotified: true })
      }
    }

    if (task.dueDate) {
      const due = new Date(task.dueDate)
      if (!task.remindDue5 && now >= new Date(due.getTime() - FIVE_MIN_MS)) {
        notify('Rappel', `Échéance de "${task.title}" dans 5 minutes`)
        updateTask(task.id, { remindDue5: true })
      }
      if (!task.remindDue2 && now >= new Date(due.getTime() - TWO_MIN_MS)) {
        notify('Rappel', `Échéance de "${task.title}" dans 2 minutes`)
        updateTask(task.id, { remindDue2: true })
      }
      if (!task.dueNotified && now >= due) {
        notify('Tâche non exécutée', `Échéance dépassée : "${task.title}"`)
        updateTask(task.id, { dueNotified: true })
      }
    }
  }
}

/**
 * Démarre la vérification périodique des rappels.
 *
 * Renvoie une fonction d'arrêt. Elle est indispensable : sans elle, chaque
 * appel à startApp() (donc chaque connexion) créait un NOUVEL intervalle, sans
 * jamais arrêter le précédent — `clearInterval` n'existait nulle part dans le
 * projet. Après trois connexions, les rappels étaient vérifiés trois fois et
 * les notifications pouvaient apparaître en triple.
 */
export function initAlarms({ getTasks, updateTask }) {
  requestPermission()
  // getTasks() passe maintenant par le réseau (fetch) : il faut l'attendre
  // avant de vérifier les rappels, sinon checkAlarms recevrait une Promise
  // au lieu d'un tableau de tâches.
  const id = setInterval(async () => {
    const tasks = await getTasks()
    checkAlarms(tasks, updateTask)
  }, 30000)
  return function stopAlarms() {
    clearInterval(id)
  }
}
