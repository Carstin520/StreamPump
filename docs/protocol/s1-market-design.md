# StreamPump S1 Market Design

S1 is the creator discovery layer before sponsored S2 campaigns. It is meant to surface early creator momentum without turning StreamPump into a pure fan-token exchange.

## Token Model

There are two different assets in S1:

- `SPUMP`: a non-transferable Token-2022 participation asset. Users earn it through daily/activity emissions and spend it inside the protocol.
- S1 creator position: a virtual internal position stored in `S1UserPosition`. It is not an SPL token and cannot be transferred.

Buying S1 exposure burns `SPUMP` and increases the user's creator-specific virtual balance. Selling mints `SPUMP` back from the protocol PDA, minus exit tax.

## Rating-Adjusted Curve

The curve is still linear, but the slope is adjusted by a creator momentum rating:

```text
effective_k = base_k * creator_rating_bps / 10_000
buy cost = effective_k / 2 * ((S + dS)^2 - S^2)
sell return = effective_k / 2 * (S^2 - (S - dS)^2)
```

Default protocol parameters:

```text
base_k = 1,000
default creator rating = 10,000 bps
rating range = 5,000 - 20,000 bps
max daily rating delta = 1,000 bps
rating effective delay = 86,400 seconds
default S1 graduation target supply = 2,500
```

At the default rating, an early user spending `10 SPUMP` from zero supply gets about `141` virtual S1 shares.

## Creator Momentum Rating

The rating should be computed off-chain and written by the oracle at most once per day. The intended score is a fixed algorithm, not a manual market maker:

```text
30% follower growth velocity
20% content update consistency
20% engagement quality
15% sponsor/commercial fit
10% retention or repeat viewer signal
5% fraud/reliability penalty
```

The daily update cap, cooldown, and one-epoch delayed effectiveness exist to reduce rating-front-running. Oracle updates schedule a pending rating first; normal S1 buy/sell activates it only after `pending_rating_effective_at`. A rating update is based on a report digest so the frontend can later display rating provenance.

## SPUMP Emission

Daily `SPUMP` is multiplied by a protocol-level emission multiplier:

```text
reward = base_reward_by_user_level * daily_spump_emission_multiplier_bps / 10_000
```

New accounts are additionally discounted during the configured new-user window:

```text
new user reward = platform reward * new_user_emission_bps / 10_000
default new_user_emission_bps = 2,500
default new_user_emission_window_seconds = 604,800
```

Recommended launch policy:

```text
active users < 1,000: 10x
1,000 - 10,000 active users: decay 5x -> 2x
10,000 - 100,000 active users: decay 2x -> 1x
100,000+ active users: 1x
```

This gives early users enough `SPUMP` to experience S1 while allowing the asset to become scarcer as the network grows.

## Graduation Target

The previous read-model target of `100,000` virtual supply made early support economically irrelevant. The v1 protocol default is now `2,500`.

With `base_k = 1,000` and default rating:

```text
10 early supporters * 10 SPUMP each ~= 447 total virtual supply
447 / 2,500 ~= 17.9%
```

In a `10,000 USDC` buyout, the first 10 supporters collectively have an upper-bound claim near `1,790 USDC` if nobody exits and later supply reaches the target. This is close to the desired `15%-20%` early-supporter upside, while still leaving most buyout value for broader supporters.

For stronger or later-stage creators, the oracle should raise `s1_graduation_target_supply`:

```text
early platform / small creator: 2,500 - 5,000
normal micro creator: 5,000 - 10,000
strong creator / mature platform: 10,000 - 25,000
```

## Anti-Arbitrage Guardrails

Current guardrails:

- `SPUMP` is non-transferable.
- S1 creator positions are virtual and non-transferable.
- Buy burns `SPUMP`; sell mints back through the protocol PDA.
- Sell has dynamic exit tax while creator is `S1_Active`.
- Buyout acceptance stops normal S1 buy/sell and opens only a 48-hour rage-quit window.
- S1 buy requires a registered user profile with fan role and minimum activity score.
- Each user has a per-creator daily S1 buy budget cap denominated in burned `SPUMP`, not virtual shares.
- New user daily `SPUMP` emission is lower during the new-account window.
- Rating updates are oracle-signed, daily-limited, capped by max daily delta, and delayed before they affect price.
- Early cohort buyout claims are split into a separate pool capped by protocol bps.

Default anti-arbitrage parameters:

```text
s1_min_user_xp = 10
max_s1_daily_buy_spump = 15,000,000 base units = 15 SPUMP
s1_early_cohort_supply_threshold = 500
s1_early_cohort_buyout_cap_bps = 2,000
s1_rage_quit_window_seconds = 172,800
```

## S1 Buyout Lifecycle

S1 buyout is the graduation bridge from creator discovery into S2 sponsored campaigns:

```text
S1_Active
  -> init_s1_buyout
S1_Auction_Pending
  -> submit_buyout_offer
S1_Auction_Pending with escrowed sponsor offer
  -> accept_buyout_offer
S1_Execution_Pending with rage-quit window
  -> execute_s1_graduation
S2_Active
  -> claim_s1_buyout_usdc
S1 positions cleared as holders claim
```

During `S1_Auction_Pending`, normal S1 buy/sell is blocked. During `S1_Execution_Pending`, normal buy/sell remains blocked and holders can only use `rage_quit_s1` before the configured deadline. After graduation, holders claim USDC against the accepted offer vault and their virtual S1 positions are zeroed.

The buyout split is bucketed at graduation:

```text
early_supply = min(creator.s1_early_cohort_supply, creator.s1_supply)
early_pool = min(natural pro-rata, buyout_amount * early_cap_bps / 10_000)
regular_pool = buyout_amount - early_pool
```

The creator also receives a SPUMP graduation bonus equal to 50% of the full S1 curve sell return at the final supply. The other 50% is not minted.

## S1 Buyout Happy Path

The fixed localnet acceptance path is `npm run test:s1:happy` with a local validator running the current `streampump_core.so`.

The test uses a short `2` second rage-quit window and restores the production `48h` value afterward. It creates an isolated creator, sponsor, and `21` fans:

```text
21 fans * 25 S1 shares = 525 total supply
early cohort threshold = 500 shares
buyout offer = 1,000 USDC raw amount = 1,000,000,000
early pool = 200,000,000
regular pool = 800,000,000
```

Acceptance requires the creator to reach `S2_Active`, level `>= 2`, one early holder to claim `10,000,000` raw USDC, one regular holder to claim `800,000,000` raw USDC, and both claimant positions to be zeroed.

## Readiness Scope

This S1 work is protocol and backend readiness. The live trading UI should still be treated as a separate rollout surface: front-end pages need to show rating provenance, pending-effective rating, daily SPUMP cap usage, and buyout/rage-quit state before S1 is promoted as public trading.

Recommended next additions:

- Frontend display of rating provenance and next update time.
- S1 buyout read model showing early-supporter concentration before creator accepts an offer.
- Add a `rage_quit_s1` event and backend projection branch so read models reflect rage-quit exits before graduation.
- Add market projection handling for cancelled and reclaimed buyout offers.
- Add early/regular buyout bucket fields to the backend projection if the frontend needs to display claim pool breakdowns directly.
