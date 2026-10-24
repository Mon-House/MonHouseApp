import { useCallback, useEffect, useRef, useState } from 'react'
import catHeroImg from './assets/cat.png'
import thumbCat from './assets/thumbs/cat.jpg'
import thumbDash from './assets/thumbs/dash.jpg'
import thumbRush from './assets/thumbs/rush.jpg'
import thumbStack from './assets/thumbs/stack.jpg'
import thumbSwat from './assets/thumbs/swat.jpg'
import MonCat from './games/MonCat.jsx'
import MonDash from './games/MonDash.jsx'
import MonRush from './games/MonRush.jsx'
import MonStack from './games/MonStack.jsx'
import MonSwat from './games/MonSwat.jsx'
import { drawCat, drawStackPreview } from './sketch.js'
import { SKIN_GROUPS } from './skins.js'
import { isMuted, setMuted, sfx } from './sound.js'
import {
  CHEER_ADDRESS,
  HOUSE_ADDRESS,
  MONAD_TESTNET,
  explorerAddrUrl,
  explorerTxUrl,
  fmtMon,
  initWallet,
  shortAddr,
} from './wallet.js'

const STORAGE_KEY = 'monhouse.v1'
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._\-]{0,15}$/

const CHEER_AMOUNTS = [1000, 5000, 10000, 25000] // 0.01, 0.05, 0.1, 0.25 MON
const CHEER_PRESETS = [
  'gmonad!! ♥ ✦',
  'GG! Beat my score ★',
  'Absurd cat FTW ◈',
  '10,000 TPS arcade vibes ⚡',
]

function timeAgo(ts) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

const PERIOD5_MS = 5 * 86400 * 1000
const ANCHOR_START = Date.parse('2026-10-05T16:59:00.000Z')
const ANCHOR_P = 6911

function cupPeriodId() {
  const t = Date.now()
  const delta = Math.max(0, t - ANCHOR_START)
  return `P${ANCHOR_P + Math.floor(delta / PERIOD5_MS)}`
}

function getDeviceId() {
  try {
    let id = localStorage.getItem('monhouse.device')
    if (!id || !/^[0-9a-f]{64}$/i.test(id)) {
      const b = new Uint8Array(32)
      crypto.getRandomValues(b)
      id = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
      localStorage.setItem('monhouse.device', id)
    }
    return id
  } catch {
    return '0'.repeat(64)
  }
}

const GAMES = [
  {
    id: 'chick',
    name: 'MonCat',
    tag: 'Tap to pounce through crystal pipes',
    accent: '#a855f7',
    badge: 'FAN FAVORITE',
    thumb: thumbCat,
    Component: MonCat,
    skinGroup: 'chick',
  },
  {
    id: 'stack',
    name: 'MonStack',
    tag: 'Drop floating 3D blocks from above · slice overhang',
    accent: '#22d3ee',
    badge: 'PRECISION',
    thumb: thumbStack,
    Component: MonStack,
    skinGroup: 'stack',
  },
  {
    id: 'rush',
    name: 'MonRush',
    tag: '3D highway · dodge cows, UFOs & giant sausages',
    accent: '#34d399',
    badge: 'REFLEX',
    thumb: thumbRush,
    Component: MonRush,
    skinGroup: 'chick',
  },
  {
    id: 'swat',
    name: 'MonSwat',
    tag: 'One angry fly · 5 misses max · BONK!',
    accent: '#facc15',
    badge: 'SPEED',
    thumb: thumbSwat,
    Component: MonSwat,
    skinGroup: 'chick',
  },
  {
    id: 'dash',
    name: 'MonDash',
    tag: 'Mario-style platformer · stomp flies · grab MON',
    accent: '#836ef9',
    badge: 'PLATFORMER',
    thumb: thumbDash,
    Component: MonDash,
    skinGroup: 'chick',
  },
]

const defaultSave = () => ({
  best: { chick: 0, stack: 0, rush: 0, swat: 0, dash: 0 },
  owned: { chick: ['classic'], stack: ['mint'] },
  equipped: { chick: 'classic', stack: 'mint' },
  name: '',
})

