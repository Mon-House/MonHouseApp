import { useEffect, useRef, useState } from 'react'
import ScoreOverlay from '../components/ScoreOverlay.jsx'
import { drawCat, drawCloud, drawFly, drawHeart, drawSun, rr } from '../sketch.js'
import { CAT_SKINS } from '../skins.js'
import { sfx } from '../sound.js'

const W = 360
const H = 560
const CAT_X = 80
const HW = 13 // hitbox half-width
const HH = 12 // hitbox half-height
const GROUND_Y = 442
const G = 0.5
const JUMP_V = -11
const FLAP_V = -8
const BASE_SPEED = 3.6
const MAX_BONUS = 2.4
const SEED = 7

function mulberry32(a) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** Mario-Bros-style riveted arcade block! */
function drawBlockUnit(ctx, x, y, w, h) {
  const g = ctx.createLinearGradient(x, y, x, y + h)
  g.addColorStop(0, '#f59e0b')
  g.addColorStop(1, '#d97706')
  ctx.fillStyle = g
  rr(ctx, x, y, w, h, 5)
  ctx.fill()
  ctx.strokeStyle = 'rgba(92, 45, 8, 0.72)'
  ctx.lineWidth = 2
  rr(ctx, x + 1.5, y + 1.5, w - 3, h - 3, 3.5)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255, 255, 255, 0.38)'
  ctx.fillRect(x + 4, y + 3, w - 8, 3)
  // Corner rivets
  ctx.fillStyle = 'rgba(92, 45, 8, 0.6)'
  ctx.fillRect(x + 5, y + 5, 3, 3)
  ctx.fillRect(x + w - 8, y + 5, 3, 3)
  ctx.fillRect(x + 5, y + h - 8, 3, 3)
  ctx.fillRect(x + w - 8, y + h - 8, 3, 3)
}

