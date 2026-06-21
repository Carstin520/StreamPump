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

Under the capped discovery-reward model, graduation target still controls creator-momentum pacing, but it no longer determines a pro-rata USDC claim. A larger S1 balance can affect whether the user remains a backer, but it must not scale the user's USDC reward. Buyout USDC now primarily belongs to the creator, with only a bounded discovery pool available to eligible backers.

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
- Buy burns `SPUMP`; sell remains mathematically unchanged in this phase and should be presented as "unbacking" in user-facing copy.
- Sell has dynamic exit tax while creator is `S1_Active`.
- Buyout acceptance stops normal S1 buy/sell and opens only a 48-hour rage-quit window.
- S1 buy requires a registered user profile with fan role and minimum activity score.
- Each user has a per-creator daily S1 buy budget cap denominated in burned `SPUMP`, not virtual shares.
- New user daily `SPUMP` emission is lower during the new-account window.
- Rating updates are oracle-signed, daily-limited, capped by max daily delta, and delayed before they affect price.
- Backer buyout rewards are capped per user and decoupled from S1 balance size. Early cohort status can affect the fixed unit amount, but no reward formula may multiply by `internal_token_balance`.

Default anti-arbitrage parameters:

```text
s1_min_user_xp = 10
max_s1_daily_buy_spump = 15,000,000 base units = 15 SPUMP
s1_early_cohort_supply_threshold = 500
s1_early_cohort_buyout_cap_bps = 2,000
s1_rage_quit_window_seconds = 172,800
s1_buyout_creator_share_bps = 8,000
s1_buyout_reward_model = EarlinessTiered
s1_discovery_reward_cap_usdc = 100,000,000 raw USDC
s1_status_thankyou_usdc = 10,000,000 raw USDC
s1_buyout_residual_to = Creator
s1_discovery_min_hold_seconds = 0
s1_discovery_claim_window_seconds = 2,592,000
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

During `S1_Auction_Pending`, normal S1 buy/sell is blocked. During `S1_Execution_Pending`, normal buy/sell remains blocked and holders can only use `rage_quit_s1` before the configured deadline. After graduation, holders may claim a capped discovery reward against the accepted offer vault and their virtual S1 positions are zeroed. The instruction name `claim_s1_buyout_usdc` is retained for IDL/client compatibility, but the product meaning is "claim discovery reward," not "claim buyout share."

Graduation is currently oracle-gated even though the holder counts are now maintained on-chain. `execute_s1_graduation` requires the caller to be `ProtocolConfig.oracle_authority`, reads holder counts from `CreatorProfile`, and no longer accepts an external holder-count argument. The oracle constraint is a conservative transition guard; whether to restore permissionless cranking after audit is an explicit open decision.

S1 holder counts are chain-maintained true values for new S1 cycles:

```text
eligible holder <=> S1UserPosition.internal_token_balance > 0
early holder <=> min(early_cohort_balance, internal_token_balance) > 0
regular holder <=> eligible and not early
```

`CreatorProfile` stores `s1_eligible_holder_count`, `s1_early_holder_count`, and `s1_regular_holder_count`. `buy_s1_token`, `sell_s1_token`, and `rage_quit_s1` update these counters by diffing the user's pre-change and post-change bucket. Counter underflow is a hard error, not a saturating correction.

Migration caveat: legacy `CreatorProfile` accounts receive zeroed holder counters during realloc migration because the historical holder distribution cannot be reconstructed from the profile account alone. Any pre-migration, not-yet-graduated buyout must either stay on the temporary oracle-snapshot path or be handled by a one-time backfill script that scans all `S1UserPosition` accounts and writes the reconstructed counts before graduation. New S1 cycles created after the counter migration use the chain counters as the source of truth.

The buyout split is snapshotted at graduation:

```text
creator_payout_usdc = buyout_amount * s1_buyout_creator_share_bps / 10_000
discovery_pool_usdc = buyout_amount - creator_payout_usdc
discovery_pool_remaining = discovery_pool_usdc
```

Reward models are stored as a chain enum snapshot so later config changes do not alter accepted buyouts:

| Model | Meaning |
| --- | --- |
| `FlatEqual` | Every eligible backer receives `min(pool_remaining / eligible_holder_count, cap)`. |
| `EarlinessTiered` | Eligible early backers and regular backers receive fixed unit amounts based on tier counts and weights, not on S1 balance size. Current code uses early weight `2` and regular weight `1`, then applies the per-user cap. |
| `StatusPrimary` | Backers primarily receive founding-supporter status; USDC is limited to `min(s1_status_thankyou_usdc, cap, pool_remaining)`. |

Residual USDC exists because capped, decoupled rewards may leave pool dust or unused budget. `s1_buyout_residual_to` controls whether the remaining pool returns to the creator or sponsor. It must never be redistributed pro-rata to backers.

Residual and vault liveness:

- Normal close path: when the last counted claimant finalizes, residual USDC is sent to the snapshotted residual destination, `discovery_pool_remaining` reaches zero, and the accepted offer vault is closed. Vault rent is returned to the sponsor, matching the offer funding/rent payer flow.
- Claim window: `s1_discovery_claim_window_seconds` defaults to 30 days from `graduated_at`.
- Sweep path: after the claim window, `sweep_s1_buyout_residual` may be called only by `oracle_authority` or `admin`. It sends all remaining vault USDC to the snapshotted residual destination, zeroes the remaining holder counts/pool, closes the vault, and emits `S1BuyoutResidualSwept`.
- Post-sweep: unclaimed discovery rewards are expired. Later claims are expected to fail because the vault is closed or empty.

Ineligible claim attempts are explicit errors. A caller outside the counted holder set, a user with no S1 balance, or a user who fails the hold-duration gate must not have their `S1UserPosition` cleared. The only zero-USDC path that may clear a position is a counted, eligible holder whose configured model legitimately yields `0` reward, such as `StatusPrimary` with zero thank-you amount.

The creator also receives a SPUMP graduation bonus equal to 50% of the full S1 curve sell return at the final supply. The other 50% is not minted.

## S1 Buyout Happy Path

The fixed localnet acceptance path is `npm run test:s1:happy` with a local validator running the current `streampump_core.so`.

The test uses a short `2` second rage-quit window and restores the production `48h` value afterward. It creates an isolated creator, sponsor, and fans with unequal S1 balances to prove the USDC reward is not balance-proportional:

```text
buyout offer = 1,000 USDC raw amount = 1,000,000,000
creator share = 800,000,000
discovery pool = 200,000,000
eligible snapshot in test = 2 early holders
per-user cap in test = 50,000,000
```

Acceptance requires the creator to reach `S2_Active`, level `>= 2`, the creator to receive the configured creator share at graduation, the two on-chain-counted early holders with different S1 balances to receive equal capped discovery rewards, residual USDC to flow to the configured destination, the vault to close after the final counted claim, and claimant positions to be zeroed. Ineligible claim attempts are rejected and do not clear positions.

## Readiness Scope

This S1 work is protocol and backend readiness. The live trading UI should still be treated as a separate rollout surface: front-end pages need to show rating provenance, pending-effective rating, daily SPUMP cap usage, and buyout/rage-quit state before S1 is promoted as public trading.

Recommended next additions:

- Frontend display of rating provenance and next update time.
- Backfill tooling for pre-counter, in-flight S1 buyouts before `execute_s1_graduation`.
- Wallet-backed devnet smoke for graduation, capped discovery reward claim, residual transfer, and projection reconciliation.
- Legal/audit review of the remaining open question: whether S1 unbacking should continue returning SPUMP or become full consumption in a later task.
