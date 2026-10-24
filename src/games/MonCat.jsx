import { useEffect, useRef, useState } from 'react'
import ScoreOverlay from '../components/ScoreOverlay.jsx'
import { drawCat, drawCloud, drawSun, rr } from '../sketch.js'
import { CAT_SKINS } from '../skins.js'
import { sfx } from '../sound.js'

const W = 360
const H = 560
const GRAVITY = 1050
const FLAP_V = -345
const PIPE_SPEED = 148
const PIPE_GAP = 144
const PIPE_W = 58
const GROUND_H = 74

export default function MonCat({ best, onScore, skinId, cup }) {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('idle') // idle | play | over
  const [score, setScore] = useState(0)
  const skin = CAT_SKINS.find((s) => s.id === skinId) || CAT_SKINS[0]
  const stateRef = useRef(null)
  const onScoreRef = useRef(onScore)
  onScoreRef.current = onScore

  useEffect(() => {
    const cvs = canvasRef.current
    const ctx = cvs.getContext('2d')
    let raf = 0
    let last = performance.now()

    const reset = () => {
      stateRef.current = {
        phase: 'idle',
        y: H * 0.44,
        vy: 0,
        flap: 0,
        pipes: [],
        spawnT: 0.7,
        score: 0,
        t: 0,
        flash: 0,
        puffs: [],
        pops: [],
      }
      setScore(0)
      setPhase('idle')
    }
    reset()

    const spawnPuffs = (x, y, n, fast = false) => {
      const s = stateRef.current
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2
        const sp = (fast ? 150 : 65) + Math.random() * 95
        s.puffs.push({
          x,
          y,
          vx: Math.cos(a) * sp - (fast ? 0 : 40),
          vy: Math.sin(a) * sp - 30,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 9,
          life: 0.55 + Math.random() * 0.35,
          color: i % 2 === 0 ? skin.colors.ears || '#ff6b9d' : skin.colors.body,
        })
      }
    }

    const doFlap = () => {
      const s = stateRef.current
      if (s.phase === 'over') return
      if (s.phase === 'idle') {
        s.phase = 'play'
        setPhase('play')
      }
      s.vy = FLAP_V
      s.flap = Math.PI
      spawnPuffs(96 - 14, s.y + 6, 4, false)
      sfx.flap()
    }

    const attach = () => {
      stateRef.current.doFlap = doFlap
      stateRef.current.restart = () => {
        reset()
        attach()
      }
    }
    attach()

    const onKey = (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault()
        doFlap()
      }
    }
    window.addEventListener('keydown', onKey)

    const drawPipe = (x, y, w, h, capAtTop) => {
      if (h <= 0) return
      // Vibrant Monad crystal-violet arcade pipe!
      const g = ctx.createLinearGradient(x, 0, x + w, 0)
      g.addColorStop(0, '#c4b5fd')
      g.addColorStop(0.24, '#8b5cf6')
      g.addColorStop(0.68, '#6d28d9')
      g.addColorStop(1, '#3b0764')
      ctx.fillStyle = g
      ctx.fillRect(x, y, w, h)
      // Sharp glossy specular stripe
      ctx.fillStyle = 'rgba(255,255,255,0.34)'
      ctx.fillRect(x + 7, y, 6, h)
      ctx.strokeStyle = '#2e1065'
      ctx.lineWidth = 2.2
      ctx.strokeRect(x + 1, y + 0.5, w - 2, h - 1)

      const capH = 24
      const capY = capAtTop ? y : y + h - capH
      ctx.fillStyle = g
      rr(ctx, x - 5, capY, w + 10, capH, 7)
      ctx.fill()
      ctx.fillStyle = 'rgba(255,255,255,0.36)'
      rr(ctx, x + 2, capY + 3, 9, capH - 6, 3)
      ctx.fill()
      // Gold Monad trim accent
      ctx.fillStyle = '#facc15'
      ctx.fillRect(x - 3, capAtTop ? capY + capH - 4 : capY + 1, w + 6, 3)
      ctx.strokeStyle = '#2e1065'
      ctx.lineWidth = 2.2
      rr(ctx, x - 5, capY, w + 10, capH, 7)
      ctx.stroke()

      // Cute animated pipe face tracking the cat (just like original NimChick!)
      const fy = capAtTop ? capY + capH + 14 : capY - 14
      if ((capAtTop && h > 42) || (!capAtTop && h > 42)) {
        const cxp = x + w / 2
        const look = Math.sin(stateRef.current.t * 1.6) * 0.9
        const dying = stateRef.current.phase === 'over'
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(cxp - 8, fy, 4, 0, Math.PI * 2)
        ctx.arc(cxp + 8, fy, 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#1e1b4b'
        ctx.beginPath()
        ctx.arc(cxp - 8 - 1.2 + look, fy + (dying ? 0 : 0.5), 1.9, 0, Math.PI * 2)
        ctx.arc(cxp + 8 - 1.2 + look, fy + (dying ? 0 : 0.5), 1.9, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#fde047'
        ctx.lineWidth = 1.6
        ctx.lineCap = 'round'
        if (dying) {
          ctx.beginPath()
          ctx.arc(cxp, fy + 8, 2.6, 0, Math.PI * 2)
          ctx.stroke()
        } else {
          ctx.beginPath()
          ctx.arc(cxp, fy + 6.5, 3.4, Math.PI * 0.15, Math.PI * 0.85)
          ctx.stroke()
        }
      }
    }

    const frame = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      const s = stateRef.current
      s.t += dt

      if (s.phase === 'play') {
        s.vy += GRAVITY * dt
        s.y += s.vy * dt
        s.flap = Math.max(0, s.flap - dt * 10)

        s.spawnT -= dt
        if (s.spawnT <= 0) {
          s.spawnT = 1.48
          const margin = 76
          const maxTop = H - GROUND_H - margin - PIPE_GAP
          const top = margin + Math.random() * (maxTop - margin)
          s.pipes.push({ x: W + 12, top, passed: false })
        }

        const cx = 96
        const cr = 13.5
        for (const p of s.pipes) {
          p.x -= PIPE_SPEED * dt
          if (!p.passed && p.x + PIPE_W < cx) {
            p.passed = true
            s.score += 1
            setScore(s.score)
            s.pops.push({ x: cx, y: s.y - 26, v: '+1', life: 0.7 })
            sfx.score()
          }
          if (cx + cr > p.x && cx - cr < p.x + PIPE_W) {
            if (s.y - cr < p.top || s.y + cr > p.top + PIPE_GAP) {
              die()
            }
          }
        }
        s.pipes = s.pipes.filter((p) => p.x > -PIPE_W - 16)

        if (s.y + cr >= H - GROUND_H || s.y - cr <= 4) die()
      } else if (s.phase === 'idle') {
        s.y = H * 0.44 + Math.sin(s.t * 3.4) * 9
        s.flap = (s.t * 7) % (Math.PI * 2)
      }

      function die() {
        if (s.phase === 'over') return
        s.phase = 'over'
        s.flash = 1
        spawnPuffs(96, s.y, 16, true)
        sfx.hit()
        setPhase('over')
        onScoreRef.current?.(s.score)
      }

      for (const f of s.puffs) {
        f.x += f.vx * dt
        f.y += f.vy * dt
        f.vy += 320 * dt
        f.rot += f.vr * dt
        f.life -= dt
      }
      s.puffs = s.puffs.filter((f) => f.life > 0)
      for (const p of s.pops) {
        p.y -= 36 * dt
        p.life -= dt
      }
      s.pops = s.pops.filter((p) => p.life > 0)

      // --- Colorful Vibrant Monad Sky + Lush Arcade World ---
      const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H)
      sky.addColorStop(0, '#4c1d95')
      sky.addColorStop(0.32, '#7c3aed')
      sky.addColorStop(0.68, '#c084fc')
      sky.addColorStop(1, '#fbcfe8')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, W, H)

      drawSun(ctx, W - 62, 68, 28)

      const cloudScroll = s.phase === 'play' ? s.t * 18 : s.t * 7
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 120 - cloudScroll) % (W + 90) + (W + 90)) % (W + 90) - 45
        const cy = 62 + (i % 3) * 44
        drawCloud(ctx, cx, cy, 0.9 + (i % 2) * 0.22)
      }

      // Far vibrant hills
      ctx.fillStyle = '#34d399'
      ctx.beginPath()
      ctx.moveTo(0, H - GROUND_H)
      for (let x = 0; x <= W; x += 16) {
        const off = s.phase === 'play' ? s.t * 24 : 0
        ctx.lineTo(x, H - GROUND_H - 36 - Math.sin((x + off) * 0.02) * 18)
      }
      ctx.lineTo(W, H - GROUND_H)
      ctx.closePath()
      ctx.fill()

      // Near lush emerald hills
      ctx.fillStyle = '#10b981'
      ctx.beginPath()
      ctx.moveTo(0, H - GROUND_H)
      for (let x = 0; x <= W; x += 14) {
        const off = s.phase === 'play' ? s.t * 48 : 0
        ctx.lineTo(x, H - GROUND_H - 16 - Math.cos((x + off) * 0.032) * 11)
      }
      ctx.lineTo(W, H - GROUND_H)
      ctx.closePath()
      ctx.fill()

      // Pipes
      for (const p of s.pipes) {
        drawPipe(p.x, 0, PIPE_W, p.top, false)
        const by = p.top + PIPE_GAP
        drawPipe(p.x, by, PIPE_W, H - GROUND_H - by, true)
      }

      // Ground
      const groundScroll = s.phase === 'play' ? (s.t * PIPE_SPEED) % 28 : 0
      const dirt = ctx.createLinearGradient(0, H - GROUND_H, 0, H)
      dirt.addColorStop(0, '#f59e0b')
      dirt.addColorStop(1, '#b45309')
      ctx.fillStyle = dirt
      ctx.fillRect(0, H - GROUND_H, W, GROUND_H)
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(0, H - GROUND_H, W, 16)
      ctx.fillStyle = '#15803d'
      for (let x = -groundScroll; x < W; x += 28) {
        ctx.beginPath()
        ctx.moveTo(x, H - GROUND_H + 16)
        ctx.lineTo(x + 14, H - GROUND_H + 16)
        ctx.lineTo(x + 7, H - GROUND_H + 6)
        ctx.closePath()
        ctx.fill()
      }
      ctx.strokeStyle = '#1e1b4b'
      ctx.lineWidth = 2.2
      ctx.beginPath()
      ctx.moveTo(0, H - GROUND_H + 1)
      ctx.lineTo(W, H - GROUND_H + 1)
      ctx.stroke()

      // Cute paw / fur puff particles
      for (const f of s.puffs) {
        ctx.save()
        ctx.globalAlpha = Math.max(0, Math.min(1, f.life * 1.6))
        ctx.translate(f.x, f.y)
        ctx.rotate(f.rot)
        ctx.fillStyle = f.color
        ctx.beginPath()
        ctx.arc(0, 0, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(-1.2, -1.2, 1.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // Ground shadow under cat
      const groundDist = Math.max(0, H - GROUND_H - s.y)
      const shScale = Math.max(0.25, 1 - groundDist / 380)
      ctx.fillStyle = 'rgba(30, 16, 65, 0.26)'
      ctx.beginPath()
      ctx.ellipse(96, H - GROUND_H + 5, 18 * shScale, 5 * shScale, 0, 0, Math.PI * 2)
      ctx.fill()

      // Absurd Cute Cat!
      const rot = Math.max(-0.48, Math.min(1.05, s.vy / 460))
      drawCat(ctx, 96, s.y, 1.05, skin, s.t, s.flap, rot)

      // +1 popups
      ctx.font = '900 18px system-ui, sans-serif'
      ctx.textAlign = 'center'
      for (const p of s.pops) {
        ctx.save()
        ctx.globalAlpha = Math.min(1, p.life * 2)
        ctx.lineWidth = 3.5
        ctx.strokeStyle = '#2e1065'
        ctx.strokeText(p.v, p.x, p.y)
        ctx.fillStyle = '#fde047'
        ctx.fillText(p.v, p.x, p.y)
        ctx.restore()
      }

      if (s.phase !== 'over') {
        ctx.font = '900 40px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.lineWidth = 6
        ctx.strokeStyle = 'rgba(30, 16, 65, 0.65)'
        ctx.strokeText(String(s.score), W / 2, 66)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(String(s.score), W / 2, 66)
      }

      if (s.phase === 'idle') {
        ctx.fillStyle = 'rgba(30, 16, 65, 0.78)'
        rr(ctx, W / 2 - 108, H * 0.66 - 21, 216, 40, 20)
        ctx.fill()
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.6)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = '800 14px system-ui, sans-serif'
        ctx.fillText('TAP OR SPACE TO POUNCE! ★', W / 2, H * 0.66 + 4)
      }

      if (s.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${s.flash * 0.65})`
        ctx.fillRect(0, 0, W, H)
        s.flash = Math.max(0, s.flash - dt * 4)
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [skin])

  return (
    <div className="stage-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="stage"
        onPointerDown={() => stateRef.current?.doFlap?.()}
      />
      {phase === 'over' && (
        <ScoreOverlay
          gameName="MonCat"
          score={score}
          best={Math.max(best, score)}
          onReplay={() => stateRef.current?.restart?.()}
          cup={cup}
        />
      )}
    </div>
  )
}
