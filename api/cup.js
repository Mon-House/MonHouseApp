/**
 * GET /api/cup — current MonHouse Cup state on Monad Testnet.
 * Returns the active period, MON pool config, per-game top-10, and payouts.
 */
import { readCup } from './lib/store.js'

export const GAMES = ['chick', 'stack', 'rush', 'swat', 'dash']

const PERIOD5_MS = 5 * 86400 * 1000 // 5-day Monad Testnet Cup epochs
const ANCHOR_START = Date.parse('2026-10-05T16:59:00.000Z')
const ANCHOR_P = 6911

export function cupPeriod(date = new Date()) {
  const t = Date.parse(date)
  const delta = Math.max(0, t - ANCHOR_START)
  const idx = Math.floor(delta / PERIOD5_MS)
  const p = ANCHOR_P + idx
  const start = new Date(ANCHOR_START + idx * PERIOD5_MS)
  const end = new Date(start.getTime() + PERIOD5_MS)
  return {
    id: `P${p}`,
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    closeUtc: end.toISOString().slice(11, 16),
    daysLeft: Math.max(1, Math.ceil((end.getTime() - t) / 86400000)),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  try {
    const data = await readCup()
    const period = cupPeriod()

    const periodsWithEntries = (p) =>
      GAMES.some((g) => (data.entries?.[g]?.[p] || []).length > 0)
    let boardPeriod = period.id
    if (!periodsWithEntries(boardPeriod)) {
      const allKeys = new Set()
      for (const g of GAMES) {
        for (const k of Object.keys(data.entries?.[g] || {})) allKeys.add(k)
      }
      const played = [...allKeys]
        .filter((p) => /^P\d+$/.test(p) && periodsWithEntries(p))
        .sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)))
      if (played.length) boardPeriod = played[played.length - 1]
    }
    const boardIsLast = boardPeriod !== period.id

    const leaders = {}
    for (const g of GAMES) {
      const list = data.entries?.[g]?.[boardPeriod] || []
      leaders[g] = [...list].sort((a, b) => b.score - a.score).slice(0, 10)
    }
    const payouts = {}
    for (const g of GAMES) {
      payouts[g] = data.payouts?.[g]?.[boardPeriod] || data.payouts?.[g]?.[period.id] || null
    }
    res.json({
      ok: true,
      period,
      games: GAMES,
      pool: data.pool,
      leaders,
      payouts,
      board: {
        period: boardPeriod,
        isLast: boardIsLast,
        paid: GAMES.every((g) => payouts[g]),
        note: boardIsLast
          ? `Showing latest standings from ${boardPeriod} — be the first to sign a score in ${period.id}!`
          : '',
      },
    })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message.slice(0, 160) })
  }
}
