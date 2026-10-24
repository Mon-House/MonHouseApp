# MonHouse — Panduan Deploy GitHub & Vercel (Monad Mainnet)

## 1. Spesifikasi Jaringan Monad Mainnet
- **Network Name:** `Monad`
- **Chain ID:** `143` (`0x8f`)
- **Symbol:** `MON` (`18 decimals`)
- **RPC URL:** `https://rpc.monad.xyz`
- **Block Explorer:** `https://monadscan.com`
- **Get MON:** bridge antar-chain atau beli di exchange (tidak ada faucet di mainnet)

## 2. Alamat House Wallet
Default yang sudah dikonfigurasi di aplikasi & Cup Pool:
- **`0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d`**

## 3. Environment Variables di Vercel
Aplikasi sudah berfungsi penuh secara langsung saat di-deploy ke Vercel. Untuk menyimpan skor **MonHouse Cup**, klaim nama, dan pesan **Cheer** secara permanen ke file JSON di repo GitHub Anda:

| Variable | Wajib? | Keterangan |
|---|---|---|
| `VITE_HOUSE_ADDRESS` | Opsional (sudah default) | `0xe5b41b1e42580ddb14F277578D5f92Fc091DAD1d` |
| `CUP_GITHUB_TOKEN` | Disarankan di produksi | Fine-grained GitHub Token dengan izin **Contents: Read & Write** pada repo ini |
| `CUP_GITHUB_REPO` | Opsional | Otomatis terdeteksi di Vercel (`owner/repo`), atau isi manual misal `sasam44/monhouse` |
| `CUP_ADMIN_SECRET` | Opsional | String rahasia untuk merekam hash payout pemenang Cup via `scripts/payout.mjs` |

## 6. MonHouse Cup v3 — Aturan & Distribusi Hadiah

- **Snapshot pemenang:** `closeAt` di `data/cup.json` (hari ini 19:45 WIB / 12:45 UTC).
  Setelah lewat, `/api/cup/submit` otomatis menolak skor baru & papan terkunci.
- **Hadiah:** total **600 MON** → #1 180 / #2 150 / #3 120 / #4 90 / #5 60.
- **Peringkat:** skor tertinggi pemain lintas SEMUA game (satu papan unified).
- **Distribusi otomatis oleh wallet MonHouse** `0xe5b4…AD1d`:
  ```bash
  MONHOUSE_PAYOUT_KEY=<private-key-wallet-monhouse> node scripts/payout.mjs --auto
  ```
  Script menandatangani transaksi EIP-155 native (Chain ID 143) dan mengirim
  180/150/120/90/60 MON ke 5 pemenang, lalu merekam tx hash ke papan via
  `/api/cup/payout` (butuh `CUP_ADMIN_SECRET`). Verifikasi di https://monadscan.com.
- Mode interaktif (tanpa private key di env): `node scripts/payout.mjs` lalu paste tx hash.
- Untuk Cup berikutnya: ubah `pool.closeAt` (+ `closeLabel`/`tiersMon` bila perlu) di
  `data/cup.json` — period id baru (`PYYYYMMDD` WIB) terhitung otomatis.
