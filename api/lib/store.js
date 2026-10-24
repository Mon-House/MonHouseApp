/**
 * JSON store for MonHouse (Cup + name claims + cheers) on Monad Mainnet.
 *
 * Dual-mode transparent storage:
 *  - On Vercel with CUP_GITHUB_TOKEN set: reads/writes `data/*.json` via the
 *    GitHub Contents API (auto-detects VERCEL_GIT_REPO_OWNER/VERCEL_GIT_REPO_SLUG
 *    or uses CUP_GITHUB_REPO) so the public repo acts as an auditable ledger.
 *  - Locally / without CUP_GITHUB_TOKEN: reads/writes `data/*.json` directly
 *    from disk (with in-memory cache fallback on read-only serverless fs).
 */
import fs from 'node:fs/promises'
import nodePath from 'node:path'

const CACHE_TTL = 15_000

const SEEDS = {
  'data/cup.json': () => ({
    version: 3,
    pool: {
      totalMon: 600,
      tiersMon: [180, 150, 120, 90, 60],
      splitPct: [30, 25, 20, 15, 10],
      wallet: '0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d',
      network: 'Monad Mainnet (Chain ID 143)',
      closeAt: '2026-10-24T12:45:00.000Z',
      closeLabel: 'Hari ini · 19:45 WIB',
      rule: 'Skor tertinggi lintas semua game',
      autoPayout: true,
      paused: false,
      closedPeriods: {},
      note: 'Free to play on Monad Mainnet. Snapshot pemenang diambil pada closeAt (19:45 WIB). Peringkat dihitung dari skor tertinggi pemain lintas SEMUA game. Top 5 berbagi 600 MON (180 / 150 / 120 / 90 / 60), didistribusikan otomatis oleh wallet MonHouse.',
    },
    entries: {},
    payouts: {},
  }),
  'data/names.json': () => ({ version: 2, names: {} }),
  'data/cheers.json': () => ({ version: 2, cheers: [] }),
}

function repo() {
  if (process.env.CUP_GITHUB_REPO) return process.env.CUP_GITHUB_REPO
  if (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG) {
    return `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
  }
  return 'sasam44/nimhouse'
}

function branch() {
  return process.env.CUP_GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main'
}

async function gh(path, opts = {}) {
  const token = process.env.CUP_GITHUB_TOKEN
  const res = await fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'monhouse-cup',
      ...(opts.headers || {}),
    },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const err = new Error(`github-${res.status}: ${body.slice(0, 200)}`)
    err.status = res.status
    throw err
  }
  return res.json()
}

const caches = new Map()

export async function readJsonFile(path, { fresh = false } = {}) {
  if (!SEEDS[path]) throw new Error(`unknown store file: ${path}`)
  if (!fresh && caches.get(path)?.data && Date.now() - caches.get(path).at < CACHE_TTL)
    return caches.get(path).data

  const token = process.env.CUP_GITHUB_TOKEN
  const ref = branch()
  let data = null

  if (token) {
    try {
      const blob = await gh(`/repos/${repo()}/contents/${path}?ref=${encodeURIComponent(ref)}`)
      data = JSON.parse(Buffer.from(blob.content, 'base64').toString('utf8'))
    } catch (e) {
      if (e.status !== 404) throw e
    }
  } else {
    try {
      const diskPath = nodePath.resolve(process.cwd(), path)
      const raw = await fs.readFile(diskPath, 'utf8')
      data = JSON.parse(raw)
    } catch {
      /* fall back to seed */
    }
  }

  if (!data) data = SEEDS[path]()
  if (!caches.get(path)?.data || fresh) caches.set(path, { at: Date.now(), data })
  return data
}

export async function writeJsonFile(path, mutator) {
  if (!process.env.CUP_GITHUB_TOKEN) {
    const data = await readJsonFile(path, { fresh: true })
    const next = mutator(structuredClone(data))
    if (!next) return data
    try {
      const diskPath = nodePath.resolve(process.cwd(), path)
      await fs.writeFile(diskPath, JSON.stringify(next, null, 2) + '\n', 'utf8')
    } catch {
      /* read-only serverless fs without token: update in-memory cache */
    }
    caches.set(path, { at: Date.now(), data: next })
    return next
  }

  const ref = branch()
  for (let attempt = 0; attempt < 3; attempt++) {
    const data = await readJsonFile(path, { fresh: true })
    const next = mutator(structuredClone(data))
    if (!next) return data
    let sha = ''
    try {
      const blob = await gh(`/repos/${repo()}/contents/${path}?ref=${encodeURIComponent(ref)}`)
      sha = blob.sha
    } catch (e) {
      if (e.status !== 404) throw e
    }
    const body = {
      message: `${path.split('/').pop()}: update ${new Date().toISOString()}`,
      content: Buffer.from(JSON.stringify(next, null, 2)).toString('base64'),
      branch: ref,
    }
    if (sha) body.sha = sha
    try {
      await gh(`/repos/${repo()}/contents/${path}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
    } catch (e) {
      if (e.status === 409 || e.status === 422) continue
      throw e
    }
    caches.set(path, { at: Date.now(), data: next })
    return next
  }
  throw new Error('cup-write-conflict')
}

export async function readCup(opts) {
  return readJsonFile('data/cup.json', opts)
}
export async function writeCup(mutator) {
  return writeJsonFile('data/cup.json', mutator)
}
