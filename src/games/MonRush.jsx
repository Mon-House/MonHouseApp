import { useEffect, useRef, useState } from 'react'
import ScoreOverlay from '../components/ScoreOverlay.jsx'
import { drawCat, drawCloud, drawSun, rr } from '../sketch.js'
import { CAT_SKINS } from '../skins.js'
import { sfx } from '../sound.js'

const W = 360
const H = 560
const HORIZON = 178
const PLAYER_P = 0.93
const RIVAL_SKIN = CAT_SKINS[4] // Neon Magma Cat rival!

const TYPES = ['cow', 'ufo', 'sausage', 'cat', 'cone']

const lerp = (a, b, t) => a + (b - a) * t
const roadHalf = (p) => lerp(16, 150, p)
const laneX = (lane, p) => W / 2 + (lane - 1) * roadHalf(p) * (2 / 3)
const screenY = (p) => lerp(HORIZON + 8, 522, p)
const scaleOf = (p) => lerp(0.18, 1, p)

function drawCow(ctx, x, y, s) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 3, 34, 8, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  rr(ctx, -30, -34, 60, 36, 13)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 2
  rr(ctx, -30, -34, 60, 36, 13)
  ctx.stroke()
  ctx.fillStyle = '#333a45'
  ctx.beginPath()
  ctx.ellipse(-14, -22, 9, 6, 0.3, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(13, -14, 8, 5.5, -0.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#fff'
  rr(ctx, -13, -46, 26, 20, 8)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  rr(ctx, -13, -46, 26, 20, 8)
  ctx.stroke()
  ctx.fillStyle = '#ffb3c1'
  rr(ctx, -9, -34, 18, 9, 4)
  ctx.fill()
  ctx.fillStyle = '#d97a8c'
  ctx.beginPath()
  ctx.arc(-4, -29.5, 1.4, 0, Math.PI * 2)
  ctx.arc(4, -29.5, 1.4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(-6, -41, 2.2, 0, Math.PI * 2)
  ctx.arc(6, -41, 2.2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawUfo(ctx, x, y, s, t) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(0, 4, 30, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  // Tractor beam
  ctx.fillStyle = 'rgba(74, 222, 128, 0.24)'
  ctx.beginPath()
  ctx.moveTo(-8, 0)
  ctx.lineTo(-20, 24)
  ctx.lineTo(20, 24)
  ctx.lineTo(8, 0)
  ctx.closePath()
  ctx.fill()
  const g = ctx.createLinearGradient(0, -14, 0, 0)
  g.addColorStop(0, '#e2e8f0')
  g.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.ellipse(0, -4, 30, 10, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.fillStyle = 'rgba(165, 243, 252, 0.88)'
  ctx.beginPath()
  ctx.arc(0, -10, 11, Math.PI, 0)
  ctx.fill()
  ctx.fillStyle = '#4ade80'
  ctx.beginPath()
  ctx.arc(0, -13, 5, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#10131a'
  ctx.beginPath()
  ctx.arc(-2, -14, 1.1, 0, Math.PI * 2)
  ctx.arc(2, -14, 1.1, 0, Math.PI * 2)
  ctx.fill()
  const cols = ['#fde047', '#f43f5e', '#22d3ee']
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = cols[Math.floor(t * 6 + i) % 3]
    ctx.beginPath()
    ctx.arc(-18 + i * 18, -3, 2.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawBigSausage(ctx, x, y, s) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 4, 36, 7, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#c1613b'
  rr(ctx, -35, -16, 70, 28, 14)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'
  ctx.lineWidth = 2
  rr(ctx, -35, -16, 70, 28, 14)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(90,35,10,0.5)'
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(-22, -12)
  ctx.lineTo(-26, 8)
  ctx.moveTo(22, -12)
  ctx.lineTo(26, 8)
  ctx.stroke()
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  rr(ctx, -28, -12, 56, 6, 3)
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(-8, -2, 4, 0, Math.PI * 2)
  ctx.arc(8, -2, 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#222'
  ctx.beginPath()
  ctx.arc(-8, -2, 1.8, 0, Math.PI * 2)
  ctx.arc(8, -2, 1.8, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#222'
  ctx.lineWidth = 1.8
  ctx.beginPath()
  ctx.arc(0, 5, 3, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

function drawCone(ctx, x, y, s) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.22)'
  ctx.beginPath()
  ctx.ellipse(0, 3, 24, 6, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#f97316'
  ctx.beginPath()
  ctx.moveTo(-13, -6)
  ctx.lineTo(-4, -40)
  ctx.lineTo(4, -40)
  ctx.lineTo(13, -6)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'
  ctx.lineWidth = 1.6
  ctx.stroke()
  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.moveTo(-9.5, -16)
  ctx.lineTo(-7, -27)
  ctx.lineTo(7, -27)
  ctx.lineTo(9.5, -16)
  ctx.closePath()
  ctx.fill()
  ctx.fillStyle = '#f97316'
  rr(ctx, -21, -7, 42, 9, 3)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.32)'
  rr(ctx, -21, -7, 42, 9, 3)
  ctx.stroke()
  ctx.restore()
}

function triPath(ctx, x, yTop, halfW, yBot) {
  ctx.beginPath()
  ctx.moveTo(x, yTop)
  ctx.lineTo(x - halfW, yBot)
  ctx.lineTo(x + halfW, yBot)
  ctx.closePath()
  ctx.fill()
}

function drawTree(ctx, x, y, s, variant) {
  if (s < 0.06) return
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.fillStyle = 'rgba(0,0,0,0.18)'
  ctx.beginPath()
  ctx.ellipse(0, 1, 22, 5.5, 0, 0, Math.PI * 2)
  ctx.fill()
  if (variant === 0) {
    ctx.fillStyle = '#92400e'
    rr(ctx, -4.5, -24, 9, 26, 3)
    ctx.fill()
    ctx.fillStyle = '#22c55e'
    ctx.beginPath()
    ctx.arc(-10, -30, 12, 0, Math.PI * 2)
    ctx.arc(10, -30, 12, 0, Math.PI * 2)
    ctx.arc(0, -40, 14, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,255,255,0.28)'
    ctx.beginPath()
    ctx.arc(-6, -44, 5.5, 0, Math.PI * 2)
    ctx.fill()
  } else {
    ctx.fillStyle = '#78350f'
    rr(ctx, -3.5, -14, 7, 16, 2)
    ctx.fill()
    ctx.fillStyle = '#16a34a'
    triPath(ctx, 0, -46, 15, -22)
    triPath(ctx, 0, -38, 19, -14)
    triPath(ctx, 0, -28, 23, -6)
  }
  ctx.restore()
}

function drawObstacle(ctx, o, t) {
  const p = o.p
  const x = laneX(o.lane, p)
  const y = screenY(p)
  const s = scaleOf(p)
  if (o.type === 'cow') drawCow(ctx, x, y, s)
  else if (o.type === 'ufo') drawUfo(ctx, x, y, s, t)
  else if (o.type === 'sausage') drawBigSausage(ctx, x, y, s)
  else if (o.type === 'cone') drawCone(ctx, x, y, s)
  else if (o.type === 'cat') {
    drawCat(ctx, x, y - 18 * s, 1.18 * s, RIVAL_SKIN, t, t * 10, 0)
    ctx.fillStyle = '#fde047'
    ctx.beginPath()
    ctx.arc(x, y - 50 * s, 8 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'
    ctx.lineWidth = 1.5 * s
    ctx.stroke()
    ctx.fillStyle = '#1e1b4b'
    ctx.font = `900 ${Math.max(8, 12 * s)}px system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText('!', x, y - 46.5 * s)
  }
}

export default function MonRush({ best, onScore, skinId, cup }) {
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

    const makeTree = (p) => ({
      side: Math.random() < 0.5 ? -1 : 1,
      off: 18 + Math.random() * 42,
      p,
      size: 0.8 + Math.random() * 0.6,
      variant: Math.random() < 0.7 ? 0 : 1,
    })

    const reset = () => {
      const trees = []
      for (let i = 0; i < 11; i++) {
        trees.push(makeTree((i / 11) * 1.2 + Math.random() * 0.05))
      }
      stateRef.current = {
        phase: 'idle',
        t: 0,
        lane: 1,
        x: W / 2,
        dist: 0,
        passBonus: 0,
        obstacles: [],
        spawnT: 0,
        spawnI: 0,
        offset: Math.floor(Math.random() * 3),
        rot: 0,
        fallY: 0,
        deadAt: 0,
        shake: 0,
        lastShown: -1,
        trees,
      }
      setScore(0)
      setPhase('idle')
    }
    reset()

    const steer = (dir) => {
      const st = stateRef.current
      if (!st || st.phase === 'over' || st.phase === 'dying') return
      if (st.phase === 'idle') {
        st.phase = 'playing'
        setPhase('playing')
        sfx.pop()
        if (dir !== 0) st.lane = Math.max(0, Math.min(2, st.lane + dir))
        return
      }
      if (st.phase !== 'playing') return
      const nl = Math.max(0, Math.min(2, st.lane + dir))
      if (nl !== st.lane) {
        st.lane = nl
        sfx.pop()
      }
    }

    const crash = (st) => {
      if (st.phase !== 'playing') return
      st.phase = 'dying'
      st.deadAt = st.t
      st.shake = 12
      sfx.hit()
    }

    const finish = (st) => {
      st.phase = 'over'
      const finalScore = Math.floor(st.dist) + st.passBonus
      setScore(finalScore)
      setPhase('over')
      onScoreRef.current?.(finalScore)
    }

    const attach = () => {
      stateRef.current.steer = steer
      stateRef.current.restart = () => {
        reset()
        attach()
      }
    }
    attach()

    const onKey = (e) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
        e.preventDefault()
        steer(-1)
      } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
        e.preventDefault()
        steer(1)
      } else if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault()
        if (stateRef.current?.phase === 'idle') steer(0)
      }
    }
    window.addEventListener('keydown', onKey)

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const st = stateRef.current
      let dt = (now - last) / (1000 / 60)
      last = now
      if (dt > 3) dt = 3
      if (dt < 0) dt = 0
      st.t += dt / 60

      if (st.phase === 'playing') {
        const speed = 0.3 + Math.min(st.dist * 0.004, 0.3)
        st.dist += speed * (dt / 60) * 8

        const target = laneX(st.lane, PLAYER_P)
        st.x += (target - st.x) * Math.min(1, dt * 0.24)

        const gap = Math.max(0.62, 1.0 - st.dist * 0.002)
        st.spawnT += dt / 60
        if (st.spawnT >= gap) {
          st.spawnT = 0
          st.spawnI += 1
          const lane = (st.spawnI + st.offset) % 3
          const type = TYPES[(st.spawnI * 7 + st.offset * 3) % TYPES.length]
          st.obstacles.push({ lane, p: 0.02, type })
          if (st.spawnI % 4 === 0) {
            st.obstacles.push({ lane: (lane + 1) % 3, p: 0.02, type: 'cone' })
          }
        }

        for (const o of st.obstacles) o.p += speed * (dt / 60)
        for (const o of st.obstacles) {
          if (o.p >= PLAYER_P && !o.done) {
            o.done = true
            if (o.lane === st.lane) crash(st)
            else st.passBonus += 5
          }
        }
        st.obstacles = st.obstacles.filter((o) => o.p < 1.15)

        for (const tr of st.trees) {
          tr.p += speed * (dt / 60)
          if (tr.p > 1.2) Object.assign(tr, makeTree(tr.p - 1.2))
        }

        const shown = Math.floor(st.dist) + st.passBonus
        if (shown !== st.lastShown) {
          st.lastShown = shown
          setScore(shown)
        }
      } else if (st.phase === 'dying') {
        st.rot += 0.16 * dt
        st.fallY += (2 + st.fallY * 0.3) * dt
        if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 0.8)
        if (st.t - st.deadAt > 0.75) finish(st)
      }

      // --- Draw 3D Perspective Monad Highway ---
      ctx.save()
      if (st.shake > 0) {
        ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake)
      }

      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON + 14)
      sky.addColorStop(0, '#3b0764')
      sky.addColorStop(0.55, '#7c3aed')
      sky.addColorStop(1, '#f472b6')
      ctx.fillStyle = sky
      ctx.fillRect(-12, -12, W + 24, HORIZON + 28)

      drawSun(ctx, 302, 78, 18)
      drawCloud(ctx, 72 + Math.sin(st.t * 0.5) * 8, 66, 0.78)
      drawCloud(ctx, 236 + Math.sin(st.t * 0.4 + 2) * 8, 114, 0.58)

      // Horizon hills
      ctx.fillStyle = 'rgba(34, 197, 94, 0.72)'
      ctx.beginPath()
      ctx.moveTo(-10, HORIZON + 8)
      for (let x = -10; x <= W + 10; x += 12) {
        ctx.lineTo(x, HORIZON + 8 - Math.abs(Math.sin(x * 0.03)) * 16)
      }
      ctx.lineTo(W + 10, HORIZON + 8)
      ctx.closePath()
      ctx.fill()

      // Lush roadside grass
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(-12, HORIZON + 8, W + 24, H - HORIZON)

      // 3D Vanishing-Point Road
      const P_MAX = 1.25
      ctx.fillStyle = '#1e1b4b'
      ctx.beginPath()
      ctx.moveTo(W / 2 - roadHalf(0), screenY(0))
      ctx.lineTo(W / 2 + roadHalf(0), screenY(0))
      ctx.lineTo(W / 2 + roadHalf(P_MAX), screenY(P_MAX))
      ctx.lineTo(W / 2 - roadHalf(P_MAX), screenY(P_MAX))
      ctx.closePath()
      ctx.fill()

      // Perspective rumble strips + dashed lane lines
      const SEG = 24
      const scroll = (st.phase === 'idle' ? st.t * 1.2 : st.dist * 0.55)
      const off = scroll % 1
      for (let i = 0; i < SEG; i++) {
        const p0 = Math.max(0, (i - off) / SEG)
        const p1 = Math.min(P_MAX, (i + 1 - off) / SEG)
        if (p1 - p0 < 0.002) continue
        const y0 = screenY(p0)
        const y1 = screenY(p1)
        const k = i + Math.floor(scroll)
        ctx.fillStyle = k % 2 === 0 ? '#ec4899' : '#fde047'
        for (const side of [-1, 1]) {
          const in0 = W / 2 + side * roadHalf(p0)
          const in1 = W / 2 + side * roadHalf(p1)
          const w0 = 10 * scaleOf(p0) + 2
          const w1 = 10 * scaleOf(p1) + 2
          const out0 = W / 2 + side * (roadHalf(p0) + w0)
          const out1 = W / 2 + side * (roadHalf(p1) + w1)
          ctx.beginPath()
          ctx.moveTo(in0, y0)
          ctx.lineTo(out0, y0)
          ctx.lineTo(out1, y1)
          ctx.lineTo(in1, y1)
          ctx.closePath()
          ctx.fill()
        }
        if (k % 2 === 0) {
          ctx.fillStyle = 'rgba(221, 214, 254, 0.8)'
          for (const side of [-1, 1]) {
            const c0 = W / 2 + side * (roadHalf(p0) / 3)
            const c1 = W / 2 + side * (roadHalf(p1) / 3)
            const dw0 = 4.2 * scaleOf(p0) + 1
            const dw1 = 4.2 * scaleOf(p1) + 1
            ctx.beginPath()
            ctx.moveTo(c0 - dw0, y0)
            ctx.lineTo(c0 + dw0, y0)
            ctx.lineTo(c1 + dw1, y1)
            ctx.lineTo(c1 - dw1, y1)
            ctx.closePath()
            ctx.fill()
          }
        }
      }

      // Roadside trees sorted far-to-near
      const trees = [...st.trees].sort((a, b) => a.p - b.p)
      for (const tr of trees) {
        const s = scaleOf(tr.p) * tr.size
        const x = W / 2 + tr.side * (roadHalf(tr.p) + 24 + tr.off * (0.4 + 0.6 * tr.p))
        drawTree(ctx, x, screenY(tr.p), s, tr.variant)
      }

      // Obstacles (or idle preview UFO & Cow!)
      if (st.phase === 'idle') {
        drawObstacle(ctx, { lane: 0, p: 0.38, type: 'cow' }, st.t)
        drawObstacle(ctx, { lane: 2, p: 0.52, type: 'ufo' }, st.t)
      } else {
        const obs = [...st.obstacles].sort((a, b) => a.p - b.p)
        for (const o of obs) if (o.p < 1.06) drawObstacle(ctx, o, st.t)
      }

      // Player Absurd Cat!
      const py = 486 + st.fallY
      const bob = st.phase === 'playing' ? Math.sin(st.dist * 1.4) * 2.5 : Math.sin(st.t * 3) * 3
      ctx.fillStyle = 'rgba(0,0,0,0.28)'
      ctx.beginPath()
      ctx.ellipse(st.x, 510, 23, 7, 0, 0, Math.PI * 2)
      ctx.fill()
      drawCat(ctx, st.x, py + bob, 1.24, skinRef.current, st.t, st.t * 12, st.rot)

      // HUD Score + Distance
      if (st.phase !== 'over') {
        ctx.fillStyle = 'rgba(15, 7, 34, 0.76)'
        rr(ctx, 14, 14, 118, 36, 18)
        ctx.fill()
        ctx.font = '900 18px system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = '#fff'
        ctx.fillText(`${Math.floor(st.dist) + st.passBonus}`, 28, 38)

        ctx.fillStyle = 'rgba(15, 7, 34, 0.76)'
        rr(ctx, W - 96, 14, 82, 36, 18)
        ctx.fill()
        ctx.font = '800 14px system-ui, sans-serif'
        ctx.textAlign = 'right'
        ctx.fillStyle = '#fde047'
        ctx.fillText(`${Math.floor(st.dist)}m`, W - 26, 37)
      }

      if (st.phase === 'idle') {
        ctx.fillStyle = 'rgba(20, 9, 46, 0.88)'
        rr(ctx, W / 2 - 134, 340, 268, 54, 16)
        ctx.fill()
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)'
        ctx.lineWidth = 1.4
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillStyle = '#fde047'
        ctx.font = '900 12.5px system-ui, sans-serif'
        ctx.fillText('WEAVE COWS, UFOS & GIANT SAUSAGES!', W / 2, 363)
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 11.5px system-ui, sans-serif'
        ctx.fillText('TAP LEFT / RIGHT (or ◀ ▶) TO CHANGE LANE', W / 2, 382)
      }

      ctx.restore()
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const gesture = useRef(null)
  const onDown = (e) => {
    e.preventDefault()
    gesture.current = { x: e.clientX }
  }
  const onUp = (e) => {
    const g = gesture.current
    gesture.current = null
    const rect = canvasRef.current.getBoundingClientRect()
    const rw = rect.width || 1
    if (g && Math.abs(e.clientX - g.x) > 22) {
      stateRef.current?.steer?.(e.clientX > g.x ? 1 : -1)
    } else {
      const cx = (e.clientX ?? rw / 2) - rect.left
      stateRef.current?.steer?.(cx / rw < 0.5 ? -1 : 1)
    }
  }

  return (
    <div className="stage-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="stage"
        onPointerDown={onDown}
        onPointerUp={onUp}
      />
      {phase === 'over' && (
        <ScoreOverlay
          gameName="MonRush"
          score={score}
          best={Math.max(best, score)}
          onReplay={() => stateRef.current?.restart?.()}
          cup={cup}
        />
      )}
    </div>
  )
}
