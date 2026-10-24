import { useState } from 'react'

export default function ScoreOverlay({ gameName, score, best, extra, onReplay, cup }) {
  const isNew = score > 0 && score >= best
  const [shared, setShared] = useState(false)
  const [cupBusy, setCupBusy] = useState(false)
  const [cupResult, setCupResult] = useState(null) // { ok, rank?, error? }

  const share = async () => {
    const text = `★ I scored ${score} in ${gameName} on MonHouse (Monad Mainnet) ⚡ Can you beat me?`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MonHouse', text })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
      }
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    } catch {
      /* user cancelled share sheet */
    }
  }

  const enterCup = async () => {
    if (!cup?.onSubmit || cupBusy) return
    setCupBusy(true)
    setCupResult(null)
    const r = await cup.onSubmit(score)
    setCupBusy(false)
    setCupResult(r)
  }

  const alreadyHigher = cup?.myEntry != null && cup.myEntry >= score

  return (
    <div className="overlay">
      <div className="overlay-card">
        <div className="overlay-tag">{isNew ? '★ NEW BEST!' : 'GAME OVER'}</div>
        <div className="overlay-score">{score}</div>
        <div className="overlay-sub">
          Best: <strong>{best}</strong>
          {extra ? ` · ${extra}` : ''}
        </div>
        {cup && score > 0 && (
          <div className="cup-enter">
            {cup.closed ? (
              <div className="cup-status">
                {cup.paused
                  ? 'Cup is PAUSED — next Monad Cup will be announced by the house'
                  : 'This cup is closed — payout in progress, next cup opens soon'}
              </div>
            ) : cupResult?.ok ? (
              <div className="cup-status ok">
                ★ In the MonHouse Cup! Rank #{cupResult.rank} ({cupResult.score} pts)
              </div>
            ) : alreadyHigher ? (
              <div className="cup-status">
                Cup entry: <strong>{cup.myEntry}</strong> (beat it to update)
              </div>
            ) : (
              <>
                <button className="btn cup-btn" onClick={enterCup} disabled={cupBusy}>
                  {cupBusy ? 'Signing with Monad wallet…' : `★ Enter MonHouse Cup (${score})`}
                </button>
                {cupResult?.error && <div className="cup-status err">{cupResult.error}</div>}
              </>
            )}
          </div>
        )}
        {cup && (
          <div className="overlay-lb">
            <div className="overlay-lb-head">
              ★ {gameName} — Cup Standings
            </div>
            {(cup.leaders?.length || 0) === 0 ? (
              <div className="overlay-lb-empty">
                Belum ada skor terdaftar — jadilah yang pertama!
              </div>
            ) : (
              cup.leaders.map((e, i) => (
                <div
                  key={(e.address || e.device) + i}
                  className={`overlay-lb-row ${e.device === cup.myDevice ? 'mine' : ''}`}
                >
                  <span className="overlay-lb-rank">#{i + 1}</span>
                  <span className="overlay-lb-name">{e.name}</span>
                  <span className="overlay-lb-score">{e.score}</span>
                </div>
              ))
            )}
          </div>
        )}
        <div className="overlay-actions">
          <button className="btn primary" onClick={onReplay}>
            Play again
          </button>
          <button className="btn ghost" onClick={share}>
            {shared ? 'Copied!' : 'Share'}
          </button>
        </div>
      </div>
    </div>
  )
}
