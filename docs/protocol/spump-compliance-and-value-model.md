# SPUMP Compliance Posture and Value Model (Design)

Status: DESIGN / PROPOSAL — not implemented on-chain or in the DB yet. Treat every mechanic below as `NOT_STARTED`.
Last updated: 2026-06-19

> Not legal advice. This is a product-design and risk-reduction proposal written by the engineering team. The securities characterization of SPUMP and of backer USDC rewards must be confirmed by qualified counsel before any public, real-money launch. This document defines the design changes that make a defensible characterization *possible*, and the legal steps that are still required.

This document answers two high-priority feasibility blockers, which are the same problem viewed from two angles:

1. Securities / Howey risk. The structure "burn SPUMP to back a creator early -> receive USDC proportional to your position when a sponsor buys the creator out" closely resembles an investment contract. Non-transferability of SPUMP is a mitigating factor, not an exemption — regulators look at economic substance, not token mechanics.
2. SPUMP has a de facto USD price. Because "burn SPUMP -> possibly receive USDC" holds and the payout is proportional to the amount staked, users can compute `E[USDC | 1 SPUMP]`. That makes daily emission feel like money printing and lets SPUMP whales dominate reward pools despite per-user caps.

Read with `docs/protocol/s1-market-design.md` (current S1 economics) and `docs/protocol/fan-loyalty-and-spump-economy.md` (the loyalty/sink layer that this posture depends on).

## The Single Root Cause

Both problems are produced by one mechanism: a **stake-proportional path from a cost-bearing input (SPUMP) to a USDC profit driven by others' efforts**.

```text
SPUMP (has acquisition cost: time + attention)
  -> staked proportionally into an S1 position / endorsement
  -> USDC payout scales with stake size, conditioned on creator + sponsor success
```

- That proportional, profit-seeking path is what trips Howey prongs 3 (expectation of profit) and 4 (from the efforts of others).
- The same proportionality is what assigns SPUMP an implicit dollar value: if 10x stake yields ~10x USDC, then SPUMP has a stable per-unit USD expectation, i.e. a price.

Therefore: **break the proportionality between stake and USDC, and recharacterize the payout as a reward for an activity rather than a return on capital.** Doing so weakens the securities profile and collapses the implicit price at the same time.

## Founder Constraint We Must Preserve

The cost side of backing is the conviction signal and must stay: "non-transferability is not a compromise — it is the mechanism that makes backing meaningful. It is skin in the game priced in time and attention, not money."

This redesign honors that exactly. It changes only the **reward** side, never the **cost** side:

- Cost of backing stays SPUMP = earned time/attention. Unchanged. This is the skin in the game.
- Reward for backing shifts from "USDC proportional to your stake" (investment return) to "permanent status + a capped, platform-funded discovery reward" (reward for the activity of early curation).

So backing remains a costly, credible conviction signal, but it is no longer an investment contract.

## Howey Analysis — Current Structure (Risk)

| Prong | Current S1 buyout path | Assessment |
|---|---|---|
| Investment of money | SPUMP burned; SPUMP has acquisition cost (time, and emission has real value) | Likely satisfied — "money" is read broadly; value given counts |
| Common enterprise | Pooled into a creator's bonding curve; fortunes rise/fall together | Likely satisfied (horizontal + vertical commonality) |
| Expectation of profit | Backers claim USDC pro-rata at buyout; upside scales with stake | Satisfied — this is the core problem |
| From efforts of others | Returns depend on creator growth + sponsor buyout decision | Satisfied |

Current code reference: `claim_s1_buyout_usdc` distributes strictly pro-rata to position size (with an early/regular cohort split); S2 `settle_track2` + `claim_endorsement` pay the 20% performance pool pro-rata to endorsement size. Both are proportional-return structures today.

Conclusion: under current mechanics, the backer/endorser flows have a high investment-contract risk profile. This must be addressed before serving real public users.

## The Fix — Four Layers of Defense in Depth

No single change is a silver bullet. Securities posture is defended in depth, with economic substance first because that is what regulators actually weigh.

