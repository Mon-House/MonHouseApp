/**
 * MonHouse Pre-Push Verification Suite
 * ------------------------------------
 * Verifies:
 *  1. Production Vite build (`dist/index.html` + bundled assets)
 *  2. Zero legacy Nimiq / NimHouse strings in production bundle
 *  3. House wallet `0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d` present in bundle & Cup config
 *  4. Real secp256k1 EIP-191 `personal_sign` cryptographic signature verification (`api/lib/verify.js`)
 *  5. All API handlers (`api/cup.js`, `api/name/claim.js`, `api/cup/submit.js`, `api/cheer.js`)
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
assert('Monad Testnet Chain ID 10143 (0x279f) in bundle', bundleJs.includes('10143') && bundleJs.includes('0x279f'))
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
assert('Valid EIP-191 personal_sign verifies & recovers exact 0x address', vOk.ok && vOk.address === walletAddr)
const vTamper = verifyWalletSignature(nameMsg + '!', walletAddr, sig)
assert('Tampered message is rejected', !vTamper.ok)

console.log('\n🌐 3. Serverless API Handlers E2E Check (with snapshot restore)')
const cupBackup = readFileSync('data/cup.json', 'utf8')
const namesBackup = readFileSync('data/names.json', 'utf8')
const cheersBackup = readFileSync('data/cheers.json', 'utf8')

try {
  // GET /api/cup
  const rCup = mockRes()
  await cupHandler({ method: 'GET', query: {} }, rCup)
  assert(
    'GET /api/cup returns 200 + House wallet 0xe5b4…AD1d',
    rCup.statusCode === 200 && rCup.body?.ok && rCup.body?.pool?.wallet === EXPECTED_WALLET
  )

  // POST /api/name/claim
  const rClaim = mockRes()
  await nameClaimHandler(
    {
      method: 'POST',
      body: { name: 'QaTester', device, message: nameMsg, address: walletAddr, signature: sig },
    },
    rClaim
  )
  assert('POST /api/name/claim accepts valid Monad wallet signature', rClaim.statusCode === 200 && rClaim.body?.ok)

  // GET /api/name
  const rName = mockRes()
  await nameGetHandler({ method: 'GET', query: { device } }, rName)
  assert('GET /api/name returns claimed name QaTester', rName.body?.claim?.name === 'QaTester')

  // POST /api/cup/submit
  const period = cupPeriod().id
  const cupMsg = `MonHouse Cup | game=chick | period=${period} | score=999 | name=QaTester | device=${device}`
  const cupSig = signEip191(cupMsg, priv)
  const rSub = mockRes()
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
        message: cupMsg,
        signature: cupSig,
      },
    },
    rSub
  )
  assert(
    `POST /api/cup/submit records #1 rank in ${period}`,
    rSub.statusCode === 200 && rSub.body?.ok && rSub.body?.rank === 1,
    JSON.stringify(rSub.body)
  )

  // POST /api/cheer
  const txHash = '0x' + 'a1b2'.repeat(16)
  const rCheer = mockRes()
  await cheerHandler(
    {
      method: 'POST',
      body: { name: 'QaTester', message: 'gmonad review!', value: 10000, txHash, device, ts: Date.now() },
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
