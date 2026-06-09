# Colosseum Hackathon Submission Answers

---

## WHAT ARE YOU BUILDING, AND WHO IS IT FOR?

StreamPump is a Web2.5 creator sponsorship market on Solana for three roles: creators, fans, and sponsors.

Season 1: Fans burn non-transferable SPUMP into creator positions on a bonding curve. An oracle scores creator momentum. When sponsors buy out a graduated creator, fans claim pro-rata USDC.

Season 2: Sponsors fund campaigns with three budget tracks — fixed base pay, performance-driven (views/clicks with cliff logic and fan endorsement pools), and CPS with delayed settlement. All funds sit in PDA-owned USDC vaults and settle on-chain.

Early/mid-tier creators get cold-start funding without MCN agencies. Fans earn real USDC, not speculative tokens. Sponsors get direct creator access with transparent, verifiable settlement.

---

## WHY DID YOU DECIDE TO BUILD THIS, AND WHY BUILD IT NOW?

The $480B creator economy still runs on flat fees, 15-30% agency commissions, and click-based KPIs. No CPS micro-payment rails exist. Creators have zero market signals before production.

Web3 social failed structurally. Friend.tech collapsed to under 10K DAU. Farcaster signups dropped 96%. Token-first incentives and view-to-earn sell pressure don't build lasting platforms.

Solana's stack is now ready: Token-2022 NonTransferable for utility-only tokens, sub-cent fees for micro-settlement, sub-second finality for bonding curve UX, and PDA architecture for composable vaults. This infrastructure didn't exist in production form two years ago.

Our thesis: content is the real asset, sponsor budgets are sustainable yield, and SPUMP never lists on a DEX — earnings flow as USDC.

---

## WHAT TECHNOLOGIES ARE YOU USING OR INTEGRATING WITH TO BUILD YOUR PRODUCT?

On-chain: Solana, Anchor (20+ instructions), Token-2022 NonTransferable (SPUMP), SPL Token (USDC vaults), PDA state for protocol, creators, positions, proposals, escrow.

Frontend: Next.js 14, React 18, Solana Wallet Adapter, Web3Auth, Tailwind CSS.

Backend: Express, TypeScript, Prisma, PostgreSQL/Neon, Cloudflare R2 (storage), Mux (video).

Services: Oracle scheduler, chain indexer, market projections, Mux reconciliation.

AI tools: Cursor IDE with Claude for code generation, architecture planning, and test scaffolding.

Deploy: Vercel, Render, Neon, Cloudflare R2, Mux, Solana devnet.
