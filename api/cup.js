/**
 * GET /api/cup — current MonHouse Cup state on Monad Mainnet.
 *
 * Cup rules (v3 — snapshot cup):
 *  - One-day event: the winner snapshot is taken at pool.closeAt (19:45 WIB).
 *  - Total prize 600 MON, tiers [180, 150, 120, 90, 60] for ranks 1-5.
 *  - Ranking = each player's HIGHEST score across ALL games.
 *  - Prizes are distributed automatically by the MonHouse house wallet.
 */
import { readCup } from './lib/store.js'

export const GAMES = ['chick', 'stack', 'rush', 'swat', 'dash']

export const GAME_LABELS = {
  chick: 'MonCat',
  stack: 'MonStack',
  rush: 'MonRush',
  swat: 'MonSwat',
  dash: 'MonDash',
}

const DEFAULT_CLOSE_AT = '2026-10-24T12:45:00.000Z'
const DEFAULT_TIERS = [180, 150, 120, 90, 60]
const WIB_OFFSET_MS = 7 * 3600 * 1000

/**
 * Derive the snapshot-cup period from the configured closeAt timestamp.
 * Period id = `P` + YYYYMMDD of the close time in WIB (Asia/Jakarta).
 */
export function cupPeriod(closeAtIso, date = new Date()) {
  const parsed = Date.parse(closeAtIso)
  const closeAt = Number.isFinite(parsed) ? parsed : Date.parse(DEFAULT_CLOSE_AT)
  const t = Date.parse(date)
  const wibDay = new Date(closeAt + WIB_OFFSET_MS).toISOString().slice(0, 10)
  return {
    id: `P${wibDay.replace(/-/g, '')}`,
    start: wibDay,
    end: wibDay,
    closeUtc: new Date(closeAt).toISOString().slice(11, 16),
    closeAt: new Date(closeAt).toISOString(),
    open: t < closeAt,
    msLeft: Math.max(0, closeAt - t),
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Cache-Control', 'no-store')
  try {
    const data = await readCup()
    const period = cupPeriod(data.pool?.closeAt)

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

    // Per-game leaders (top 10 each) + unified board:
    // each player is ranked by their single HIGHEST score across ALL games.
    const leaders = {}
    const bestByPlayer = new Map()
    for (const g of GAMES) {
      const list = [...(data.entries?.[g]?.[boardPeriod] || [])].sort(
        (a, b) => b.score - a.score || a.ts - b.ts
      )
      leaders[g] = list.slice(0, 10)
      for (const e of list) {
        const key = String(e.address || e.device || '').toLowerCase()
        const cur = bestByPlayer.get(key)
        if (!cur || e.score > cur.score) bestByPlayer.set(key, { ...e, game: g })
      }
    }
    const overall = [...bestByPlayer.values()]
      .sort((a, b) => b.score - a.score || a.ts - b.ts)
      .slice(0, 10)

    const tiers =
      Array.isArray(data.pool?.tiersMon) && data.pool.tiersMon.length
        ? data.pool.tiersMon.map(Number)
        : DEFAULT_TIERS
    const winners = overall.slice(0, tiers.length).map((e, i) => ({
      ...e,
      rank: i + 1,
      prizeMon: tiers[i],
    }))

    const payouts = data.payouts?.[boardPeriod] || null

    res.json({
      ok: true,
      period,
      games: GAMES,
      gameLabels: GAME_LABELS,
      pool: data.pool,
      leaders,
      overall,
      winners,
      payouts,
      board: {
        period: boardPeriod,
        isLast: boardIsLast,
        snapshotTaken: !period.open && !boardIsLast,
        paid:
          !!payouts &&
          winners.length > 0 &&
          Object.keys(payouts.txs || {}).length >= winners.length,
        note: boardIsLast
          ? `Menampilkan standings final dari ${boardPeriod}.`
          : '',
      },
    })
  } catch (e) {
    res.status(503).json({ ok: false, error: e.message.slice(0, 160) })
  }
}