/** Spinning Monad MON coin! */
function drawMonCoin(ctx, x, y, f) {
  ctx.save()
  ctx.translate(x, y)
  const sq = 0.78 + 0.22 * Math.abs(Math.sin(f * 0.09 + x * 0.05))
  ctx.scale(sq, 1)
  const g = ctx.createRadialGradient(-3, -3, 1, 0, 0, 10)
  g.addColorStop(0, '#ede9fe')
  g.addColorStop(0.5, '#836ef9')
  g.addColorStop(1, '#4c1d95')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 9.5, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#fde047'
  ctx.lineWidth = 1.8
  ctx.stroke()
  // Monad diamond emblem
  ctx.fillStyle = '#fde047'
  ctx.beginPath()
  ctx.moveTo(0, -5)
  ctx.lineTo(5, 0)
  ctx.lineTo(0, 5)
  ctx.lineTo(-5, 0)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

export default function MonDash({ best, onScore, skinId, cup }) {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const skin = CAT_SKINS.find((s) => s.id === skinId) || CAT_SKINS[0]

  const skinRef = useRef(skin)
  skinRef.current = skin
  const onScoreRef = useRef(onScore)
  onScoreRef.current = onScore
  const stateRef = useRef(null)

  useEffect(() => {
    const cvs = canvasRef.current
    const ctx = cvs.getContext('2d')
    let raf = 0
    let last = performance.now()

    const genSegment = (st, prevX) => {
      const r = st.rng
      let gap = 0
      // Calm opening stretch — no pits for the first ~600px
      if (prevX > 600 && r() < 0.5) gap = 58 + r() * (38 + Math.min(56, st.dist / 42))
      // Every pit is followed by a generous landing runway
      const segW = gap > 0 ? 200 + r() * 130 : 150 + r() * 180
      const x0 = prevX + gap
      const x1 = x0 + segW
      st.segs.push({ x0, x1 })

      // Coin arc curving over the pit!
      if (gap > 0) {
        const g0 = x0 - gap
        for (let i = 0; i < 5; i++) {
          const k = i / 4
          st.objects.push({
            type: 'coin',
            x: g0 + gap * k,
            y: GROUND_Y - 40 - Math.sin(k * Math.PI) * 62,
            taken: false,
          })
        }
      }

      // Mario-style blocks, tall blocks, stompable flies & coin rows
      if (x0 > 460 && gap === 0) {
        let n = segW > 230 ? (r() < 0.6 ? 2 : 1) : r() < 0.5 ? 1 : 0
        let tries = 0
        while (n > 0 && tries < 10) {
          tries++
          const type = r() < 0.42 ? 'fly' : r() < 0.5 ? 'block' : 'tall'
          const ox = x0 + 60 + r() * (segW - 120)
          if (st.objects.every((o) => o.type === 'coin' || Math.abs(o.x - ox) > 130)) {
            if (type === 'fly') {
              st.objects.push({
                type: 'fly',
                x: ox,
                y: GROUND_Y - 42,
                w: 26,
                h: 20,
                bob: r() * 6.28,
                squished: 0,
              })
            } else if (type === 'block') {
              st.objects.push({ type: 'block', x: ox, y: GROUND_Y - 34, w: 34, h: 34 })
            } else {
              st.objects.push({ type: 'tall', x: ox, y: GROUND_Y - 66, w: 34, h: 66 })
            }
            n--
          }
        }
        if (segW > 200 && r() < 0.7) {
          const sx = x0 + 70 + r() * (segW - 160)
          for (let i = 0; i < 4; i++) {
            st.objects.push({ type: 'coin', x: sx + i * 26, y: GROUND_Y - 64, taken: false })
          }
        }
      }
      return x1
    }

    const ensureWorld = (st) => {
      let guard = 0
      while (st.genX < st.dist + W + 320 && guard++ < 60) {
        st.genX = genSegment(st, st.genX)
      }
      while (st.segs.length && st.segs[0].x1 < st.dist - 300) st.segs.shift()
      st.objects = st.objects.filter((o) => o.x > st.dist - 120)
    }

    const reset = () => {
      const st = {
        phase: 'idle', // idle | play | dying | over
        f: 0,
        dist: 0,
        speed: BASE_SPEED,
        timeScale: 1,
        catY: GROUND_Y - HH,
        vy: 0,
        onGround: true,
        holding: false,
        flapsUsed: 0,
        rot: 0,
        rotV: 0,
        squashT: 0,
        invuln: 0,
        lives: 3,
        coins: 0,
        stompBonus: 0,
        score: 0,
        lastShown: -1,
        rng: mulberry32(SEED),
        segs: [],
        objects: [],
        genX: 0,
        dieT: 0,
        shakeT: 0,
        shakeMag: 0,
        flashT: 0,
        flashCol: '255,255,255',
        popups: [],
        parts: [],
        goT: 0,
      }
      st.genX = genSegment(st, 0)
      ensureWorld(st)
      stateRef.current = st
      setScore(0)
      setPhase('idle')
    }
    reset()

    const addShake = (st, mag, frames) => {
      st.shakeMag = Math.max(st.shakeMag, mag)
      st.shakeT = Math.max(st.shakeT, frames)
    }
    const addFlash = (st, col, frames) => {
      st.flashCol = col
      st.flashT = Math.max(st.flashT, frames)
    }
    const burst = (st, x, y, col, n, spd) => {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2
        st.parts.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 0.6, life: 26, col })
      }
    }

    const doJump = (st) => {
      if (st.onGround) {
        st.vy = JUMP_V
        st.onGround = false
        st.flapsUsed = 0
        sfx.flap()
        for (let i = 0; i < 6; i++) {
          st.parts.push({
            x: CAT_X - 6,
            y: GROUND_Y - 2,
            vx: -1 - Math.random() * 1.5,
            vy: -Math.random() * 1,
            life: 16,
            col: 'rgba(255,255,255,0.85)',
          })
        }
      } else if (st.flapsUsed === 0) {
        st.vy = FLAP_V
        st.flapsUsed = 1
        sfx.flap()
        burst(st, CAT_X, st.catY + 8, '#e9d5ff', 8, 1.6)
      }
    }

    const respawn = (st) => {
      let target = null
      let guard = 0
      while (!target && guard++ < 50) {
        ensureWorld(st)
        target = st.segs.find((s) => s.x1 > st.dist + CAT_X + 60)
      }
      if (target) st.dist = target.x0 + 46 - CAT_X
      st.catY = GROUND_Y - HH
      st.vy = 0
      st.onGround = true
      st.invuln = 110
      addFlash(st, '255,255,255', 8)
      burst(st, CAT_X, GROUND_Y - 10, '#ffffff', 10, 2)
    }

    const startDying = (st) => {
      st.phase = 'dying'
      st.dieT = 50
      st.timeScale = 0.32
      st.rotV = 0.22
      addShake(st, 7, 30)
      addFlash(st, '244,63,94', 16)
    }

    const loseLife = (st, fell) => {
      st.lives -= 1
      st.invuln = 90
      sfx.hit()
      st.popups.push({
        x: CAT_X,
        y: fell ? 150 : st.catY - 26,
        text: '-1 ♥',
        life: 46,
        col: '#fb7185',
        big: true,
      })
      addFlash(st, '244,63,94', 12)
      addShake(st, 5, 20)
      if (st.lives <= 0) {
        startDying(st)
        return
      }
      if (fell) respawn(st)
    }

    const finish = (st) => {
      st.phase = 'over'
      setPhase('over')
      onScoreRef.current?.(st.score)
      sfx.hit()
    }

    const pressDown = () => {
      const st = stateRef.current
      if (!st || st.phase === 'over' || st.phase === 'dying') return
      if (st.phase === 'idle') {
        st.phase = 'play'
        st.invuln = 45
        st.goT = 46
        setPhase('play')
        sfx.pop()
        return
      }
      st.holding = true
      doJump(st)
    }

    const pressUp = () => {
      if (stateRef.current) stateRef.current.holding = false
    }

    const attach = () => {
      stateRef.current.pressDown = pressDown
      stateRef.current.pressUp = pressUp
      stateRef.current.restart = () => {
        reset()
        attach()
      }
    }
    attach()

    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'Enter') {
        e.preventDefault()
        if (e.type === 'keydown' && !e.repeat) pressDown()
        if (e.type === 'keyup') pressUp()
      }
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('pointerup', pressUp)
    window.addEventListener('pointercancel', pressUp)

    const stepFx = (st, dt) => {
      if (st.shakeT > 0) {
        st.shakeT -= dt
        if (st.shakeT <= 0) st.shakeMag = 0
      }
      if (st.flashT > 0) st.flashT -= dt
      for (const pp of st.popups) {
        pp.y -= 0.55 * dt
        pp.life -= dt
      }
      st.popups = st.popups.filter((pp) => pp.life > 0)
      for (const pt of st.parts) {
        pt.x += pt.vx * dt
        pt.y += pt.vy * dt
        pt.vy += 0.12 * dt
        pt.life -= dt
      }
      st.parts = st.parts.filter((pt) => pt.life > 0)
    }

    const draw = (st) => {
      ctx.save()
      if (st.shakeT > 0) {
        const m = st.shakeMag * (st.shakeT / 20)
        ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m)
      }

      // Vibrant Monad twilight-to-day platformer sky
      const sky = ctx.createLinearGradient(0, 0, 0, H)
      sky.addColorStop(0, '#4c1d95')
      sky.addColorStop(0.55, '#8b5cf6')
      sky.addColorStop(1, '#f5d0fe')
      ctx.fillStyle = sky
      ctx.fillRect(-10, -10, W + 20, H + 20)

      drawSun(ctx, 304, 72, 20)
      for (let i = 0; i < 3; i++) {
        const cx = ((((i * 200 + 40 - st.dist * 0.15) % (W + 160)) + W + 160) % (W + 160)) - 80
        drawCloud(ctx, cx, 62 + i * 42, 0.52 + (i % 2) * 0.2)
      }

      // Parallax city skyline silhouettes with glowing windows
      const farOff = (st.dist * 0.3) % 160
      const farCol0 = Math.floor((st.dist * 0.3 - 160) / 160)
      for (let x = -farOff - 160; x < W + 160; x += 160) {
        const idx = farCol0 + Math.round((x + farOff) / 160)
        const bh = 84 + Math.abs((idx * 53) % 110)
        ctx.fillStyle = 'rgba(46, 16, 101, 0.38)'
        rr(ctx, x + 22, GROUND_Y - bh, 98, bh + 6, 4)
        ctx.fill()
        ctx.fillStyle = 'rgba(253, 224, 71, 0.22)'
        for (let wy = GROUND_Y - bh + 12; wy < GROUND_Y - 14; wy += 18) {
          ctx.fillRect(x + 36, wy, 10, 8)
          ctx.fillRect(x + 62, wy, 10, 8)
          ctx.fillRect(x + 88, wy, 10, 8)
        }
      }

      // Pit abyss shadow below ground line
      const chasm = ctx.createLinearGradient(0, GROUND_Y, 0, H)
      chasm.addColorStop(0, 'rgba(15, 7, 34, 0.25)')
      chasm.addColorStop(1, 'rgba(10, 4, 24, 0.85)')
      ctx.fillStyle = chasm
      ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y)

      // Mario-Bros grassy platform segments
      for (const s of st.segs) {
        const x0 = s.x0 - st.dist
        const x1 = s.x1 - st.dist
        if (x1 < -30 || x0 > W + 30) continue
        // Rich earth
        ctx.fillStyle = '#7c4a21'
        ctx.fillRect(x0, GROUND_Y, x1 - x0, H - GROUND_Y)
        // Side bevels on pit edges
        ctx.fillStyle = '#5c3415'
        ctx.fillRect(x0, GROUND_Y, 4, H - GROUND_Y)
        ctx.fillRect(x1 - 4, GROUND_Y, 4, H - GROUND_Y)
        // Vibrant emerald grass cap
        ctx.fillStyle = '#22c55e'
        ctx.fillRect(x0, GROUND_Y, x1 - x0, 13)
        ctx.fillStyle = 'rgba(255,255,255,0.32)'
        ctx.fillRect(x0, GROUND_Y, x1 - x0, 3)
        // Grass tufts
        ctx.fillStyle = '#16a34a'
        for (let gx = x0 + 8; gx < x1 - 6; gx += 22) ctx.fillRect(gx, GROUND_Y - 3, 6, 5)
        // Dirt brick speckles
        ctx.fillStyle = 'rgba(0,0,0,0.16)'
        for (let gy = GROUND_Y + 26; gy < H - 8; gy += 32) {
          for (let gx = x0 + 12; gx < x1 - 10; gx += 38) ctx.fillRect(gx, gy, 11, 6)
        }
      }

      // Coins, stompable flies, and riveted blocks
      for (const o of st.objects) {
        const sx = o.x - st.dist
        if (sx < -60 || sx > W + 60) continue
        if (o.type === 'coin') {
          if (!o.taken) drawMonCoin(ctx, sx, o.y, st.f)
        } else if (o.type === 'fly') {
          if (o.squished > 0) {
            const k = o.squished / 26
            ctx.save()
            ctx.translate(sx, o.y + 6)
            ctx.scale(1 + (1 - k) * 0.5, k * 0.5 + 0.1)
            ctx.globalAlpha = k
            drawFly(ctx, 0, 0, 1.05, st.f * 0.02, false)
            ctx.restore()
            ctx.globalAlpha = 1
          } else {
            const fy = o.y + Math.sin(st.f * 0.12 + o.bob) * 5
            drawFly(ctx, sx, fy, 1.08, st.f * 0.02, true)
          }
        } else {
          drawBlockUnit(ctx, sx, o.y, o.w, o.h)
        }
      }

      // Sprinting Absurd Cat!
      const blink = st.invuln > 0 && Math.floor(st.f / 4) % 2 === 0
      if (!blink) {
        let sc = 1.02
        if (st.phase === 'dying') sc = 1.02
        else if (st.squashT > 0) sc = 0.84
        else if (st.onGround) sc = 1.02 + Math.sin(st.f * 0.45) * 0.03
        else if (st.vy < -2) sc = 1.12
        const flap = st.onGround ? st.f * 0.45 : 3
        const rot = st.phase === 'dying' ? st.rot : clamp(st.vy * 0.022, -0.3, 0.36)
        drawCat(ctx, CAT_X, st.catY - 3, sc, skinRef.current, st.f / 60, flap, rot)
      }

      // Particles
      for (const pt of st.parts) {
        ctx.fillStyle = pt.col
        ctx.globalAlpha = Math.min(1, pt.life / 16)
        ctx.fillRect(pt.x - 2, pt.y - 2, 4, 4)
      }
      ctx.globalAlpha = 1

      // Score / Stomp / Hit popups
      for (const pp of st.popups) {
        ctx.save()
        ctx.font = pp.big ? '900 18px system-ui, sans-serif' : '900 15px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.globalAlpha = Math.min(1, pp.life / 20)
        ctx.strokeStyle = 'rgba(15, 7, 34, 0.82)'
        ctx.lineWidth = 3.5
        ctx.strokeText(pp.text, pp.x, pp.y)
        ctx.fillStyle = pp.col
        ctx.fillText(pp.text, pp.x, pp.y)
        ctx.restore()
      }

      if (st.flashT > 0) {
        ctx.fillStyle = `rgba(${st.flashCol},${Math.min(0.45, st.flashT / 24)})`
        ctx.fillRect(-8, -8, W + 16, H + 16)
      }
      if (st.phase === 'dying') {
        ctx.fillStyle = 'rgba(15, 7, 34, 0.28)'
        ctx.fillRect(-8, -8, W + 16, H + 16)
      }
      ctx.restore()

      // --- HUD (3 Hearts · Distance m · MON Coins + Score) ---
      if (st.phase !== 'over') {
        // Hearts pill (top-left)
        ctx.fillStyle = 'rgba(15, 7, 34, 0.76)'
        rr(ctx, 10, 10, 78, 30, 15)
        ctx.fill()
        for (let i = 0; i < 3; i++) {
          drawHeart(ctx, 26 + i * 23, 28, 0.95, i < st.lives)
        }

        // Distance badge (top-center)
        const meters = Math.floor(st.dist / 24)
        ctx.fillStyle = 'rgba(91, 33, 182, 0.88)'
        rr(ctx, W / 2 - 44, 10, 88, 30, 15)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.font = '900 13px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(`${meters} m`, W / 2, 29)

        // Coins + Total Score pill (top-right)
        ctx.fillStyle = 'rgba(15, 7, 34, 0.76)'
        rr(ctx, W - 122, 10, 112, 30, 15)
        ctx.fill()
        ctx.textAlign = 'left'
        ctx.font = '800 12px system-ui, sans-serif'
        ctx.fillStyle = '#fde047'
        ctx.fillText(`◈ ${st.coins}`, W - 110, 29)
        ctx.textAlign = 'right'
        ctx.font = '900 14px system-ui, sans-serif'
        ctx.fillStyle = '#fff'
        ctx.fillText(String(st.score), W - 20, 29)
      }

      // GO! banner
      if (st.goT > 0) {
        ctx.save()
        ctx.globalAlpha = Math.min(1, st.goT / 14)
        ctx.fillStyle = 'rgba(20, 9, 46, 0.88)'
        rr(ctx, W / 2 - 58, 210, 116, 44, 14)
        ctx.fill()
        ctx.fillStyle = '#fde047'
        ctx.font = '900 22px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('GO!', W / 2, 240)
        ctx.restore()
      }

      // Idle Instructions Card
      if (st.phase === 'idle') {
        ctx.fillStyle = 'rgba(20, 9, 46, 0.9)'
        rr(ctx, 20, 152, W - 40, 118, 18)
        ctx.fill()
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)'
        ctx.lineWidth = 1.4
        ctx.stroke()

        ctx.textAlign = 'center'
        ctx.fillStyle = '#fde047'
        ctx.font = '900 17px system-ui, sans-serif'
        ctx.fillText('MON DASH · PLATFORMER', W / 2, 180)

        ctx.fillStyle = '#ffffff'
        ctx.font = '700 11.5px system-ui, sans-serif'
        ctx.fillText('TAP / SPACE to jump blocks & pits', W / 2, 203)
        ctx.fillText('TAP again mid-air to DOUBLE JUMP!', W / 2, 221)

        ctx.fillStyle = '#4ade80'
        ctx.font = '800 11px system-ui, sans-serif'
        ctx.fillText('Stomp flies from above = +50 · Grab MON coins (+10)', W / 2, 244)
        ctx.fillStyle = '#c4b5fd'
        ctx.fillText('TAP ANYWHERE TO START', W / 2, 261)
      }
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const st = stateRef.current
      let dt = ((now - last) / (1000 / 60)) * st.timeScale
      last = now
      if (dt > 3) dt = 3
      if (dt < 0) dt = 0
      st.f += dt

      if (st.phase === 'play') {
        st.speed = BASE_SPEED + Math.min(MAX_BONUS, st.f * 0.0016)
        st.dist += st.speed * dt
        if (st.goT > 0) st.goT -= dt
        if (st.invuln > 0) st.invuln -= dt
        ensureWorld(st)

        const wx = st.dist + CAT_X
        let seg = null
        for (const s of st.segs) {
          if (wx >= s.x0 && wx <= s.x1) {
            seg = s
            break
          }
        }
        const groundY = seg ? GROUND_Y : Infinity

        // Variable-height Mario jump physics
        const g = st.holding && st.vy < 0 ? 0.32 : G
        const prevY = st.catY
        st.vy += g * dt
        st.catY += st.vy * dt

        if (st.vy >= 0 && st.catY >= groundY - HH && prevY <= groundY - HH + 20) {
          if (!st.onGround) {
            st.squashT = 6
            for (let i = 0; i < 4; i++) {
              st.parts.push({
                x: CAT_X - 4,
                y: GROUND_Y - 2,
                vx: -0.8 - Math.random(),
                vy: -Math.random() * 0.6,
                life: 14,
                col: 'rgba(255,255,255,0.75)',
              })
            }
          }
          st.catY = groundY - HH
          st.vy = 0
          st.onGround = true
          st.flapsUsed = 0
        }
        if (st.onGround && seg === null) st.onGround = false
        if (st.squashT > 0) st.squashT -= dt

        // Fell into pit
        if (st.catY > H + 40 || (seg !== null && st.catY > GROUND_Y)) {
          loseLife(st, true)
          if (st.phase !== 'play') {
            stepFx(st, dt)
            draw(st)
            return
          }
        }

        // Collisions with coins, flies (stomp!), and blocks
        const cL = CAT_X - HW + 3
        const cR = CAT_X + HW - 3
        const cT = st.catY - HH + 3
        const cB = st.catY + HH - 3
        for (const o of st.objects) {
          const sx = o.x - st.dist
          if (sx < -60 || sx > W + 60) continue
          if (o.type === 'coin') {
            if (!o.taken && Math.abs(sx - CAT_X) < 20 && Math.abs(o.y - st.catY) < 24) {
              o.taken = true
              st.coins += 1
              sfx.pop()
              burst(st, sx, o.y, '#fde047', 6, 1.8)
            }
          } else if (o.type === 'fly') {
            if (o.squished > 0) {
              o.squished -= dt
              continue
            }
            const fy = o.y + Math.sin(st.f * 0.12 + o.bob) * 5
            const oT = fy - o.h / 2 + 3
            const oB = fy + o.h / 2 - 3
            const oL = sx - o.w / 2 + 3
            const oR = sx + o.w / 2 - 3
            if (oL < cR && oR > cL && oT < cB && oB > cT) {
              if (st.vy > 0 && cB - oT < 14) {
                // Mario-style STOMP!
                o.squished = 26
                st.stompBonus += 50
                st.vy = -8
                st.flapsUsed = 0
                sfx.score()
                addFlash(st, '255,255,255', 6)
                addShake(st, 3, 10)
                st.popups.push({ x: sx, y: fy - 20, text: 'STOMP +50', life: 44, col: '#4ade80' })
                burst(st, sx, fy, '#c4b5fd', 9, 2)
              } else if (st.invuln <= 0) {
                loseLife(st, false)
                if (st.phase !== 'play') break
              }
            }
          } else {
            const oL = sx + 4
            const oR = sx + o.w - 4
            const oT = o.y + 4
            const oB = o.y + o.h - 2
            if (oL < cR && oR > cL && oT < cB && oB > cT && st.invuln <= 0) {
              loseLife(st, false)
              if (st.phase !== 'play') break
            }
          }
        }

        st.score = Math.floor(st.dist / 24) + st.coins * 10 + st.stompBonus
      } else if (st.phase === 'dying') {
        st.vy += G * dt
        st.catY += st.vy * dt
        st.rot += st.rotV * dt
        st.dieT -= dt
        if (st.dieT <= 0) finish(st)
      }

      stepFx(st, dt)

      if (st.score !== st.lastShown) {
        st.lastShown = st.score
        setScore(st.score)
      }

      draw(st)
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('pointerup', pressUp)
      window.removeEventListener('pointercancel', pressUp)
    }
  }, [])

  return (
    <div className="stage-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="stage"
        onPointerDown={(e) => {
          e.preventDefault()
          stateRef.current?.pressDown?.()
        }}
      />
      {phase === 'over' && (
        <ScoreOverlay
          gameName="MonDash"
          score={score}
          best={Math.max(best, score)}
          onReplay={() => stateRef.current?.restart?.()}
          cup={cup}
        />
      )}
    </div>
  )
}
