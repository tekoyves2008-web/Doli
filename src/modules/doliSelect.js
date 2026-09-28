// doliSelect.js
// Menu déroulant maison à l'identité Doli.
//
// Le popup d'un <select> est peint par le système d'exploitation : ni coins
// arrondis, ni animation, ni teintes personnalisées. On dessine donc la liste
// nous-mêmes — un panneau « mini-fenêtre » — tout en conservant le <select>
// d'origine simplement masqué : il reste la source de vérité de la valeur et
// de l'état désactivé, si bien qu'aucun autre module n'a besoin d'être modifié.

const CHEVRON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5.5 9l6.5 6.5L18.5 9"/></svg>'
const TICK =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7"/></svg>'

export function enhanceDoliSelect(selectEl) {
  if (!selectEl || selectEl.dataset.doliSelect === 'on') return
  const opts = Array.from(selectEl.options).map((o) => ({ value: o.value, label: o.textContent.trim() }))
  if (!opts.length) return
  selectEl.dataset.doliSelect = 'on'

  const field = selectEl.closest('label')
  const overlay = selectEl.closest('.modal-overlay')
  const firstText =
    field && Array.from(field.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim())
  const fieldLabel = firstText ? firstText.textContent.trim() : (selectEl.getAttribute('aria-label') || selectEl.id)

  /* --- Structure : bouton (fermé) + panneau (ouvert) -------------------- */
  const wrap = document.createElement('div')
  wrap.className = 'doli-select'

  const control = document.createElement('button')
  control.type = 'button'
  control.className = 'doli-select__control'
  control.setAttribute('role', 'combobox')
  control.setAttribute('aria-haspopup', 'listbox')
  control.setAttribute('aria-expanded', 'false')
  control.setAttribute('aria-label', fieldLabel)

  const valueEl = document.createElement('span')
  valueEl.className = 'doli-select__value'

  const chevEl = document.createElement('span')
  chevEl.className = 'doli-select__chev'
  chevEl.setAttribute('aria-hidden', 'true')
  chevEl.innerHTML = CHEVRON

  control.append(valueEl, chevEl)
  wrap.append(control)

  const listId = `doli-list-${selectEl.id || Math.random().toString(36).slice(2, 7)}`
  const list = document.createElement('ul')
  // Les panneaux des menus places dans un champ court recoivent la classe
  // --compact : leur rendu est decrit par une seule regle CSS valable pour
  // tous les menus, au lieu d'une liste d'ids a tenir a jour a la main.
  list.className = 'doli-select__list' + (selectEl.closest('.mtasks2__field') ? ' doli-select__list--compact' : '')
  list.id = listId
  list.setAttribute('role', 'listbox')
  list.hidden = true
  control.setAttribute('aria-controls', listId)

  const items = opts.map((opt, i) => {
    const li = document.createElement('li')
    li.className = 'doli-select__opt'
    li.id = `${listId}-${i}`
    li.setAttribute('role', 'option')
    li.dataset.value = opt.value
    li.innerHTML = `<span class="doli-select__opt-label">${opt.label}</span><span class="doli-select__tick" aria-hidden="true">${TICK}</span>`
    li.addEventListener('click', () => pick(i))
    li.addEventListener('mouseenter', () => setActive(i, false))
    list.append(li)
    return li
  })

  // Le <select> natif reste dans le formulaire (donc lisible et inscriptible
  // par les autres modules) mais devient invisible et hors tabulation.
  selectEl.classList.add('doli-select__native')
  selectEl.setAttribute('aria-hidden', 'true')
  selectEl.tabIndex = -1
  selectEl.after(wrap)
  document.body.append(list)

  /* --- État ------------------------------------------------------------- */
  let open = false
  let active = -1

  function indexOfValue() {
    const i = opts.findIndex((o) => o.value === selectEl.value)
    return i < 0 ? 0 : i
  }

  function sync() {
    const i = indexOfValue()
    valueEl.textContent = opts[i].label
    const off = selectEl.disabled
    wrap.dataset.disabled = String(off)
    control.disabled = off
    items.forEach((li, k) => {
      const on = k === i
      li.dataset.selected = String(on)
      li.setAttribute('aria-selected', String(on))
    })
    if (open && off) close()
  }

  function setActive(i, scroll) {
    active = i
    items.forEach((li, k) => {
      li.dataset.active = String(k === i)
    })
    const cur = items[i]
    if (!cur) return
    control.setAttribute('aria-activedescendant', cur.id)
    if (scroll) cur.scrollIntoView({ block: 'nearest' })
  }

  /* --- Placement du panneau -------------------------------------------- */
  function place() {
    const r = control.getBoundingClientRect()
    const panelW = Math.max(r.width, 190)
    const spaceBelow = window.innerHeight - r.bottom
    list.style.width = `${panelW}px`
    list.style.left = `${Math.min(Math.max(8, r.right - panelW), Math.max(8, window.innerWidth - panelW - 8))}px`
    // Ouverture vers le haut si la place manque en dessous (comme les menus
    // natifs), sinon vers le bas.
    if (spaceBelow < 200 && r.top > spaceBelow) {
      list.dataset.dir = 'up'
      list.style.top = 'auto'
      list.style.bottom = `${window.innerHeight - r.top + 6}px`
    } else {
      list.dataset.dir = 'down'
      list.style.bottom = 'auto'
      list.style.top = `${r.bottom + 6}px`
    }
  }

  /* --- Ouverture / fermeture ------------------------------------------- */
  let frame = 0

  function openList() {
    if (open || selectEl.disabled) return
    open = true
    list.hidden = false
    wrap.dataset.open = 'true'
    control.setAttribute('aria-expanded', 'true')
    place()
    setActive(indexOfValue(), true)
    document.addEventListener('pointerdown', onDocPointer, true)
    window.addEventListener('scroll', onViewportChange, true)
    window.addEventListener('resize', onViewportChange)
    frame = requestAnimationFrame(follow)
  }

  function close() {
    if (!open) return
    open = false
    list.hidden = true
    wrap.dataset.open = 'false'
    control.setAttribute('aria-expanded', 'false')
    control.removeAttribute('aria-activedescendant')
    items.forEach((li) => {
      li.dataset.active = 'false'
    })
    document.removeEventListener('pointerdown', onDocPointer, true)
    window.removeEventListener('scroll', onViewportChange, true)
    window.removeEventListener('resize', onViewportChange)
    if (frame) cancelAnimationFrame(frame)
    frame = 0
  }

  function follow() {
    if (!open) return
    place()
    frame = requestAnimationFrame(follow)
  }

  function onDocPointer(event) {
    if (wrap.contains(event.target) || list.contains(event.target)) return
    close()
  }

  function onViewportChange() {
    place()
  }

  function pick(i) {
    const opt = opts[i]
    if (!opt) return
    selectEl.value = opt.value
    // On prévient l'application comme si l'utilisateur avait manipulé le
    // <select> natif (aucun module n'a donc à être modifié).
    selectEl.dispatchEvent(new Event('input', { bubbles: true }))
    selectEl.dispatchEvent(new Event('change', { bubbles: true }))
    sync()
    close()
    control.focus()
  }

  /* --- Interactions ----------------------------------------------------- */
  control.addEventListener('click', () => {
    if (open) close()
    else openList()
  })

  control.addEventListener('keydown', (event) => {
    const key = event.key
    if (key === 'Enter' || key === ' ' || key === 'ArrowDown' || key === 'ArrowUp') {
      event.preventDefault()
      if (!open) {
        openList()
        return
      }
      if (key === 'Enter' || key === ' ') pick(active < 0 ? indexOfValue() : active)
      else if (key === 'ArrowDown') setActive(Math.min(items.length - 1, active + 1), true)
      else setActive(Math.max(0, active - 1), true)
      return
    }
    if (key === 'Escape' && open) {
      event.preventDefault()
      close()
      return
    }
    if (key === 'Tab') close()
    // Saisie clavier : saute à l'option commençant par la lettre tapée.
    if (key.length === 1 && /[\p{L}\p{N}]/u.test(key)) {
      const from = (open ? active : indexOfValue()) + 1
      let target = opts.findIndex((o, i) => i >= from && o.label.toLowerCase().startsWith(key.toLowerCase()))
      if (target < 0) target = opts.findIndex((o) => o.label.toLowerCase().startsWith(key.toLowerCase()))
      if (target >= 0) {
        if (open) setActive(target, true)
        else pick(target)
      }
    }
  })

  /* --- Synchronisation avec le <select> natif --------------------------- */
  // Valeur écrite par main.js (ouverture en création ou en édition).
  selectEl.addEventListener('change', sync)
  selectEl.addEventListener('input', sync)
  // Activation/désactivation décidée par main.js (consultation, édition).
  new MutationObserver(sync).observe(selectEl, {
    attributes: true,
    attributeFilter: ['disabled'],
  })
  // La fenêtre qui se ferme ou se rouvre referme ou rafraîchit la liste.
  if (overlay) {
    new MutationObserver(() => {
      if (overlay.hidden) close()
      else sync()
    }).observe(overlay, { attributes: true, attributeFilter: ['hidden'] })
  }

  sync()
  return { sync, close, open: openList }
}