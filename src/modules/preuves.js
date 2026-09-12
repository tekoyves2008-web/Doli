// --- Rubrique Preuves : galerie « Mes preuves privées » (maquette) --------
// Bandeau de confidentialité, 4 cartes de stats, recherche + filtres +
// bascule grille/liste, cartes de preuves (badge statut, privé, aperçu,
// titre, tâche, date, actions), pagination et panneau « Détail de la
// preuve ». Données réelles : preuves horodatées (proofCount/lastProofAt).

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export const pfState = {
  search: '', status: 'all', period: 'all', view: 'grid',
  page: 1, perPage: 6, selected: null,
}

const PF_PREVIEW_VARIANTS = ['code', 'diagram', 'sheet', 'chart', 'photo', 'code']

function pfStatusInfo(task) {
  // Une preuve horodatée enregistrée = preuve validée.
  return { key: 'validee', label: 'Validée' }
}

function pfDateLabel(value) {
  if (!value) return '—'
  const d = new Date(value)
  const day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} à ${hm}`
}

function pfDownloadProof(info) {
  const lines = [
    'TaskManager — Preuve privée',
    '===========================',
    `Titre : ${info.title}`,
    `Tâche associée : ${info.title}`,
    `Ajouté le : ${pfDateLabel(info.lastProofAt)}`,
    `Nombre de preuves : ${info.proofCount}`,
    'Statut : Validée',
    'Visibilité : Privée (uniquement vous)',
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `preuve-${info.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.txt`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function pfPreviewHtml(variant) {
  if (variant === 'code') {
    const widths = [3, 7, 5, 9, 4, 8, 6, 10, 5]
    return `<div class="pf-preview pf-preview--code"><div class="pf-preview__code">${widths
      .map((w, i) => `<span style="width:${w * 7 + 14}%;${i % 3 === 0 ? 'background:#34d399' : i % 3 === 1 ? 'background:#60a5fa' : 'background:#818cf8'}"></span>`)
      .join('')}</div></div>`
  }
  if (variant === 'chart') {
    const bars = [46, 62, 34, 78, 52, 66, 40, 84]
    return `<div class="pf-preview pf-preview--chart"><div class="pf-preview__bars">${bars
      .map((h) => `<span style="height:${h}%"></span>`)
      .join('')}</div><div class="pf-preview__donut"></div></div>`
  }
  if (variant === 'diagram') {
    return `<div class="pf-preview pf-preview--diagram">
      <span class="pf-node pf-node--a"></span><span class="pf-node pf-node--b"></span>
      <span class="pf-node pf-node--c"></span><span class="pf-node pf-node--d"></span>
      <svg viewBox="0 0 200 100" preserveAspectRatio="none"><path d="M30 25h55v25h55M30 75h55v-25h55" fill="none" stroke="#94a3b8" stroke-width="1.5"/></svg>
    </div>`
  }
  if (variant === 'photo') {
    return '<div class="pf-preview pf-preview--photo"><span class="pf-preview__shine"></span></div>'
  }
  return `<div class="pf-preview pf-preview--sheet"><div class="pf-preview__rows">${Array
    .from({ length: 6 }, (_, i) => `<span style="width:${88 - i * 9}%"></span>`)
    .join('')}</div></div>`
}

function pfCardHtml(it, selected) {
  const variant = PF_PREVIEW_VARIANTS[Math.abs(it.id.length * 7 + it.proofCount) % PF_PREVIEW_VARIANTS.length]
  return `
    <article class="pf-card${selected ? ' is-selected' : ''}" data-id="${it.id}">
      <div class="pf-card__top">
        <span class="pf-badge pf-badge--${it.status.key === 'validee' ? 'ok' : 'wait'}">${it.status.label}</span>
        <span class="pf-badge pf-badge--lock"><svg viewBox="0 0 20 20" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg> Privé</span>
      </div>
      ${pfPreviewHtml(variant)}
      <h4 class="pf-card__title">${it.title}</h4>
      <p class="pf-card__task">Tâche : ${it.title}</p>
      <p class="pf-card__date">${pfDateLabel(it.lastProofAt)}</p>
      <div class="pf-card__actions">
        <button type="button" class="pf-btn" data-action="view"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M2 10s3.2-5 8-5 8 5 8 5-3.2 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2.2"/></svg> Voir</button>
        <button type="button" class="pf-btn pf-btn--icon" data-action="download" aria-label="Télécharger"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9"/><polyline points="6.5,8.5 10,12 13.5,8.5"/><path d="M4 16h12"/></svg></button>
        <button type="button" class="pf-btn pf-btn--icon" data-action="more" aria-label="Options">⋯</button>
      </div>
    </article>`
}

function pfDetailHtml(selected) {
  if (!selected) {
    return `
      <div class="pf-detail__head"><h4 class="pf-detail__title">Détail de la preuve</h4></div>
      <div class="pf-detail__empty">
        <svg viewBox="0 0 20 20" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h8v15l-4-2-4 2z"/><path d="M8.5 9l1.2 1.2L12 7.4"/></svg>
        <p>Sélectionnez une preuve pour afficher son détail.</p>
      </div>`
  }
  const variant = PF_PREVIEW_VARIANTS[Math.abs(selected.id.length * 7 + selected.proofCount) % PF_PREVIEW_VARIANTS.length]
  return `
    <div class="pf-detail__head">
      <h4 class="pf-detail__title">Détail de la preuve</h4>
      <button type="button" class="pf-detail__close" data-action="close-detail" aria-label="Fermer">✕</button>
    </div>
    <div class="pf-detail__badges">
      <span class="pf-badge pf-badge--ok">${selected.status.label}</span>
      <span class="pf-detail__lock"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg> Privée</span>
    </div>
    ${pfPreviewHtml(variant)}
    <dl class="pf-detail__fields">
      <div><dt>Titre</dt><dd>${selected.title}</dd></div>
      <div><dt>Tâche associée</dt><dd class="pf-detail__task">${selected.title}</dd></div>
      <div><dt>Ajouté le</dt><dd>${pfDateLabel(selected.lastProofAt)}</dd></div>
      <div><dt>Nombre de preuves</dt><dd>${selected.proofCount}</dd></div>
      <div><dt>Statut</dt><dd><span class="pf-badge pf-badge--ok">${selected.status.label}</span></dd></div>
      <div><dt>Visibilité</dt><dd>Privée (uniquement vous)</dd></div>
    </dl>
    <button type="button" class="pf-detail__main-btn" data-action="fullscreen">
      <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 7V3h4M17 7V3h-4M3 13v4h4M17 13v4h-4"/></svg>
      Voir en plein écran
    </button>
    <div class="pf-detail__row">
      <button type="button" class="pf-btn pf-btn--block" data-action="download-detail"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9"/><polyline points="6.5,8.5 10,12 13.5,8.5"/><path d="M4 16h12"/></svg> Télécharger</button>
      <button type="button" class="pf-btn pf-btn--block pf-btn--danger" data-action="delete-proof"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 6h12"/><path d="M6 6l.7 10h6.6L14 6"/><path d="M8.5 9v4.5M11.5 9v4.5"/></svg> Supprimer</button>
    </div>
    <p class="pf-detail__note"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg> <strong>Rappel</strong> : cette preuve est confidentielle et accessible uniquement par vous.</p>`
}

export function renderPreuves(container, tasks) {
  if (!container) return
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

  // 1 carte par tâche (dernière preuve en date) ; titres échappés ici.
  let items = [...withProofs]
    .map((task) => ({
      id: task.id,
      title: escapeHtml(task.title),
      proofCount: task.proofCount,
      lastProofAt: task.lastProofAt,
      status: pfStatusInfo(task),
    }))
    .sort((a, b) => new Date(b.lastProofAt) - new Date(a.lastProofAt))

  // Filtres : recherche (titre), statut, période.
  if (pfState.search) {
    const q = pfState.search.toLowerCase()
    items = items.filter((it) => it.title.toLowerCase().includes(q))
  }
  if (pfState.status !== 'all') items = items.filter((it) => it.status.key === pfState.status)
  if (pfState.period !== 'all') {
    const now = new Date()
    const start = pfState.period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : pfState.period === 'week' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      : new Date(now.getFullYear(), now.getMonth(), 1)
    items = items.filter((it) => new Date(it.lastProofAt) >= start)
  }

  const total = withProofs.reduce((n, t) => n + t.proofCount, 0)
  const validees = withProofs.filter((t) => pfStatusInfo(t).key === 'validee').length
  const attente = withProofs.length - validees
  const pct = (n) => (withProofs.length === 0 ? 0 : Math.round((n / withProofs.length) * 100))

  const pages = Math.max(1, Math.ceil(items.length / pfState.perPage))
  if (pfState.page > pages) pfState.page = pages
  const pageItems = items.slice((pfState.page - 1) * pfState.perPage, pfState.page * pfState.perPage)
  const selected = pfState.selected ? items.find((it) => it.id === pfState.selected) : null
  container.innerHTML = `
    <div class="pf">
      <div class="pf__main">
        <h2 class="pf__heading">Mes preuves privées
          <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg>
        </h2>
        <div class="pf-banner">
          <div class="pf-banner__icon"><svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg></div>
          <div class="pf-banner__text">
            <strong>Vos preuves sont privées et confidentielles.</strong>
            <span>Vous êtes le seul utilisateur autorisé à les consulter, les télécharger et les gérer.</span>
          </div>
          <div class="pf-banner__shield">
            <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 3v6c0 5-3 8.5-7 10-4-1.5-7-5-7-10V5z"/><rect x="9.2" y="10.5" width="5.6" height="4.2" rx="1"/><path d="M10.4 10.5V9.2a1.6 1.6 0 013.2 0v1.3"/></svg>
          </div>
        </div>
        <div class="pf-stats">
          <div class="pf-stat"><div class="pf-stat__text"><h4>Total des preuves</h4><strong>${total}</strong><span>Toutes tâches confondues</span></div><span class="pf-stat__icon pf-stat__icon--accent"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9l4 4v12H5z"/><path d="M8 12h8M8 16h6"/></svg></span></div>
          <div class="pf-stat"><div class="pf-stat__text"><h4>Validées</h4><strong class="pf-stat__num--ok">${validees}</strong><span>${pct(validees)} % du total</span></div><span class="pf-stat__icon pf-stat__icon--ok"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8,12.5 11,15.5 16,9.5"/></svg></span></div>
          <div class="pf-stat"><div class="pf-stat__text"><h4>En attente</h4><strong class="pf-stat__num--wait">${attente}</strong><span>${pct(attente)} % du total</span></div><span class="pf-stat__icon pf-stat__icon--wait"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,14"/></svg></span></div>
          <div class="pf-stat"><div class="pf-stat__text"><h4>Rejetées</h4><strong class="pf-stat__num--bad">0</strong><span>0 % du total</span></div><span class="pf-stat__icon pf-stat__icon--bad"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg></span></div>
        </div>
        <div class="pf-toolbar">
          <div class="pf-search">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="9" cy="9" r="6"/><line x1="13.5" y1="13.5" x2="18" y2="18"/></svg>
            <input type="search" id="pfSearch" placeholder="Rechercher une preuve..." aria-label="Rechercher une preuve" value="${pfState.search}" />
          </div>
          <select id="pfStatus" class="pf-select" aria-label="Filtrer par statut">
            <option value="all"${pfState.status === 'all' ? ' selected' : ''}>Tous les statuts</option>
            <option value="validee"${pfState.status === 'validee' ? ' selected' : ''}>Validées</option>
            <option value="attente"${pfState.status === 'attente' ? ' selected' : ''}>En attente</option>
          </select>
          <select id="pfPeriod" class="pf-select" aria-label="Filtrer par date">
            <option value="all"${pfState.period === 'all' ? ' selected' : ''}>Toutes les dates</option>
            <option value="today"${pfState.period === 'today' ? ' selected' : ''}>Aujourd'hui</option>
            <option value="week"${pfState.period === 'week' ? ' selected' : ''}>Cette semaine</option>
            <option value="month"${pfState.period === 'month' ? ' selected' : ''}>Ce mois</option>
          </select>
          <div class="pf-viewtoggle" role="group" aria-label="Mode d'affichage">
            <button type="button" class="${pfState.view === 'grid' ? 'is-active' : ''}" data-view="grid" aria-label="Grille"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg></button>
            <button type="button" class="${pfState.view === 'list' ? 'is-active' : ''}" data-view="list" aria-label="Liste"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></svg></button>
          </div>
        </div>
        <div class="pf-grid pf-grid--${pfState.view}">${pageItems.map((it) => pfCardHtml(it, pfState.selected === it.id)).join('') || '<p class="pf-empty">Aucune preuve ne correspond à ces filtres.</p>'}</div>
        ${pages > 1 ? `
        <div class="pf-pagination">
          <button type="button" class="pf-page-btn" data-page="${pfState.page - 1}"${pfState.page <= 1 ? ' disabled' : ''}>‹ Précédent</button>
          <span class="pf-page-nums">${Array.from({ length: pages }, (_, i) => `<button type="button" class="pf-page-btn pf-page-num${i + 1 === pfState.page ? ' is-current' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}</span>
          <button type="button" class="pf-page-btn" data-page="${pfState.page + 1}"${pfState.page >= pages ? ' disabled' : ''}>Suivant ›</button>
        </div>` : ''}
      </div>
      <aside class="pf-detail">${pfDetailHtml(selected)}</aside>
    </div>`
  bindPreuvesEvents(container, items, selected)
}
