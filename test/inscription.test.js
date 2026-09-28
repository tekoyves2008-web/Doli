import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import os from 'node:os'
import net from 'node:net'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  isRegistrationOpen,
  isInviteCodeValid,
  requiresInviteCode,
  isEmailWellFormed,
  isDomainAllowed,
  registrationPolicy,
} from '../server/registration-policy.js'

// Ces règles sont lues dans process.env au moment de l'appel : le test peut
// donc simuler les configurations sans lancer de sous-processus.
function withEnv(vars, fn) {
  const saved = {}
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k]
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  try {
    return fn()
  } finally {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  }
}

test('les inscriptions sont fermées par défaut', () => {
  // Sans aucune configuration, personne ne peut créer un compte : c'est la
  // protection contre quiconque découvrirait l'adresse du site.
  withEnv({ ALLOW_REGISTRATION: undefined, REGISTRATION_SECRET: undefined }, () => {
    assert.equal(isRegistrationOpen(), false, 'inscriptions fermées par défaut')
    assert.equal(requiresInviteCode(), false)
    assert.equal(registrationPolicy().open, false)
  })
})

test('ALLOW_REGISTRATION ouvre les inscriptions', () => {
  withEnv({ ALLOW_REGISTRATION: 'true' }, () => {
    assert.equal(isRegistrationOpen(), true)
    assert.equal(registrationPolicy().open, true)
  })
  // Seule la valeur exacte « true » ouvre : « 1 » ou « oui » ne suffisent pas,
  // pour éviter une ouverture par erreur de saisie dans la configuration.
  withEnv({ ALLOW_REGISTRATION: '1' }, () => {
    assert.equal(isRegistrationOpen(), false, '« 1 » ne doit pas ouvrir les inscriptions')
  })
})

test('le code d’invitation est exigé et vérifié', () => {
  withEnv({ ALLOW_REGISTRATION: 'true', REGISTRATION_SECRET: 'code-secret' }, () => {
    assert.equal(requiresInviteCode(), true)
    assert.equal(registrationPolicy().requiresInvite, true, 'le client doit savoir qu’un code est nécessaire')
    assert.equal(isInviteCodeValid('code-secret'), true, 'le bon code est accepté')
    assert.equal(isInviteCodeValid('faux'), false)
    assert.equal(isInviteCodeValid(''), false, 'un code vide est refusé')
    assert.equal(isInviteCodeValid(undefined), false, 'un code absent est refusé')
    assert.equal(isInviteCodeValid('code-secre'), false, 'un code tronqué est refusé')
    assert.equal(isInviteCodeValid('code-secretX'), false, 'un code trop long est refusé')
  })
})

test('sans code configuré, aucun code n’est exigé', () => {
  withEnv({ REGISTRATION_SECRET: undefined }, () => {
    assert.equal(requiresInviteCode(), false)
    assert.equal(isInviteCodeValid('n’importe quoi'), true)
  })
})

test('toute adresse valide est acceptée, pas seulement gmail', () => {
  // L'ancienne règle n'acceptait que @gmail.com, ce qui excluait la plupart des
  // utilisateurs d'une application partagée.
  for (const email of ['a@orange.fr', 'jean.dupont@laposte.net', 'prenom.nom@entreprise.co.uk']) {
    assert.equal(isEmailWellFormed(email), true, `${email} devrait être valide`)
    assert.equal(isDomainAllowed(email), true, `${email} devrait être accepté`)
  }
  for (const email of ['pas-un-email', 'a@', '@b.fr', 'a@b', 'a b@c.fr', '']) {
    assert.equal(isEmailWellFormed(email), false, `${email} ne devrait pas être valide`)
  }
})

