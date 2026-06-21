# StreamPump Pitch Script

---

## Slide 1 — Title

Hey everyone, thanks for having me. I'm here to talk about **StreamPump** — a Web2.5 creator sponsorship market built on Solana.

The idea is simple: we're putting content creation, creator momentum, sponsor budgets, fan participation, and on-chain settlement into one single product loop. Not a fan token platform. Not an influencer CRM. Something in between — and something that actually works.

---

## Slide 2 — Product Market Fit

Let's start with why this market matters.

The creator economy is projected to reach $480 billion by 2027, according to Goldman Sachs. US creator ad spend alone is at $37 billion — IAB's 2025 number. And here's what's interesting: 73% of brands now prefer working with micro and mid-tier creators over mega-influencers.

The demand is already here. Creator campaigns have become a core media channel, not an experimental growth hack.

But here's the gap: **the missing layer is trust**. Brands need campaign proof — did this actually work? Creators need fair settlement — not a flat fee and goodbye. And fans? They need upside that isn't just speculation on some random token.

That's where StreamPump fits. We're building the trust layer between these three groups.

---

## Slide 3 — Web3/SocialFi Failures

Now, you might think — hasn't Web3 tried to solve this? It has. And it's mostly failed.

Look at the numbers. Friend.tech went from 80,000 daily active users down to less than 10,000. Revenue literally collapsed to $71. The developers abandoned the smart contract.

Farcaster raised $150 million — and then new signups dropped from 15,000 a month to 545.

Lens Protocol? New users went from 37,000 a month to 142. That's a 99.6% drop.

Why did this happen? Three structural problems.

One — **token-first mentality**. Teams launch coins, not products. There's no real intent to build a sustainable content platform.

Two — **view-to-earn is a death spiral**. Users earn platform tokens, immediately dump them on a DEX, and that constant sell pressure crashes the token. Then users leave.

Three — **fake content ownership**. Let's be honest: creators don't care about "data sovereignty" until their content is actually generating real revenue. And putting full videos on-chain? Way too expensive and way too slow.

---

## Slide 4 — Our Insight

So here's where we think differently. We have four core convictions that shape everything we build.

**Number one**: content — videos, posts — these are the real valuable digital products. Not meme coins. Not NFTs. Those attract speculators. Content is what actually retains and grows an audience over time.

And to be clear about ownership — since we just called out fake content ownership: we don't claim to own your content, we don't tokenize it, and we don't lock it to our platform. Your content stays where you publish it. What we put on-chain is narrow and honest — a creator-signed publication timestamp and an integrity fingerprint. It's not ownership and it's not anti-copy; it's a verifiable attribution record that ties a piece of content to your identity and to a campaign, so the *revenue* gets distributed to the right creator. We fix attribution and settlement, not ownership.

**Number two**: our platform token, SPUMP, is utility-only. We're not listing it on any DEX or CEX. You earn USDC through in-platform participation — not by trading tokens on secondary markets.

**Number three**: sponsors on our platform are marketing spenders, not investors. They're doing what they'd normally do — running campaigns, buying ad placements. That's a much healthier source of capital than speculation.

**Number four**: the platform is highly automated. We don't need a big team or extractive monetization. Service fees and small USDC transaction fees keep the lights on.

---

## Slide 5 — Introducing StreamPump

So what is StreamPump exactly?

Think of it as sitting right in the middle — between Web2 platforms like YouTube and TikTok, where the platform controls everything, and Web3 DeFi products like Friend.tech, where it's all tokens and bad UX.

We take the best of both: social-first user experience from Web2, plus transparent on-chain settlement from Web3.

There are three roles in the system.

**Creators** get cold-start funding through fan backing, then graduate into structured sponsorship deals with guaranteed base pay and performance upside.

**Fans and backers** support creators early using SPUMP tokens. When a sponsor buys out a creator they believed in, they earn real USDC. They can also endorse campaigns and earn from reward pools.

**Sponsors** get direct access to creators — no agency middlemen. They choose from three flexible budget tracks: fixed, performance-based, or cost-per-sale. And they pay in USDC.

---

## Slide 6 — Season 1: Creator Discovery Market

Let me walk you through how this works in practice, starting with Season 1.

S1 is the creator discovery layer. It's how early creators bootstrap their commercial value.

A fan burns SPUMP — which is a non-transferable Token-2022 asset — and receives an internal creator position. This is recorded as a PDA on Solana, not as a tradable token. The price of that position adjusts along a quadratic bonding curve.

Meanwhile, an oracle evaluates the creator's momentum — looking at followers, view counts, growth velocity, and other metrics — and adjusts a rating that scales the curve.

We've also built in serious anti-speculation guardrails: SPUMP is non-transferable, there are daily buy caps per user, a dynamic exit tax on sells, delayed rating activation to prevent front-running, and early-cohort buyout caps.

The key point is: this is not a fan token market. It's a conviction-based discovery mechanism where you back creators you believe in — and the upside comes from real sponsorship money, not token speculation.

---

## Slide 7 — S1 Buyout: The Bridge