### Layer 1 — Economic substance (decisive)

This is the layer that makes the other three credible. Change what actually happens, not just what it is called.

1. Decouple reward from stake size. Backer USDC is no longer a pro-rata slice of the buyout. Options (see "Mechanism Options" below): equal/flat discovery reward among qualifying early backers, or a reward tiered by participation quality and recency (loyalty badge tier, how early) with a hard per-user cap — never scaled by SPUMP amount.
2. SPUMP is consumed, not invested. Frame and implement SPUMP spend as non-refundable consumption of earned attention. De-emphasize the "sell your S1 position back for SPUMP" mental model that makes a position feel like a tradable, priced asset; treat selling as "unbacking," and keep the dynamic exit friction.
3. Cap and bound the upside. Hard per-user USDC caps. Bounded, predictable rewards read as rebate/cashback; uncapped proportional upside reads as yield. Refunds (e.g. failed-campaign endorsement) return only the user's own consumed principal, never a profit.

Result: the payout becomes a reward for the activity of early discovery/curation, not a return on invested capital. Howey prongs 3 and 4 weaken substantially, and the per-SPUMP USD expectation stops being a stable price because more SPUMP no longer buys more USDC.

### Layer 2 — Legal characterization and structure

- Recharacterize backer USDC as a platform loyalty / discovery reward (a rebate), funded as a marketing expense by the platform and/or sponsor. This is the same category as cashback, referral bounties, creator-fund payouts, and finder's fees — generally not securities when capped and tied to an activity rather than to capital at risk.
- Obtain a token classification memo / legal opinion before public launch, explicitly covering (a) SPUMP as a non-transferable utility/consumption unit with no monetary value and no profit expectation, and (b) the backer reward as a discretionary, capped platform reward. This is a hard blocker.
- Confirm the funding/entity structure supports the "marketing reward" characterization (who funds the reward pool, who custodies USDC, how it is disclosed).

### Layer 3 — Jurisdiction and access controls

- Geofence early markets: launch first in a chosen friendly jurisdiction and exclude the US (and other strict regimes) until classification is clear. Enforce via IP + KYC gating.
- KYC/KYB: sponsor KYB already exists; add light KYC for any user who can receive USDC (supports both the reward characterization and AML).
- Disclosures / ToS: state plainly that SPUMP has no monetary value, is non-transferable, confers no profit expectation, and that USDC rewards are discretionary, capped platform rewards.

### Layer 4 — Narrative and UX discipline

Substance can be undone by marketing. Enforce language rules in product and docs:

- Banned: "investment", "ROI", "yield", "APY", "returns", "profit", "passive income", price charts for SPUMP, any SPUMP->USDC expected-value calculator.
- Use instead: "discovery reward", "loyalty reward", "supporter reward", "platform rebate", "early-supporter status".
- Headline reward is status (founding badge); USDC is a bounded bonus, never the pitch.

## Solving SPUMP's Implicit USD Price Specifically

The implicit price is `E[USDC | spend 1 SPUMP]`. Four converging mechanisms drive it toward noise:

1. Non-proportional rewards (Layer 1.1): more SPUMP no longer yields more USDC, so there is no stable per-unit price.
2. Hard caps (Layer 1.3): bounded upside flattens the expectation.
3. Utility sinks dominate demand (the loyalty layer): cheer, boost, badge-tier claims, and perk unlocks are pure consumption with no USDC path at all. When most SPUMP demand is non-monetary utility, the USDC-expectation component of SPUMP value shrinks to a rounding error. This is why the loyalty/sink design is not just engagement — it is a compliance mechanism.
4. Emission framed as an allowance: daily SPUMP is a participation allowance sized to the utility economy (how much cheering/boosting/leveling the network does), not a USDC-redemption economy. It is spending money for a game, not printed currency with a redemption rate.

Whale concern: once endorsement/discovery rewards are capped per user and decoupled from stake size, a SPUMP-rich whale can no longer convert a large balance into a large USDC share. Balance buys more voice/utility (cheer, boost, status), not more money.

