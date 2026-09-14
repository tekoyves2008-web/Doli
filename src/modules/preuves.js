// --- Rubrique Preuves : galerie « Mes preuves privées » (maquette fidèle) --
// Bandeau confidentialité, 4 cartes stats, recherche + filtres + bascule
// grille/liste, cartes de preuves (badge statut, privé, aperçu, titre,
// tâche, date, actions), pagination et panneau « Détail de la preuve ».

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export const pfState = {
  search: '', task: 'all', status: 'all', period: 'all', view: 'grid',
  page: 1, perPage: 6, selected: null,
}

// Preuves fichier importées par l'utilisateur (serveur SQLite) : fusionnées
// aux démos SANS toucher au HTML/CSS existant — mêmes cartes, mêmes badges.
// `photoUrl` = aperçu image (data URL) quand le fichier est une image.
export let USER_PROOFS = []

// Évite les doubles insertions quand render() est rappelé plusieurs fois.
let userProofSyncInFlight = false

function proofFileVariant(mimeType, fileName) {
  const mime = String(mimeType || '')
  const name = String(fileName || '').toLowerCase()
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(name)) return 'photo'
  if (mime.includes('pdf') || name.endsWith('.pdf')) return 'sheet'
  if (mime.startsWith('text/') || mime.includes('json') || /\.(txt|md|csv|json|js|ts|html|css)$/.test(name)) return 'code'
  return 'sheet'
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return ''
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

// Synchronise les VRAIES preuves du serveur (dont les fichiers importés via
// « Ajouter une preuve ») : appel réseau unique, interface inchangée.
export async function syncUserProofs() {
  if (userProofSyncInFlight) return
  userProofSyncInFlight = true
  try {
    const { getAllProofs } = await import('./tasks.js')
    const rows = await getAllProofs()
    USER_PROOFS = (rows || []).map((r) => ({
      id: `srv-${r.id}`,
      serverId: r.id,
      taskId: r.task_id,
      title: r.file_name || `Preuve du ${pfDateLabel(r.created_at)}`,
      taskName: r.task_title || 'Tâche',
      desc: r.file_name
        ? `Fichier importé : ${r.file_name}${r.size_bytes ? ` (${formatFileSize(r.size_bytes)})` : ''}.`
        : 'Preuve enregistrée depuis la tâche.',
      lastProofAt: r.created_at,
      status: { key: 'validee', label: 'Validée', badge: 'ok' },
      variant: proofFileVariant(r.mime_type, r.file_name),
      mimeType: r.mime_type,
      fileName: r.file_name,
      hasFile: !!r.has_file,
      fromServer: true,
    }))
  } catch {
    // Hors-ligne / non connecté : on garde les démos, sans casser la rubrique.
    USER_PROOFS = []
  } finally {
    userProofSyncInFlight = false
  }
}

// Aucune preuve démo : la rubrique n'affiche QUE les preuves réellement
// ajoutées par l'utilisateur (USER_PROOFS, serveur SQLite).

function pfDateFull(value) {
  if (!value) return '—'
  const d = new Date(value)
  const options = { day: '2-digit', month: 'long', year: 'numeric' }
  const day = d.toLocaleDateString('fr-FR', options)
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} à ${hm}`
}

function pfDateLabel(value) {
  if (!value) return '—'
  const d = new Date(value)
  let day = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  if (day === new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })) day = "Aujourd'hui"
  const hm = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  return `${day} à ${hm}`
}

function pfDownloadProof(info) {
  // Preuve fichier importée : on retélécharge le VRAI fichier du serveur.
  // Interface inchangée : même bouton « Télécharger », même carte.
  if (info.fromServer && info.hasFile && info.serverId) {
    import('./tasks.js').then(({ getProofFile }) => getProofFile(info.serverId)).then(({ fileName, mimeType, dataBase64 }) => {
      const byteChars = atob(dataBase64)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName || 'preuve'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }).catch(() => {
      window.alert('Impossible de télécharger ce fichier pour le moment.')
    })
    return
  }
  const lines = [
    'TaskManager — Preuve privée',
    '===========================',
    `Titre : ${info.title}`,
    `Tâche associée : ${info.taskName}`,
    `Description : ${info.desc || ''}`,
    `Ajouté le : ${pfDateFull(info.lastProofAt)}`,
    `Statut : ${info.status.label}`,
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

function pfPreviewHtml(variant, photoUrl = null) {
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
    // Aperçu image réel quand la preuve fichier est une photo : même cadre
    // .pf-preview--photo existant, avec l'image en fond (aucun CSS ajouté).
    if (photoUrl) {
      return `<div class="pf-preview pf-preview--photo"><img src="${photoUrl}" alt="Aperçu de la preuve" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" /><span class="pf-preview__shine"></span></div>`
    }
    return '<div class="pf-preview pf-preview--photo"><span class="pf-preview__shine"></span></div>'
  }
  return `<div class="pf-preview pf-preview--sheet"><div class="pf-preview__rows">${Array
    .from({ length: 6 }, (_, i) => `<span style="width:${88 - i * 9}%"></span>`)
    .join('')}</div></div>`
}