Now here's where it gets interesting. When a creator reaches critical mass — enough followers, enough views, enough momentum — the buyout mechanism kicks in.

Sponsors can submit buyout offers. Each offer includes USDC plus specific requirements — like "I want the next 3 video ad slots." Multiple sponsors can compete.

The creator has 48 hours to review and choose an offer.

Once accepted, there's a rage-quit window for backers. If you don't like the deal, you can exit at full curve price with zero exit tax. No forced lock-in. That's important — we protect backers.

After the window closes, graduation executes. The creator moves to S2 — the sponsored campaign market. And the remaining backers? They claim their share of the buyout USDC, proportional to their position. Early supporters even get a capped bonus share.

So the full loop is: you back a creator early with SPUMP, a sponsor pays real USDC to buy them out, and you get paid. That's the value prop.

---

## Slide 8 — Season 2: Sponsored Campaign Market

Season 2 is where the real business happens. This is the structured sponsorship market.

We designed a three-track budget model that gives sponsors granular control while protecting creators and rewarding fans.

**Track 1** is a fixed base pay. Guaranteed creator compensation, settled unconditionally. This is the "you definitely get paid" part.

**Track 2** is performance-driven. The budget is tied to verified metrics — views, clicks, saves. There's a cliff threshold: if the campaign doesn't hit the minimum, the sponsor gets a full refund. Above the cliff, 80% goes to the creator and 20% goes into a fan endorsement pool. Fans burn SPUMP to endorse campaigns and earn pro-rata USDC rewards from that pool.

**Track 3** is CPS — cost per sale — with a delayed settlement window. The sponsor pre-funds an estimated budget. After the refund period closes, the approved payout goes to the creator. Unused balance returns to the sponsor. If actual sales exceed the pre-funded amount, an overflow invoice is generated.

The whole campaign lifecycle flows from a content manifest to a proposal intent, then creator signs, sponsor signs, funds go into a Solana vault, and settlement happens per track.

---

## Slide 9 — Why Solana?

Now — why Solana? This isn't a marketing choice. Every core mechanism in StreamPump depends on specific Solana capabilities.

**Sub-second finality.** S1 market interactions — buying, selling, price updates — confirm in about 400 milliseconds. That's critical for bonding curve UX. You can't have users waiting 30 seconds to see if their trade went through.

**Less than a penny per transaction.** This is what makes Track 2 micro-settlements and Track 3 CPS payouts economically viable. Try doing that on Ethereum L1 — it's impossible.

**Token-2022.** The NonTransferable extension is exactly what we need for SPUMP. It's enforced at the protocol level — not by social convention, but by Solana's token program. Purpose-built for utility tokens.

**PDA architecture.** Protocol config, creator profiles, S1 positions, proposals, USDC vaults — all composable on-chain state derived from deterministic addresses. Everything is verifiable and queryable.

**Anchor framework.** Our program has over 20 type-safe instructions covering the full product lifecycle — S1 discovery, buyout, S2 campaigns, three-track settlement. All in one program.

And the **ecosystem** — wallet adapters, Web3Auth for social login, rock-solid RPC infrastructure, and devnet for rapid iteration. We had production-ready tooling from day one.

---

## Slide 10 — Architecture

Here's the technical architecture. We call it "hybrid by design."

On the left, you have the three user roles — creator, sponsor, and fan. They interact with a Next.js frontend, which talks to an Express API backed by Postgres, Cloudflare R2 for media storage, and Mux for video processing. An oracle and indexer service bridges the off-chain and on-chain worlds.

On the right, everything financial lives on Solana — the Anchor program, SPUMP mint on Token-2022, USDC vaults, and all PDA state.

The key design principle is: **DB-first for product workflow, chain-first for financial truth.**

Drafts, media uploads, proposal intents, retry logic — all of that lives in the database where it's fast and flexible. But the moment money needs to move — funding, settlement, token operations — that's on-chain. Solana is the source of truth for anything financial.

---

## Slide 11 — Current Status

So where are we today?

Our **Solana program** is an advanced prototype — over 20 Anchor instructions covering S1 market, buyout, S2 proposals, three-track settlement, content anchoring, and full protocol state management.

The **backend** is an integration prototype — Express API, Prisma models, auth system, content manifests, S1 transaction builders, market projections, R2 and Mux integration.

The **frontend** is demo-ready — a full Next.js shell with Explore, Trending, Creator pages, Portfolio, Market, Buyout, Workspace, Campaign, and Settlement surfaces.

We have two working demo paths. For S1, you can seed a devnet market, do live buy and sell transactions, claim USDC from a buyout, and verify your portfolio. For S2, you can go from wallet sign-in through content manifest, proposal intent, dual signature, to a confirmed Solana campaign with settlement pages showing real PDA data and transaction signatures.

---

## Slide 12 — Vision

Let me leave you with this.

StreamPump makes content the asset, fans the backers, and sponsors the revenue engine — all settled on Solana.

We're not building another token speculation platform. We're building infrastructure for the next generation of creator-sponsor relationships — where value flows directly between the people who create it and the people who fund it.

Thank you.