function loadSave() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null')
    if (!raw) return defaultSave()
    const d = defaultSave()
    return {
      best: { ...d.best, ...raw.best },
      owned: { ...d.owned, ...raw.owned },
      equipped: { ...d.equipped, ...raw.equipped },
      name: typeof raw.name === 'string' ? raw.name : '',
    }
  } catch {
    return defaultSave()
  }
}

function SkinThumb({ groupId, skin }) {
  const ref = useRef(null)
  useEffect(() => {
    const cvs = ref.current
    if (!cvs) return
    const ctx = cvs.getContext('2d')
    let raf = 0
    const render = (now = 0) => {
      ctx.clearRect(0, 0, 56, 56)
      if (groupId === 'chick') {
        drawCat(ctx, 27, 29, 0.86, skin, now / 1000, Math.sin(now / 260) * 0.6, 0)
        raf = requestAnimationFrame(render)
      } else if (groupId === 'stack') {
        drawStackPreview(ctx, skin.hue, 56, 56)
      }
    }
    render()
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [groupId, skin])
  return <canvas ref={ref} width={56} height={56} className="skin-canvas" />
}

export default function App() {
  const [save, setSave] = useState(loadSave)
  const [active, setActive] = useState(null)
  const [wallet, setWallet] = useState({
    mode: 'loading',
    address: '',
    chainId: null,
    isMonadTestnet: false,
    hasProvider: false,
    balanceMon: null,
  })
  const [muted, setMutedState] = useState(false)
  const [toast, setToast] = useState('')
  const [busySkin, setBusySkin] = useState('')
  const [cheers, setCheers] = useState([])
  const [cheerLive, setCheerLive] = useState(false)
  const [cheerAmt, setCheerAmt] = useState(10000) // 0.1 MON
  const [cheerMsg, setCheerMsg] = useState('')
  const [cheerBusy, setCheerBusy] = useState(false)
  const [cup, setCup] = useState(null)
  const [cupTab, setCupTab] = useState('chick')
  const [nameOpen, setNameOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')
  const [nameClaim, setNameClaim] = useState(null)
  const [nameBusy, setNameBusy] = useState(false)
  const [netBusy, setNetBusy] = useState(false)
  const deviceId = useRef(getDeviceId())

  const showToast = useCallback((msg) => {
    setToast(msg)
    setTimeout(() => setToast((m) => (m === msg ? '' : m)), 2800)
  }, [])

  const loadCup = useCallback(async () => {
    try {
      const r = await fetch('/api/cup')
      if (!r.ok) return
      const j = await r.json()
      if (j?.ok) setCup(j)
    } catch {
      /* api offline */
    }
  }, [])

  useEffect(() => {
    let alive = true
    initWallet((nextState) => {
      if (alive) setWallet((prev) => ({ ...prev, ...nextState }))
    }).then((w) => {
      if (alive) setWallet(w)
    })
    loadCup()
    fetch(`/api/name?device=${deviceId.current}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!alive || !j?.ok || !j.claim) return
        setNameClaim(j.claim)
        setSave((prev) => (prev.name === j.claim.name ? prev : { ...prev, name: j.claim.name }))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [loadCup])

  const loadCheers = useCallback(async (fresh = false) => {
    try {
      const r = await fetch(fresh ? '/api/cheer?fresh=1' : '/api/cheer')
      if (!r.ok) return
      const j = await r.json()
      if (j?.ok && Array.isArray(j.cheers)) {
        setCheers(j.cheers)
        setCheerLive(true)
      }
    } catch {
      /* api unavailable */
    }
  }, [])

  useEffect(() => {
    loadCheers(false)
  }, [loadCheers])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(save))
    } catch {
      /* ignore quota */
    }
  }, [save])

  const handleConnectWallet = async () => {
    if (!wallet.connect) return
    setNetBusy(true)
    const res = await wallet.connect()
    setNetBusy(false)
    if (res.ok) {
      await wallet.refresh?.()
      showToast('Monad Testnet wallet connected! ⚡')
    } else if (res.error === 'no-wallet') {
      showToast('No EVM wallet detected (MetaMask / Rabby / Phantom) — using Demo Mode')
    } else {
      showToast(res.error || 'Wallet connection cancelled')
    }
  }

  const handleSwitchNetwork = async () => {
    if (!wallet.switchToMonad) return
    setNetBusy(true)
    const res = await wallet.switchToMonad()
    setNetBusy(false)
    if (res.ok) {
      await wallet.refresh?.()
      showToast('Switched to Monad Testnet (Chain ID 10143)! ⚡')
    } else {
      showToast(res.error || 'Could not switch network in wallet')
    }
  }

  const onScore = useCallback((gameId, score) => {
    setSave((prev) => {
      if (score <= (prev.best[gameId] || 0)) return prev
      return { ...prev, best: { ...prev.best, [gameId]: score } }
    })
  }, [])

  const handleActiveScore = useCallback(
    (s) => {
      if (active) onScore(active, s)
    },
    [active, onScore]
  )

  const submitToCup = useCallback(
    async (gameId, score) => {
      if (wallet.mode !== 'monad' || !wallet.sign) {
        if (wallet.hasProvider && wallet.connect) {
          const c = await wallet.connect()
          if (!c.ok) return { ok: false, error: 'Connect your Monad Testnet wallet first to sign scores' }
        } else {
          return {
            ok: false,
            error: 'Install MetaMask / Rabby on Monad Testnet to sign verified Cup scores',
          }
        }
      }
      if (!NAME_RE.test(save.name || '')) {
        setNameDraft(save.name || '')
        setNameOpen(true)
        return { ok: false, error: 'Claim your player name in the popup, then tap Enter Cup again!' }
      }
      const period = cup?.period?.id || cupPeriodId()
      const msg = `MonHouse Cup | game=${gameId} | period=${period} | score=${score} | name=${save.name} | device=${deviceId.current}`
      const sig = await wallet.sign(msg)
      if (!sig.ok) return { ok: false, error: sig.error || 'Signature cancelled' }
      try {
        const r = await fetch('/api/cup/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            game: gameId,
            period,
            score,
            name: save.name,
            device: deviceId.current,
            address: sig.address || wallet.address,
            message: msg,
            publicKey: sig.publicKey,
            signature: sig.signature,
          }),
        })
        const j = await r.json()
        if (j?.ok) loadCup()
        return j || { ok: false, error: 'submit failed' }
      } catch {
        return { ok: false, error: 'network error' }
      }
    },
    [wallet, cup, save.name, loadCup]
  )

  const toggleMute = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }

  const claimName = async () => {
    const clean = nameDraft.trim()
    if (!NAME_RE.test(clean)) {
      showToast('1–16 chars: letters, numbers, space, . _ -')
      return
    }
    if (nameClaim && nameClaim.name === clean) {
      setNameOpen(false)
      return
    }
    if (wallet.mode !== 'monad' || !wallet.sign) {
      if (wallet.hasProvider && wallet.connect) {
        const c = await wallet.connect()
        if (!c.ok) {
          setSave((prev) => ({ ...prev, name: clean }))
          setNameOpen(false)
          showToast(`Saved locally as ${clean}`)
          return
        }
      } else {
        setSave((prev) => ({ ...prev, name: clean }))
        setNameOpen(false)
        showToast(`Name saved as ${clean} (Demo Mode)`)
        return
      }
    }
    const isChange = !!nameClaim
    setNameBusy(true)
    const msg = `MonHouse Name | name=${clean} | device=${deviceId.current} | ts=${Date.now()}`
    const sig = await wallet.sign(msg)
    if (!sig.ok) {
      setNameBusy(false)
      showToast(sig.error || 'Signature cancelled')
      return
    }
    try {
      const r = await fetch('/api/name/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: clean,
          device: deviceId.current,
          message: msg,
          address: sig.address || wallet.address,
          publicKey: sig.publicKey,
          signature: sig.signature,
        }),
      })
      const j = await r.json()
      setNameBusy(false)
      if (!j?.ok) {
        showToast(j?.error || 'Could not claim name')
        return
      }
      setNameClaim(j.claim)
      setSave((prev) => ({ ...prev, name: j.claim.name }))
      setNameOpen(false)
      sfx.buy()
      showToast(isChange ? `Name changed to ${j.claim.name}!` : `Signed & claimed ${j.claim.name}!`)
    } catch {
      setNameBusy(false)
      showToast('Network error — try again')
    }
  }

  const sendCheer = async () => {
    if (cheerBusy) return
    if (!NAME_RE.test(save.name || '')) {
      setNameDraft(save.name || '')
      setNameOpen(true)
      showToast('Set your player name first to post on the Cheer board!')
      return
    }
    const msg = cheerMsg.trim()
    setCheerBusy(true)
    const res = await wallet.pay({
      value: cheerAmt,
      memo: `MonHouse cheer: ${msg || 'GG!'}`,
      recipient: CHEER_ADDRESS,
    })
    if (!res.ok) {
      setCheerBusy(false)
      showToast(res.error || 'Cheer cancelled')
      return
    }

    const optimistic = {
      id: 'local-' + Date.now(),
      name: save.name,
      message: msg,
      value: cheerAmt,
      txHash: res.txHash,
      ts: Date.now(),
    }
    setCheers((prev) => [optimistic, ...prev])
    setCheerMsg('')
    sfx.win()

    if (res.demo) {
      try {
        await fetch('/api/cheer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: save.name,
            message: msg,
            value: cheerAmt,
            txHash: res.txHash,
            device: deviceId.current,
            ts: optimistic.ts,
          }),
        })
        await loadCheers(true)
      } catch {
        /* local preview */
      }
      setCheerBusy(false)
      showToast(`Demo cheer posted (${fmtMon(cheerAmt)})! Connect Monad wallet for real MON tx`)
      return
    }

    try {
      const r = await fetch('/api/cheer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: save.name,
          message: msg,
          value: cheerAmt,
          txHash: res.txHash,
          device: deviceId.current,
          ts: optimistic.ts,
        }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.ok) {
        showToast(`Thanks for the ${fmtMon(cheerAmt)} cheer on Monad Testnet! ♥`)
        await loadCheers(true)
        wallet.refresh?.()
      } else {
        showToast(`MON sent! (${j?.error || 'board sync pending'})`)
      }
    } catch {
      showToast('MON sent on Monad Testnet!')
    }
    setCheerBusy(false)
  }

  const buyOrEquip = async (groupId, skin) => {
    const owned = save.owned[groupId]?.includes(skin.id)
    if (owned) {
      setSave((prev) => ({
        ...prev,
        equipped: { ...prev.equipped, [groupId]: skin.id },
      }))
      sfx.pop()
      return
    }
    const key = `${groupId}:${skin.id}`
    setBusySkin(key)
    const res = await wallet.pay({
      value: skin.price,
      memo: `MonHouse skin: ${skin.name}`,
    })
    setBusySkin('')
    if (!res.ok) {
      showToast(res.error || 'Payment cancelled')
      return
    }
    sfx.buy()
    setSave((prev) => ({
      ...prev,
      owned: { ...prev.owned, [groupId]: [...(prev.owned[groupId] || []), skin.id] },
      equipped: { ...prev.equipped, [groupId]: skin.id },
    }))
    wallet.refresh?.()
    showToast(
      res.demo
        ? `Unlocked ${skin.name} (Demo Mode)!`
        : `Unlocked ${skin.name} on Monad Testnet! ✨`
    )
  }

  const soundIcon = muted ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  )

  const nameModal = nameOpen && (
    <div className="name-modal" onClick={() => !nameBusy && setNameOpen(false)}>
      <div className="name-card" onClick={(e) => e.stopPropagation()}>
        <div className="name-title">
          {nameClaim ? 'Change your player name' : 'Claim your MonHouse name'}
        </div>
        <p className="name-hint">
          {nameClaim ? (
            <>
              Currently signed as <strong>{nameClaim.name}</strong>. Sign a free EIP-191 message
              with the same Monad wallet to update it (no gas required).
            </>
          ) : (
            <>
              Required before entering the MonHouse Cup or Cheer board. Free EIP-191{' '}
              <code>personal_sign</code> signature — zero gas cost!
            </>
          )}
        </p>
        <input
          className="cheer-input"
          type="text"
          maxLength={16}
          placeholder="e.g. GmonadCat"
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && claimName()}
          disabled={nameBusy}
          autoFocus
        />
        <div className="overlay-actions" style={{ marginTop: 12 }}>
          <button className="btn ghost" onClick={() => setNameOpen(false)} disabled={nameBusy}>
            Cancel
          </button>
          <button className="btn primary" onClick={claimName} disabled={nameBusy}>
            {nameBusy ? 'Signing…' : nameClaim ? 'Sign & Update' : 'Sign & Claim'}
          </button>
        </div>
      </div>
    </div>
  )

  // --- Active Mini-Game Screen ---
  if (active) {
    const game = GAMES.find((g) => g.id === active)
    const { Component } = game
    const best = save.best[game.id] || 0
    const skinId = save.equipped[game.skinGroup]
    const catSkinId = save.equipped.chick || 'classic'
    const myEntry = (cup?.leaders?.[game.id] || []).find((e) => e.device === deviceId.current)?.score
    const closeMs = Date.parse(cup?.pool?.closeAt || '')
    const cupClosed =
      !!cup?.pool?.paused ||
      !!cup?.pool?.closedPeriods?.[cup?.period?.id] ||
      (Number.isFinite(closeMs) && Date.now() >= closeMs)
    const cupProps = {
      myEntry,
      closed: cupClosed,
      paused: !!cup?.pool?.paused,
      onSubmit: (s) => submitToCup(game.id, s),
    }
    return (
      <div className="screen game-screen">
        <header className="topbar game-topbar">
          <button className="icon-btn" onClick={() => setActive(null)} aria-label="Back">
            ← Hub
          </button>
          <div className="topbar-title">
            <img src={catHeroImg} alt="" className="mini-cat-icon" />
            <span>{game.name}</span>
          </div>
          <button className="icon-btn round" onClick={toggleMute} aria-label="Toggle sound">
            {soundIcon}
          </button>
        </header>
        <Component
          best={best}
          skinId={skinId}
          catSkinId={catSkinId}
          onScore={handleActiveScore}
          cup={cupProps}
        />
        {nameModal}
        {toast && <div className="toast">{toast}</div>}
      </div>
    )
  }

  const totalBest = GAMES.reduce((sum, g) => sum + (save.best[g.id] || 0), 0)

  // --- Hub Screen ---
  return (
    <div className="screen hub">
      {/* Top Brand & Monad Wallet Bar */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-avatar">
            <img src={catHeroImg} alt="MonHouse Absurd Cat" className="brand-cat-img" />
          </div>
          <div>
            <div className="brand-name">
              MonHouse <span className="brand-pill">TESTNET</span>
            </div>
            <div className="brand-sub">5 Absurd Cat Skill Games · Monad</div>
          </div>
        </div>
        <div className="topbar-right">
          {wallet.mode === 'monad' ? (
            wallet.isMonadTestnet ? (
              <button
                className="wallet-pill live"
                onClick={() => wallet.refresh?.()}
                title={`${wallet.address} on Monad Testnet (Chain ID 10143)`}
              >
                <span className="dot live" />
                <span>
                  {shortAddr(wallet.address)}
                  {wallet.balanceMon ? ` · ${wallet.balanceMon} MON` : ''}
                </span>
              </button>
            ) : (
              <button
                className="wallet-pill warn"
                onClick={handleSwitchNetwork}
                disabled={netBusy}
                title="Switch wallet to Monad Testnet (Chain ID 10143)"
              >
                <span className="dot warn" />
                <span>{netBusy ? 'Switching…' : 'Switch to Monad (10143)'}</span>
              </button>
            )
          ) : (
            <button
              className="wallet-pill connect"
              onClick={handleConnectWallet}
              disabled={netBusy}
              title="Connect MetaMask, Rabby, or any EVM wallet on Monad Testnet"
            >
              <span className="dot connect" />
              <span>{netBusy ? 'Connecting…' : wallet.hasProvider ? 'Connect Monad' : 'Demo · Connect'}</span>
            </button>
          )}
          <button className="icon-btn round" onClick={toggleMute} aria-label="Toggle sound">
            {soundIcon}
          </button>
        </div>
      </header>

      {/* Monad Testnet Network Strip */}
      <div className="monad-strip">
        <div className="monad-strip-left">
          <span className="monad-diamond">◈</span>
          <span>
            <strong>Monad Testnet</strong> · Chain ID <code>10143</code> · Token <code>MON</code>
          </span>
        </div>
        <div className="monad-strip-actions">
          {wallet.hasProvider && !wallet.isMonadTestnet && (
            <button className="mini-chip-btn" onClick={handleSwitchNetwork} disabled={netBusy}>
              + Add Chain
            </button>
          )}
          <a
            href={MONAD_TESTNET.faucetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mini-chip-link"
          >
            ◈ MON Faucet ↗
          </a>
          <a
            href={MONAD_TESTNET.blockExplorerUrls[0]}
            target="_blank"
            rel="noopener noreferrer"
            className="mini-chip-link"
          >
            Monadscan ↗
          </a>
        </div>
      </div>

      {/* Vibrant Monad Hero Showcase */}
      <section className="hero-banner">
        <div className="hero-copy">
          <div className="hero-kicker">⚡ POWERED BY MONAD TESTNET</div>
          <h1 className="hero-title">
            Absurd Cats. <br />
            <span>Pure Arcade Skill.</span>
          </h1>
          <p className="hero-desc">
            Zero pay-to-win. Pounce, stack, swat, and dash across 5 colorful mini-games, sign
            leaderboard scores with your Monad wallet, and flex rare cat outfits in <strong>MON</strong>.
          </p>
          <div className="hero-actions">
            <button className="hero-play-btn" onClick={() => setActive('chick')}>
              ▶ Play MonCat Now
            </button>
            <button
              className="name-bar"
              onClick={() => {
                setNameDraft(save.name || '')
                setNameOpen(true)
              }}
            >
              <span className="monad-diamond">✦</span>
              {save.name ? (
                <span>
                  <strong>{save.name}</strong>
                  {nameClaim ? ' ✓' : ''} · Edit
                </span>
              ) : (
                <span>Set Player Name</span>
              )}
            </button>
          </div>
        </div>
        <div className="hero-mascot-wrap" onClick={() => setActive('chick')} title="Click to play MonCat!">
          <div className="hero-glow-orb" />
          <img src={catHeroImg} alt="MonHouse Absurd Cat Mascot" className="hero-cat-img" />
          <div className="hero-score-badge">★ Total Best: {totalBest}</div>
        </div>
      </section>

      {nameModal}

      {/* 5 Sharp Colorful Mini-Games Grid */}
      <section className="section">
        <div className="section-head">
          <h2>◈ Choose Your Game</h2>
          <span className="hint">5 Vibrant Arcade Modes · Free to Play</span>
        </div>
        <div className="games">
          {GAMES.map((g) => (
            <button
              key={g.id}
              className="game-card"
              style={{ '--accent': g.accent }}
              onClick={() => setActive(g.id)}
            >
              <div className="game-thumb-wrap">
                <img src={g.thumb} alt={g.name} className="game-thumb" />
                <span className="game-badge">{g.badge}</span>
              </div>
              <div className="game-info">
                <div className="game-name">{g.name}</div>
                <div className="game-tag">{g.tag}</div>
                <div className="game-best">
                  Best Score: <strong>{save.best[g.id] || 0}</strong>
                </div>
              </div>
              <div className="game-play">Play ▶</div>
            </button>
          ))}
        </div>
      </section>

      {/* MonHouse Cup on Monad Testnet */}
      <section className="section">
        <div className="section-head">
          <h2>★ MonHouse Cup · Monad Testnet</h2>
          <span className="hint">
            {cup?.pool?.paused
              ? 'Paused'
              : cup
                ? `${cup.period.id} · ${cup.period.daysLeft}d left · closes ${cup.period.end} ${cup.period.closeUtc} UTC`
                : '5-day epochs · MON prizes'}
          </span>
        </div>
        <div className="cup-card">
          {cup?.pool?.paused ? (
            <div className="cup-banner">
              <div>
                <div className="cup-pool">CUP PAUSED</div>
                <div className="cup-sub">
                  Standings from <strong>{cup?.board?.period || 'last epoch'}</strong> remain live
                  below while the next MON pool is prepared.
                </div>
              </div>
              <div className="cup-split">
                <span>#1 —</span>
                <span>#2 —</span>
                <span>#3 —</span>
              </div>
            </div>
          ) : (
            <div className="cup-banner">
              <div>
                <div className="cup-pool">
                  {(cup?.pool?.perGameMon ?? 5) * GAMES.length} MON Prize Pool
                </div>
                <div className="cup-sub">
                  Free entry · {cup?.pool?.perGameMon ?? 5} MON per game · Top 3 split 50 / 30 / 20%
                  · EIP-191 wallet-signed scores
                </div>
              </div>
              <div className="cup-split">
                <span>#1 · {((cup?.pool?.perGameMon ?? 5) * 0.5).toFixed(1)} MON</span>
                <span>#2 · {((cup?.pool?.perGameMon ?? 5) * 0.3).toFixed(1)} MON</span>
                <span>#3 · {((cup?.pool?.perGameMon ?? 5) * 0.2).toFixed(1)} MON</span>
              </div>
            </div>
          )}

          <div className="cup-tabs">
            {GAMES.map((g) => (
              <button
                key={g.id}
                className={`chip ${cupTab === g.id ? 'active' : ''}`}
                onClick={() => setCupTab(g.id)}
              >
                {g.name.replace('Mon', '')}
              </button>
            ))}
          </div>

          {(() => {
            const rows = cup?.leaders?.[cupTab] || []
            const paid = cup?.payouts?.[cupTab] || {}
            const perGame = cup?.pool?.perGameMon ?? 5
            const prizes = [perGame * 0.5, perGame * 0.3, perGame * 0.2]
            if (!cup) return <div className="cheer-empty">Loading MonHouse Cup standings…</div>
            if (rows.length === 0) {
              return (
                <div className="cheer-empty">
                  No signed scores yet for this game — play a round and tap{' '}
                  <strong>Enter MonHouse Cup</strong> on Game Over!
                </div>
              )
            }
            return (
              <div className="cup-board">
                {rows.map((e, i) => {
                  const rank = i + 1
                  const mine = e.device === deviceId.current
                  const tx = paid[String(rank)]
                  return (
                    <div key={e.device + i} className={`cup-row ${mine ? 'mine' : ''}`}>
                      <span className={`cup-rank r${rank <= 3 ? rank : 0}`}>#{rank}</span>
                      <span className="cup-who">
                        <strong>{e.name}</strong>
                        {e.address && (
                          <a
                            href={explorerAddrUrl(e.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="cup-addr link"
                          >
                            {shortAddr(e.address)} ↗
                          </a>
                        )}
                      </span>
                      <span className="cup-pts">{e.score}</span>
                      {rank <= 3 && (
                        <span className={`cup-prize ${tx ? 'paid' : ''}`}>
                          {tx ? (
                            <a
                              href={explorerTxUrl(tx)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cup-txlink"
                            >
                              paid ✓
                            </a>
                          ) : (
                            `${prizes[i].toFixed(1)} MON`
                          )}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          <div className="cup-foot">
            House Wallet (Monad Testnet):{' '}
            <a
              href={explorerAddrUrl(cup?.pool?.wallet || HOUSE_ADDRESS)}
              target="_blank"
              rel="noopener noreferrer"
              className="cup-txlink"
            >
              <code>{shortAddr(cup?.pool?.wallet || HOUSE_ADDRESS)}</code> ↗
            </a>{' '}
            · Play any game → tap <strong>Enter MonHouse Cup</strong> on Game Over.
          </div>
        </div>
      </section>

      {/* Cosmetic Skins Shop in MON */}
      <section className="section">
        <div className="section-head">
          <h2>✦ Absurd Cat Outfits & Skins</h2>
          <span className="hint">100% Cosmetic · Paid in Testnet MON</span>
        </div>
        {SKIN_GROUPS.map((grp) => (
          <div key={grp.id} className="skin-group">
            <div className="skin-group-label">{grp.label}</div>
            <div className="skins">
              {grp.skins.map((s) => {
                const owned = save.owned[grp.id]?.includes(s.id)
                const equipped = save.equipped[grp.id] === s.id
                const loading = busySkin === `${grp.id}:${s.id}`
                return (
                  <button
                    key={s.id}
                    className={`skin-card ${equipped ? 'equipped' : ''}`}
                    disabled={loading}
                    onClick={() => buyOrEquip(grp.id, s)}
                  >
                    <SkinThumb groupId={grp.id} skin={s} />
                    <div className="skin-name">{s.name}</div>
                    <div className="skin-cta">
                      {loading
                        ? 'Sending MON…'
                        : equipped
                          ? 'Equipped ✓'
                          : owned
                            ? 'Equip'
                            : fmtMon(s.price)}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </section>

      {/* Cheer the House in MON */}
      <section className="section">
        <div className="section-head">
          <h2>♥ Cheer the House</h2>
          <span className="hint">
            {cheerLive ? 'Live on-chain Monad Testnet board' : 'Tip MON & leave a message'}
          </span>
        </div>
        <div className="cheer-card">
          <div className="cheer-amounts">
            {CHEER_AMOUNTS.map((v) => (
              <button
                key={v}
                type="button"
                className={`chip ${cheerAmt === v ? 'active' : ''}`}
                onClick={() => setCheerAmt(v)}
              >
                {fmtMon(v)}
              </button>
            ))}
          </div>
          <div className="cheer-presets">
            {CHEER_PRESETS.map((p) => (
              <button key={p} type="button" className="preset" onClick={() => setCheerMsg(p)}>
                {p}
              </button>
            ))}
          </div>
          <div className="cheer-row">
            <input
              className="cheer-input"
              type="text"
              maxLength={60}
              placeholder="Say gmonad to the players…"
              value={cheerMsg}
              onChange={(e) => setCheerMsg(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendCheer()}
            />
            <button className="btn primary cheer-btn" disabled={cheerBusy} onClick={sendCheer}>
              {cheerBusy ? 'Sending…' : `Cheer ${fmtMon(cheerAmt)}`}
            </button>
          </div>
        </div>

        {cheers.length > 0 && (
          <div className="cheer-wall">
            {cheers.slice(0, 12).map((c) => {
              const isRealTx = c.txHash && String(c.txHash).startsWith('0x') && c.txHash.length >= 42
              return (
                <div key={c.id} className="cheer-item">
                  <span className="cheer-badge">{fmtMon(c.value)}</span>
                  <div className="cheer-body">
                    <div className="cheer-meta">
                      <strong>{c.name}</strong>
                      <span>
                        {timeAgo(c.ts)}
                        {isRealTx && (
                          <>
                            {' · '}
                            <a
                              href={explorerTxUrl(c.txHash)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="cup-txlink"
                            >
                              tx ↗
                            </a>
                          </>
                        )}
                      </span>
                    </div>
                    {c.message && <div className="cheer-msg">{c.message}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <footer className="foot">
        MonHouse · Built on <strong>Monad Testnet (Chain ID 10143)</strong> · Pure skill, cosmetic
        MON skins only ✦
      </footer>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
