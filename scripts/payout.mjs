#!/usr/bin/env node
/**
 * MonHouse Cup — Monad Testnet Payout Runner
 * ------------------------------------------
 * Computes top 3 winners per game for a closed 5-day MonHouse Cup period
 * and records Monad Testnet `0x...` transaction hashes via POST /api/cup/payout.
 *
 * Usage:
 *   node scripts/payout.mjs --dry-run
 *   node scripts/payout.mjs --period P6914 --dry-run
 *   node scripts/payout.mjs --period P6914 --api https://your-monhouse.vercel.app
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'

const SPLIT = [50, 30, 20]
const GAMES = ['chick', 'stack', 'rush', 'swat', 'dash']
const NAMES = {
  chick: 'MonCat',
  stack: 'MonStack',
  rush: 'MonRush',
  swat: 'MonSwat',
  dash: 'MonDash',
}

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : fallback
}
const DRY_RUN = argv.includes('--dry-run')
const API = arg('--api', process.env.MONHOUSE_API_URL || 'http://localhost:5173')
const requestedPeriod = arg('--period', null)

const PERIOD5_MS = 5 * 86400 * 1000
const ANCHOR_START = Date.parse('2026-10-05T16:59:00.000Z')
const ANCHOR_P = 6911

function periodInfo(date = new Date()) {
  const t = Date.parse(date)
  const idx = Math.max(0, Math.floor((t - ANCHOR_START) / PERIOD5_MS))
  const p = ANCHOR_P + idx
  const start = new Date(ANCHOR_START + idx * PERIOD5_MS)
  const end = new Date(start.getTime() + PERIOD5_MS)
  return { p, id: `P${p}`, start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

const here = path.dirname(fileURLToPath(import.meta.url))
const localCupPath = path.join(here, '..', 'data', 'cup.json')
const data = JSON.parse(readFileSync(localCupPath, 'utf8'))

const current = periodInfo()
const targetId = requestedPeriod || `P${current.p - 1}`
const poolMon = Number(arg('--pool', data.pool?.perGameMon ?? 5))
const shares = SPLIT.map((pct) => Number(((poolMon * pct) / 100).toFixed(4)))

console.log('🏆 MonHouse Cup — Monad Testnet Payout Runner')
console.log(`   period: ${targetId} · pool: ${poolMon} MON/game · split: ${SPLIT.join(' / ')}%\n`)

const plan = []
for (const g of GAMES) {
  const entries = [...(data.entries?.[g]?.[targetId] || [])]
    .sort((a, b) => b.score - a.score || a.ts - b.ts)
    .slice(0, 3)
  entries.forEach((e, i) => {
    plan.push({
      game: g,
      rank: i + 1,
      mon: shares[i],
      name: e.name,
      address: e.address || '',
      score: e.score,
      already: data.payouts?.[g]?.[targetId]?.[String(i + 1)],
    })
  })
}

if (plan.length === 0) {
  console.log(`No entries recorded in ${targetId}.`)
  process.exit(0)
}

for (const p of plan) {
  const status = p.already ? ` [paid: ${p.already.slice(0, 14)}…]` : ''
  console.log(
    `  ${NAMES[p.game].padEnd(12)} #${p.rank}  ${String(p.mon + ' MON').padStart(9)}  ${p.name.padEnd(16)} score ${String(p.score).padStart(6)}  →  ${p.address || 'NO ADDRESS'}${status}`
  )
}

if (DRY_RUN) {
  console.log('\n--dry-run complete.')
  process.exit(0)
}

const envFile = path.join(here, '..', '.env.cup-admin')
if (!existsSync(envFile)) {
  console.error(`\nMissing ${envFile} with CUP_ADMIN_SECRET=... (use --dry-run to preview).`)
  process.exit(1)
}
const secret = (readFileSync(envFile, 'utf8').match(/CUP_ADMIN_SECRET=([^\s]+)/) || [])[1]
if (!secret) {
  console.error('CUP_ADMIN_SECRET not found in .env.cup-admin')
  process.exit(1)
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise((res) => rl.question(q, res))

for (const p of plan.filter((x) => !x.already && x.address)) {
  const raw = (await ask(`\nTx hash for ${NAMES[p.game]} #${p.rank} (${p.mon} MON → ${p.address}) [or 's' to skip]: `)).trim()
  if (!raw || /^s$/i.test(raw)) continue
  const r = await fetch(`${API}/api/cup/payout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-cup-admin': secret },
    body: JSON.stringify({ game: p.game, period: targetId, rank: p.rank, tx: raw }),
  })
  const j = await r.json().catch(() => ({}))
  console.log(j.ok ? `  ✓ Recorded ${raw}` : `  ✗ Error: ${j.error || r.status}`)
}
rl.close()