test('EMAIL_DOMAIN_ALLOWLIST restreint les domaines', () => {
  withEnv({ EMAIL_DOMAIN_ALLOWLIST: 'gmail.com' }, () => {
    assert.equal(isDomainAllowed('a@gmail.com'), true)
    assert.equal(isDomainAllowed('a@GMAIL.com'), true, 'le domaine ne doit pas être sensible à la casse')
    assert.equal(isDomainAllowed('a@orange.fr'), false)
  })
  withEnv({ EMAIL_DOMAIN_ALLOWLIST: 'gmail.com, orange.fr , laposte.net' }, () => {
    assert.equal(isDomainAllowed('a@orange.fr'), true, 'les espaces autour des domaines sont ignorés')
    assert.equal(isDomainAllowed('a@laposte.net'), true)
    assert.equal(isDomainAllowed('a@yahoo.fr'), false)
    assert.deepEqual(registrationPolicy().allowedDomains, ['gmail.com', 'orange.fr', 'laposte.net'])
  })
  withEnv({ EMAIL_DOMAIN_ALLOWLIST: undefined }, () => {
    assert.deepEqual(registrationPolicy().allowedDomains, [], 'par défaut, aucun domaine n’est restreint')
  })
})

// ===========================================================================
// 2) Les mêmes règles, mais vues du CÔTÉ DU SERVEUR
// ===========================================================================
// Pourquoi des tests en plus : les six tests du dessus vérifient des FONCTIONS.
// Une fonction peut être parfaitement correcte et ne jamais être appelée par la
// route — c'est exactement le piège du 18/09 (le SQL d'écriture ignorait
// `prefs`, la fonction était bonne, le résultat invisible). Ici on interroge
// donc /api/auth/register pour de vrai.
//
// Chaque test démarre son propre serveur, sur sa PROPRE base : aucun accès à
// server/doli.sqlite, et surtout aucun partage du limiteur de tentatives
// (routes/auth.js en bloque 10 par IP et par 15 min). Un seul serveur pour tous
// les tests ferait échouer les derniers d'entre eux — un faux négatif.

const SERVER_ENTRY = fileURLToPath(new URL('../server/index.js', import.meta.url))
const ACCOUNT = { name: 'Test', email: 'test@exemple.fr', password: 'motdepasse1', confirmPassword: 'motdepasse1' }

const servers = []

// Filet de sécurité : si un test échoue avant d'appeler stop(), le serveur
// traînerait encore et garderait son fichier ouvert. On attend la mort de tous
// les serveurs restants avant de rendre la main.
after(async () => { for (const stop of servers.splice(0)) await stop() })

// Une variable absente doit être ABSENTE, pas la chaîne « undefined » : on
// construit donc l'environnement du fils à la main au lieu de lui faire
// hériter process.env, que les tests ci-dessus ont pu modifier.
function childEnv(vars) {
  const env = {}
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) env[k] = String(v)
  }
  return { ...process.env, ...env }
}

// Port libre demandé à l'OS : un port fixe entrerait en conflit avec le
// serveur de développement (3001) ou avec un run parallèle de la suite.
function freePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Chaque test a sa PROPRE base : aucun accès à server/doli.sqlite. Le pid rend
// le nom unique : si une suppression échoue, le test suivant n'hérite pas d'une
// base laissée par un run précédent (ce qui ferait échouer « doublon » en 201).
const tempDb = (name) => path.join(os.tmpdir(), `doli-reg-${name}-${process.pid}.sqlite`)

// La suppression des fichiers est un CONFORT, jamais une raison de faire
// échouer un test : sous Windows, un fichier sqlite peut rester verrouillé
// quelques millisecondes après la mort du processus (EPERM). On ignore.
function purge(dbPath) {
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(dbPath + suffix, { force: true }) } catch { /* verrouillé */ }
  }
}

