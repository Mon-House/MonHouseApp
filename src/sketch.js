/**
 * Shared canvas art helpers for MonHouse — sharp, colorful cartoon & 2.5D style.
 * Features the official MonHouse Absurd Cute Cat sprite (`cat.png`) with
 * pre-baked offscreen skin-tinted canvases (fast 60fps & immune to mobile/Safari
 * ctx.filter quirks), bouncy squash-and-stretch animation, custom accessories,
 * and a full procedural absurd-cat fallback!
 */

import catUrl from './assets/cat.png'

let catSpriteReady = false
const tintedCache = new Map()
const catSprite = typeof Image !== 'undefined' ? new Image() : null
if (catSprite) {
  catSprite.onload = () => {
    catSpriteReady = true
    tintedCache.clear()
  }
  catSprite.src = catUrl
}

export function catSpriteIsReady() {
  return catSpriteReady
}
export const chickSpriteIsReady = catSpriteIsReady

/** hex → hue (0..360) */
function hexHue(hex) {
  const h = (hex || '').replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = ((n >> 16) & 255) / 255
  const g = ((n >> 8) & 255) / 255
  const b = (n & 255) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === min) return 0
  const d = max - min
  let hue
  if (max === r) hue = ((g - b) / d) % 6
  else if (max === g) hue = (b - r) / d + 2
  else hue = (r - g) / d + 4
  return (hue * 60 + 360) % 360
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
    else if (max === g) h = ((b - r) / d + 2) / 6
    else h = ((r - g) / d + 4) / 6
  }
  return [h * 360, s, l]
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360
  if (s === 0) {
    const v = Math.round(l * 255)
    return [v, v, v]
  }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ]
}

/**
 * Returns a pre-baked offscreen canvas (or raw image for classic) for `skin`.
 * Uses direct pixel HSL fur-hue rotation (cached once per skin ID!) so:
 *  1) Eyes, white sclera, pink tongue, and dark outline stay crisp and natural!
 *  2) ZERO `ctx.filter` is ever set on the main gameplay canvas (100% bug-free on
 *     iOS Safari, Android WebView, and Chromium software/GPU pipelines!).
 */
function getTintedCatSource(skin) {
  if (!skin || skin.id === 'classic' || typeof document === 'undefined') {
    return catSprite
  }
  const key = skin.id
  if (tintedCache.has(key)) return tintedCache.get(key)

  try {
    const w = catSprite.naturalWidth || 512
    const h = catSprite.naturalHeight || 512
    const off = document.createElement('canvas')
    off.width = w
    off.height = h
    const octx = off.getContext('2d')
    octx.drawImage(catSprite, 0, 0, w, h)

    const targetHue = hexHue(skin?.colors?.wing || '#ff8c12')
    const hueShift = targetHue - 35 // cat.png orange coat median hue ≈ 35°
    const imgData = octx.getImageData(0, 0, w, h)
    const d = imgData.data
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 12) continue
      const [hue, sat, lig] = rgbToHsl(d[i], d[i + 1], d[i + 2])
      // Rotate warm orange/amber fur pixels (hue 8°..58°, saturated, non-outline)
      // while preserving blue/green heterochromia eyes, white sclera & pink blep tongue!
      if (hue >= 8 && hue <= 58 && sat > 0.25 && lig > 0.16 && lig < 0.88) {
        const [nr, ng, nb] = hslToRgb(hue + hueShift, Math.min(1, sat * 1.08), lig)
        d[i] = nr
        d[i + 1] = ng
        d[i + 2] = nb
      }
    }
    octx.putImageData(imgData, 0, 0)
    tintedCache.set(key, off)
    return off
  } catch {
    return catSprite
  }
}

/**
 * Draw the absurd cute MonHouse cat!
 * Exported as both `drawCat` and `drawChicken` so every game & thumbnail works seamlessly.
 */
export function drawCat(ctx, x, y, s, skin, t = 0, flap = 0, rot = 0) {
  if (catSpriteReady && catSprite && catSprite.naturalWidth > 0 && ctx.drawImage) {
    drawCatSprite(ctx, x, y, s, skin, t, flap, rot)
    return
  }
  drawCatCanvas(ctx, x, y, s, skin, t, flap, rot)
}