function pfCardHtml(it, selected) {
  return `
    <article class="pf-card${selected ? ' is-selected' : ''}" data-id="${it.id}">
      <div class="pf-card__top">
        <span class="pf-badge pf-badge--${it.status.badge}">${it.status.label}</span>
        <span class="pf-badge pf-badge--lock"><svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg> Privée</span>
      </div>
      <div class="pf-card__preview">${pfPreviewHtml(it.variant, it.photoUrl || null)}</div>
      <div class="pf-card__body">
        <h4 class="pf-card__title" title="${escapeHtml(it.title)}">${escapeHtml(it.title)}</h4>
        <p class="pf-card__task" title="Tâche : ${escapeHtml(it.taskName)}">Tâche : ${escapeHtml(it.taskName)}</p>
        <p class="pf-card__date">${pfDateLabel(it.lastProofAt)}</p>
      </div>
      <div class="pf-card__actions">
        <button type="button" class="pf-btn" data-action="view"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 10s3.2-5 8-5 8 5 8 5-3.2 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2.2"/></svg> Voir</button>
        <button type="button" class="pf-btn pf-btn--icon" data-action="download" aria-label="Télécharger" title="Télécharger la preuve"><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9"/><polyline points="6.5,8.5 10,12 13.5,8.5"/><path d="M4 16h12"/></svg></button>
        <button type="button" class="pf-btn pf-btn--icon" data-action="more" aria-label="Options" title="Options">⋯</button>
      </div>
    </article>`
}

function pfDetailHtml(selected) {
  if (!selected) {
    return `
      <div class="pf-detail__head"><h4 class="pf-detail__title">DÉTAIL DE LA PREUVE</h4></div>
      <div class="pf-detail__empty">
        <svg viewBox="0 0 20 20" width="34" height="34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2.5h8v15l-4-2-4 2z"/><path d="M8.5 9l1.2 1.2L12 7.4"/></svg>
        <p>Sélectionnez une preuve pour afficher son détail.</p>
      </div>`
  }
  const statusDateStr = selected.statusDate ? pfDateFull(selected.statusDate) : pfDateFull(selected.lastProofAt)
  return `
    <div class="pf-detail__head">
      <h4 class="pf-detail__title">DÉTAIL DE LA PREUVE</h4>
      <button type="button" class="pf-detail__close" data-action="close-detail" aria-label="Fermer" title="Fermer le panneau"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
    </div>
    <div class="pf-detail__badges">
      <span class="pf-badge pf-badge--${selected.status.badge}">${selected.status.label}</span>
      <span class="pf-detail__lock"><svg viewBox="0 0 20 20" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg> Privée</span>
    </div>
    <div class="pf-detail__preview-wrap">${pfPreviewHtml(selected.variant, selected.photoUrl || null)}</div>
    <dl class="pf-detail__fields">
      <div><dt><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 5h14M3 10h10M3 15h7"/></svg> Titre</dt><dd>${escapeHtml(selected.title)}</dd></div>
      <div><dt><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9.5 2.5l7 4v7l-7 4-7-4v-7z"/></svg> Tâche associée</dt><dd class="pf-detail__task">${escapeHtml(selected.taskName)}</dd></div>
      <div class="pf-detail__desc-row"><dt><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h12v12H4z"/><path d="M7 8h6M7 11h4"/></svg> Description</dt><dd class="pf-detail__desc-text">${escapeHtml(selected.desc || '')}</dd></div>
      <div><dt><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><polyline points="10,6 10,10 13,12"/></svg> Ajouté le</dt><dd>${pfDateFull(selected.lastProofAt)}</dd></div>
      <div><dt><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="10" cy="10" r="7"/><polyline points="7,10 9.5,12.5 13.5,7.5"/></svg> Statut</dt><dd><span class="pf-badge pf-badge--${selected.status.badge}">${selected.status.label}</span> le ${statusDateStr}</dd></div>
      <div><dt><svg viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2 10s3.2-5 8-5 8 5 8 5-3.2 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2.2"/></svg> Visibilité</dt><dd>Privée (uniquement vous)</dd></div>
    </dl>
    <button type="button" class="pf-detail__main-btn" data-action="fullscreen">
      <svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 10s3.2-5 8-5 8 5 8 5-3.2 5-8 5-8-5-8-5z"/><circle cx="10" cy="10" r="2.2"/></svg>
      Voir en plein écran
    </button>
    <div class="pf-detail__row">
      <button type="button" class="pf-btn--block pf-btn--outline" data-action="download-detail"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9"/><polyline points="6.5,8.5 10,12 13.5,8.5"/><path d="M4 16h12"/></svg> Télécharger</button>
      <button type="button" class="pf-btn--block pf-btn--danger" data-action="delete-proof"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h12"/><path d="M6 6l.7 10h6.6L14 6"/><path d="M8.5 9v4.5M11.5 9v4.5"/></svg> Supprimer</button>
    </div>
    <p class="pf-detail__note"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg> <strong>Rappel</strong> : Cette preuve est confidentielle et accessible uniquement par vous.</p>`
}

