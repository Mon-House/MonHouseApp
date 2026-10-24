/**
 * POST /api/cup/payout — record an on-chain Monad Mainnet payout for a Cup winner.
 * The MonHouse wallet sends MON first, then this marks the tx hash so the
 * UI can show "paid ✓" with a Monadscan link. Protected by CUP_ADMIN_SECRET.
 *
 * Body: { period, rank (1..5), tx }
 */
import { writeCup } from '../lib/store.js'

const MAX_RANK = 5

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-cup-admin')
    res.status(204).end()
    return
  }
  const secret = process.env.CUP_ADMIN_SECRET
  if (!secret || req.headers['x-cup-admin'] !== secret) {
    res.status(401).json({ ok: false, error: 'unauthorized' })
    return
  }
  try {
    const { period, rank, tx } = req.body || {}
    if (!/^P\d+$/.test(period || ''))
      return res.status(400).json({ ok: false, error: 'bad period' })
    const r = Number(rank)
    if (!Number.isInteger(r) || r < 1 || r > MAX_RANK)
      return res.status(400).json({ ok: false, error: 'bad rank (1..5)' })
    if (!tx || !/^0x[0-9a-f]{64}$/i.test(String(tx)))
      return res.status(400).json({ ok: false, error: 'missing tx hash' })

    await writeCup((data) => {
      data.payouts = data.payouts || {}
      const byPeriod = (data.payouts[period] = data.payouts[period] || {})
      byPeriod.wallet = data.pool?.wallet || byPeriod.wallet
      byPeriod.txs = byPeriod.txs || {}
      byPeriod.txs[String(r)] = String(tx).slice(0, 128)
      byPeriod.distributedAt = Date.now()
      return data
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message.slice(0, 160) })
  }
}
