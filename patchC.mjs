import fs from 'node:fs'
const p='src/modules/ui.js'
let u=fs.readFileSync(p,'utf8')
const start=u.indexOf('export function renderTasksTable')
const end=u.indexOf('// Panneau latéral « Résumé de la journée »')
console.log('range',start,end)
if(start<0||end<0){ console.log('anchors missing'); process.exit(1) }
const block=`export function renderTasksTable(container, tasks, emptyMessage) {
  if (!container) return
  if (tasks.length === 0) {
    container.innerHTML = \`<p class="empty-state">\${escapeHtml(emptyMessage || 'Aucune tâche pour le moment. Ajoute ta première tâche.')}</p>\`
    return
  }

  container.innerHTML = tasks
    .map((task) => {
      const now = Date.now()
      const progress = computeTaskProgress(task)
      const progressPct = progress === null ? '0%' : \`\${progress}%\`
      const fillClass = progress === null || progress < 50 ? 'is-low' : progress < 100 ? 'is-mid' : 'is-done'
      const fillWidth = progress === null ? 0 : progress
      const progressLabel =
        task.status === STATUS.DONE
          ? 'Terminée'
          : task.status === STATUS.TODO
            ? 'Non exécutée'
            : progress === null
              ? 'Preuve requise'
              : 'En cours'
      const sit = situationInfo(task, now)
      const priority = effectivePriority(task)
      const prioLabel = MTASK_PRIORITY_LABEL[priority] || MTASK_PRIORITY_LABEL.medium
      const overdueRow = sit.cls === 'late' ? ' mtask--overdue' : ''
      const startHM = fmtTimeShort(task.startTime)
      const endHM = fmtTimeShort(task.dueDate)
      const dayLabel = fmtDayShort(task.startTime || task.dueDate)
      const isDone = task.status === STATUS.DONE
      const avatarCls = isDone ? 'done' : sit.cls === 'late' || sit.cls === 'latemod' ? 'late' : priority
      const avatarIcon = isDone
        ? \`<svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4.5,10.5 8,14 15.5,6"/></svg>\`
        : TASK_AVATAR_ICON[priority] || TASK_AVATAR_ICON.medium
      const actionBtn = task.status === STATUS.DOING
        ? \`<button type="button" class="mtask__btn mtask__btn--primary" data-action="provide-proof">\${TASK_ROW_ACTION_ICON.play} Continuer</button>\`
        : task.status === STATUS.TODO
          ? \`<button type="button" class="mtask__btn mtask__btn--primary" data-action="set-status" data-status="doing">\${TASK_ROW_ACTION_ICON.play} Commencer</button>\`
          : ''
      return \`
      <article class="task mtask2-row mtask--\${task.status}\${overdueRow}" data-id="\${task.id}">
        <div class="mtask2-cell mtask2-cell--task">
          <span class="mtask2-avatar mtask2-avatar--\${avatarCls}">\${avatarIcon}</span>
          <span class="mtask2-task-text">
            <span class="mtask__title">\${escapeHtml(task.title)}</span>
            <span class="mtask__kind">\${taskKindLabel(task)}</span>
          </span>
        </div>
        <div class="mtask2-cell"><span class="mtask__priority mtask__priority--\${priority}"><i></i>\${prioLabel}</span></div>
        <div class="mtask2-cell mtask__period">
          <span class="mtask__period-cols"><span class="mtask__period-col"><em>Début</em><strong>\${startHM}</strong></span><span class="mtask__period-col"><em>Fin</em><strong>\${endHM}</strong></span></span>
          <span class="mtask__period-day">\${dayLabel}</span>
        </div>
        <div class="mtask2-cell mtask__adv">
          <span class="mtask__progress-pct">\${progressPct}</span>
          <span class="mtask__progress-track"><span class="mtask__progress-fill \${fillClass}" style="width:\${fillWidth}%"></span></span>
          <span class="mtask__progress-status mtask__progress-status--\${task.status}">\${progressLabel}</span>
        </div>
        <div class="mtask2-cell"><span class="mtask__situation mtask__situation--\${sit.cls}"><span class="mtask__situation-line mtask__situation-top">\${sit.text}</span><span class="mtask__situation-line mtask__situation-sub">\${sit.sub}</span></span></div>
        <div class="mtask2-cell mtask__actions">
          \${actionBtn}
          <button type="button" class="mtask__btn" data-action="edit">Voir détails</button>
          <div class="row-menu">
            <button type="button" class="row-menu__toggle" data-action="toggle-row-menu" aria-label="Options de la tâche">···</button>
            <div class="row-menu__list" hidden>
              <button type="button" class="row-menu__option" data-action="provide-proof">Ajouter une preuve</button>
              <button type="button" class="row-menu__option row-menu__option--danger" data-action="delete">Supprimer</button>
            </div>
          </div>
        </div>
      </article>\`
    })
    .join('')
}
`
u=u.slice(0,start)+block+u.slice(end)
fs.writeFileSync(p,u,'utf8')
console.log('table done',u.length)
