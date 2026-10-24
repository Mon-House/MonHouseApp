/**
 * Cosmetic-only skins for MonHouse on Monad Testnet.
 * Prices are in internal MON units (100,000 units = 1 MON, so 1,000 = 0.01 MON).
 * Skins never affect gameplay — that is a hard rule of MonHouse.
 */

export const CAT_SKINS = [
  {
    id: 'classic',
    name: 'Absurd Chonker',
    price: 0,
    colors: {
      body: '#ffa424',
      wing: '#ff8c12',
      ears: '#ff6b9d',
      nose: '#ff5c8a',
      mustache: '#5b2a0e',
    },
  },
  {
    id: 'monad',
    name: 'Monad Violet',
    price: 1000, // 0.01 MON
    colors: {
      body: '#a78bfa',
      wing: '#836ef9',
      ears: '#f472b6',
      nose: '#f472b6',
      mustache: '#2e1065',
    },
  },
  {
    id: 'gold',
    name: 'Royal Meow',
    price: 5000, // 0.05 MON
    // (our hero already wears his royal crown — no extra accessory needed!)
    colors: {
      body: '#fde047',
      wing: '#facc15',
      ears: '#fb7185',
      nose: '#f43f5e',
      mustache: '#78350f',
    },
  },
  {
    id: 'space',
    name: 'Astro Nyancat',
    price: 10000, // 0.1 MON
    accessory: 'helmet',
    colors: {
      body: '#67e8f9',
      wing: '#06b6d4',
      ears: '#c084fc',
      nose: '#f472b6',
      mustache: '#164e63',
    },
  },
  {
    id: 'lava',
    name: 'Neon Magma Cat',
    price: 10000, // 0.1 MON
    accessory: 'sunglasses',
    colors: {
      body: '#fb7185',
      wing: '#f43f5e',
      ears: '#fde047',
      nose: '#facc15',
      mustache: '#4c0519',
    },
  },
]

// Backwards-compatible alias so any import of CHICK_SKINS works seamlessly
export const CHICK_SKINS = CAT_SKINS

export const STACK_SKINS = [
  { id: 'mint', name: 'Monad Violet Blocks', price: 0, hue: 264 },
  { id: 'sunset', name: 'Neon Mint Blocks', price: 1000, hue: 158 },
  { id: 'ocean', name: 'Solar Flare Blocks', price: 1000 * 5, hue: 18 },
]

export const SKIN_GROUPS = [
  { id: 'chick', label: 'MonCat outfits', skins: CAT_SKINS },
  { id: 'stack', label: 'MonStack blocks', skins: STACK_SKINS },
]