export const drawChicken = drawCat

function drawCatSprite(ctx, x, y, s, skin, t, flap, rot) {
  const S = 56 * s
  const src = getTintedCatSource(skin)
  ctx.save()
  ctx.translate(x, y)
  if (rot) ctx.rotate(rot)
  const bounce = Math.sin(flap) * 0.055
  ctx.scale(1 - bounce * 0.45, 1 + bounce)

  ctx.imageSmoothingEnabled = true
  if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high'

  ctx.drawImage(src, -S / 2, -S / 2, S, S)

  // Calibrated landmarks on our 512x512 superhero cat.png sprite
  // (back cyan eye ≈ (-0.04S, +0.05S), front gold eye ≈ (+0.21S, +0.05S)):
  if (skin && skin.accessory === 'helmet') {
    const hx = 0.105 * S
    const hy = 0.03 * S
    ctx.fillStyle = 'rgba(165, 243, 252, 0.34)'
    ctx.beginPath()
    ctx.arc(hx, hy, 0.31 * S, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(131, 110, 249, 0.9)'
    ctx.lineWidth = 2.2 * s
    ctx.stroke()
    ctx.fillStyle = 'rgba(255,255,255,0.68)'
    ctx.beginPath()
    ctx.ellipse(hx - 0.11 * S, hy - 0.14 * S, 0.09 * S, 0.038 * S, -0.55, 0, Math.PI * 2)
    ctx.fill()
  } else if (skin && skin.accessory === 'sunglasses') {
    ctx.fillStyle = '#0f0a1e'
    ctx.strokeStyle = '#c084fc'
    ctx.lineWidth = 1.5 * s
    rr(ctx, -0.095 * S, -0.175 * S, 0.2 * S, 0.145 * S, 0.035 * S)
    ctx.fill()
    ctx.stroke()
    rr(ctx, 0.155 * S, -0.155 * S, 0.155 * S, 0.12 * S, 0.03 * S)
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#c084fc'
    ctx.fillRect(0.105 * S, -0.115 * S, 0.052 * S, 0.022 * S)
    ctx.fillStyle = 'rgba(255,255,255,0.5)'
    ctx.fillRect(-0.065 * S, -0.15 * S, 0.055 * S, 0.02 * S)
    ctx.fillRect(0.18 * S, -0.135 * S, 0.042 * S, 0.018 * S)
  } else if (skin && skin.accessory === 'crown') {
    const cx2 = 0.1 * S
    const cy2 = -0.25 * S
    ctx.fillStyle = '#facc15'
    ctx.beginPath()
    ctx.moveTo(cx2 - 0.11 * S, cy2)
    ctx.lineTo(cx2 - 0.08 * S, cy2 - 0.11 * S)
    ctx.lineTo(cx2 - 0.03 * S, cy2 - 0.045 * S)
    ctx.lineTo(cx2 + 0.015 * S, cy2 - 0.13 * S)
    ctx.lineTo(cx2 + 0.06 * S, cy2 - 0.045 * S)
    ctx.lineTo(cx2 + 0.11 * S, cy2 - 0.11 * S)
    ctx.lineTo(cx2 + 0.12 * S, cy2)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = '#78350f'
    ctx.lineWidth = 1.6 * s
    ctx.stroke()
    ctx.fillStyle = '#836ef9'
    ctx.beginPath()
    ctx.arc(cx2 + 0.015 * S, cy2 - 0.055 * S, 0.022 * S, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/** rounded-rect path (manual — avoids ctx.roundRect compat issues) */
export function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rad, y)
  ctx.lineTo(x + w - rad, y)
  ctx.arcTo(x + w, y, x + w, y + rad, rad)
  ctx.lineTo(x + w, y + h - rad)
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad)
  ctx.lineTo(x + rad, y + h)
  ctx.arcTo(x, y + h, x, y + h - rad, rad)
  ctx.lineTo(x, y + rad)
  ctx.arcTo(x, y, x + rad, y, rad)
  ctx.closePath()
}

/** Crisp vector heart icon (used for lives HUD so no OS emoji font is needed). */
export function drawHeart(ctx, x, y, s, active = true) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.beginPath()
  ctx.moveTo(0, 3.5)
  ctx.bezierCurveTo(-1, 1.5, -8, -1.5, -8, -5.5)
  ctx.bezierCurveTo(-8, -9, -4.5, -10.5, -1.5, -8.5)
  ctx.lineTo(0, -6.8)
  ctx.lineTo(1.5, -8.5)
  ctx.bezierCurveTo(4.5, -10.5, 8, -9, 8, -5.5)
  ctx.bezierCurveTo(8, -1.5, 1, 1.5, 0, 3.5)
  ctx.closePath()
  ctx.fillStyle = active ? '#c084fc' : 'rgba(255,255,255,0.16)'
  ctx.fill()
  ctx.strokeStyle = active ? '#fde047' : 'rgba(255,255,255,0.25)'
  ctx.lineWidth = 1.3
  ctx.stroke()
  ctx.restore()
}

