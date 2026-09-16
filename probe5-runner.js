// probe5-runner.js — mouchard chargé DANS la vraie page (même document que
// main.js). Il observe l'état réel de l'application et le journalise vers
// /api/probe, pour diagnostiquer le bug « la petite fenêtre ne s'affiche plus ».
const log = (m) => {
  try {
    fetch('/api/probe?d=' + encodeURIComponent('P5 ' + m)).catch(() => {})
  } catch {
    /* ignore */
  }
}

window.addEventListener('error', (e) => log('ERROR ' + e.message + ' @ ' + e.filename + ':' + e.lineno))
window.addEventListener('unhandledrejection', (e) => log('REJECT ' + (e.reason && (e.reason.message || e.reason))))

function state(tag) {
  const shell = document.getElementById('appShell')
  const overlay = document.getElementById('taskModalOverlay')
  const prio = document.getElementById('taskPriority')
  const wrap = prio ? prio.nextElementSibling : null
  log(
    tag +
      ' | appShell.hidden=' + (shell ? shell.hidden : 'n/a') +
      ' | overlay=' + !!overlay +
      ' | overlay.hidden=' + (overlay ? overlay.hidden : 'n/a') +
      ' | label.offsetHeight=' + (overlay ? overlay.querySelector('.modal').offsetHeight : 'n/a') +
      ' | select.display=' + (wrap ? getComputedStyle(wrap).display : 'n/a') +
      ' | wrapCls=' + (wrap ? wrap.className : 'n/a'),
  )
}

window.addEventListener('load', () => {
  setTimeout(() => {
    log('=== boot state ===')
    state('after-load')
    // Étape 1 : clic sur « Nouvelle tâche » (barre d'outils « Mes tâches »).
    const addBtn = document.getElementById('addTaskBtn')
    log('addTaskBtn présent=' + !!addBtn)
    if (addBtn) addBtn.click()
    setTimeout(() => {
      state('after-click-add')
      // Étape 2 : clic sur la 1re ligne de tâche (ouvre la consultation).
      const row = document.querySelector('#taskList .task')
      log('row présente=' + !!row)
      if (row) row.click()
      setTimeout(() => state('after-click-row'), 400)
    }, 400)
  }, 1200)
})