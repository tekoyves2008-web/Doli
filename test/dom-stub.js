// test/dom-stub.js
// Micro-environnement DOM pour que les modules s'importent dans Node.
//
// Pourquoi : retards.js lit le DOM DÈS LE CHARGEMENT du module
// (const x = document.getElementById(...) au niveau global). Sans ce stub,
// impossible d'importer le module hors navigateur — donc impossible de tester
// ses calculs. Plutôt que de refactorer le code de production avant d'avoir une
// référence, on installe un DOM minimal qui renvoie null partout : les
// fonctions de calcul n'utilisent pas ces éléments, donc le résultat des
// tests n'est pas faussé.
//
// Doit être importé EN PREMIER dans un fichier de test : en ESM, les imports
// sont évalués dans l'ordre de déclaration.

const noop = () => {}
const nullish = () => null

function makeElement() {
  return {
    textContent: '', innerHTML: '', value: '', hidden: false, disabled: false,
    className: '', style: { setProperty: noop, removeProperty: noop },
    dataset: {}, children: [], options: [],
    classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
    setAttribute: noop, getAttribute: nullish, removeAttribute: noop,
    appendChild: noop, append: noop, remove: noop, insertBefore: noop,
    addEventListener: noop, removeEventListener: noop, dispatchEvent: noop,
    querySelector: nullish, querySelectorAll: () => [], closest: nullish,
    focus: noop, blur: noop, click: noop, getBoundingClientRect: () => ({ width: 0, height: 0, top: 0, left: 0 }),
    getContext: () => null,
  }
}

const doc = {
  getElementById: nullish,
  querySelector: nullish,
  querySelectorAll: () => [],
  createElement: makeElement,
  createElementNS: () => makeElement(),
  createTextNode: () => makeElement(),
  addEventListener: noop,
  removeEventListener: noop,
  body: makeElement(),
  documentElement: makeElement(),
}

if (typeof globalThis.document === 'undefined') globalThis.document = doc
if (typeof globalThis.window === 'undefined') {
  globalThis.window = { addEventListener: noop, removeEventListener: noop, matchMedia: () => ({ matches: false, addEventListener: noop }) }
}
if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0)
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
}
