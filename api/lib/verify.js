/**
 * EVM (Monad Testnet) Wallet Signature Verification for MonHouse.
 *
 * Primary scheme: EIP-191 personal_sign (secp256k1 recoverable ECDSA):
 *   keccak256("\x19Ethereum Signed Message:\n" + byteLength(message) + message)
 * Recovers the 20-byte 0x... EVM address and compares case-insensitively
 * against the claimed signer address (`address` or `publicKey`).
 */
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak256 } from 'js-sha3'

/** Compute EIP-191 personal_sign digest (32-byte Uint8Array). */
export function evmMessageDigest(message) {
  const msgBytes = Buffer.from(String(message ?? ''), 'utf8')
  const prefix = Buffer.from(`\x19Ethereum Signed Message:\n${msgBytes.length}`, 'utf8')
  const payload = Buffer.concat([prefix, msgBytes])
  return Uint8Array.from(Buffer.from(keccak256.arrayBuffer(payload)))
}

/** Recover lowercase 0x-prefixed EVM address from message + 65-byte hex signature. */
export function recoverEvmAddress(message, signature) {
  const clean = String(signature || '').replace(/^0x/i, '')
  if (clean.length !== 130) throw new Error(`bad signature length (${clean.length})`)
  const sigBytes = Buffer.from(clean, 'hex')
  const r = BigInt('0x' + sigBytes.subarray(0, 32).toString('hex'))
  const s = BigInt('0x' + sigBytes.subarray(32, 64).toString('hex'))
  let v = sigBytes[64]
  if (v >= 27) v -= 27
  if (v !== 0 && v !== 1) throw new Error(`invalid recovery id v=${sigBytes[64]}`)

  const sig = new secp256k1.Signature(r, s).addRecoveryBit(v)
  const digest = evmMessageDigest(message)
  const pubPoint = sig.recoverPublicKey(digest)
  // Uncompressed public key is 65 bytes: 0x04 || X (32B) || Y (32B)
  const uncompressed = pubPoint.toBytes(false).slice(1)
  const addrHash = Buffer.from(keccak256.arrayBuffer(uncompressed))
  return '0x' + addrHash.subarray(12).toString('hex').toLowerCase()
}

/**
 * Verify an EVM personal_sign signature against a claimed 0x... address.
 * @param {string} message
 * @param {string} addressOrPub  0x-prefixed 20-byte EVM address
 * @param {string} signature     0x-prefixed 65-byte hex signature
 * @returns {{ ok: boolean, address: string|null, error: string|null }}
 */
export function verifyWalletSignature(message, addressOrPub, signature) {
  const claimed = String(addressOrPub || '').trim().toLowerCase()
  if (!/^0x[0-9a-f]{40}$/.test(claimed)) {
    return { ok: false, address: null, error: 'bad EVM wallet address (expected 0x...)' }
  }
  try {
    const recovered = recoverEvmAddress(message, signature)
    if (recovered !== claimed) {
      return { ok: false, address: recovered, error: 'signature does not match wallet address' }
    }
    return { ok: true, address: recovered, error: null }
  } catch (e) {
    return { ok: false, address: null, error: e?.message || 'signature invalid' }
  }
}
