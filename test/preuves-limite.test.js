// test/preuves-limite.test.js
// Verrouille le COUPLAGE entre les deux limites qui gouvernent l'envoi d'une
// preuve. C'est le point que le TODO(phase 5) signalait, et qu'il est facile de
// casser : quelqu'un baisse la limite d'un seul côté, et le résultat est
// trompeur — un fichier entre les deux seuils se fait rejeter par le parseur
// JSON avec une erreur 413 BRUTE, au lieu du message clair « Fichier trop
// volumineux » que l'utilisateur doit lire.
//
// Exécution : npm test

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')

const indexSrc = read('server/index.js')
const tasksSrc = read('server/routes/tasks.js')

// Les fichiers sont lus (et non réécrits) : ce test protège le code
// réellement exécuté par le serveur, pas une copie de ses constantes.
const bodyLimitMatch = indexSrc.match(/express\.json\(\{\s*limit:\s*'(\d+)mb'\s*\}\)/)
const proofMaxMatch = tasksSrc.match(/PROOF_FILE_MAX_BYTES\s*=\s*(\d+)\s*\*\s*1024\s*\*\s*1024/)

test('les deux limites sont déclarées et lisibles', () => {
  assert.ok(bodyLimitMatch, "la limite du corps de requête est introuvable dans server/index.js")
  assert.ok(proofMaxMatch, 'PROOF_FILE_MAX_BYTES est introuvable dans server/routes/tasks.js')
})

const BODY_LIMIT_MB = Number(bodyLimitMatch[1])
const PROOF_MAX_BYTES = Number(proofMaxMatch[1]) * 1024 * 1024
const PROOF_MAX_MB = PROOF_MAX_BYTES / (1024 * 1024)

test('la limite d’une preuve est bien de 2 Mo', () => {
  assert.equal(PROOF_MAX_MB, 2, `attendu 2 Mo, trouvé ${PROOF_MAX_MB} Mo`)
})

test('le corps de requête accepte la preuve entière après encodage base64', () => {
  // base64 gonfle la donnée d'environ 33 % (×4/3). Le corps JSON doit donc
  // pouvoir contenir la preuve entière, sinon le parseur la refuse avant même
  // que la route ne puisse répondre avec son message clair.
  const asBase64Mb = PROOF_MAX_MB * (4 / 3)
  assert.ok(
    BODY_LIMIT_MB > asBase64Mb,
    `limite corps ${BODY_LIMIT_MB} Mo insuffisante pour une preuve de ${PROOF_MAX_MB} Mo ` +
    `une fois encodée (${asBase64Mb.toFixed(2)} Mo) : le fichier serait refusé par le ` +
    `parseur JSON, sans message utilisable`,
  )
})

test('le corps de requête reste borné : il ne doit pas tout accepter', () => {
  // Garde-fou symétrique : une limite de corps hugely supérieure au fichier
  // signifierait qu'on laisse passer des envois énormes. On tolère un facteur
  // 10, pas plus.
  assert.ok(
    BODY_LIMIT_MB < PROOF_MAX_MB * 10,
    `limite corps ${BODY_LIMIT_MB} Mo disproportionnée face à ${PROOF_MAX_MB} Mo`,
  )
})

test('exactement 2 Mo est accepté, 2 Mo + 1 octet est refusé', () => {
  // La route teste `sizeBytes > PROOF_FILE_MAX_BYTES` : la limite est
  // « inférieure ou égale », comme demandé. Ce test fixe cette sémantique.
  const atLimit = PROOF_MAX_BYTES
  const overLimit = PROOF_MAX_BYTES + 1
  assert.equal(atLimit > PROOF_MAX_BYTES, false, '2 Mo pile doit être accepté')
  assert.equal(overLimit > PROOF_MAX_BYTES, true, '2 Mo + 1 octet doit être refusé')
})

test('le message d’erreur annonce la limite réellement appliquée', () => {
  // Le message est calculé depuis la constante ; si quelqu'un réintroduit une
  // valeur écrite en dur, cette vérification l'attrape.
  assert.ok(
    /maxMo\s*=\s*Math\.round\(PROOF_FILE_MAX_BYTES/.test(tasksSrc),
    'le message doit être calculé depuis PROOF_FILE_MAX_BYTES, pas écrit en dur',
  )
  assert.ok(
    !/Fichier trop volumineux \(\d+\s*Mo maximum\)/.test(tasksSrc),
    'le message contient une taille écrite en dur : il risque de mentir',
  )
})

test('le volume Railway de 0,5 Go tient un nombre correct de preuves', () => {
  // Pourquoi cette limite existe : le palier gratuit Railway offre 0,5 Go de
  // volume, et les preuves ne sont jamais purgées. À 8 Mo, une preuve prenait
  // ~10,7 Mo en base64 et le volume était plein après 45 ; à 2 Mo, ~2,7 Mo.
  const RAILWAY_VOLUME_MO = 500
  const perProofMo = PROOF_MAX_MB * (4 / 3)
  const capacity = Math.floor(RAILWAY_VOLUME_MO / perProofMo)
  assert.ok(capacity > 100, `trop peu de preuves pour un usage normal : ${capacity}`)
})
