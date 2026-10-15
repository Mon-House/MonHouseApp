/**
 * Paused-cup leaderboard test — production bundle inside jsdom.
 *
 * Scenario: the house has PAUSED the cup (no prize pool). A player still
 * finishes a run. Assert that:
 *   1. the in-game overlay shows the top-5 device leaderboard + "you" row,
 *   2. the overlay says the cup is paused and offers the leaderboard (not a
 *      prize entry),
 *   3. the hub Cup card shows the LAST cup's final standings with paid ✓ and
 *      explains that the leaderboard stays up without a prize.
 *
 * Usage: node test/paused-lb.mjs   (after: npm run build)
 */
import { JSDOM } from 'jsdom'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
function check(label, cond) {
  console.log(`${cond ? '✅' : '❌'} ${label}`)
  if (!cond) failures++
}

const distDir = path.join(process.cwd(), 'dist')
if (!existsSync(path.join(distDir, 'index.html'))) {
  console.error('Run `npm run build` first.')
  process.exit(1)
}
const html = readFileSync(path.join(distDir, 'index.html'), 'utf8')
const jsHref = [...html.matchAll(/src="(\/assets\/[^"]+\.js)"/g)][0][1]
const jsCode = readFileSync(path.join(distDir, jsHref.slice(1)), 'utf8')

function fakeCtx() {
  const gradient = { addColorStop() {} }
  const target = {}
  return new Proxy(target, {
    get(t, p) {
      if (p === 'createLinearGradient' || p === 'createRadialGradient' || p === 'createPattern') {
        return () => gradient
      }
      if (p === 'measureText') return () => ({ width: 0 })
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) })
      if (!(p in t)) t[p] = () => {}
      return t[p]
    },
    set(t, p, v) {
      t[p] = v
      return true
    },
  })
}

const GAMES = ['chick', 'stack', 'bull', 'rush', 'swat', 'slice', 'dash']
// Last played cup (P6911) standings, as the API returns them while paused.
const leaders = {
  chick: [
    { device: 'd1', name: 'harefe', score: 231 },
    { device: 'd2', name: 'Paulghz', score: 86 },
    { device: 'd3', name: 'sasam', score: 15 },
    { device: 'd4', name: 'nimiqlive', score: 12 },
    { device: 'd5', name: 'StarEyes', score: 9 },
    { device: 'd6', name: 'anita', score: 4 },
  ],
}
for (const g of GAMES) if (!leaders[g]) leaders[g] = leaders.chick.slice(0, 3)
const payouts = {}
for (const g of GAMES) payouts[g] = { 1: 'tx-' + g + '-1', 2: 'tx-' + g + '-2', 3: 'tx-' + g + '-3' }

const CUP = {
  ok: true,
  period: { id: 'P6913', start: '2026-10-15', end: '2026-10-20', closeUtc: '16:59', daysLeft: 5 },
  games: GAMES,
  pool: {
    wallet: 'NQ52 UUPV JEM5 SBRA Y98H S0FP YHCX HUQR H8CJ',
    perGameDailyNim: 300,
    splitPct: [50, 30, 20],
    paused: true,
    closeAt: '2026-10-10T16:59:00.000Z',
    closedPeriods: { P6911: '2026-10-10T16:59:00.000Z' },
    note: 'P6911 paid on-chain; cup paused by the house.',
  },
  leaders,
  payouts,
  board: {
    period: 'P6911',
    isLast: true,
    paid: true,
    note: 'Final standings of P6911 — shown while the cup is paused. The leaderboard stays up whether or not there is a prize.',
  },
}