## Mechanism Options (to decide with counsel)

S1 buyout backer reward — replace pro-rata split with one of:

- Option A (flat discovery reward): qualifying early backers split a capped, platform/sponsor-funded discovery pool in equal shares (or shares that depend only on how early they were, not on SPUMP amount). Simplest "not proportional to investment" story.
- Option B (loyalty-tiered reward): reward determined by fan-badge tier and recency, hard-capped per user, independent of SPUMP staked. Ties into the loyalty layer; rewards genuine fans over capital.
- Option C (status-primary): buyout USDC is the creator's commercial proceeds; backers receive permanent founding status plus a small fixed "thank-you" reward. Strongest compliance posture; relies on status being the real prize.

The buyout USDC that currently flows to backers would instead largely flow to the creator (it is the creator's deal), with a bounded, separately-funded reward pool for early supporters. This is a financial-semantics change and is audit-sensitive.

S2 endorsement (Track 2 fan pool):

- Keep endorsement as a costly support signal, but cap the per-user USDC reward and decouple it from endorsement size, or convert part of the fan share into non-USDC rewards (badge XP, status, perks). Failed-campaign refunds remain principal-only.

## Required Code Changes (Specification Only — Not Executed Here)

These are audit-sensitive financial-semantics changes. They are intentionally NOT implemented in this pass. They require counsel sign-off, an Anchor audit, and full test rewrites (per repo rules: do not change financial semantics casually).

- `claim_s1_buyout_usdc`: replace strict pro-rata distribution with the chosen capped/decoupled reward model; redirect the bulk of buyout USDC to the creator; add per-user reward caps in `ProtocolConfig`.
- `settle_track2` / `claim_endorsement`: cap per-user fan-pool reward and decouple from endorsement size.
- `sell_s1_token`: re-frame as "unbacking"; evaluate whether return mechanics should change to reduce "tradable position" perception.
- Add KYC/geofence gating at the API layer for USDC-receiving actions.
- Update all Anchor and backend tests for the new settlement math; update `docs/protocol/s1-market-design.md` parameters.

## Howey Analysis — After Redesign (Defensible)

| Prong | After redesign | Assessment |
|---|---|---|
| Investment of money | SPUMP is consumed as a non-refundable participation cost (earned attention) | Weakened; framed as consumption, not investment |
| Common enterprise | Backing is curation/support; reward not pooled-proportional | Weakened |
| Expectation of profit | Reward is capped, non-proportional, discretionary platform reward for an activity | Substantially weakened — looks like a rebate/bounty, not profit |
| From efforts of others | Reward depends on the user's own curation activity + a capped platform reward, not a proportional cut of others' success | Weakened |

Combined with geofencing, KYC, disclosures, and disciplined narrative, the redesigned flow has a materially more defensible posture. Final classification still requires counsel.

## Phased Rollout and Blockers

Order (each phase ends with verification; no copy-only promotion):

1. Design sign-off + counsel engagement (blocker). Decide jurisdiction and mechanism option.
2. Narrative/UX discipline (Layer 4) and disclosures — safe to do now in copy and docs.
3. Utility sinks live (loyalty layer) so SPUMP demand is mostly non-monetary before any public launch.
4. Geofencing + KYC gating at the API layer.
5. Audit-gated on-chain settlement redesign (Layer 1.1–1.3).

Blockers (stop-and-report per repo policy):

- Legal opinion / token classification memo — required before public, real-money launch. Engineering cannot self-certify this.
- Jurisdiction decision (which markets to open first, which to geofence) — business/legal call.
- Anchor audit of any settlement-math change before mainnet/real funds.

## Open Decisions

- Which mechanism option (A/B/C) for the S1 buyout reward.
- Per-user USDC reward caps and the size/funding source of the discovery reward pool.
- Whether to keep any SPUMP return on S1 "unbacking", or move to full-consumption.
- First-launch jurisdiction and KYC depth for USDC-receiving users.
