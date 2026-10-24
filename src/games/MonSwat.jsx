import { useEffect, useRef, useState } from 'react'
import ScoreOverlay from '../components/ScoreOverlay.jsx'
import { drawCat, drawCloud, drawFly, drawSun, drawSwatter, rr } from '../sketch.js'
import { CAT_SKINS } from '../skins.js'
import { sfx } from '../sound.js'

const W = 360
const H = 560
const MAX_MISS = 5
const HIT_RADIUS = 46

const BURSTS = ['BONK!', 'WHACK!', 'SQUISH!', 'POW!', 'THWAP!']

function flyPos(t, score) {
  const A = 114 + 22 * Math.sin(t * 0.31)
  const B = 80 + 18 * Math.sin(t * 0.23 + 2)
  const w1 = 1.1 + Math.min(score * 0.035, 1.5)
  const w2 = 1.7 + Math.min(score * 0.03, 1.7)
  return {
    x: 180 + Math.sin(t * w1) * A,
    y: 235 + Math.sin(t * w2 + 1) * B,
  }
}

export default function MonSwat({ best, onScore, skinId, cup }) {
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

    const reset = () => {
      stateRef.current = {
        phase: 'idle', // idle | playing | escaping | over
        t: 0,
        score: 0,
        miss: 0,
        dizzy: 0,
        swats: [], // { x, y, t }
        bursts: [], // { x, y, t, text, small }
        escapeT: 0,
        shake: 0,
      }
      setScore(0)
      setPhase('idle')
    }
    reset()

    const finish = (st) => {
      st.phase = 'over'
      setPhase('over')
      onScoreRef.current?.(st.score)
    }

    const swat = (px, py) => {
      const st = stateRef.current
      if (!st || st.phase === 'over' || st.phase === 'escaping') return
      if (st.phase === 'idle') {
        st.phase = 'playing'
        setPhase('playing')
      }
      if (st.phase !== 'playing' || st.dizzy > 0) return

      st.swats.push({ x: px, y: py, t: 0 })
      const f = flyPos(st.t, st.score)
      const d = Math.hypot(px - f.x, py - f.y)
      if (d <= HIT_RADIUS) {
        st.score += 1
        st.dizzy = 26
        st.shake = 5
        st.bursts.push({
          x: f.x,
          y: f.y,
          t: 0,
          text: BURSTS[st.score % BURSTS.length],
          small: false,
        })
        if (st.score % 5 === 0) sfx.win()
        else sfx.drop()
        setScore(st.score)
      } else {
        st.miss += 1
        st.bursts.push({ x: px, y: py, t: 0, text: 'hehe', small: true })
        sfx.pop()
        if (st.miss >= MAX_MISS) {
          st.phase = 'escaping'
          st.escapeT = 0
          sfx.hit()
        }
      }
    }

    const tapClient = (clientX, clientY) => {
      const rect = cvs.getBoundingClientRect()
      const rw = rect.width || 1
      const rh = rect.height || 1
      const x = (((clientX ?? rw / 2) - rect.left) / rw) * W
      const y = (((clientY ?? rh / 2) - rect.top) / rh) * H
      swat(x, y)
    }

    const attach = () => {
      stateRef.current.tapClient = tapClient
      stateRef.current.restart = () => {
        reset()
        attach()
      }
    }
    attach()

    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault()
        const st = stateRef.current
        if (!st) return
        if (st.phase === 'idle') {
          st.phase = 'playing'
          setPhase('playing')
        } else if (st.phase === 'playing' && st.dizzy <= 0) {
          const f = flyPos(st.t, st.score)
          swat(f.x, f.y)
        }
      }
    }
    window.addEventListener('keydown', onKey)

    const drawBackground = (st) => {
      // Cozy Monad Violet-Lavender Arcade Kitchen Wall
      const wall = ctx.createLinearGradient(0, 0, 0, H)
      wall.addColorStop(0, '#3b1578')
      wall.addColorStop(0.6, '#5b21b6')
      wall.addColorStop(1, '#4c1d95')
      ctx.fillStyle = wall
      ctx.fillRect(-12, -12, W + 24, H + 24)

      // Subtle wallpaper stripes
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
      for (let x = 0; x < W; x += 28) ctx.fillRect(x, 0, 10, H)

      // Sunny Window on left wall
      ctx.fillStyle = '#fde68a'
      rr(ctx, 22, 62, 118, 94, 10)
      ctx.fill()
      ctx.strokeStyle = '#92400e'
      ctx.lineWidth = 4
      rr(ctx, 22, 62, 118, 94, 10)
      ctx.stroke()
      const sky = ctx.createLinearGradient(0, 68, 0, 150)
      sky.addColorStop(0, '#60a5fa')
      sky.addColorStop(1, '#dbeafe')
      ctx.fillStyle = sky
      rr(ctx, 28, 68, 106, 82, 6)
      ctx.fill()
      drawSun(ctx, 108, 92, 12)
      drawCloud(ctx, 60 + Math.sin(st.t * 0.5) * 5, 126, 0.52)
      ctx.strokeStyle = '#92400e'
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(81, 68)
      ctx.lineTo(81, 150)
      ctx.moveTo(28, 109)
      ctx.lineTo(134, 109)
      ctx.stroke()

      // Framed Portrait Painting of our Absurd Cat on right wall!
      ctx.fillStyle = '#b45309'
      rr(ctx, 244, 68, 90, 70, 7)
      ctx.fill()
      ctx.strokeStyle = '#fde047'
      ctx.lineWidth = 2
      rr(ctx, 244, 68, 90, 70, 7)
      ctx.stroke()
      ctx.fillStyle = '#ede9fe'
      rr(ctx, 251, 75, 76, 56, 4)
      ctx.fill()
      drawCat(ctx, 289, 105, 0.72, skinRef.current, st.t, 0.8, 0)

      // 3D Kitchen Counter at bottom
      ctx.fillStyle = '#a855f7'
      ctx.fillRect(-12, 444, W + 24, 15)
      ctx.fillStyle = '#fde047'
      ctx.fillRect(-12, 444, W + 24, 3)
      ctx.fillStyle = '#2e1065'
      ctx.fillRect(-12, 459, W + 24, H - 459 + 24)

      // Steaming Monad Mug on right counter
      ctx.fillStyle = '#22d3ee'
      rr(ctx, 294, 408, 42, 38, 8)
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.35)'
      ctx.lineWidth = 2.2
      rr(ctx, 294, 408, 42, 38, 8)
      ctx.stroke()
      ctx.strokeStyle = '#22d3ee'
      ctx.lineWidth = 5
      ctx.beginPath()
      ctx.arc(339, 427, 9, -Math.PI / 2, Math.PI / 2)
      ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.65)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(308, 402)
      ctx.quadraticCurveTo(304, 392, 310, 384)
      ctx.moveTo(322, 402)
      ctx.quadraticCurveTo(326, 392, 320, 382)
      ctx.stroke()

      // Live cheering Absurd Cat sitting on left side of counter!
      drawCat(ctx, 56, 426, 0.85, skinRef.current, st.t, st.t * 5, 0.04)
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      const st = stateRef.current
      let dt = (now - last) / (1000 / 60)
      last = now
      if (dt > 3) dt = 3
      if (dt < 0) dt = 0
      st.t += dt / 60

      if (st.phase === 'playing') {
        st.dizzy = Math.max(0, st.dizzy - dt)
      }

      for (const s of st.swats) s.t += dt / 11
      st.swats = st.swats.filter((s) => s.t < 1)
      for (const b of st.bursts) b.t += dt
      st.bursts = st.bursts.filter((b) => b.t < 45)
      if (st.shake > 0) st.shake = Math.max(0, st.shake - dt * 0.8)

      if (st.phase === 'escaping') {
        st.escapeT += dt / 60
        if (st.escapeT > 0.95) finish(st)
      }

      ctx.save()
      if (st.shake > 0) {
        ctx.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake)
      }

      drawBackground(st)

      // Weaving Cool Fly
      let f = flyPos(st.t, st.score)
      if (st.phase === 'escaping') {
        const e = Math.min(st.escapeT / 0.9, 1)
        f = { x: f.x + (W + 80 - f.x) * e, y: f.y + (-70 - f.y) * e }
      } else if (st.dizzy > 0) {
        f = { x: f.x + Math.sin(st.t * 30) * 3, y: f.y + Math.cos(st.t * 26) * 3 }
      }

      ctx.fillStyle = 'rgba(0,0,0,0.22)'
      ctx.beginPath()
      ctx.ellipse(f.x + 3, f.y + 10, 10, 3.8, 0, 0, Math.PI * 2)
      ctx.fill()
      drawFly(ctx, f.x, f.y, 1.32, st.t, st.score >= 8 || st.miss >= 3)

      // Slamming Swatter Animation (2.4 -> 1.0)
      for (const s of st.swats) {
        const sc = 2.4 - 1.4 * s.t
        ctx.globalAlpha = 1 - Math.max(0, s.t - 0.7) / 0.3
        drawSwatter(ctx, s.x, s.y - (1 - s.t) * 26, sc, -0.5)
        ctx.globalAlpha = 1
      }

      // BONK! / hehe Bursts
      for (const b of st.bursts) {
        const a = Math.max(0, 1 - b.t / 45)
        ctx.save()
        ctx.globalAlpha = a
        ctx.font = `900 ${b.small ? 15 : 25}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.lineWidth = 4.5
        ctx.lineJoin = 'round'
        ctx.strokeStyle = 'rgba(15, 7, 34, 0.85)'
        const y = b.y - 18 - b.t * 0.6
        ctx.strokeText(b.text, b.x, y)
        ctx.fillStyle = b.small ? '#e9d5ff' : '#fde047'
        ctx.fillText(b.text, b.x, y)
        ctx.restore()
      }

      // HUD Score (top-left) + 5-Fly Miss Tracker with red X crosses (top-right)
      if (st.phase !== 'over') {
        ctx.fillStyle = 'rgba(15, 7, 34, 0.74)'
        rr(ctx, 14, 14, 96, 36, 18)
        ctx.fill()
        drawFly(ctx, 32, 32, 0.75, st.t, false)
        ctx.font = '900 18px system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = '#fff'
        ctx.fillText(String(st.score), 48, 38)

        ctx.fillStyle = 'rgba(15, 7, 34, 0.74)'
        rr(ctx, W - 154, 14, 140, 36, 18)
        ctx.fill()
        for (let i = 0; i < MAX_MISS; i++) {
          const x = W - 30 - i * 25
          const missed = i < st.miss
          ctx.globalAlpha = missed ? 0.35 : 1
          drawFly(ctx, x, 32, 0.55, 0.6, false)
          if (missed) {
            ctx.globalAlpha = 1
            ctx.strokeStyle = '#f43f5e'
            ctx.lineWidth = 2.8
            ctx.beginPath()
            ctx.moveTo(x - 8, 24)
            ctx.lineTo(x + 8, 40)
            ctx.moveTo(x + 8, 24)
            ctx.lineTo(x - 8, 40)
            ctx.stroke()
          }
        }
        ctx.globalAlpha = 1
      }

      if (st.phase === 'idle') {
        ctx.fillStyle = 'rgba(20, 9, 46, 0.88)'
        rr(ctx, 26, 336, W - 52, 62, 16)
        ctx.fill()
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)'
        ctx.lineWidth = 1.4
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillStyle = '#fde047'
        ctx.font = '900 13px system-ui, sans-serif'
        ctx.fillText('ONE ANGRY FLY · FIVE MISSES MAX!', W / 2, 361)
        ctx.fillStyle = '#ffffff'
        ctx.font = '700 11.5px system-ui, sans-serif'
        ctx.fillText('TAP THE FLY TO SWAT · 5 misses = it escapes!', W / 2, 382)
      }

      ctx.restore()
    }

    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
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
          stateRef.current?.tapClient?.(e.clientX, e.clientY)
        }}
      />
      {phase === 'over' && (
        <ScoreOverlay
          gameName="MonSwat"
          score={score}
          best={Math.max(best, score)}
          onReplay={() => stateRef.current?.restart?.()}
          cup={cup}
        />
      )}
    </div>
  )
}
