import { useState } from 'react'
import { loadLB } from '../leaderboard'

/**
 * Shared "round over" overlay for all games.
 * Handles the wallet-verified score badge + optional NimHouse Cup entry.
 *
 * Leaderboard policy: the board is ALWAYS shown in-game, prize or no prize.
 * When the house pauses the Cup (no pool to pay), the entry button turns into
 * a leaderboard button and the standings of the last played cup stay public
 * on the hub — scores keep counting, only the prize is off.
 */
export default function ScoreOverlay({
  gameLabel,
  gameId,
  score,
  best,
  isBest,
  quote,
  rankLine,
  onReplay,
  onExit,
  requestVerify,
  entryId,
  walletMode,
  onCup,
  cupState,
}) {
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [sig, setSig] = useState(null)
  const [err, setErr] = useState(null)
  const [cupBusy, setCupBusy] = useState(false)
  const [cupDone, setCupDone] = useState(null)
  const [cupErr, setCupErr] = useState(null)

  // Per-device board, read at render time so this run is already on it.
  // Top 5 always show; if this run did not make the cut it is appended with
  // its real rank, because a player must always see the score they just made.
  const board = gameId ? loadLB(gameId) : []
  const top5 = board.slice(0, 5)
  const myIdx = entryId ? board.findIndex((e) => e.id === entryId) : -1
  const rows = myIdx >= 5 ? [...top5, { ...board[myIdx], rank: myIdx + 1 }] : top5
  const paused = !!cupState?.paused

  async function doCup() {
    if (cupBusy || cupDone) return
    setCupBusy(true)
    setCupErr(null)
    try {
      const res = await onCup(score)
      if (res.ok) setCupDone(res.rank ? `#${res.rank} today` : 'saved')
      else setCupErr(res.error || 'Cup entry failed')
    } catch (e) {
      setCupErr(e?.message || 'Cup entry failed')
    } finally {
      setCupBusy(false)
    }
  }

  async function doVerify() {
    if (!entryId || verifying || verified) return
    setVerifying(true)
    setErr(null)
    try {
      const res = await requestVerify(entryId)
      if (res.ok) {
        setVerified(true)
        setSig(res.signature)
      } else {
        setErr(res.error || 'Verification failed')
      }
    } catch (e) {
      setErr(e?.message || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="panel">
      {isBest && <span className="new-best">★ NEW BEST</span>}
      <div className="score-big">{score}</div>
      <div className="score-best">
        Best {best} {rankLine ? ` · ${rankLine}` : ''}
      </div>
      <div className="quote">{quote}</div>

      {!verified && (
        <button
          className="btn ghost block"
          onClick={doVerify}
          disabled={verifying || !entryId}
          title="Signs a record of this score with your Nimiq wallet"
        >
          {verifying ? (
            <>
              <span className="spin" /> Signing…
            </>
          ) : (
            <>✓ Verify score with wallet{walletMode === 'demo' ? ' (demo)' : ''}</>
          )}
        </button>
      )}
      {verified && (
        <div>
          <div>
            <span className="badge verified">✓ WALLET-VERIFIED</span>
          </div>
          <div className="verified-line">sig {String(sig || '').slice(0, 18)}…</div>
        </div>
      )}
      {err && <div className="quote">{err}</div>}

      {paused ? (
        <button className="btn gold block" onClick={onExit} title="Opens the house leaderboard">
          🏆 View the leaderboard
        </button>
      ) : (
        onCup &&
        !cupDone && (
          <button
            className="btn gold block"
            onClick={doCup}
            disabled={cupBusy}
            title="Signs this score with your Nimiq wallet to enter the daily Cup"
          >
            {cupBusy ? (
              <>
                <span className="spin" /> Signing…
              </>
            ) : (
              <>🏆 Enter the NimHouse Cup</>
            )}
          </button>
        )
      )}
      {cupDone && (
        <div className="cup-line ok">
          🏆 Cup entry saved · {cupDone} <span>(top 3 per game take this cup's pool)</span>
        </div>
      )}
      {cupErr && <div className="cup-line err">{cupErr}</div>}
      {paused && (
        <div className="cup-line">
          Cup paused — no prize pool right now. Scores still count and the leaderboard stays up.
        </div>
      )}

      <div className="lb-mini">
        <div className="lb-mini-head">
          {gameLabel} · top 5 on this device
          <span className="lb-mini-sub">no prize needed — the board never closes</span>
        </div>
        {rows.length === 0 ? (
          <div className="lb-empty">No runs yet — be the first on the board.</div>
        ) : (
          rows.map((e, i) => (
            <div className={`lb-row${e.id === entryId ? ' me' : ''}`} key={e.id}>
              <div className="lb-rank">{e.rank || i + 1}</div>
              <div className="lb-name">
                {e.name} {e.verified && <span className="badge verified">✓</span>}
                {e.id === entryId && <span className="lb-you">you</span>}
              </div>
              <div className="lb-score">{e.score}</div>
            </div>
          ))
        )}
      </div>

      <div className="btns">
        <div className="row">
          <button className="btn primary" onClick={onReplay}>
            ↺ Play again
          </button>
          <button className="btn ghost" onClick={onExit}>
            ← Back to house
          </button>
        </div>
        <div className="panel-hint">{gameLabel} · 100% skill</div>
      </div>
    </div>
  )
}
