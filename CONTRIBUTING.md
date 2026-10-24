# Contributing to MonHouse 🐱⚡

Thanks for wanting to help! MonHouse is a small, focused project — contributions are welcome.

## Ways to help

- 🐛 **Bug reports** — open an issue with steps to reproduce (browser + wallet used)
- 🎮 **Game ideas** — absurd cat mini-games that are pure skill (no pay-to-win mechanics, ever)
- 🎨 **Art & cosmetics** — King Nads Meow outfits, block themes (must match the mascot's style guide)
- 🌍 **Translations** — the UI is English/Indonesian today
- ⚡ **Performance** — the games must stay smooth on low-end phones

## Ground rules

1. **Cosmetics never affect gameplay.** This is the project's core promise — PRs that sell
   gameplay advantages will be declined.
2. **Scores must stay verifiable.** Anything touching leaderboards must keep EIP-191
   wallet-signed submissions and server-side verification.
3. **Keep the bundle light.** No heavy web3 SDKs; we talk JSON-RPC directly.

## Dev workflow

```bash
npm install
npm run dev      # develop on http://localhost:5173
npm test         # 21-assertion smoke suite must pass before every push
```

- Branch from `main`, keep PRs small and focused
- Run `npm test` before pushing — CI-minded reviewers will check
- Screenshots/GIFs in PR descriptions are greatly appreciated for UI changes

## Reporting security issues

Please do **not** open public issues for vulnerabilities in payout/verification logic.
Use GitHub security advisories or contact a maintainer directly.
