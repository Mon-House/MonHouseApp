# MonHouse 🐾⚡ — Monad Mainnet Absurd Cat Arcade

**MonHouse** (migrated & rebranded from NimHouse) is a colorful, sharp arcade hub featuring **5 skill-based mini-games** starring absurd chonky cats on **Monad Mainnet**.

## Monad Mainnet Configuration
- **Network Name:** `Monad`
- **Chain ID:** `143` (`0x8f`)
- **Native Token:** `MON` (18 decimals)
- **Primary RPC:** `https://rpc.monad.xyz`
- **Explorer:** `https://monadscan.com`
- **Get MON:** bridge from other chains or buy on an exchange (no faucet on mainnet)

## 5 Mini-Games
1. **MonCat** — Tap or press `Space` to pounce your absurd cat through crystal Monad pipes.
2. **MonStack** — Drop high floating 3D glowing blocks with overhang slicing & perfect combo streaks.
3. **MonRush** — 3D highway runner: weave past cows, UFOs, rival cats, and giant sausages.
4. **MonSwat** — Cozy room swatter: bonk the weaving angry fly before 5 misses let it escape.
5. **MonDash** — Mario-style side-scrolling platformer: leap blocks & pits, stomp flies (`+50`), and grab `MON` coins.

## Configuring Your House Wallet
Copy `.env.example` to `.env` (or set Environment Variables in Vercel):

```env
VITE_HOUSE_ADDRESS=0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d
VITE_CHEER_ADDRESS=0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d
VITE_MONAD_RPC=https://rpc.monad.xyz
```

## Local Development
```bash
npm install
npm run dev
```

## 🏆 MonHouse Cup Rules (v3 — Snapshot Cup)

| Rule | Value |
| --- | --- |
| **Snapshot pemenang** | Hari ini · **19:45 WIB** (12:45 UTC) |
| **Total hadiah** | **600 MON** |
| **Hadiah per juara** | #1 **180** · #2 **150** · #3 **120** · #4 **90** · #5 **60** MON |
| **Basis peringkat** | Skor tertinggi pemain **lintas semua game** (best single-game score) |
| **Distribusi** | Otomatis oleh wallet MonHouse `0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d` |

Setelah jam 19:45 WIB, submit skor otomatis ditolak ("cup closed — snapshot taken")
dan papan pemenang terkunci. Distribusi hadiah dijalankan dari wallet MonHouse:

```bash
node scripts/payout.mjs --dry-run          # lihat pemenang & hadiah
node scripts/payout.mjs --auto             # kirim 180/150/120/90/60 MON otomatis
                                          # (butuh MONHOUSE_PAYOUT_KEY = private key wallet MonHouse)
```
