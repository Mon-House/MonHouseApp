/**
 * Monad Mainnet EVM Wallet & JSON-RPC Integration for MonHouse.
 *
 * Official Monad Mainnet Specs:
 *   - Network Name : Monad
 *   - Chain ID     : 143 (0x8f)
 *   - Currency     : MON (18 decimals)
 *   - Primary RPC  : https://rpc.monad.xyz
 *   - Fallback RPC : https://rpc1.monad.xyz / https://rpc3.monad.xyz
 *   - Explorers    : https://monadscan.com / https://monadvision.com
 */

export const MONAD_MAINNET = {
  chainIdDec: 143,
  chainIdHex: '0x8f',
  chainName: 'Monad',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: [
    'https://rpc.monad.xyz',
    'https://rpc1.monad.xyz',
    'https://rpc3.monad.xyz',
  ],
  blockExplorerUrls: ['https://monadscan.com', 'https://monadvision.com'],
}

/**
 * Recipient EVM wallet address for in-app MON payments (cosmetic skins + cheers).
 * Override anytime via VITE_HOUSE_ADDRESS in .env.
 */
export const HOUSE_ADDRESS =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HOUSE_ADDRESS) ||
  '0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d'

// Backwards-compatible alias (can also be overridden via VITE_CHEER_ADDRESS)
export const CHEER_ADDRESS =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_CHEER_ADDRESS) ||
  HOUSE_ADDRESS

/**
 * Internal pricing unit: 100,000 units = 1 MON (so 1,000 units = 0.01 MON = 10^16 wei).
 */
export const UNITS_PER_MON = 100_000
export const LUNA_PER_NIM = UNITS_PER_MON

const WEI_PER_UNIT = 10_000_000_000_000n // 10^13 wei * 10^5 = 10^18 wei (1 MON)

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

function randomHex(bytes = 32) {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export function utf8ToHex(str) {
  const bytes = new TextEncoder().encode(String(str || ''))
  return (
    '0x' +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  )
}

export function unitsToWeiHex(units) {
  const u = BigInt(Math.max(0, Math.round(Number(units) || 0)))
  return '0x' + (u * WEI_PER_UNIT).toString(16)
}

export function formatWeiToMon(weiHexOrBigInt) {
  try {
    const w = BigInt(weiHexOrBigInt || 0)
    const whole = w / 1_000_000_000_000_000_000n
    const frac = (w % 1_000_000_000_000_000_000n) / 100_000_000_000_000n // 4 decimals
    if (frac === 0n) return `${whole.toString()} MON`
    const fracStr = frac.toString().padStart(4, '0').replace(/0+$/, '')
    return `${whole.toString()}.${fracStr} MON`
  } catch {
    return '0 MON'
  }
}

/**
 * Direct read-only JSON-RPC call against Monad Mainnet public RPC.
 */
export async function monadRpc(method, params = []) {
  for (const url of MONAD_MAINNET.rpcUrls.slice(0, 2)) {
    try {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 5000)
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const json = await res.json()
      if (json && json.result !== undefined) return json.result
    } catch {
      /* try next RPC endpoint */
    }
  }
  return null
}

/**
 * Discover EIP-6963 or window.ethereum EVM provider.
 */
let announcedProvider = null
if (typeof window !== 'undefined') {
  window.addEventListener('eip6963:announceProvider', (e) => {
    if (e?.detail?.provider && !announcedProvider) {
      announcedProvider = e.detail.provider
    }
  })
  try {
    window.dispatchEvent(new Event('eip6963:requestProvider'))
  } catch {
    /* ignore */
  }
}

export function getInjectedProvider() {
  if (typeof window === 'undefined') return null
  if (announcedProvider) return announcedProvider
  if (window.ethereum?.providers?.length) {
    return window.ethereum.providers.find((p) => p.isMetaMask || p.isRabby) || window.ethereum.providers[0]
  }
  return window.ethereum || null
}

/**
 * Switch or add Monad Mainnet (Chain ID 143 / 0x8f) in the user's EVM wallet.
 */
