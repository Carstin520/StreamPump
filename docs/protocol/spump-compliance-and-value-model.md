# SPUMP Compliance Posture and Value Model (Design)

Status: CODE-IMPLEMENTED SEMANTICS / NOT LEGAL-CLEARED / NOT AUDITED / NOT DEPLOYED. The capped, decoupled reward mechanics now exist in local code, tests, projections, and UI copy, but product readiness must remain `NOT_STARTED` / `MOCK_PREVIEW` until legal, audit, migration, deployment, and wallet-smoke gates are cleared.
Last updated: 2026-06-21

> Not legal advice. This is a product-design and risk-reduction proposal written by the engineering team. The securities characterization of SPUMP and of backer USDC rewards must be confirmed by qualified counsel before any public, real-money launch. This document defines the design changes that make a defensible characterization *possible*, and the legal steps that are still required.

This document answers two high-priority feasibility blockers, which are the same problem viewed from two angles:

1. Securities / Howey risk. The structure "burn SPUMP to back a creator early -> receive USDC proportional to your position when a sponsor buys the creator out" closely resembles an investment contract. Non-transferability of SPUMP is a mitigating factor, not an exemption — regulators look at economic substance, not token mechanics.
2. SPUMP has a de facto USD price. Because "burn SPUMP -> possibly receive USDC" holds and the payout is proportional to the amount staked, users can compute `E[USDC | 1 SPUMP]`. That makes daily emission feel like money printing and lets SPUMP whales dominate reward pools despite per-user caps.

Read with `docs/protocol/s1-market-design.md` (current S1 economics) and `docs/protocol/fan-loyalty-and-spump-economy.md` (the loyalty/sink layer that this posture depends on). The weighted-influence/leveling design in `docs/protocol/user-influence-and-leveling.md` depends on this firewall too: user standing may move discovery/traffic freely but must never multiply a financial claim, and may reach creator valuation only as bounded, oracle-mediated evidence.

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

## Howey Analysis — Pre-Redesign Structure (Risk)

| Prong | Current S1 buyout path | Assessment |
|---|---|---|
| Investment of money | SPUMP burned; SPUMP has acquisition cost (time, and emission has real value) | Likely satisfied — "money" is read broadly; value given counts |
| Common enterprise | Pooled into a creator's bonding curve; fortunes rise/fall together | Likely satisfied (horizontal + vertical commonality) |
| Expectation of profit | Backers claim USDC pro-rata at buyout; upside scales with stake | Satisfied — this is the core problem |
| From efforts of others | Returns depend on creator growth + sponsor buyout decision | Satisfied |

Historical code reference: the pre-redesign `claim_s1_buyout_usdc` distributed buyout USDC pro-rata to position size, and S2 `claim_endorsement` paid the Track2 fan pool pro-rata to endorsement size. That proportional-return structure is the risk this redesign removes at the code level.

Conclusion: under the pre-redesign mechanics, the backer/endorser flows had a high investment-contract risk profile. The code-level redesign removes the proportional path, but legal clearance is still required before serving real public users.

## The Fix — Four Layers of Defense in Depth

No single change is a silver bullet. Securities posture is defended in depth, with economic substance first because that is what regulators actually weigh.

### Layer 1 — Economic substance (decisive)

This is the layer that makes the other three credible. Change what actually happens, not just what it is called.

1. Decouple reward from stake size. Backer USDC is no longer a pro-rata slice of the buyout. The code now supports `FlatEqual`, `EarlinessTiered`, and `StatusPrimary` reward models, with `EarlinessTiered` as the default. Unit rewards are based on holder counts/tier counts and caps, never scaled by SPUMP amount.
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

S1 buyout backer reward — supported code paths:

- Option A / `FlatEqual`: qualifying backers split a capped discovery pool in equal shares. Simplest "not proportional to investment" story.
- Option B / `EarlinessTiered`: default code path. Reward is determined by early/regular holder counts and fixed weights, hard-capped per user, independent of SPUMP staked.
- Option C / `StatusPrimary`: buyout USDC is mainly the creator's commercial proceeds; backers receive permanent founding status plus a small fixed "thank-you" reward. Strongest compliance posture; relies on status being the real prize.

The buyout USDC that previously flowed mostly to backers now largely flows to the creator (it is the creator's deal), with a bounded reward pool for early supporters. This is a financial-semantics change and is audit-sensitive.

S2 endorsement (Track 2 fan pool):

- Keep endorsement as a costly support signal, but cap the per-user USDC reward and decouple it from endorsement size, or convert part of the fan share into non-USDC rewards (badge XP, status, perks). Failed-campaign refunds remain principal-only.

## Code Implementation Status

These are audit-sensitive financial-semantics changes. They are implemented in local code and tests, but that does not mean SPUMP is legally cleared, production-ready, or deployable.

- `ProtocolConfig`, `S1BuyoutState`, and `Proposal` now carry reward-model, cap, residual-destination, creator-share, and holder-count snapshots.
- `CreatorProfile` now carries chain-maintained S1 eligible/early/regular holder counters for new S1 cycles. `buy_s1_token`, `sell_s1_token`, and `rage_quit_s1` update those counters by bucket diff; graduation reads the counters from chain state instead of trusting user-supplied counts.
- `execute_s1_graduation` is currently restricted to `oracle_authority`, sends the configured creator share from the accepted offer vault to the creator payout ATA, and leaves only the discovery pool for backers.
- `claim_s1_buyout_usdc` now functions as a discovery-reward claim: it uses model/count/cap snapshots and does not multiply by `internal_token_balance`. Ineligible callers are rejected without clearing their S1 position; only counted eligible holders may finalize, including legitimate zero-USDC model outcomes.
- S1 buyout vault liveness now has two paths: normal final-claim close, or admin/oracle `sweep_s1_buyout_residual` after the configured claim window. Swept unclaimed rewards expire; residual is routed by the snapshotted residual destination and vault rent is returned to the sponsor.
- `settle_track2` / `claim_endorsement` now use capped flat Track2 fan rewards instead of stake-proportional USDC rewards. Failed/cancelled/voided principal-return behavior remains separate.
- Backend projections and frontend copy now expose capped reward state and avoid showing proportional S1/S2 USDC estimates.
- `sell_s1_token` math is intentionally unchanged in this task; user-facing language should call it "unbacking." Whether it should become full consumption remains a separate legal/business decision.

Still not implemented in this pass: KYC/geofence gating for USDC-receiving actions, production migrations, program deployment, legal sign-off, external audit, wallet-backed devnet smoke, and a one-time backfill for pre-counter in-flight S1 buyouts.

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
- Whether `execute_s1_graduation` and residual sweep should remain oracle/admin-only after audit, or whether graduation can become permissionless again once counters are proven.
- Whether 30 days is the right default for `s1_discovery_claim_window_seconds`.
- Whether residual and vault rent should keep routing to the current default destinations (residual by snapshot, rent to sponsor) across all jurisdictions.
- Whether to keep any SPUMP return on S1 "unbacking", or move to full-consumption.
- First-launch jurisdiction and KYC depth for USDC-receiving users.