function shade(hex, f) {
  const h = (hex || '#ff9214').replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  const r = Math.min(255, Math.round(((n >> 16) & 255) * f))
  const g = Math.min(255, Math.round(((n >> 8) & 255) * f))
  const b = Math.min(255, Math.round((n & 255) * f))
  return `rgb(${r},${g},${b})`
}

/**
 * Procedural fallback art: Cute Absurd Chubby Cat
 */
function drawCatCanvas(ctx, x, y, s, skin, t = 0, flap = 0, rot = 0) {
  const c = skin?.colors || {
    body: '#ffa424',
    wing: '#ff8c12',
    ears: '#ff6b9d',
    nose: '#ff5c8a',
    mustache: '#5b2a0e',
  }
  const out = '#2b1206'
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rot)
  ctx.lineJoin = 'round'

  ctx.save()
  ctx.translate(-14 * s, 0)
  ctx.rotate(-0.35 + Math.sin(t * 6 + flap * 0.5) * 0.25)
  ctx.fillStyle = c.wing || '#ff8c12'
  rr(ctx, -15 * s, -4 * s, 16 * s, 8 * s, 4 * s)
  ctx.fill()
  ctx.strokeStyle = out
  ctx.lineWidth = 1.8 * s
  ctx.stroke()
  ctx.restore()

  ctx.fillStyle = c.body || '#ffa424'
  ctx.beginPath()
  ctx.ellipse(0, 1 * s, 18 * s, 15 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = out
  ctx.lineWidth = 2 * s
  ctx.stroke()

  ctx.fillStyle = 'rgba(255, 245, 214, 0.78)'
  ctx.beginPath()
  ctx.ellipse(3 * s, 5 * s, 12 * s, 8.5 * s, 0, 0, Math.PI * 2)
  ctx.fill()

  for (const [ex, ey, tilt] of [
    [-4 * s, -11 * s, -0.25],
    [13 * s, -11 * s, 0.22],
  ]) {
    ctx.save()
    ctx.translate(ex, ey)
    ctx.rotate(tilt)
    ctx.fillStyle = c.body || '#ffa424'
    ctx.beginPath()
    ctx.moveTo(-6 * s, 2 * s)
    ctx.lineTo(0, -10 * s)
    ctx.lineTo(6 * s, 2 * s)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = out
    ctx.lineWidth = 1.8 * s
    ctx.stroke()
    ctx.fillStyle = c.ears || '#ff6b9d'
    ctx.beginPath()
    ctx.moveTo(-3.2 * s, 1 * s)
    ctx.lineTo(0, -6.5 * s)
    ctx.lineTo(3.2 * s, 1 * s)
    ctx.closePath()
    ctx.fill()
    ctx.restore()
  }

  const pawOff = Math.sin(flap) * 2.2 * s
  ctx.fillStyle = '#ffe5b4'
  for (const [px, py] of [
    [-2 * s, 11 * s + pawOff],
    [12 * s, 10 * s - pawOff],
  ]) {
    ctx.beginPath()
    ctx.arc(px, py, 4.2 * s, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = out
    ctx.lineWidth = 1.5 * s
    ctx.stroke()
  }

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(3 * s, -4 * s, 6.2 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = out
  ctx.lineWidth = 1.5 * s
  ctx.stroke()
  ctx.fillStyle = '#0ea5e9'
  ctx.beginPath()
  ctx.arc(3.6 * s, -4 * s, 3.8 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(3.8 * s, -4 * s, 2.2 * s, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fff'
  ctx.beginPath()
  ctx.arc(13.5 * s, -3.5 * s, 4.6 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = out
  ctx.lineWidth = 1.4 * s
  ctx.stroke()
  ctx.fillStyle = '#22c55e'
  ctx.beginPath()
  ctx.arc(13.8 * s, -3.5 * s, 2.7 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#111'
  ctx.beginPath()
  ctx.arc(14 * s, -3.5 * s, 1.6 * s, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#fb7185'
  ctx.beginPath()
  ctx.ellipse(9.2 * s, 5.2 * s, 2.5 * s, 3.3 * s, 0.08, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = c.nose || '#ff5c8a'
  ctx.beginPath()
  ctx.arc(9.2 * s, 0.2 * s, 2 * s, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = c.mustache || '#5b2a0e'
  ctx.lineWidth = 2.4 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(9 * s, 2 * s)
  ctx.quadraticCurveTo(4 * s, 5 * s, 1 * s, 2.2 * s)
  ctx.moveTo(9.4 * s, 2 * s)
  ctx.quadraticCurveTo(14 * s, 5 * s, 16.8 * s, 2.2 * s)
  ctx.stroke()

  ctx.restore()
}

export function drawBlock3D(ctx, x, y, w, hue, h = 26, squash = 0) {
  const hh = h * (1 - 0.2 * squash)
  const yTop = y + (h - hh)
  const d = 7
  const top = `hsl(${hue}, 82%, 72%)`
  const front = `hsl(${hue}, 76%, 56%)`
  const side = `hsl(${hue}, 68%, 38%)`

  ctx.fillStyle = top
  ctx.beginPath()
  ctx.moveTo(x, yTop)
  ctx.lineTo(x + d, yTop - d)
  ctx.lineTo(x + w + d, yTop - d)
  ctx.lineTo(x + w, yTop)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.2)'
  ctx.lineWidth = 1
  ctx.stroke()

  ctx.fillStyle = side
  ctx.beginPath()
  ctx.moveTo(x + w, yTop)
  ctx.lineTo(x + w + d, yTop - d)
  ctx.lineTo(x + w + d, yTop - d + hh)
  ctx.lineTo(x + w, yTop + hh)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = front
  ctx.fillRect(x, yTop, w, hh)
  ctx.fillStyle = 'rgba(255,255,255,0.34)'
  ctx.fillRect(x, yTop, w, 3.5)
  ctx.fillStyle = 'rgba(0,0,0,0.14)'
  ctx.fillRect(x, yTop + hh - 4, w, 4)
  ctx.strokeStyle = 'rgba(0,0,0,0.24)'
  ctx.lineWidth = 1
  ctx.strokeRect(x + 0.5, yTop + 0.5, w - 1, hh - 1)
}

export function drawFly(ctx, x, y, s, t, angry = false) {
  ctx.save()
  ctx.translate(x, y)
  const flap = Math.sin(t * 45) * 0.5
  ctx.fillStyle = 'rgba(224, 242, 254, 0.85)'
  for (const d of [-1, 1]) {
    ctx.save()
    ctx.translate(d * 4 * s, -3 * s)
    ctx.rotate(d * (0.7 + flap))
    ctx.beginPath()
    ctx.ellipse(d * 6 * s, -4 * s, 8 * s, 4.4 * s, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  const g = ctx.createRadialGradient(-2 * s, -2 * s, 1, 0, 0, 8 * s)
  g.addColorStop(0, '#6d28d9')
  g.addColorStop(1, '#1e1b4b')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(0, 0, 7.5 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.45)'
  ctx.lineWidth = 1.2 * s
  ctx.stroke()
  ctx.fillStyle = '#f43f5e'
  rr(ctx, -6.2 * s, -3.4 * s, 5.4 * s, 3.8 * s, 1.4 * s)
  ctx.fill()
  rr(ctx, 0.8 * s, -3.4 * s, 5.4 * s, 3.8 * s, 1.4 * s)
  ctx.fill()
  ctx.fillRect(-1.4 * s, -2.4 * s, 2.8 * s, 1.1 * s)
  ctx.strokeStyle = '#10131a'
  ctx.lineWidth = 1.3 * s
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(-4 * s, 2.6 * s)
  ctx.quadraticCurveTo(-6.6 * s, 1.6 * s, -8.2 * s, 3 * s)
  ctx.moveTo(4 * s, 2.6 * s)
  ctx.quadraticCurveTo(6.6 * s, 1.6 * s, 8.2 * s, 3 * s)
  ctx.stroke()
  if (angry) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 1.5 * s
    ctx.beginPath()
    ctx.moveTo(-6.4 * s, -6.4 * s)
    ctx.lineTo(-2 * s, -4.8 * s)
    ctx.moveTo(6.4 * s, -6.4 * s)
    ctx.lineTo(2 * s, -4.8 * s)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawSwatter(ctx, x, y, s, angle = -0.5) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(s, s)
  ctx.strokeStyle = '#836ef9'
  ctx.lineWidth = 5
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(4, 16)
  ctx.lineTo(16, 38)
  ctx.stroke()
  ctx.fillStyle = '#ec4899'
  rr(ctx, -26, -28, 52, 46, 11)
  ctx.fill()
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = 2.5
  rr(ctx, -26, -28, 52, 46, 11)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(255,255,255,0.65)'
  ctx.lineWidth = 1.2
  for (let i = 0; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(-20 + i * 12, -23)
    ctx.lineTo(-20 + i * 12, 13)
    ctx.stroke()
  }
  for (let i = 0; i < 3; i++) {
    ctx.beginPath()
    ctx.moveTo(-22, -19 + i * 11)
    ctx.lineTo(22, -19 + i * 11)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawStackPreview(ctx, hue, w, h) {
  ctx.clearRect(0, 0, w, h)
  const baseY = h - 8
  const blocks = [
    { x: (w - 40) / 2, w: 40 },
    { x: (w - 34) / 2, w: 34 },
    { x: (w - 28) / 2 + 3, w: 28 },
  ]
  blocks.forEach((b, i) => {
    drawBlock3D(ctx, b.x, baseY - (i + 1) * 12, b.w, hue + i * 7, 12, 0)
  })
  drawBlock3D(ctx, (w - 24) / 2 + 12, baseY - 4 * 12 - 6, 24, hue + 24, 12, 0)
}

export function drawSun(ctx, x, y, r) {
  ctx.save()
  ctx.strokeStyle = '#fbbf24'
  ctx.lineWidth = r * 0.22
  ctx.lineCap = 'round'
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4
    ctx.beginPath()
    ctx.moveTo(x + Math.cos(a) * (r + r * 0.22), y + Math.sin(a) * (r + r * 0.22))
    ctx.lineTo(x + Math.cos(a) * (r + r * 0.5), y + Math.sin(a) * (r + r * 0.5))
    ctx.stroke()
  }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r)
  g.addColorStop(0, '#fef08a')
  g.addColorStop(1, '#f59e0b')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = '#b45309'
  ctx.lineWidth = r * 0.13
  ctx.beginPath()
  ctx.arc(x - r * 0.32, y - r * 0.08, r * 0.18, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x + r * 0.32, y - r * 0.08, r * 0.18, Math.PI * 1.1, Math.PI * 1.9)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(x, y + r * 0.15, r * 0.34, Math.PI * 0.15, Math.PI * 0.85)
  ctx.stroke()
  ctx.restore()
}

export function drawCloud(ctx, x, y, s) {
  ctx.save()
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2)
  ctx.arc(x + 16 * s, y + 3 * s, 11 * s, 0, Math.PI * 2)
  ctx.arc(x - 15 * s, y + 4 * s, 10 * s, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(167, 139, 250, 0.38)'
  ctx.beginPath()
  ctx.ellipse(x, y + 9 * s, 22 * s, 5 * s, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}