export async function ensureMonadMainnet(provider = getInjectedProvider()) {
  if (!provider) throw new Error('No EVM wallet detected (install MetaMask, Rabby, Phantom, or OKX Wallet)')
  const currentChain = await provider.request({ method: 'eth_chainId' }).catch(() => null)
  if (currentChain && parseInt(currentChain, 16) === MONAD_MAINNET.chainIdDec) {
    return MONAD_MAINNET.chainIdHex
  }
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_MAINNET.chainIdHex }],
    })
  } catch (switchErr) {
    const code = switchErr?.code ?? switchErr?.data?.originalError?.code
    const msg = String(switchErr?.message || '').toLowerCase()
    if (code === 4902 || code === -32603 || msg.includes('unrecognized') || msg.includes('not added')) {
      await provider.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: MONAD_MAINNET.chainIdHex,
            chainName: MONAD_MAINNET.chainName,
            nativeCurrency: MONAD_MAINNET.nativeCurrency,
            rpcUrls: [MONAD_MAINNET.rpcUrls[0]],
            blockExplorerUrls: [MONAD_MAINNET.blockExplorerUrls[0]],
          },
        ],
      })
    } else {
      throw switchErr
    }
  }
  return MONAD_MAINNET.chainIdHex
}

/**
 * Live Monad Mainnet EVM wallet adapter.
 */
function createLiveMonadProvider(eth) {
  return {
    _demo: false,
    provider: eth,
    async listAccounts() {
      await ensureMonadMainnet(eth)
      const accs = await eth.request({ method: 'eth_requestAccounts' })
      return Array.isArray(accs) ? accs : []
    },
    async getSilentAccounts() {
      const accs = await eth.request({ method: 'eth_accounts' }).catch(() => [])
      return Array.isArray(accs) ? accs : []
    },
    async getChainId() {
      const hex = await eth.request({ method: 'eth_chainId' }).catch(() => null)
      return hex ? parseInt(hex, 16) : null
    },
    async switchToMonad() {
      return ensureMonadMainnet(eth)
    },
    async sign(message, fromAddr) {
      const accs = fromAddr ? [fromAddr] : await eth.request({ method: 'eth_requestAccounts' })
      const signer = accs?.[0]
      if (!signer) throw new Error('Wallet not connected')
      const hexMsg = utf8ToHex(message)
      const signature = await eth.request({
        method: 'personal_sign',
        params: [hexMsg, signer],
      })
      return { address: signer, publicKey: signer, signature }
    },
    async isConsensusEstablished() {
      const cid = await this.getChainId()
      return cid === MONAD_MAINNET.chainIdDec
    },
    async getBlockNumber() {
      const hex =
        (await eth.request({ method: 'eth_blockNumber' }).catch(() => null)) ||
        (await monadRpc('eth_blockNumber'))
      return hex ? parseInt(hex, 16) : null
    },
    async getBalance(address) {
      if (!address) return null
      const hex =
        (await eth.request({ method: 'eth_getBalance', params: [address, 'latest'] }).catch(() => null)) ||
        (await monadRpc('eth_getBalance', [address, 'latest']))
      return hex ? formatWeiToMon(hex) : null
    },
    async sendBasicTransaction({ recipient, value }) {
      return this.sendBasicTransactionWithData({ recipient, value, data: '' })
    },
    async sendBasicTransactionWithData({ recipient, value, data }) {
      await ensureMonadMainnet(eth)
      const accs = await eth.request({ method: 'eth_requestAccounts' })
      const from = accs?.[0]
      if (!from) throw new Error('Connect your Monad wallet first')
      const txParams = {
        from,
        to: recipient,
        value: unitsToWeiHex(value),
      }
      if (data) txParams.data = utf8ToHex(data)
      try {
        return await eth.request({
          method: 'eth_sendTransaction',
          params: [txParams],
        })
      } catch (err) {
        const msg = String(err?.message || '').toLowerCase()
        // If user explicitly rejected, propagate rejection immediately
        if (err?.code === 4001 || msg.includes('user denied') || msg.includes('rejected')) {
          throw err
        }
        // Fallback without calldata if smart-account wallet restricts data on value transfer
        if (txParams.data) {
          const { data: _omit, ...plainTx } = txParams
          return await eth.request({
            method: 'eth_sendTransaction',
            params: [plainTx],
          })
        }
        throw err
      }
    },
  }
}

