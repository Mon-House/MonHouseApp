/**
 * Playful WebAudio sound effects for MonHouse — no external audio assets needed.
 */
let ctx = null
let muted = false

export const setMuted = (m) => {
  muted = m
}
export const isMuted = () => muted

function audio() {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.05, slideTo = 0) {
  if (muted) return
  const c = audio()
  if (!c) return
  try {
    const o = c.createOscillator()
    const g = c.createGain()
    o.type = type
    o.frequency.value = freq
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), c.currentTime + dur)
    g.gain.value = vol
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur)
    o.connect(g)
    g.connect(c.destination)
    o.start()
    o.stop(c.currentTime + dur + 0.03)
  } catch {
    /* audio is decorative — never break gameplay */
  }
}

export const sfx = {
  // Cute upbeat cat-pounce / meow-boing chirp!
  flap: () => beep(560, 0.085, 'triangle', 0.06, 880),
  score: () => {
    beep(700, 0.06, 'sine', 0.055)
    setTimeout(() => beep(988, 0.09, 'sine', 0.055), 65)
  },
  hit: () => beep(165, 0.28, 'sawtooth', 0.06, 55),
  drop: () => beep(340, 0.08, 'triangle', 0.05, 190),
  thud: () => beep(220, 0.1, 'triangle', 0.05, 120),
  pop: () => beep(940, 0.05, 'sine', 0.048),
  win: () => {
    beep(587, 0.09, 'sine', 0.055)
    setTimeout(() => beep(740, 0.09, 'sine', 0.055), 95)
    setTimeout(() => beep(880, 0.16, 'sine', 0.055), 190)
  },
  buy: () => {
    beep(740, 0.07, 'sine', 0.055)
    setTimeout(() => beep(1110, 0.11, 'sine', 0.055), 85)
  },
}
