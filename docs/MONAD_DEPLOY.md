# MonHouse — Panduan Deploy GitHub & Vercel (Monad Testnet)

## 1. Spesifikasi Jaringan Monad Testnet
- **Network Name:** `Monad Testnet`
- **Chain ID:** `10143` (`0x279f`)
- **Symbol:** `MON` (`18 decimals`)
- **RPC URL:** `https://testnet-rpc.monad.xyz`
- **Block Explorer:** `https://testnet.monadscan.com`
- **Faucet:** `https://faucet.monad.xyz`

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
