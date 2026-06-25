# StreamPump · Demo Day Script (Colloquial & Concise, 5 Min / 9 Slides)

> **Speaker Guidelines:** Speak naturally and conversationally. Use a high-energy, fast-paced tone.
> **Names & Terms:** 罗永浩, Tim, 影视飓风, SPUMP, USDC, Token-2022, Firedancer.
> **Timing Target:** ~4:15 total (gives you a solid 45-second buffer under the 5-minute limit).

---

## Slide 1 — Where It Started (~40s)

This whole thing started with an interview. I was watching 罗永浩 sit down with Tim, the creator behind 影视飓风—one of China's biggest tech channels, with around 30 million followers across platforms. 

Listening to them, one major realization hit me: creator funding is completely broken at every single level.

Think about it. If you're a beginner, brands ignore you. 
If you're mid-tier, agencies take a massive 40% cut just to broker a deal.
And if you're at the top, like Tim, VC cash makes absolutely no sense. More money or more editors won't make his videos better or his brand worth more. Tim doesn't need VC cash; he needs a way to build a direct IP brand. 

Because for a creator, the audience's attention is the real asset—not a VC check.

StreamPump is here to give creators a healthier way to grow that asset and get paid.

> *(Visuals: Split screen. Left: "Middlemen take 40%." Right: "More cash ≠ Better content." Picture of Tim and 罗永浩.)*

---

## Slide 2 — Crypto Tried, and It Broke (~15s)

Now, Web3 tried to fix this. But they mostly built speculation casinos.

Friend.tech's daily users fell to about fifteen — revenue to seventy-one dollars — and the team literally burned the contract. Rally, a creator-token platform, raised fifty-seven million and then shut down its chain, stranding everyone's assets. Farcaster raised a hundred and fifty million at just eighty thousand daily users — and still lost ninety-five percent of its sign-ups. 

The creator economy is a 480-billion-dollar market. What it actually needs is a trust layer, not another token casino.