// Démarre le serveur et attend qu'il réponde réellement. On n'attend pas la
// seule ouverture du processus : les routes préparent leurs requêtes SQLite au
// chargement du module, et répondraient 500 si on frappait trop tôt.
async function startServer(name, vars = {}) {
  const dbPath = tempDb(name)
  purge(dbPath)

  const port = await freePort()
  const child = spawn(process.execPath, [SERVER_ENTRY], {
    env: childEnv({ PORT: port, DB_PATH: dbPath, ...vars }),
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let log = ''
  child.stdout.on('data', (b) => { log += b })
  child.stderr.on('data', (b) => { log += b })
  let exited = false
  child.on('exit', () => { exited = true })

  const base = `http://127.0.0.1:${port}`
  for (let i = 0; i < 100; i++) {
    if (exited) throw new Error(`le serveur s'est arrêté au démarrage :\n${log}`)
    try {
      if ((await fetch(`${base}/api/health`)).ok) break
    } catch { /* pas encore prêt */ }
    if (i === 99) throw new Error(`le serveur n'a pas répondu sur ${base} :\n${log}`)
    await sleep(100)
  }

  // SIGKILL et non SIGTERM : le handler d'arrêt propre (server/index.js)
  // attend la fermeture des connexions, et le client de test en garde une
  // ouverte — l'arrêt prendrait alors plusieurs secondes par test.
  //
  // On ATTEND la mort du processus avant de toucher aux fichiers : kill() est
  // asynchrone, et sous Windows le fichier sqlite reste verrouillé quelques
  // millisecondes après le signal (EPERM sur rmSync).
  let stopped = false
  const stop = async () => {
    if (stopped) return
    stopped = true
    if (!exited) {
      const dead = new Promise((resolve) => child.once('exit', resolve))
      child.kill('SIGKILL')
      await dead
    }
    purge(dbPath)
  }
  servers.push(stop)

  // Le bocal à cookies suit les réponses, comme le ferait un navigateur :
  // c'est ce qui permet d'enchaîner inscription puis /me avec la session.
  const jar = new Map()
  const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')
  const saveCookies = (res) => {
    // getSetCookie() est la lecture correcte en Node >= 19.7 ; get() renvoie
    // une chaîne unique et fusionne plusieurs cookies.
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const raw of list.length ? list : [res.headers.get('set-cookie')].filter(Boolean)) {
      const [pair] = raw.split(';')
      const eq = pair.indexOf('=')
      if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }
  }

  // `anonyme` n'envoie AUCUN cookie : c'est ainsi qu'on vérifie qu'une route
  // est réellement protégée, et non protégée seulement pour le cookie oublié.
  const call = async (method, route, body, anonyme = false) => {
    const headers = { cookie: anonyme ? '' : cookieHeader() }
    if (body !== undefined) headers['content-type'] = 'application/json'
    const res = await fetch(`${base}${route}`, {
      method,
      headers,
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
    if (!anonyme) saveCookies(res)
    return { status: res.status, body: await res.json().catch(() => ({})) }
  }

  return {
    post: (route, body) => call('POST', route, body),
    get: (route) => call('GET', route),
    postAnonyme: (route, body) => call('POST', route, body, true),
    getAnonyme: (route) => call('GET', route, undefined, true),
    stop,
  }
}

test('inscriptions fermées : le serveur refuse même un formulaire valide', async () => {
  const s = await startServer('fermees')
  const { status, body } = await s.post('/api/auth/register', ACCOUNT)
  // 403 et non 400 : le serveur ne va même pas chercher à valider le contenu.
  assert.equal(status, 403, `403 attendu, reçu ${status} ${JSON.stringify(body)}`)
  assert.match(body.error, /fermées/i, 'le message doit dire pourquoi')
  await s.stop()
})

test('ALLOW_REGISTRATION=true : le compte est créé et la session ouverte', async () => {
  const s = await startServer('ouvert', { ALLOW_REGISTRATION: 'true' })
  const { status, body } = await s.post('/api/auth/register', ACCOUNT)
  assert.equal(status, 201, `201 attendu, reçu ${status} ${JSON.stringify(body)}`)
  assert.equal(body.email, ACCOUNT.email, 'l’email est renvoyé')
  assert.equal(body.name, ACCOUNT.name)
  // Le mot de passe ne doit JAMAIS quitter le serveur en clair.
  assert.equal(body.password, undefined, 'le mot de passe ne doit pas être renvoyé')

  // La session fonctionne : c'est la preuve que le cookie a bien été posé.
  const me = await s.get('/api/auth/me')
  assert.equal(me.status, 200, 'la session doit être valable immédiatement')
  assert.equal(me.body.email, ACCOUNT.email)
  await s.stop()
})

test('le code d’invitation est exigé, et le bon code passe', async () => {
  const s = await startServer('invite', {
    ALLOW_REGISTRATION: 'true',
    REGISTRATION_SECRET: 'code-secret',
  })

  const sans = await s.post('/api/auth/register', ACCOUNT)
  assert.equal(sans.status, 403, 'sans code, l’inscription doit être refusée')
  assert.match(sans.body.error, /code/i)

  const mauvais = await s.post('/api/auth/register', { ...ACCOUNT, inviteCode: 'faux' })
  assert.equal(mauvais.status, 403, 'un mauvais code doit être refusé')

  const bon = await s.post('/api/auth/register', { ...ACCOUNT, inviteCode: 'code-secret' })
  assert.equal(bon.status, 201, `le bon code doit passer, reçu ${JSON.stringify(bon.body)}`)
  await s.stop()
})


test('le compte créé peut se connecter, sans révéler quels comptes existent', async () => {
  const s = await startServer('connexion', { ALLOW_REGISTRATION: 'true' })
  await s.post('/api/auth/register', ACCOUNT)

  const mauvais = await s.post('/api/auth/login', { email: ACCOUNT.email, password: 'mauvais' })
  assert.equal(mauvais.status, 401)
  // Message volontairement identique à celui d'un compte INCONNU : il ne doit
  // pas révéler quelles adresses sont déjà enregistrées.
  const inconnu = await s.post('/api/auth/login', { email: 'absent@test.fr', password: 'mauvais' })
  assert.equal(inconnu.status, 401)
  assert.equal(mauvais.body.error, inconnu.body.error, 'le message ne doit pas révéler l’existence du compte')
  assert.doesNotMatch(mauvais.body.error, /test@exemple\.fr/i, 'aucune adresse ne doit être citée')

  const bon = await s.post('/api/auth/login', { email: 'TEST@Exemple.FR', password: ACCOUNT.password })
  assert.equal(bon.status, 200, `200 attendu, reçu ${JSON.stringify(bon.body)}`)
  assert.equal(bon.body.email, 'test@exemple.fr', 'la connexion normalise aussi l’email')
  await s.stop()
})

test('les données invalides sont rejetées en 400, jamais en 500', async () => {
  const s = await startServer('validation', { ALLOW_REGISTRATION: 'true' })

  const cas = [
    ['email mal formé', { ...ACCOUNT, email: 'pas-un-email' }, /email/i],
    ['mots de passe différents', { ...ACCOUNT, confirmPassword: 'autre' }, /correspondent/i],
    ['mot de passe trop court', { ...ACCOUNT, password: '123', confirmPassword: '123' }, /6 caractères/i],
    ['nom vide', { ...ACCOUNT, name: '   ' }, /champs/i],
    ['mot de passe absent', { ...ACCOUNT, password: undefined, confirmPassword: undefined }, /champs/i],
  ]
  for (const [nom, payload, motif] of cas) {
    const { status, body } = await s.post('/api/auth/register', payload)
    assert.equal(status, 400, `${nom} : 400 attendu, reçu ${status} ${JSON.stringify(body)}`)
    assert.match(body.error, motif, `${nom} : message inattendu « ${body.error} »`)
  }

  // Aucun de ces essais n'a consommé le couple email/mot de passe : le bon
  // reste disponible. C'est la preuve qu'aucun cas invalide n'a créé de compte.
  assert.equal((await s.post('/api/auth/register', ACCOUNT)).status, 201)
  await s.stop()
})

test('la liste blanche de domaines est appliquée par le serveur', async () => {
  const s = await startServer('domaines', {
    ALLOW_REGISTRATION: 'true',
    EMAIL_DOMAIN_ALLOWLIST: 'gmail.com, orange.fr',
  })

  const refuse = await s.post('/api/auth/register', ACCOUNT)
  assert.equal(refuse.status, 400, 'un domaine hors liste doit être refusé')
  assert.match(refuse.body.error, /orange\.fr/, 'l’erreur doit citer les domaines autorisés')

  assert.equal((await s.post('/api/auth/register', { ...ACCOUNT, email: 'a@gmail.com' })).status, 201)
  await s.stop()
})

test('/api/auth/registration annonce la politique à l’interface', async () => {
  // Sans cet appel, le bouton « Créer un compte » resterait affiché alors que
  // le serveur répond 403 : l'utilisateur ne comprendrait pas le refus.
  const ferme = await startServer('annonce-fermee')
  const r1 = await ferme.get('/api/auth/registration')
  assert.equal(r1.status, 200)
  assert.equal(r1.body.open, false)
  assert.equal(r1.body.requiresInvite, false)
  await ferme.stop()
  const invite = await startServer('annonce-invite', {
    ALLOW_REGISTRATION: 'true',
    REGISTRATION_SECRET: 'code-secret',
    EMAIL_DOMAIN_ALLOWLIST: 'gmail.com',
  })
  const r2 = await invite.get('/api/auth/registration')
  assert.equal(r2.body.open, true)
  assert.equal(r2.body.requiresInvite, true, 'le client doit savoir qu’un code est nécessaire')
  assert.deepEqual(r2.body.allowedDomains, ['gmail.com'])
  await invite.stop()
})

test('déconnexion : la session cesse immédiatement de fonctionner', async () => {
  const s = await startServer('deconnexion', { ALLOW_REGISTRATION: 'true' })
  await s.post('/api/auth/register', ACCOUNT)
  assert.equal((await s.get('/api/auth/me')).status, 200)

  const out = await s.post('/api/auth/logout', {})
  assert.equal(out.status, 204, 'la déconnexion doit répondre 204 sans corps')
  assert.equal((await s.get('/api/auth/me')).status, 401, 'la session doit être invalidée')
  await s.stop()
})

test('sans cookie, toute l’API est fermée — y compris les tâches', async () => {
  // Garde-fou : l'authentification doit protéger les DONNÉES, pas seulement
  // l'écran. Si /api/tasks répondait sans cookie, n'importe qui pourrait lire
  // (et modifier) les tâches d'autrui en devinant un identifiant.
  const s = await startServer('acces-taches', { ALLOW_REGISTRATION: 'true' })
  await s.post('/api/auth/register', ACCOUNT)

  for (const route of ['/api/auth/me', '/api/tasks', '/api/settings', '/api/tasks/proofs/all']) {
    const { status } = await s.getAnonyme(route)
    assert.equal(status, 401, `${route} doit répondre 401 sans session`)
  }
  // La même route répond bien 200 pour qui s'est authentifié : le 401 ci-dessus
  // vient donc bien de l'absence de session, pas d'une route cassée.
  assert.equal((await s.get('/api/auth/me')).status, 200)
  await s.stop()
})

test('l’email est normalisé en minuscules et un doublon est refusé', async () => {
  const s = await startServer('doublon', { ALLOW_REGISTRATION: 'true' })

  const premier = await s.post('/api/auth/register', { ...ACCOUNT, email: 'Test@Exemple.FR' })
  assert.equal(premier.status, 201)
  assert.equal(premier.body.email, 'test@exemple.fr', 'l’email doit être normalisé')

  // Le doublon est détecté malgré la casse : sans normalisation, deux lignes
  // cohabiteraient en base et la connexion deviendrait imprévisible.
  const second = await s.post('/api/auth/register', ACCOUNT)
  assert.equal(second.status, 409, 'un doublon doit répondre 409')
  assert.match(second.body.error, /existe déjà/i)
  await s.stop()
})

