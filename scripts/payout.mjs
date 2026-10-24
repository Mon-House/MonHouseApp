#!/usr/bin/env node
/**
 * MonHouse Cup — Monad Mainnet Payout Runner (v3 — 600 MON snapshot cup)
 * ---------------------------------------------------------------------
 * Rules: winner snapshot at closeAt (19:45 WIB). Ranking = each player's
 * HIGHEST score across ALL games. Top 5 win 180 / 150 / 120 / 90 / 60 MON,
 * distributed automatically from the MonHouse house wallet.
 *
 * Usage:
 *   node scripts/payout.mjs --dry-run                 # preview winners & prizes
 *   node scripts/payout.mjs --auto                    # AUTO: send MON from the house
 *                                                     # wallet (needs MONHOUSE_PAYOUT_KEY)
 *   node scripts/payout.mjs                           # interactive: paste tx hashes
 *   node scripts/payout.mjs --api https://monhouse.vercel.app
 *
 * Env:
 *   MONHOUSE_PAYOUT_KEY   house wallet private key (hex, 0x optional) for --auto
 *   MONHOUSE_RPC_URL      RPC (default https://rpc.monad.xyz)
 *   CUP_ADMIN_SECRET      admin secret to record tx hashes via /api/cup/payout
 *                         (or put it in .env.cup-admin)
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak256 } from 'js-sha3'

const GAMES = ['chick', 'stack', 'rush', 'swat', 'dash']
const GAME_LABELS = {
  chick: 'MonCat',
  stack: 'MonStack',
  rush: 'MonRush',
  swat: 'MonSwat',
  dash: 'MonDash',
}
const DEFAULT_TIERS = [180, 150, 120, 90, 60]
const CHAIN_ID = 143
const RPC_URL = process.env.MONHOUSE_RPC_URL || 'https://rpc.monad.xyz'
const WIB_OFFSET_MS = 7 * 3600 * 1000
const WEI_PER_MON = 10n ** 18n

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : fallback
}
const DRY_RUN = argv.includes('--dry-run')
const AUTO = argv.includes('--auto')
const FORCE = argv.includes('--force')
const API = arg('--api', process.env.MONHOUSE_API_URL || 'http://localhost:5173')
const requestedPeriod = arg('--period', null)

const here = path.dirname(fileURLToPath(import.meta.url))
const localCupPath = path.join(here, '..', 'data', 'cup.json')
const data = JSON.parse(readFileSync(localCupPath, 'utf8'))

const closeAt = Date.parse(data.pool?.closeAt || '')
const closeLabel = data.pool?.closeLabel || '19:45 WIB'
const periodId =
  requestedPeriod ||
  (Number.isFinite(closeAt)
    ? 'P' + new Date(closeAt + WIB_OFFSET_MS).toISOString().slice(0, 10).replace(/-/g, '')
    : 'P0')
const tiers = Array.isArray(data.pool?.tiersMon) && data.pool.tiersMon.length
  ? data.pool.tiersMon.map(Number)
  : DEFAULT_TIERS
const totalMon = Number(data.pool?.totalMon) || tiers.reduce((a, b) => a + b, 0)

console.log('🏆 MonHouse Cup — Monad Mainnet Payout Runner (v3)')
console.log(
  `   period: ${periodId} · snapshot: ${Number.isFinite(closeAt) ? new Date(closeAt).toISOString() : '?'} (${closeLabel})`
)
console.log(`   pool: ${totalMon} MON · tiers: ${tiers.join(' / ')} MON (ranks 1-${tiers.length})\n`)

if (Number.isFinite(closeAt) && Date.now() < closeAt && !FORCE) {
  const left = Math.ceil((closeAt - Date.now()) / 60000)
  console.log(`⏳ Cup still OPEN — snapshot in ~${left} min. Use --force to override.\n`)
  if (!DRY_RUN) process.exit(0)
}

// ---- Unified winners: best score per player across ALL games ----
const bestByPlayer = new Map()
for (const g of GAMES) {
  for (const e of data.entries?.[g]?.[periodId] || []) {
    const key = String(e.address || e.device || '').toLowerCase()
    const cur = bestByPlayer.get(key)
    if (!cur || e.score > cur.score) bestByPlayer.set(key, { ...e, game: g })
  }
}
const ranked = [...bestByPlayer.values()].sort((a, b) => b.score - a.score || a.ts - b.ts)
const plan = ranked.slice(0, tiers.length).map((e, i) => ({
  rank: i + 1,
  mon: tiers[i],
  name: e.name,
  address: (e.address || '').toLowerCase(),
  score: e.score,
  game: e.game,
  already: data.payouts?.[periodId]?.txs?.[String(i + 1)],
}))

if (plan.length === 0) {
  console.log(`No entries recorded in ${periodId}.`)
  process.exit(0)
}

for (const p of plan) {
  const status = p.already ? ` [paid: ${p.already.slice(0, 14)}…]` : ''
  console.log(
    `  #${p.rank}  ${String(p.mon + ' MON').padStart(9)}  ${p.name.padEnd(16)} score ${String(p.score).padStart(6)} (${GAME_LABELS[p.game] || p.game})  →  ${p.address || 'NO ADDRESS'}${status}`
  )
}

if (DRY_RUN) {
  console.log('\n--dry-run complete.')
  process.exit(0)
}

// ---------- helpers: admin secret ----------
function loadAdminSecret() {
  if (process.env.CUP_ADMIN_SECRET) return process.env.CUP_ADMIN_SECRET
  const envFile = path.join(here, '..', '.env.cup-admin')
  if (existsSync(envFile)) {
    const m = readFileSync(envFile, 'utf8').match(/CUP_ADMIN_SECRET=([^\s]+)/)
    if (m) return m[1]
  }
  return null
}
async function recordTx(period, rank, tx) {
  const secret = loadAdminSecret()
  if (!secret) {
    console.log('  ⚠ CUP_ADMIN_SECRET not set — tx not recorded on the board (send it manually later).')
    return false
  }
  const r = await fetch(`${API}/api/cup/payout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cup-admin': secret },
    body: JSON.stringify({ period, rank, tx }),
  })
  const j = await r.json().catch(() => ({}))
  console.log(j.ok ? `  ✓ Recorded ${tx}` : `  ✗ Record error: ${j.error || r.status}`)
  return !!j.ok
}

// ---------- mode A: automatic on-chain distribution from the house wallet ----------
if (AUTO) {
  const keyHex = (process.env.MONHOUSE_PAYOUT_KEY || '').replace(/^0x/i, '')
  if (!/^[0-9a-f]{64}$/i.test(keyHex)) {
    console.error('\nMissing/invalid MONHOUSE_PAYOUT_KEY (64-char hex private key) for --auto.')
    process.exit(1)
  }
  const priv = Uint8Array.from(Buffer.from(keyHex, 'hex'))
  const pubUncomp = secp256k1.getPublicKey(priv, false).slice(1)
  const houseAddr = '0x' + Buffer.from(keccak256.arrayBuffer(pubUncomp)).subarray(12).toString('hex')
  console.log(`\n🤖 AUTO mode — distributing from house wallet ${houseAddr} via ${RPC_URL}\n`)

  const rpc = async (method, params = []) => {
    const res = await fetch(RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    })
    const j = await res.json()
    if (j.error) throw new Error(`rpc ${method}: ${j.error.message}`)
    return j.result
  }

  // --- minimal RLP + EIP-155 legacy transaction signing ---
  const concat = (arrs) => Uint8Array.from(arrs.flatMap((a) => [...a]))
  const intBytes = (n) => {
    if (n === 0n) return new Uint8Array(0)
    let hex = n.toString(16)
    if (hex.length % 2) hex = '0' + hex
    return Uint8Array.from(Buffer.from(hex, 'hex'))
  }
  const rlp = (item) => {
    const buf = Array.isArray(item) ? concat(item.map(rlp)) : item
    if (buf.length === 1 && buf[0] < 0x80) return buf
    let prefix
    if (buf.length <= 55) prefix = Uint8Array.of(0x80 + buf.length)
    else {
      const len = intBytes(BigInt(buf.length))
      prefix = Uint8Array.of(0xb7 + len.length, ...len)
    }
    return concat([prefix, buf])
  }
  const signTx = async ({ nonce, gasPrice, to, valueWei }) => {
    const toBuf = Uint8Array.from(Buffer.from(to.replace(/^0x/, ''), 'hex'))
    const unsigned = rlp([
      intBytes(nonce),
      intBytes(gasPrice),
      intBytes(21000n),
      toBuf,
      intBytes(valueWei),
      new Uint8Array(0),
      intBytes(BigInt(CHAIN_ID)),
      intBytes(0n),
      intBytes(0n),
    ])
    const hash = Uint8Array.from(Buffer.from(keccak256.arrayBuffer(unsigned)))
    const rec = secp256k1.sign(hash, priv, { prehash: false, format: 'recovered' })
    const recBit = rec[0]
    const r = rec.slice(1, 33)
    const s = rec.slice(33, 65)
    const v = 35n + 2n * BigInt(CHAIN_ID) + BigInt(recBit)
    const signed = rlp([
      intBytes(nonce),
      intBytes(gasPrice),
      intBytes(21000n),
      toBuf,
      intBytes(valueWei),
      new Uint8Array(0),
      intBytes(v),
      r,
      s,
    ])
    return '0x' + Buffer.from(signed).toString('hex')
  }

  const pending = plan.filter((p) => !p.already && p.address)
  if (pending.length === 0) {
    console.log('All winners already paid. Nothing to do.')
    process.exit(0)
  }
  let nonce = BigInt(await rpc('eth_getTransactionCount', [houseAddr, 'pending']))
  const gasPrice = BigInt(await rpc('eth_gasPrice', []))
  console.log(`  nonce=${nonce} · gasPrice=${gasPrice} wei\n`)
  for (const p of pending) {
    const valueWei = BigInt(Math.round(p.mon * Number(WEI_PER_MON)))
    try {
      const raw = await signTx({ nonce, gasPrice, to: p.address, valueWei })
      const tx = await rpc('eth_sendRawTransaction', [raw])
      console.log(`  ✓ #${p.rank} ${p.mon} MON → ${p.name} (${p.address}) tx ${tx}`)
      await recordTx(periodId, p.rank, tx)
      nonce += 1n
    } catch (e) {
      console.error(`  ✗ #${p.rank} failed: ${e.message}`)
    }
  }
  console.log('\nDone. Verify on Monadscan: https://monadscan.com')
  process.exit(0)
}

// ---------- mode B: interactive tx-hash recording ----------
const envFile = path.join(here, '..', '.env.cup-admin')
const secret = loadAdminSecret()
if (!secret && existsSync(envFile) === false) {
  console.error(`\nMissing CUP_ADMIN_SECRET (env or ${envFile}) — use --dry-run to preview.`)
  process.exit(1)
}
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

for (const p of plan.filter((x) => !x.already && x.address)) {
  const raw = (
    await ask(`\nTx hash for #${p.rank} (${p.mon} MON → ${p.address}) [or 's' to skip]: `)
  ).trim()
  if (!raw || /^s$/i.test(raw)) continue
  await recordTx(periodId, p.rank, raw)
}
rl.close()