/**
 * Simulated Monad provider used when no browser wallet extension is
 * present (e.g. sandboxed preview / mobile webview). Still queries real Monad
 * Mainnet block numbers when network access is available!
 */
function createDemoMonadProvider() {
  let storedAddr = null
  try {
    storedAddr = localStorage.getItem('monhouse.demoAddr')
    if (!storedAddr || !/^0x[0-9a-fA-F]{40}$/.test(storedAddr)) {
      storedAddr = '0x714C' + randomHex(18)
      localStorage.setItem('monhouse.demoAddr', storedAddr)
    }
  } catch {
    storedAddr = '0x714C00000000000000000000000000000000CAFE'
  }
  let demoBalanceUnits = 1_250_000 // 12.50 MON simulated balance

  return {
    _demo: true,
    demoAddress: storedAddr,
    async listAccounts() {
      await delay(380)
      return [storedAddr]
    },
    async getSilentAccounts() {
      return [storedAddr]
    },
    async getChainId() {
      return MONAD_MAINNET.chainIdDec
    },
    async switchToMonad() {
      await delay(200)
      return MONAD_MAINNET.chainIdHex
    },
    async sign() {
      await delay(420)
      const sig = '0x' + randomHex(64) + '1b'
      return { address: storedAddr, publicKey: storedAddr, signature: sig }
    },
    async isConsensusEstablished() {
      return true
    },
    async getBlockNumber() {
      const liveHex = await monadRpc('eth_blockNumber')
      if (liveHex) return parseInt(liveHex, 16)
      return 18_420_000 + Math.floor((Date.now() / 500) % 100000)
    },
    async getBalance() {
      return fmtMon(demoBalanceUnits)
    },
    async sendBasicTransaction({ value }) {
      await delay(550)
      demoBalanceUnits = Math.max(0, demoBalanceUnits - (Number(value) || 0))
      return '0x' + randomHex(32)
    },
    async sendBasicTransactionWithData({ value }) {
      await delay(550)
      demoBalanceUnits = Math.max(0, demoBalanceUnits - (Number(value) || 0))
      return '0x' + randomHex(32)
    },
  }
}

let walletPromise = null

/**
 * Resolve to { mode: 'live' | 'demo', monad, nimiq, error }.
 * ('nimiq' is aliased to 'monad' so all existing callers work seamlessly.)
 */
export function getWallet({ forceRefresh = false } = {}) {
  if (!walletPromise || forceRefresh) {
    walletPromise = (async () => {
      // Wait briefly in case EIP-6963 provider announces async on page load
      let eth = getInjectedProvider()
      if (!eth && typeof window !== 'undefined') {
        await delay(120)
        eth = getInjectedProvider()
      }
      if (eth) {
        const monad = createLiveMonadProvider(eth)
        return { mode: 'live', monad, nimiq: monad, error: null }
      }
      const demo = createDemoMonadProvider()
      return {
        mode: 'demo',
        monad: demo,
        nimiq: demo,
        error: 'No EVM wallet extension found — running in Monad Demo Mode',
      }
    })()
  }
  return walletPromise
}

/**
 * Stable 64-hex pseudonymous device identifier (stored locally).
 */
let deviceIdPromise = null
export function getDeviceId() {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        let local = localStorage.getItem('monhouse.device') || localStorage.getItem('nimhouse.device')
        if (!local || !/^[0-9a-f]{64}$/i.test(local)) {
          local = randomHex(32)
          localStorage.setItem('monhouse.device', local)
        }
        return local
      } catch {
        return randomHex(32)
      }
    })()
  }
  return deviceIdPromise
}

export const fmtMon = (units) =>
  (Number(units || 0) / UNITS_PER_MON).toLocaleString('en-US', { maximumFractionDigits: 6 }) + ' MON'

// Backwards-compatible alias
export const fmtNim = fmtMon

export const shortHash = (h) => {
  const s = String(h || '')
  return s.length > 16 ? `${s.slice(0, 10)}…${s.slice(-6)}` : s
}

export const shortAddr = (addr) => {
  const s = String(addr || '').trim()
  if (!s) return ''
  return s.length > 14 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s
}

export const explorerTxUrl = (txHash) =>
  txHash ? `${MONAD_MAINNET.blockExplorerUrls[0]}/tx/${txHash}` : MONAD_MAINNET.blockExplorerUrls[0]

