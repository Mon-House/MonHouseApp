/**
 * POST /api/cup/submit — enter the current MonHouse Cup with a Monad Testnet wallet-signed score.
 *
 * Body: { game, period, score, name, device, address, message, publicKey?, signature }
 */
import { writeCup, readJsonFile } from '../lib/store.js'
import { verifyWalletSignature } from '../lib/verify.js'
import { GAMES, cupPeriod } from '../cup.js'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.status(204).end()
    return
  }
  const bad = (error) => res.status(400).json({ ok: false, error })
  try {
    const { game, period, score, name, device, address, message, publicKey, signature } =
      req.body || {}

    if (!GAMES.includes(game)) return bad('unknown game')
    if (!/^P\d+$/.test(period || '')) return bad('bad period')
    if (period !== cupPeriod().id) return bad('cup period closed')

    try {
      const cupData = await readJsonFile('data/cup.json')
      if (cupData.pool?.closedPeriods?.[period])
        return bad('this cup closed early — payout in progress, the next cup opens soon')
      if (cupData.pool?.paused)
        return bad('the cup is PAUSED — the next cup will be announced by the house')
      const closeAt = Date.parse(cupData.pool?.closeAt || '')
      if (Number.isFinite(closeAt) && Date.now() >= closeAt)
        return bad('this cup is closed — payout in progress, the next cup opens soon')
    } catch {
      /* no closeAt set */
    }

    const s = Math.floor(Number(score))
    if (!Number.isFinite(s) || s < 0 || s > 1_000_000) return bad('bad score')
    if (!/^[0-9a-f]{64}$/i.test(device || '')) return bad('bad device id')
    const claimedAddr = String(address || publicKey || '').trim().toLowerCase()
    if (!claimedAddr || !signature || typeof message !== 'string') return bad('missing signature')
    if (
      !message.includes(`score=${s}`) ||
      !message.includes(`game=${game}`) ||
      !message.includes(`period=${period}`)
    )
      return bad('message/score mismatch')

    const v = verifyWalletSignature(message, claimedAddr, signature)
    if (!v.ok) return bad(v.error)

    const addrNorm = v.address

    let claimedName = ''
    try {
      const names = await readJsonFile('data/names.json')
      claimedName = names.names?.[String(device).toLowerCase()]?.name || ''
    } catch {
      /* names store unavailable — fall back to submitted name */
    }

    const next = await writeCup((data) => {
      data.entries = data.entries || {}
      const byPeriod = (data.entries[game] = data.entries[game] || {})
      const list = byPeriod[period] || (byPeriod[period] = [])
      const i = list.findIndex(
        (e) => e.device === device || (addrNorm && (e.pub === addrNorm || e.address?.toLowerCase() === addrNorm))
      )
      const entry = {
        device,
        name: claimedName || String(name || 'Anonymous').slice(0, 24),
        score: s,
        address: addrNorm,
        pub: addrNorm,
        ts: Date.now(),
      }
      if (i >= 0) {
        const existing = list[i]
        if (existing.device !== device) throw new Error('cup-identity-blocked')
        list[i] = {
          ...existing,
          name: entry.name,
          address: existing.address || entry.address,
          pub: existing.pub || entry.pub,
          score: Math.max(existing.score, s),
          ts: s > existing.score ? entry.ts : existing.ts,
        }
      } else {
        list.push(entry)
      }
      return data
    })

    const list = next.entries[game][period]
    const top = [...list].sort((a, b) => b.score - a.score)
    const rank = top.findIndex((e) => e.device === device || (addrNorm && e.pub === addrNorm)) + 1
    const mine = list.find((e) => e.device === device || (addrNorm && e.pub === addrNorm))
    res.json({ ok: true, rank, score: mine?.score ?? s, period })
  } catch (e) {
    if (e.message === 'cup-identity-blocked')
      return bad('one entry per wallet — this wallet already entered the cup')
    if (/cup-not-configured|cup-write-conflict/.test(e.message)) {
      res.status(503).json({ ok: false, error: 'cup is being set up — try again shortly' })
    } else {
      res.status(500).json({ ok: false, error: e.message.slice(0, 160) })
    }
  }
}