export function renderPreuves(container, tasks) {
  if (!container) return

  // Uniquement les VRAIES preuves du serveur (fichiers importés et
  // horodatages enregistrés via « Ajouter une preuve ») — plus de démos.
  const serverItems = (USER_PROOFS || []).map((p) => {
    const match = (tasks || []).find((t) => t.id === p.taskId || t.title === p.taskName)
    return match ? { ...p, taskName: match.title } : p
  })
  let items = [...serverItems].sort((a, b) => new Date(b.lastProofAt) - new Date(a.lastProofAt))

  // Initialize selected if null
  if (!pfState.selected && items.length > 0) {
    pfState.selected = items[0].id
  }

  // Stocker la liste complète de tâches pour dropdown
  const allTaskNames = [...new Set(items.map((it) => it.taskName))]

  // Filtres
  if (pfState.search) {
    const q = pfState.search.toLowerCase()
    items = items.filter((it) => it.title.toLowerCase().includes(q) || it.taskName.toLowerCase().includes(q))
  }
  if (pfState.task !== 'all') {
    items = items.filter((it) => it.taskName === pfState.task)
  }
  if (pfState.status !== 'all') items = items.filter((it) => it.status.key === pfState.status)
  if (pfState.period !== 'all') {
    const now = new Date()
    const start = pfState.period === 'today' ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : pfState.period === 'week' ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7)
      : new Date(now.getFullYear(), now.getMonth(), 1)
    items = items.filter((it) => new Date(it.lastProofAt) >= start)
  }

  // Stats (calculées sur TOUTES les preuves utilisateur, pas sur les filtrées)
  const total = serverItems.length
  const validees = serverItems.filter((it) => it.status.key === 'validee').length
  const attente = serverItems.filter((it) => it.status.key === 'attente').length
  const rejetees = serverItems.filter((it) => it.status.key === 'rejetee').length
  const pct = (n) => (total === 0 ? 0 : Math.round((n / total) * 100))

  const pages = Math.max(1, Math.ceil(items.length / pfState.perPage))
  if (pfState.page > pages) pfState.page = pages
  const pageItems = items.slice((pfState.page - 1) * pfState.perPage, pfState.page * pfState.perPage)
  const selected = pfState.selected ? serverItems.find((it) => it.id === pfState.selected) : null

  // Dropdown options pour les tâches
  const taskOptions = allTaskNames.map((tn) =>
    `<option value="${escapeHtml(tn)}"${pfState.task === tn ? ' selected' : ''}>${escapeHtml(tn)}</option>`
  ).join('')

  container.innerHTML = `
      <div class="pf__main">
        <div class="pf-header">
          <div class="pf-header__text">
            <h2 class="pf__heading">Mes preuves privées
              <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg>
            </h2>
            <p class="pf__subtitle">Consultez, gérez et vérifiez toutes vos preuves en toute confidentialité.</p>
          </div>
        </div>
        <div class="pf-banner">
          <div class="pf-banner__left">
            <div class="pf-banner__icon"><svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4.5" y="8.5" width="11" height="8" rx="1.5"/><path d="M7 8.5V6a3 3 0 016 0v2.5"/></svg></div>
            <div class="pf-banner__text">
              <strong>Vos preuves sont privées et confidentielles.</strong>
              <span>Vous êtes le seul utilisateur autorisé à les consulter, les télécharger et les gérer.</span>
            </div>
          </div>
          <div class="pf-banner__shield">
            <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l7 3v6c0 5-3 8.5-7 10-4-1.5-7-5-7-10V5z" fill="color-mix(in srgb, var(--accent) 12%, transparent)" stroke="var(--accent)" stroke-width="1.5"/><rect x="9.2" y="10.5" width="5.6" height="4.2" rx="1" fill="none" stroke="var(--accent)" stroke-width="1.5"/><path d="M10.4 10.5V9.2a1.6 1.6 0 013.2 0v1.3" fill="none" stroke="var(--accent)" stroke-width="1.5"/><circle cx="17.5" cy="17.5" r="4.5" fill="#16a34a" stroke="none"/><polyline points="15.5,17.5 17,19 19.5,16" fill="none" stroke="white" stroke-width="1.5"/></svg>
          </div>
        </div>
        <div class="pf-stats">
          <div class="pf-stat"><div class="pf-stat__text"><h4>Total des preuves</h4><strong class="pf-stat__num--accent">${total}</strong><span>Toutes tâches confondues</span></div><span class="pf-stat__icon pf-stat__icon--accent"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h9l4 4v12H5z"/><path d="M8 12h8M8 16h6"/></svg></span></div>
          <div class="pf-stat"><div class="pf-stat__text"><h4>Validées</h4><strong class="pf-stat__num--ok">${validees}</strong><span>${pct(validees)}% du total</span></div><span class="pf-stat__icon pf-stat__icon--ok"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polyline points="8,12.5 11,15.5 16,9.5"/></svg></span></div>
          <div class="pf-stat"><div class="pf-stat__text"><h4>En attente</h4><strong class="pf-stat__num--wait">${attente}</strong><span>${pct(attente)}% du total</span></div><span class="pf-stat__icon pf-stat__icon--wait"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12,7 12,12 15,14"/></svg></span></div>
          <div class="pf-stat"><div class="pf-stat__text"><h4>Rejetées</h4><strong class="pf-stat__num--bad">${rejetees}</strong><span>${pct(rejetees)}% du total</span></div><span class="pf-stat__icon pf-stat__icon--bad"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg></span></div>
        </div>
        <div class="pf-toolbar">
          <div class="pf-search">
            <svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="9" cy="9" r="6"/><line x1="13.5" y1="13.5" x2="18" y2="18"/></svg>
            <input type="search" id="pfSearch" placeholder="Rechercher une preuve…" aria-label="Rechercher une preuve" value="${pfState.search}" />
          </div>
          <select id="pfTask" class="pf-select" aria-label="Filtrer par tâche">
            <option value="all"${pfState.task === 'all' ? ' selected' : ''}>Toutes les tâches</option>
            ${taskOptions}
          </select>
          <select id="pfStatus" class="pf-select" aria-label="Filtrer par statut">
            <option value="all"${pfState.status === 'all' ? ' selected' : ''}>Tous les statuts</option>
            <option value="validee"${pfState.status === 'validee' ? ' selected' : ''}>Validées</option>
            <option value="attente"${pfState.status === 'attente' ? ' selected' : ''}>En attente</option>
            <option value="rejetee"${pfState.status === 'rejetee' ? ' selected' : ''}>Rejetées</option>
          </select>
          <select id="pfPeriod" class="pf-select" aria-label="Filtrer par date">
            <option value="all"${pfState.period === 'all' ? ' selected' : ''}>Toutes les dates</option>
            <option value="today"${pfState.period === 'today' ? ' selected' : ''}>Aujourd'hui</option>
            <option value="week"${pfState.period === 'week' ? ' selected' : ''}>Cette semaine</option>
            <option value="month"${pfState.period === 'month' ? ' selected' : ''}>Ce mois</option>
          </select>
          <div class="pf-viewtoggle" role="group" aria-label="Mode d'affichage">
            <button type="button" class="${pfState.view === 'grid' ? 'is-active' : ''}" data-pfview="grid" aria-label="Grille" title="Affichage Grille"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="3" width="6" height="6" rx="1"/><rect x="11" y="3" width="6" height="6" rx="1"/><rect x="3" y="11" width="6" height="6" rx="1"/><rect x="11" y="11" width="6" height="6" rx="1"/></svg></button>
            <button type="button" class="${pfState.view === 'list' ? 'is-active' : ''}" data-pfview="list" aria-label="Liste" title="Affichage Liste"><svg viewBox="0 0 20 20" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="5" x2="17" y2="5"/><line x1="3" y1="10" x2="17" y2="10"/><line x1="3" y1="15" x2="17" y2="15"/></svg></button>
          </div>
        </div>
      <div class="pf-layout">
        <div class="pf__main" style="gap:12px;">
          <div class="pf-grid pf-grid--${pfState.view}">${pageItems.map((it) => pfCardHtml(it, pfState.selected === it.id)).join('') || '<p class="pf-empty">Aucune preuve ne correspond à ces filtres.</p>'}</div>
          ${pages > 1 ? `
          <div class="pf-pagination">
            <button type="button" class="pf-page-btn" data-page="${pfState.page - 1}"${pfState.page <= 1 ? ' disabled' : ''}>‹ Précédent</button>
            <span class="pf-page-nums">${Array.from({ length: pages }, (_, i) => `<button type="button" class="pf-page-btn pf-page-num${i + 1 === pfState.page ? ' is-current' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}</span>
            <button type="button" class="pf-page-btn" data-page="${pfState.page + 1}"${pfState.page >= pages ? ' disabled' : ''}>Suivant ›</button>
          </div>` : ''}
        </div>
        <aside class="pf-detail">${pfDetailHtml(selected)}</aside>
      </div>
      </div>
  `
  bindPreuvesEvents(container, items, tasks)
}

// Remplit les cadres photo des preuves fichier images (cartes + détail) en
// allant chercher le contenu à la demande — aucun changement de HTML/CSS.
async function hydrateServerPhotoPreviews(container, items) {
  let tasksApi = null
  try {
    tasksApi = await import('./tasks.js')
  } catch {
    return
  }
  const targets = (items || []).filter(
    (it) => it.fromServer && it.hasFile && !it.photoUrl && String(it.mimeType || '').startsWith('image/') && it.serverId
  )
  if (targets.length === 0) return
  await Promise.all(targets.slice(0, 12).map(async (it) => {
    try {
      const file = await tasksApi.getProofFile(it.serverId)
      it.photoUrl = `data:${file.mimeType || 'image/*'};base64,${file.dataBase64}`
    } catch { /* on garde l'aperçu stylisé */ }
  }))
  let changed = false
  container.querySelectorAll('.pf-card').forEach((card) => {
    const it = targets.find((t) => t.id === card.dataset.id)
    if (!it || !it.photoUrl) return
    const preview = card.querySelector('.pf-card__preview .pf-preview--photo')
    if (preview && !preview.querySelector('img')) {
      preview.insertAdjacentHTML('afterbegin', `<img src="${it.photoUrl}" alt="Aperçu de la preuve" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`)
      changed = true
    }
  })
  const sel = items.find((it) => it.id === pfState.selected)
  if (sel && sel.photoUrl) {
    const wrap = container.querySelector('.pf-detail__preview-wrap .pf-preview--photo')
    if (wrap && !wrap.querySelector('img')) {
      wrap.insertAdjacentHTML('afterbegin', `<img src="${sel.photoUrl}" alt="Aperçu de la preuve" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`)
      changed = true
    }
  }
  if (changed) void 0
}

function bindPreuvesEvents(container, items, tasks) {
  // Recherche
  const searchInput = container.querySelector('#pfSearch')
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      pfState.search = searchInput.value
      pfState.page = 1
      renderPreuves(container, tasks)
    })
  }

  // Filtre tâche
  const taskSelect = container.querySelector('#pfTask')
  if (taskSelect) {
    taskSelect.addEventListener('change', () => {
      pfState.task = taskSelect.value
      pfState.page = 1
      renderPreuves(container, tasks)
    })
  }

  // Filtre statut
  const statusSelect = container.querySelector('#pfStatus')
  if (statusSelect) {
    statusSelect.addEventListener('change', () => {
      pfState.status = statusSelect.value
      pfState.page = 1
      renderPreuves(container, tasks)
    })
  }

  // Filtre période
  const periodSelect = container.querySelector('#pfPeriod')
  if (periodSelect) {
    periodSelect.addEventListener('change', () => {
      pfState.period = periodSelect.value
      pfState.page = 1
      renderPreuves(container, tasks)
    })
  }

  // Bascule grille / liste
  container.querySelectorAll('[data-pfview]').forEach((btn) => {
    btn.addEventListener('click', () => {
      pfState.view = btn.dataset.pfview
      renderPreuves(container, tasks)
    })
  })

  // Clic sur une carte -> sélection
  container.querySelectorAll('.pf-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button')) return
      pfState.selected = card.dataset.id
      renderPreuves(container, tasks)
    })
  })

  // Actions des cartes
  container.querySelectorAll('.pf-card button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const card = btn.closest('.pf-card')
      const id = card?.dataset.id
      const item = items.find((it) => it.id === id)
      if (!item) return
      if (btn.dataset.action === 'view') {
        pfState.selected = id
        renderPreuves(container, tasks)
      } else if (btn.dataset.action === 'download') {
        pfDownloadProof(item)
      }
    })
  })

  // Pagination
  container.querySelectorAll('[data-page]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.page)
      if (p >= 1) {
        pfState.page = p
        renderPreuves(container, tasks)
      }
    })
  })

  // Panneau détail
  const closeBtn = container.querySelector('[data-action="close-detail"]')
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      pfState.selected = null
      renderPreuves(container, tasks)
    })
  }

  // Aperçus images réels : chargés à la demande (data URL), sans changer le
  // HTML/CSS — on remplit simplement les cadres photo existants.
  hydrateServerPhotoPreviews(container, items)

  const downloadDetailBtn = container.querySelector('[data-action="download-detail"]')
  if (downloadDetailBtn) {
    const sel = items.find((it) => it.id === pfState.selected)
    if (sel) {
      downloadDetailBtn.addEventListener('click', () => pfDownloadProof(sel))
    }
  }

  const deleteBtn = container.querySelector('[data-action="delete-proof"]')
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async () => {
      const sel = items.find((it) => it.id === pfState.selected)
      pfState.selected = null
      if (sel && sel.fromServer && sel.serverId) {
        try {
          const { deleteProof } = await import('./tasks.js')
          await deleteProof(sel.serverId)
          await syncUserProofs()
        } catch {
          window.alert('Impossible de supprimer cette preuve pour le moment.')
        }
      }
      renderPreuves(container, tasks)
    })
  }

  // Fullscreen Modal for "Voir en plein écran"
  const fullscreenBtn = container.querySelector('[data-action="fullscreen"]')
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', async () => {
      const sel = items.find((it) => it.id === pfState.selected)
      if (!sel) return

      // Preuve fichier image : le plein écran affiche la VRAIE photo.
      let photoUrl = sel.photoUrl || null
      if (!photoUrl && sel.fromServer && sel.hasFile && sel.serverId && String(sel.mimeType || '').startsWith('image/')) {
        try {
          const { getProofFile } = await import('./tasks.js')
          const file = await getProofFile(sel.serverId)
          photoUrl = `data:${file.mimeType || 'image/*'};base64,${file.dataBase64}`
          sel.photoUrl = photoUrl
          const wrap = container.querySelector('.pf-detail__preview-wrap .pf-preview--photo')
          if (wrap && !wrap.querySelector('img')) {
            wrap.insertAdjacentHTML('afterbegin', `<img src="${photoUrl}" alt="Aperçu de la preuve" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" />`)
          }
        } catch { /* aperçu stylisé de secours */ }
      }

      const modalHtml = `
        <div class="pf-modal-overlay" id="pfModalOverlay">
          <div class="pf-modal-card">
            <div class="pf-modal-header">
              <h3 class="pf-modal-title">${escapeHtml(sel.title)}</h3>
              <button type="button" class="pf-detail__close" id="pfModalClose" aria-label="Fermer"><svg viewBox="0 0 20 20" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 5l10 10M15 5L5 15"/></svg></button>
            </div>
            <div class="pf-modal-body">
              <div class="pf-modal-preview">
                ${pfPreviewHtml(sel.variant, photoUrl)}
              </div>
              <div class="pf-modal-meta">
                <span class="pf-badge pf-badge--${sel.status.badge}">${sel.status.label}</span>
                <span>Tâche : <strong>${escapeHtml(sel.taskName)}</strong></span>
                <span>Date : ${pfDateFull(sel.lastProofAt)}</span>
              </div>
            </div>
          </div>
        </div>
      `
      container.insertAdjacentHTML('beforeend', modalHtml)
      const overlay = container.querySelector('#pfModalOverlay')
      const closeBtn = container.querySelector('#pfModalClose')
      
      const closeModal = () => overlay.remove()
      closeBtn.addEventListener('click', closeModal)
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal()
      })
      document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
          closeModal()
          document.removeEventListener('keydown', escHandler)
        }
      })
    })
  }
}
