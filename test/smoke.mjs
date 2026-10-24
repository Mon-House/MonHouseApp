/**
 * MonHouse Pre-Push Verification Suite
 * ------------------------------------
 * Verifies:
 *  1. Production Vite build (`dist/index.html` + bundled assets)
 *  2. Zero legacy Nimiq / NimHouse / Testnet strings in production bundle
 *  3. House wallet `0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d` present in bundle & Cup config
 *  4. Real secp256k1 EIP-191 `personal_sign` cryptographic signature verification (`api/lib/verify.js`)
 *  5. All API handlers (`api/cup.js`, `api/name/claim.js`, `api/cup/submit.js`, `api/cheer.js`)
 *  6. Cup v3 rules: 600 MON pool, tiers 180/150/120/90/60, snapshot closeAt (19:45 WIB),
 *     unified leaderboard (best score across ALL games), closed-cup rejection
 *
 * Usage: node test/smoke.mjs
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak256 } from 'js-sha3'
import cheerHandler from '../api/cheer.js'
import cupHandler, { cupPeriod } from '../api/cup.js'
import submitHandler from '../api/cup/submit.js'
import { readJsonFile } from '../api/lib/store.js'
import { evmMessageDigest, verifyWalletSignature } from '../api/lib/verify.js'
import nameClaimHandler from '../api/name/claim.js'
import nameGetHandler from '../api/name/index.js'

const EXPECTED_WALLET = '0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d'
let passed = 0
let failed = 0

function assert(label, cond, detail = '') {
  if (cond) {
    console.log(`  ✅ ${label}`)
    passed++
  } else {
    console.error(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`)
    failed++
  }
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    headersSent: false,
    setHeader(k, v) {
      this.headers[k] = v
    },
    status(c) {
      this.statusCode = c
      return this
    },
    json(obj) {
      this.body = obj
      this.headersSent = true
      return this
    },
    end() {
      this.headersSent = true
    },
  }
}

function signEip191(message, privKeyBytes) {
  const digest = evmMessageDigest(message)
  const nobleRec = secp256k1.sign(digest, privKeyBytes, { prehash: false, format: 'recovered' })
  const ethSig = Buffer.concat([Buffer.from(nobleRec.slice(1)), Buffer.from([27 + nobleRec[0]])])
  return '0x' + ethSig.toString('hex')
}

console.log('\n🔍 1. Production Bundle Check')
const distDir = path.join(process.cwd(), 'dist')
assert('dist/index.html exists', existsSync(path.join(distDir, 'index.html')))
const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf8')
assert('index.html has MonHouse title', indexHtml.includes('MonHouse'))
const jsMatch = [...indexHtml.matchAll(/src="(\/assets\/[^"]+\.js)"/g)][0]
assert('Bundled JS entry found', !!jsMatch)
const bundleJs = readFileSync(path.join(distDir, jsMatch[1].slice(1)), 'utf8')

assert('House wallet 0xe5b4…AD1d compiled into bundle', bundleJs.includes(EXPECTED_WALLET))
assert(
  'Monad Mainnet Chain ID 143 (0x8f) in bundle & no Testnet leftovers',
  bundleJs.includes('0x8f') &&
    !bundleJs.includes('0x279f') &&
    !bundleJs.includes('10143') &&
    !bundleJs.includes('Testnet')
)
assert(
  'All 5 MonHouse mini-games in bundle & MonBullseye/MonSlice removed',
  ['MonCat', 'MonStack', 'MonRush', 'MonSwat', 'MonDash'].every((g) => bundleJs.includes(g)) &&
    !bundleJs.includes('MonBullseye') &&
    !bundleJs.includes('MonSlice')
)
assert(
  'Zero legacy Nimiq UI strings in bundle',
  !bundleJs.includes('NimHouse') && !bundleJs.includes('NimChick') && !bundleJs.includes('Nimiq Pay')
)

console.log('\n🔐 2. EIP-191 Wallet Signature Recovery Check')
const priv = new Uint8Array(32)
priv[31] = 42
const pubUncomp = secp256k1.getPublicKey(priv, false).slice(1)
const walletAddr = '0x' + Buffer.from(keccak256.arrayBuffer(pubUncomp)).subarray(12).toString('hex')
const device = 'f'.repeat(64)
const nameMsg = `MonHouse Name | name=QaTester | device=${device} | ts=1792730000000`
const sig = signEip191(nameMsg, priv)

const vOk = verifyWalletSignature(nameMsg, walletAddr, sig)
assert(
  'Valid EIP-191 personal_sign verifies & recovers exact 0x address',
  vOk.ok && vOk.address === walletAddr
)
const vTamper = verifyWalletSignature(nameMsg + '!', walletAddr, sig)
assert('Tampered message is rejected', !vTamper.ok)

console.log('\n🌐 3. Serverless API Handlers E2E Check (with snapshot restore)')
const cupBackup = readFileSync('data/cup.json', 'utf8')
const namesBackup = readFileSync('data/names.json', 'utf8')
const cheersBackup = readFileSync('data/cheers.json', 'utf8')
const cupConfig = JSON.parse(cupBackup)
const period = cupPeriod(cupConfig.pool?.closeAt).id

try {
  // ---- Cup v3 rule checks (pure config) ----
  const pMeta = cupPeriod(cupConfig.pool?.closeAt)
  assert(
    'Cup period id P20261024 derived from closeAt (19:45 WIB = 12:45 UTC)',
    pMeta.id === 'P20261024' && pMeta.closeUtc === '12:45'
  )
  assert(
    'Cup pool: 600 MON total, tiers 180/150/120/90/60, house wallet',
    cupConfig.pool?.totalMon === 600 &&
      JSON.stringify(cupConfig.pool?.tiersMon) === JSON.stringify([180, 150, 120, 90, 60]) &&
      cupConfig.pool?.wallet === EXPECTED_WALLET
  )

  // ---- Closed-cup rejection (closeAt already in the past) ----
  const closedCup = JSON.parse(cupBackup)
  closedCup.pool.closeAt = '2026-10-24T00:00:00.000Z'
  writeFileSync('data/cup.json', JSON.stringify(closedCup, null, 2))
  const closedMsg = `MonHouse Cup | game=chick | period=${period} | score=1 | name=QaTester | device=${device}`
  const rClosed = mockRes()
  await submitHandler(
    {
      method: 'POST',
      body: {
        game: 'chick',
        period,
        score: 1,
        name: 'QaTester',
        device,
        address: walletAddr,
        message: closedMsg,
        signature: signEip191(closedMsg, priv),
      },
    },
    rClosed
  )
  assert(
    'POST /api/cup/submit rejected after snapshot time (400 + closed)',
    rClosed.statusCode === 400 && /closed|snapshot/i.test(rClosed.body?.error || '')
  )
  writeFileSync('data/cup.json', cupBackup)
  await readJsonFile('data/cup.json', { fresh: true }) // bust the store cache

  // ---- GET /api/cup ----
  const rCup = mockRes()
  await cupHandler({ method: 'GET', query: {} }, rCup)
  assert(
    'GET /api/cup returns 200 + 600 MON pool + tiers + house wallet',
    rCup.statusCode === 200 &&
      rCup.body?.ok &&
      rCup.body?.pool?.totalMon === 600 &&
      JSON.stringify(rCup.body?.pool?.tiersMon) === JSON.stringify([180, 150, 120, 90, 60]) &&
      rCup.body?.pool?.wallet === EXPECTED_WALLET
  )

  // ---- POST /api/name/claim ----
  const rClaim = mockRes()
  await nameClaimHandler(
    {
      method: 'POST',
      body: { name: 'QaTester', device, message: nameMsg, address: walletAddr, signature: sig },
    },
    rClaim
  )
  assert(
    'POST /api/name/claim accepts valid Monad wallet signature',
    rClaim.statusCode === 200 && rClaim.body?.ok
  )

  // ---- GET /api/name ----
  const rName = mockRes()
  await nameGetHandler({ method: 'GET', query: { device } }, rName)
  assert('GET /api/name returns claimed name QaTester', rName.body?.claim?.name === 'QaTester')

  // ---- POST /api/cup/submit (game 1) ----
  const cupMsg1 = `MonHouse Cup | game=chick | period=${period} | score=999 | name=QaTester | device=${device}`
  const rSub1 = mockRes()
  await submitHandler(
    {
      method: 'POST',
      body: {
        game: 'chick',
        period,
        score: 999,
        name: 'QaTester',
        device,
        address: walletAddr,
        message: cupMsg1,
        signature: signEip191(cupMsg1, priv),
      },
    },
    rSub1
  )
  assert(
    `POST /api/cup/submit records #1 rank in ${period} (MonCat 999)`,
    rSub1.statusCode === 200 && rSub1.body?.ok && rSub1.body?.rank === 1,
    JSON.stringify(rSub1.body)
  )

  // ---- POST /api/cup/submit (same wallet, another game, higher score) ----
  const cupMsg2 = `MonHouse Cup | game=dash | period=${period} | score=1500 | name=QaTester | device=${device}`
  const rSub2 = mockRes()
  await submitHandler(
    {
      method: 'POST',
      body: {
        game: 'dash',
        period,
        score: 1500,
        name: 'QaTester',
        device,
        address: walletAddr,
        message: cupMsg2,
        signature: signEip191(cupMsg2, priv),
      },
    },
    rSub2
  )
  assert(
    'POST /api/cup/submit accepts 2nd game entry (MonDash 1500) for same wallet',
    rSub2.statusCode === 200 && rSub2.body?.ok && rSub2.body?.rank === 1,
    JSON.stringify(rSub2.body)
  )

  // ---- Unified leaderboard: best score across ALL games ----
  const rCup2 = mockRes()
  await cupHandler({ method: 'GET', query: {} }, rCup2)
  const overall = rCup2.body?.overall || []
  const winners = rCup2.body?.winners || []
  assert(
    'Unified board merges games: 1 player, best score 1500 from MonDash',
    overall.length === 1 && overall[0].score === 1500 && overall[0].game === 'dash',
    JSON.stringify(overall)
  )
  assert(
    'Winner #1 gets the 180 MON top prize',
    winners.length === 1 && winners[0].rank === 1 && winners[0].prizeMon === 180,
    JSON.stringify(winners)
  )

  // ---- POST /api/cheer ----
  const txHash = '0x' + 'a1b2'.repeat(16)
  const rCheer = mockRes()
  await cheerHandler(
    {
      method: 'POST',
      body: {
        name: 'QaTester',
        message: 'gmonad review!',
        value: 10000,
        txHash,
        device,
        ts: Date.now(),
      },
    },
    rCheer
  )
  assert('POST /api/cheer records MON cheer', rCheer.statusCode === 200 && rCheer.body?.ok)

  // Duplicate txHash check
  const rCheerDup = mockRes()
  await cheerHandler(
    {
      method: 'POST',
      body: { name: 'QaTester', message: 'dup', value: 10000, txHash, device, ts: Date.now() },
    },
    rCheerDup
  )
  assert('POST /api/cheer rejects duplicate txHash', rCheerDup.statusCode === 400)
} finally {
  writeFileSync('data/cup.json', cupBackup)
  writeFileSync('data/names.json', namesBackup)
  writeFileSync('data/cheers.json', cheersBackup)
}

console.log(`\n📊 Result: ${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