const dom = new JSDOM(html, {
  url: 'http://localhost:5173/',
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  beforeParse(window) {
    Object.defineProperty(window, 'crypto', { value: globalThis.crypto, configurable: true })
    window.HTMLCanvasElement.prototype.getContext = function () {
      return fakeCtx()
    }
    window.scrollTo = () => {}
    // Stub the cup API: paused cup + last-cup standings.
    window.fetch = async (url) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).includes('/api/cup') ? CUP : { ok: false }),
    })
    // Seed a device board so the in-game top 5 has rows before the run.
    const seeded = [
      { id: 's1', name: 'OldRun A', score: 500, device: 'x', verified: true, ts: 1 },
      { id: 's2', name: 'OldRun B', score: 400, device: 'x', verified: false, ts: 2 },
      { id: 's3', name: 'OldRun C', score: 300, device: 'x', verified: false, ts: 3 },
      { id: 's4', name: 'OldRun D', score: 200, device: 'x', verified: false, ts: 4 },
      { id: 's5', name: 'OldRun E', score: 100, device: 'x', verified: false, ts: 5 },
      { id: 's6', name: 'OldRun F', score: 50, device: 'x', verified: false, ts: 6 },
    ]
    window.localStorage.setItem('nimhouse.lb.chick', JSON.stringify(seeded))
    window.localStorage.setItem('nimhouse.player', 'PausedTester')
  },
})

const { window } = dom
const { document } = window
window.addEventListener('error', (e) => {
  console.log('❌ window error:', e.message)
  failures++
})

window.eval(jsCode)
const allButtons = () => [...document.querySelectorAll('button')]
const text = () => document.body.textContent.replace(/\s+/g, ' ')

await sleep(1500)

// ---------- hub: cup card while paused ----------
check('hub renders', text().includes('NimHouse'))
check('cup card shows PAUSED', text().includes('cup PAUSED'))
check('cup card shows the last cup as final standings', text().includes('P6911 (final)'))
check('cup card shows paid badge', document.querySelectorAll('.cup-medal + .badge, .badge.verified').length > 0)
check('cup card lists more than the old top 3 (top 5 now)', text().includes('StarEyes') && text().includes('9'))
check('board note explains why it is shown', text().includes('Final standings of P6911'))
check('hub promises the leaderboard stays open', text().includes('the leaderboard stays open'))
check('hub leaderboard card says always on', text().includes('always on, prize or no prize'))
check('no prize promise while paused', !text().includes('Top 3 per game get paid on-chain at the end of each cup'))

// ---------- in-game: finish a run while paused ----------
const playButtons = allButtons().filter((b) => b.textContent.trim() === 'Play')
check('play buttons present (7)', playButtons.length === 7)
playButtons[0].dispatchEvent(new window.Event('click', { bubbles: true }))
await sleep(600)
const view = document.querySelector('.gameview')
view.dispatchEvent(new window.Event('pointerdown', { bubbles: true }))
await sleep(450)
await sleep(5000) // let the chicken die → overlay
check('game-over overlay appears', text().includes('Play again'))

check('in-game mini leaderboard rendered', !!document.querySelector('.lb-mini'))
check('mini board titled with the game', text().includes('NimChick · top 5 on this device'))
check('mini board says no prize needed', text().includes('no prize needed — the board never closes'))
const rows = [...document.querySelectorAll('.lb-mini .lb-row')]
check('mini board shows top 5 + this run when it missed the cut', rows.length === 6)
check('missed-the-cut run shows its real rank (7th of 7)', rows[5].querySelector('.lb-rank').textContent === '7')
check('this run is flagged as you', !!document.querySelector('.lb-mini .lb-row.me .lb-you'))
check('old low score dropped off the top 5', !text().includes('OldRun F'))
check('paused overlay hides the cup entry button', !text().includes('Enter the NimHouse Cup'))
check('paused overlay offers the leaderboard button', text().includes('View the leaderboard'))
check('paused overlay states no prize pool', text().includes('no prize pool right now'))
check('rank line still shown', /#\d+ on device board/.test(text()))

// leaderboard button returns to the house (board is on the hub)
const lbBtn = allButtons().find((b) => b.textContent.includes('View the leaderboard'))
lbBtn.dispatchEvent(new window.Event('click', { bubbles: true }))
await sleep(700)
check('leaderboard button returns to the hub', text().includes('NIM shop'))
check('hub leaderboard card lists the run', text().includes('PausedTester'))

console.log(failures === 0 ? '\nPAUSED-LB TEST PASSED' : `\nPAUSED-LB TEST FAILED (${failures} checks)`)
process.exit(failures === 0 ? 0 : 1)