> *(Visuals: Trend line showing Friend.tech's volume crash to zero.)*

---

## Slide 3 — Three Failure Modes, Flipped (~35s)

So why did SocialFi keep failing? It came down to three design choices — and we flipped every one of them. Same problem, opposite decision.

**One — the token.** They launched a tradable coin, so speculators just pump and dump. We made SPUMP soulbound: non-transferable, never listed on any exchange. The logic is simple — if there's no market to trade it on, there's nothing to speculate on. It's a reputation token, not a casino chip.

**Two — where the yield comes from.** They printed inflationary tokens to pay users, and that's the death spiral right there. We do the opposite: we pre-fund the vaults with real brand budgets, in USDC. Yield has to come from real commercial spenders — not from a money printer.

**Three — the content.** They tried to force entire videos on-chain, which is slow and expensive. We keep the videos in a fast database, and only anchor the creator's signature and hash on Solana. Web2 speed for the workflow, Web3 truth for the money.

Same three problems everyone else had — three deliberate inversions. The result: on StreamPump, sponsors are marketing spenders, not token gamblers.

> *(Visuals: Three comparison cards — left "Their Way" vs. right "Our Way": 1. Speculation → Soulbound, 2. Inflation → Real USDC, 3. Bloated Storage → Clean Attribution.)*

---

## Slide 4 — The Philosophy: Lifecycles & Seasons (~25s)

Our architecture comes from one basic insight: **a creator’s needs change as they grow**.

In the early discovery stage, creators have no track record. Brands won’t touch them. What they need is the crowd—fans and scouts to discover them, back them with skin-in-the-game, and prove their content has value. That is **Season 1: Creator Discovery**.

But once they build momentum, their challenge shifts to scaling. They need corporate sponsors with real USDC ad budgets to fund campaigns and grow their IP. That is **Season 2: Sponsored Campaigns**.

StreamPump connects these phases into a single Web2.5 loop on Solana.

> *(Visuals: Creator lifecycle timeline showing the transition from Season 1 (Discovery) to Season 2 (Commercialization).)*

---

## Slide 5 — Season 1: Discovery & the Buyout (~50s)

So Season 1 is discovery. Fans earn non-transferable SPUMP and burn it to back early creators along a quadratic curve. It's recorded as an on-chain position — not a tradable token. No secondary market, so no pump-and-dumps.

Now here's the part that matters — the buyout. This is the bridge from "promising creator" to "real commercial deal."

Once a creator builds enough momentum, sponsors compete for them. They place USDC bids into an escrow vault on-chain, and the creator picks the offer they want. The winning bid is locked in.

Then the money splits — and this is our compliance fix. The creator takes the majority; we want the creator to win. The fans who backed them get paid too, but look at how. There are just two tiers — early backers and regular backers. Early backers earn twice what a regular backer gets, two to one, to reward conviction. And every payout is capped — about a hundred dollars max per person. It's based on how early you were, not how much you staked: inside a tier, a whale and a small fan get the exact same amount. That's what breaks pro-rata investment yields and keeps us clear of securities law.

And nobody's trapped. If a fan doesn't like the sponsor, they rage-quit before the deadline — 100% of their SPUMP back, zero exit tax.

Once that buyout settles, the creator graduates — they move out of discovery and into Season 2, where the real sponsorship business happens.

> *(Visuals: Auction → escrow vault → payout split. Large slice to Creator; fan pool split into Early (2×) and Regular (1×) tiers, each capped (~$100). Arrow out to "Graduate → Season 2.")*

---

## Slide 6 — Season 2: Programmatic Campaigns (~30s)

Once graduated, the creator enters Season 2. Sponsors bypass expensive agencies, pre-fund USDC into a PDA escrow vault, and run campaigns across three programmatic tracks:

1. **Fixed Sponsorship:** Guaranteed, unconditional creator payout.
2. **Metric Cliff Performance:** Tied to verified views or clicks. If the campaign fails to hit the minimum cliff, the sponsor gets a 100% refund. Above it, the budget settles: 80% to the creator, 20% to fans.
3. **Cost-Per-Sale:** Pre-funded budget settled after consumer refund windows close.

This gives brands transparent risk choices while aligning creators and fans with commercial growth.

> *(Visuals: Grid representing Track 1 (Fixed), Track 2 (Performance Cliff), and Track 3 (CPS).)*

---

## Slide 7 — Why Solana (~15s)

And this only works on Solana. Sub-second finality keeps the curve instant. Sub-penny fees make micro-settlements viable. And Token-2022 enforces soulbinding natively — at the protocol layer. It's not a marketing choice; it's a requirement.

> *(Visuals: Logos of Solana and Firedancer. Key stats: 150ms latency, <$0.001 fee, Token-2022, 13 PDAs.)*

---

## Slide 8 — Status: Verified on Devnet (~10s)

This isn't a mockup — the core corridor is tested end-to-end on devnet with real on-chain proof. You are more than welcome to try it out right now! Just scan this QR code to access the live test environment and experience the creator workspace yourself.

> *(Visuals: corridor diagram with on-chain proof badges — PDA, tx signature, content hash. QR code to live demo + UI testing.)*

---

## Slide 9 — Where This Goes, and Why I'm Building It (~45s)

Let me close with what I believe. Content is the asset. Fans are the curation engine. Sponsors are the capital. And Solana is the source of truth.

But bigger than StreamPump — here's my real conviction about this whole space. 

For consumer Web3 to reach the next billion users, we have to stop building speculation-first. Stop printing inflation tokens and praying for the next buyer. Start building products that pull in real, real-world business budgets. 

I genuinely believe utility-first is not just possible on Solana — it's the only version of Web3 that lasts. And I want to be one of the people building it.

A quick word about me. I'm a CS graduate from the University of Illinois, and before this I built industrial-internet system products. I'm new to Solana, but I am all in: I came in, learned the stack, and shipped this entire product end to end on my own.

I'm here looking for the right team and the right people to build the future of consumer crypto with. Scan the code — let's talk. Thank you!

> *(Visuals: Big typography "From Speculation-First to Utility-First." QR code linking to GitHub / Twitter / Telegram / resume.)*
