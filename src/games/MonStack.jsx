import { useEffect, useRef, useState } from 'react'
import ScoreOverlay from '../components/ScoreOverlay.jsx'
import { drawBlock3D, drawCat, drawCloud, rr } from '../sketch.js'
import { CAT_SKINS, STACK_SKINS } from '../skins.js'
import { sfx } from '../sound.js'

const W = 360
const H = 560
const BH = 26
const BASE_W = 170
const TOPY = 408 // screen Y of the tower's top block
const DROPY = 104 // screen Y of the floating block HIGH ABOVE

export default function MonStack({ best, onScore, skinId, catSkinId, cup }) {
  const canvasRef = useRef(null)
  const [phase, setPhase] = useState('idle')
  const [score, setScore] = useState(0)
  const skin = STACK_SKINS.find((s) => s.id === skinId) || STACK_SKINS[0]
  const catSkin = CAT_SKINS.find((s) => s.id === catSkinId) || CAT_SKINS[0]
  const stateRef = useRef(null)
  const onScoreRef = useRef(onScore)
  onScoreRef.current = onScore

  useEffect(() => {
    const cvs = canvasRef.current
    const ctx = cvs.getContext('2d')
    let raf = 0
    let last = performance.now()

    const makeMover = (blocks) => {
      const top = blocks[blocks.length - 1]
      const w = top.w
      const fromLeft = blocks.length % 2 === 1
      return {
        x: fromLeft ? 16 : W - 16 - w,
        w,
        dir: fromLeft ? 1 : -1,
      }
    }

    const reset = () => {
      const blocks = [{ x: (W - BASE_W) / 2, w: BASE_W }]
      stateRef.current = {
        phase: 'idle', // idle | sliding | falling | over
        t: 0,
        blocks,
        cur: makeMover(blocks), // floating block high at DROPY
        fallingBlock: null, // { x, w, y, vy } dropping from DROPY -> TOPY
        debris: [], // { x, y, w, vy, rot, vr, hue }
        particles: [], // { x, y, vx, vy, life, c }
        rings: [], // { x, w, life }
        pops: [], // { x, y, txt, life }
        combo: 0,
        score: 0,
        shake: 0,
        squash: 0,
        scrollLag: 0, // smooth tower scroll offset when new block lands
        stars: Array.from({ length: 26 }, () => ({
          x: Math.random() * W,
          y: Math.random() * (H * 0.72),
          r: 0.8 + Math.random() * 1.5,
          p: Math.random() * Math.PI * 2,
        })),
      }
      setScore(0)
      setPhase('idle')
    }
    reset()

    const puff = (s, x, y, color = '#e9d5ff') => {
      for (let i = 0; i < 8; i++) {
        s.particles.push({
          x,
          y,
          vx: (Math.random() - 0.5) * 190,
          vy: -30 - Math.random() * 135,
          life: 0.38 + Math.random() * 0.16,
          c: color,
        })
      }
    }

    const triggerDrop = () => {
      const s = stateRef.current
      if (!s || s.phase === 'over' || s.phase === 'falling' || !s.cur) return
      if (s.phase === 'idle') {
        setPhase('play')
      }
      s.fallingBlock = {
        x: s.cur.x,
        w: s.cur.w,
        y: DROPY,
        vy: 60,
      }
      s.cur = null
      s.phase = 'falling'
      sfx.pop()
    }

    const landBlock = (s) => {
      const d = s.fallingBlock
      s.fallingBlock = null
      const n = s.blocks.length
      const top = s.blocks[n - 1]
      const hue = (skin.hue + n * 7) % 360

      const overlapStart = Math.max(d.x, top.x)
      const overlapEnd = Math.min(d.x + d.w, top.x + top.w)
      const overlap = overlapEnd - overlapStart

      if (overlap <= 8) {
        s.debris.push({
          x: d.x,
          y: TOPY,
          w: d.w,
          vy: 40,
          rot: 0,
          vr: d.x < top.x ? -3.4 : 3.4,
          hue,
        })
        s.shake = 12
        s.phase = 'over'
        sfx.hit()
        setPhase('over')
        onScoreRef.current?.(s.score)
        return
      }

      const diff = Math.abs(d.x - top.x)
      let nw = overlap
      let nx = overlapStart

      if (diff <= 4.5) {
        // Perfect snap!
        nx = top.x
        nw = Math.min(BASE_W, top.w + (s.combo >= 3 ? 6 : 0))
        s.combo += 1
        s.rings.push({ x: nx + nw / 2, w: nw, life: 0.55 })
        s.pops.push({ x: nx + nw / 2, y: TOPY - 14, txt: `PERFECT ×${s.combo}`, life: 0.85 })
        puff(s, nx, TOPY, '#fde047')
        puff(s, nx + nw, TOPY, '#fde047')
        sfx.win()
      } else {
        s.combo = 0
        if (d.x < top.x) {
          s.debris.push({
            x: d.x,
            y: TOPY,
            w: top.x - d.x,
            vy: 20,
            rot: 0,
            vr: -3.0,
            hue,
          })
        } else if (d.x + d.w > top.x + top.w) {
          s.debris.push({
            x: top.x + top.w,
            y: TOPY,
            w: d.x + d.w - (top.x + top.w),
            vy: 20,
            rot: 0,
            vr: 3.0,
            hue,
          })
        }
        puff(s, nx, TOPY)
        puff(s, nx + nw, TOPY)
        sfx.drop()
      }

      s.blocks.push({ x: nx, w: nw })
      s.squash = 1
      s.scrollLag += BH
      const gained = 1 + (s.combo >= 2 ? 1 : 0)
      s.score += gained
      setScore(s.score)

      s.cur = makeMover(s.blocks)
      s.phase = 'sliding'
    }

    const attach = () => {
      stateRef.current.drop = triggerDrop
      stateRef.current.restart = () => {
        reset()
        attach()
      }
    }
    attach()

    const onKey = (e) => {
      if ((e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'ArrowUp') && !e.repeat) {
        e.preventDefault()
        triggerDrop()
      }
    }
    window.addEventListener('keydown', onKey)

    const topScreenY = (i, n, scrollLag) => TOPY + (n - 1 - i) * BH - scrollLag

    const frame = (now) => {
      const dt = Math.min(0.033, Math.max(0.001, (now - last) / 1000))
      last = now
      const s = stateRef.current
      s.t += dt

      // Smoothly settle tower camera scroll
      s.scrollLag *= Math.pow(0.0015, dt)
      if (s.scrollLag < 0.2) s.scrollLag = 0

      // Slide floating block high up at DROPY
      if ((s.phase === 'idle' || s.phase === 'sliding') && s.cur) {
        const speed = 135 + Math.min(s.blocks.length * 4.2, 155)
        s.cur.x += s.cur.dir * speed * dt
        if (s.cur.dir > 0 && s.cur.x >= W - 8 - s.cur.w) {
          s.cur.x = W - 8 - s.cur.w
          s.cur.dir = -1
        } else if (s.cur.dir < 0 && s.cur.x <= 8) {
          s.cur.x = 8
          s.cur.dir = 1
        }
      }

      // Gravity drop from DROPY (104) -> TOPY (408)!
      if (s.phase === 'falling' && s.fallingBlock) {
        s.fallingBlock.vy += 2150 * dt
        s.fallingBlock.y += s.fallingBlock.vy * dt
        const targetY = topScreenY(s.blocks.length - 1, s.blocks.length, s.scrollLag) - BH
        if (s.fallingBlock.y >= targetY) {
          s.fallingBlock.y = targetY
          landBlock(s)
        }
      }

      for (const f of s.debris) {
        f.vy += 1450 * dt
        f.y += f.vy * dt
        f.rot += f.vr * dt
      }
      s.debris = s.debris.filter((f) => f.y < H + 140)

      for (const p of s.particles) {
        p.vy += 460 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
      }
      s.particles = s.particles.filter((p) => p.life > 0)

      for (const r of s.rings) r.life -= dt
      s.rings = s.rings.filter((r) => r.life > 0)

      for (const pop of s.pops) {
        pop.y -= 36 * dt
        pop.life -= dt
      }
      s.pops = s.pops.filter((p) => p.life > 0)

      if (s.shake > 0) s.shake = Math.max(0, s.shake - 34 * dt)
      s.squash *= Math.pow(0.015, dt)
      if (s.squash < 0.02) s.squash = 0

      // --- Draw Vibrant Monad Cosmic Sky ---
      ctx.save()
      if (s.shake > 0) {
        ctx.translate((Math.random() - 0.5) * s.shake, (Math.random() - 0.5) * s.shake)
      }

      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#1e1042')
      bg.addColorStop(0.55, '#4c1d95')
      bg.addColorStop(1, '#9333ea')
      ctx.fillStyle = bg
      ctx.fillRect(-14, -14, W + 28, H + 28)

      for (const st of s.stars) {
        ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.55 * Math.abs(Math.sin(s.t * 2 + st.p))})`
        ctx.beginPath()
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2)
        ctx.fill()
      }
      drawCloud(ctx, 278 + Math.sin(s.t * 0.45) * 8, 76, 0.72)
      drawCloud(ctx, 74 + Math.sin(s.t * 0.35 + 2) * 9, 162, 0.58)

      const n = s.blocks.length
      const baseY = topScreenY(0, n, s.scrollLag)
      const topYNow = topScreenY(n - 1, n, s.scrollLag)

      // Pedestal under base block (scrolls down cleanly as tower grows!)
      if (baseY < H + 80) {
        const px = (W - BASE_W - 44) / 2
        const pw = BASE_W + 44
        ctx.fillStyle = '#2e1065'
        rr(ctx, px, baseY + BH, pw, 96, 10)
        ctx.fill()
        ctx.fillStyle = '#7c3aed'
        rr(ctx, px, baseY + BH, pw, 10, 5)
        ctx.fill()
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.4)'
        ctx.lineWidth = 1.6
        rr(ctx, px, baseY + BH, pw, 96, 10)
        ctx.stroke()
      }

      // Stacked 3D Tower Blocks
      for (let i = 0; i < n; i++) {
        const b = s.blocks[i]
        const by = topScreenY(i, n, s.scrollLag)
        if (by > H + 60) continue
        const isTop = i === n - 1
        drawBlock3D(ctx, b.x, by, b.w, (skin.hue + i * 7) % 360, BH, isTop ? s.squash : 0)
      }

      // Perfect alignment shockwave rings
      for (const r of s.rings) {
        const k = 1 - r.life / 0.55
        ctx.strokeStyle = `rgba(253, 224, 71, ${(1 - k) * 0.95})`
        ctx.lineWidth = 3
        rr(ctx, r.x - r.w / 2 - k * 22, topYNow - k * 8, r.w + k * 44, BH + k * 16, 7)
        ctx.stroke()
      }

      // Dashed vertical drop guide + landing overlap shadow from DROPY down to TOPY!
      if ((s.phase === 'idle' || s.phase === 'sliding') && s.cur) {
        const cx = s.cur.x + s.cur.w / 2
        // Top hover rail / crane cable
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(cx, 0)
        ctx.lineTo(cx, DROPY - 6)
        ctx.stroke()

        // Dashed drop trajectory line
        ctx.strokeStyle = 'rgba(253, 224, 71, 0.48)'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 7])
        ctx.beginPath()
        ctx.moveTo(cx, DROPY + BH + 4)
        ctx.lineTo(cx, topYNow - 6)
        ctx.stroke()
        ctx.setLineDash([])

        // Edge alignment ticks + landing shadow on top block
        const top = s.blocks[n - 1]
        const lo = Math.max(s.cur.x, top.x)
        const hi = Math.min(s.cur.x + s.cur.w, top.x + top.w)
        if (hi > lo) {
          ctx.fillStyle = 'rgba(15, 7, 34, 0.34)'
          ctx.fillRect(lo, topYNow, hi - lo, 5)
        }
      }

      const nextHue = (skin.hue + n * 7) % 360

      // Floating block HIGH UP at DROPY = 104!
      if (s.cur) {
        drawBlock3D(ctx, s.cur.x, DROPY, s.cur.w, nextHue, BH, 0)
      }

      // Falling block dropping with gravity from DROPY -> TOPY!
      if (s.fallingBlock) {
        // Motion trail above falling block
        ctx.fillStyle = 'rgba(196, 181, 253, 0.22)'
        ctx.fillRect(s.fallingBlock.x + 2, Math.max(DROPY, s.fallingBlock.y - 38), s.fallingBlock.w - 4, 38)
        drawBlock3D(ctx, s.fallingBlock.x, s.fallingBlock.y, s.fallingBlock.w, nextHue, BH, 0)
      }

      // Tumbling 3D sliced overhang debris
      for (const f of s.debris) {
        ctx.save()
        ctx.translate(f.x + f.w / 2, f.y + BH / 2)
        ctx.rotate(f.rot)
        drawBlock3D(ctx, -f.w / 2, -BH / 2, f.w, f.hue, BH, 0)
        ctx.restore()
      }

      // Landing puff particles
      for (const p of s.particles) {
        ctx.globalAlpha = Math.max(0, Math.min(1, p.life * 2.4))
        ctx.fillStyle = p.c
        ctx.beginPath()
        ctx.arc(p.x, p.y, 3.3, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1

      // Combo popups
      ctx.textAlign = 'center'
      ctx.font = '900 15px system-ui, sans-serif'
      for (const pop of s.pops) {
        ctx.save()
        ctx.globalAlpha = Math.min(1, pop.life * 2)
        ctx.lineWidth = 3.5
        ctx.strokeStyle = 'rgba(15, 7, 34, 0.8)'
        ctx.strokeText(pop.txt, pop.x, pop.y)
        ctx.fillStyle = '#fde047'
        ctx.fillText(pop.txt, pop.x, pop.y)
        ctx.restore()
      }

      ctx.restore()

      // Adorable Absurd Cat cheering on bottom-left corner!
      if (s.phase !== 'over') {
        const hop = s.squash * 10
        drawCat(ctx, 44, H - 36 - hop, 0.78, catSkin, s.t, s.t * 8, 0.04)
      }

      // HUD Score (top-left, clear of floating block!)
      if (s.phase !== 'over') {
        ctx.fillStyle = 'rgba(15, 7, 34, 0.72)'
        rr(ctx, 14, 14, 92, 36, 18)
        ctx.fill()
        ctx.font = '900 20px system-ui, sans-serif'
        ctx.textAlign = 'left'
        ctx.fillStyle = '#fff'
        ctx.fillText(String(s.score), 30, 39)
        if (s.combo > 1) {
          ctx.fillStyle = '#fde047'
          ctx.font = '800 12px system-ui, sans-serif'
          ctx.textAlign = 'right'
          ctx.fillText(`COMBO ×${s.combo}`, W - 18, 36)
        }
      }

      if (s.phase === 'idle') {
        ctx.fillStyle = 'rgba(30, 16, 65, 0.82)'
        rr(ctx, W / 2 - 126, H * 0.48 - 20, 252, 40, 20)
        ctx.fill()
        ctx.strokeStyle = 'rgba(196, 181, 253, 0.55)'
        ctx.lineWidth = 1.4
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = '800 12.5px system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('TAP / SPACE TO DROP BLOCK', W / 2, H * 0.48 + 5)
      }

      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', onKey)
    }
  }, [skin, catSkin])

  return (
    <div className="stage-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="stage"
        onPointerDown={() => stateRef.current?.drop?.()}
      />
      {phase === 'over' && (
        <ScoreOverlay
          gameName="MonStack"
          score={score}
          best={Math.max(best, score)}
          onReplay={() => stateRef.current?.restart?.()}
          cup={cup}
        />
      )}
    </div>
  )
}