export const explorerAddrUrl = (addr) =>
  addr ? `${MONAD_MAINNET.blockExplorerUrls[0]}/address/${addr}` : MONAD_MAINNET.blockExplorerUrls[0]

/**
 * High-level reactive wallet initializer used by App.jsx.
 * Auto-detects injected EVM wallets (MetaMask, Rabby, Phantom EVM, EIP-6963),
 * tracks Chain ID 143 (Monad Mainnet), MON balance, signing, and MON transfers,
 * with graceful Demo Mode fallback when no browser extension is installed.
 */
export async function initWallet(onChange) {
  const w = await getWallet()
  const eth = getInjectedProvider()
  const hasProvider = !!eth && w.mode === 'live'

  const state = {
    mode: 'demo',
    address: '',
    chainId: null,
    isMonadMainnet: false,
    hasProvider,
    balanceMon: null,
  }

  const syncState = async () => {
    if (!hasProvider) {
      const demoAccs = await w.monad.getSilentAccounts()
      state.mode = 'demo'
      state.address = demoAccs[0] || ''
      state.chainId = MONAD_MAINNET.chainIdDec
      state.isMonadMainnet = true
      state.balanceMon = '12.50'
      onChange?.({ ...state })
      return
    }
    const accs = await w.monad.getSilentAccounts()
    const cid = await w.monad.getChainId()
    state.chainId = cid
    state.isMonadMainnet = cid === MONAD_MAINNET.chainIdDec
    if (accs.length > 0) {
      state.mode = 'monad'
      state.address = accs[0]
      if (state.isMonadMainnet) {
        const balStr = await w.monad.getBalance(accs[0])
        state.balanceMon = balStr ? balStr.replace(/\s*MON$/, '') : null
      } else {
        state.balanceMon = null
      }
    } else {
      state.mode = 'disconnected'
      state.address = ''
      state.balanceMon = null
    }
    onChange?.({ ...state })
  }

  await syncState()

  if (eth && typeof eth.on === 'function') {
    eth.on('accountsChanged', () => syncState())
    eth.on('chainChanged', () => syncState())
  }

  const api = {
    ...state,
    refresh: syncState,
    async connect() {
      if (!hasProvider) return { ok: false, error: 'no-wallet' }
      try {
        const accs = await w.monad.listAccounts()
        await syncState()
        return accs.length > 0 ? { ok: true, address: accs[0] } : { ok: false, error: 'No account authorized' }
      } catch (e) {
        return { ok: false, error: e?.message || 'Connection rejected' }
      }
    },
    async switchToMonad() {
      if (!hasProvider) return { ok: false, error: 'no-wallet' }
      try {
        await w.monad.switchToMonad()
        await syncState()
        return { ok: true }
      } catch (e) {
        return { ok: false, error: e?.message || 'Failed to switch network' }
      }
    },
    async sign(message) {
      try {
        const res = await w.monad.sign(message, state.address || undefined)
        return { ok: true, ...res }
      } catch (e) {
        return { ok: false, error: e?.message || 'Signature cancelled' }
      }
    },
    async pay({ value, memo = '', recipient = HOUSE_ADDRESS }) {
      if (!hasProvider || state.mode !== 'monad') {
        if (hasProvider) {
          const conn = await api.connect()
          if (!conn.ok) return { ok: false, error: conn.error || 'Connect wallet first' }
        } else {
          const demoHash = await w.monad.sendBasicTransactionWithData({ recipient, value, data: memo })
          await syncState()
          return { ok: true, demo: true, txHash: 'demo_' + String(demoHash).replace(/^0x/, '') }
        }
      }
      try {
        const txHash = await w.monad.sendBasicTransactionWithData({ recipient, value, data: memo })
        await syncState()
        return { ok: true, demo: false, txHash }
      } catch (e) {
        return { ok: false, error: e?.message || 'Transaction cancelled' }
      }
    },
  }

  // Wrap onChange so handlers stay attached when React merges state updates
  const origOnChange = onChange
  if (origOnChange) {
    onChange = (partial) => origOnChange({ ...api, ...partial })
  }

  return { ...api, ...state }
}
