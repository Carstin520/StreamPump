# StreamPump Fan Loyalty Badges and SPUMP Sink Economy (Design)

Status: DESIGN / PROPOSAL — not implemented on-chain or in the DB yet.
Last updated: 2026-06-19

This document specifies a loyalty layer ("Fan Badges") and the SPUMP sink economy that sits on top of it. It is a design proposal that extends the existing S1/S2 product model. Nothing here is shipped; treat every mechanic below as `NOT_STARTED` until it has code, tests, and verification.

It exists to answer two product problems:

1. The "early discovery bragging right" is currently invisible and its payoff is delayed and uncertain, so it does not drive the user/creator flywheel.
2. SPUMP has weak, narrow sinks. If S1 has no graduation-worthy creator to back, SPUMP accumulates with nowhere to go, which makes users devalue it and depresses retention. When a good creator finally appears, hoarded SPUMP floods in and daily caps make it feel unfair.

Read with `docs/protocol/s1-market-design.md` (S1 economics) and `pitch/script.md` (product boundary). This layer is also the load-bearing mechanism for `docs/protocol/spump-compliance-and-value-model.md`: by making most SPUMP demand pure non-monetary utility, and by making status (not proportional USDC) the headline reward for backing, the loyalty layer is what lets SPUMP avoid an implicit USD price and lets backing avoid an investment-contract characterization.

## Design Principle: SPUMP Is Conviction, Not Money

The psychological failure mode of a non-transferable, time-earned token is not the non-transferability itself. It is letting users perceive the token as "money I earned but cannot withdraw." That framing triggers a deprivation reaction.

The fix is positioning, function, and scarcity:

- Position SPUMP as the platform's native conviction / voice / energy currency, not as a "token." Nobody resents being unable to sell game energy, a vote, or Reddit karma, because those were never money.
- Non-transferability is the feature, not the apology: because SPUMP can only be earned through genuine, time-based participation, spending it on a creator is a credible costly signal of real conviction. That is exactly what makes backing a trustworthy momentum signal instead of buyable hype. The "trust layer" thesis depends on SPUMP being unbuyable.
- Keep the SPUMP -> USDC relationship probabilistic and framed as a discovery bonus, never a fixed exchange rate. If SPUMP acquires a clear dollar price, non-transferability becomes pure frustration ("I have $500 locked"). USDC is the creator's commercial reward and the backer's occasional jackpot; SPUMP is the "how much I care" currency. The two must not become interchangeable in the user's mental model.

Status is the headline reward; USDC is a bounded bonus. The permanent founding badge and tier are the primary payoff for early backing. Any USDC a backer receives must be a capped, platform-funded discovery reward that does not scale with SPUMP staked — not a pro-rata investment return. This is what keeps backing a costly conviction signal (the cost is earned time/attention) without making it an investment contract. See `docs/protocol/spump-compliance-and-value-model.md` for the full posture.

Everything below operationalizes that principle.

## Fan Badge Primitive

A Fan Badge is a per-`(user, creator)` soulbound record. It is the concrete, visible artifact that the "I discovered them early / I am a real fan" status is anchored to. It is non-transferable, consistent with SPUMP and S1 positions.

### Account and seeds (on-chain)

Proposed PDA, mirroring the existing `S1UserPosition` seed pattern (`["s1_position", user, creator_profile]`):

```text
FanBadge  seeds = ["fan_badge", user, creator_profile]
  authority:                Pubkey   // the fan
  creator_profile:          Pubkey
  first_followed_at:        i64      // loyalty clock start
  follow_seconds_accumulated: i64    // honest duration across unfollow/refollow
  unfollowed_at:            i64      // 0 if currently following
  founding_rank:            Option<u64>  // permanent: set if backed before early-cohort threshold
  tier:                     u8       // 0..=5 (see ladder)
  badge_xp:                 u64      // from duration + engagement + SPUMP spent on THIS creator
  milestone_flags:          u64      // content-anchored milestone bitset
  spump_burned_total:       u64      // lifetime SPUMP burned on this creator (cheer/boost/tier)
  last_engaged_at:          i64
  bump:                     u8
```

`founding_rank` is the scarce bragging unit. It is derived from a concrete on-chain fact (the user was an early-cohort S1 backer), not from spending, so it cannot be bought.

### Tier ladder: time gates the floor, engagement + SPUMP unlock the tier

The governing rule: following duration sets the minimum eligible tier; engagement plus a SPUMP burn is required to claim the tier. You can never buy a tier you have not earned through time, but claiming a tier you have earned always consumes SPUMP. This preserves the credibility of the loyalty signal while making SPUMP an always-available sink.

| Tier | Name (EN / 中文) | Duration floor | Additional requirement to claim |
|---|---|---|---|
| 0 | Passerby / 路人 | — | none (just viewing) |
| 1 | Newcomer / 新粉 | instant | follow |
| 2 | Regular / 常驻粉 | 7 days | minimum engagement score |
| 3 | Loyal / 铁粉 | 30 days | engagement + SPUMP burn to claim |
| 4 | Devoted / 真爱粉 | 90 days | engagement + SPUMP + at least one S1 back or endorsement |
| 5 | Guardian / 守护者 | 180 days | sustained engagement + SPUMP |
| star | Founding / 创始粉 #N | — | backed before the creator's early-cohort supply threshold (permanent, orthogonal to tiers) |

Parameters (duration floors, engagement thresholds, SPUMP claim cost per tier) belong in `ProtocolConfig` so they are tunable without a program change to seeds.

### Content-anchored milestones

`milestone_flags` records concrete, anchored achievements so the badge is not an abstract number. Each milestone is tied to a real on-chain or content fact:

- "Here for the first post" — anchored to the creator's first `ContentHashAnchor`.
- "Backed before graduation" — set if a position existed before `S1_Execution_Pending`.
- "Cheered [post]" — anchored to a specific content digest.
- "Endorsed N campaigns" — counted from S2 `EndorsementPosition` history.

Milestones are what make the badge feel earned and specific ("I was here for video #1"), which is the concrete content anchor the bragging right needs.

## SPUMP Sink Economy

The Fan Badge layer is the engine that introduces always-available SPUMP sinks. The point is to decouple SPUMP demand from "is there a graduation-worthy creator to S1-back right now." Every creator a user already follows becomes a place to spend SPUMP today.

| Sink | Burns SPUMP | Side effects | Why it helps |
|---|---|---|---|
| Badge tier claim/upgrade | yes | mints earned tier + cosmetics | Always available for every followed creator; turns earned eligibility into a status artifact |
| Cheer / 打赏 | yes | + fan badge_xp; + creator momentum signal feeding the oracle rating; content-anchored milestone | Pure social signal; directly strengthens the creator the fan believes in (flywheel) |
| Content Boost / 助推 | yes | signal-weighted, decaying boost to feed ranking | Fans amplify creators they back; aids discovery; capped to prevent pay-to-rank |
| Perk unlock | yes | comment highlight, name color, exclusive-content gate, profile cosmetics | Status + utility sinks tied to identity |
| Streak / tier protection | yes (small) | shields a streak or tier from a single missed day | Loss-aversion sink |

Burn policy: a portion of cheer/boost SPUMP is permanently burned (deflation); a portion converts into a non-token momentum signal that feeds the oracle's "engagement quality" rating input. No new token is minted by these actions.

Because cheering and boosting are costly (SPUMP is earned over time), they are hard-to-fake, StreamPump-native engagement signals. They are a better input to the creator momentum rating than scraped external metrics, and they tie the sink directly into the S1 rating mechanism.

## Loyalty-Gated S1 Backing Capacity

This is the structural fix for the "hoarded SPUMP floods a hot creator, daily cap makes it unfair" problem.

Today the per-creator daily S1 buy cap is a flat SPUMP amount (`max_s1_daily_buy_spump`, default 15 SPUMP; see `docs/protocol/s1-market-design.md`). Proposal: scale the per-creator daily cap by the user's Fan Badge tier for that creator.

```text
effective_daily_cap(user, creator) =
    base_daily_cap * tier_multiplier[fan_badge.tier]
```

Consequences:

- A whale who just discovered a creator holds tier 0/1 -> low cap -> cannot flood the curve.
- A fan who has followed and engaged for months holds a high tier -> higher cap -> earned priority to back early.
- Backing power becomes a function of loyalty and time, not capital. This is the conviction thesis enforced economically, and it directly counters the unfairness failure mode.

The flat cap remains as the tier-0/1 floor, so this never weakens the existing anti-speculation guardrail; it only grants additional capacity to demonstrated loyalty.

## How This Solves the Stated Problems

Failure mode 1 — SPUMP accumulates, no creator worth S1-backing, SPUMP feels useless, DAU drops:

- Badge progression, cheering, boosting, and perks are available for every creator the user already follows, every day. SPUMP always converts into status, relationship, or amplification. A graduation-worthy creator is no longer a precondition for SPUMP to have a use.

Failure mode 2 — hoarded SPUMP floods a hot creator, daily caps feel unfair:

- Loyalty-gated backing capacity means the people who can back hardest are the ones who earned it through time, not the ones holding the most SPUMP.
- Continuous sinks reduce hoarding in the first place, so there is less dry powder to flood with.

Emission/burn balance:

- Emission already decays from 10x to 1x as the network grows (see `docs/protocol/s1-market-design.md`).
- The new sinks scale with engagement and the number of creators a user follows, so burn grows with activity.
- Net effect: as the network grows, emission decays while sinks grow, keeping SPUMP scarce and useful. The anti-hoard property comes from continuous sinks (and optional gentle tier decay), not from punitive balance decay.

## Flywheel Effect (User <-> Creator)

The loyalty layer supplies the immediate psychological reward each side needs to pull the other in.

```text
user earns SPUMP through genuine engagement (scarce, effortful)
  -> spends it: follow, cheer, claim badge tier, back creator (costly signal -> early-backer identity + visible status)
  -> creator sees credible conviction + gains a visible Backer Wall (social proof)
  -> creator is validated and produces more; can reward badge tiers (reciprocity)
  -> more content + visible backing attracts new fans
  -> new fans earn SPUMP, follow, cheer, back -> amplify momentum (feeds oracle rating)
  -> creator graduates -> backers get permanent founding status (+ possible USDC jackpot)
  -> backers broadcast "I discovered them early" via their permanent badge -> recruits new users
```

Named levers at each step: scarcity and variable reward (earning), costly signaling and the IKEA effect (spending/backing), social proof and goal-gradient (Backer Wall and tier progress), reciprocity (creator-gated perks), loss aversion (streaks and duration), and scarce permanent status (founding rank) as the viral bragging anchor.

## Data Model and Surfaces

DB-first vs chain-first split, consistent with the StreamPump principle:

- DB-first (fast social graph and workflow): the follow relationship, accumulated follow duration, engagement counters, Backer Wall projections, leaderboards.
- Chain-first (scarce, non-fakeable truth): SPUMP burns (tier claim, cheer, boost), founding rank (derived from on-chain early-cohort fact), and the canonical badge tier after a claim. The displayed badge is a projection of chain events plus DB duration.

Proposed on-chain instruction surface (additive; does not change existing seeds or financial semantics):

- `follow_creator` — initializes a `FanBadge` (tier 1), starts the loyalty clock. Cheap, possibly DB-only with a chain anchor on first SPUMP action.
- `claim_badge_tier` — burns SPUMP to mint an earned tier; validates duration floor + engagement.
- `cheer_content` — burns SPUMP against a content digest; emits an event for momentum + milestone.
- `boost_content` — burns SPUMP for signal-weighted feed boost.
- `unfollow_creator` — accumulates duration into `follow_seconds_accumulated`.

Backend additions: Prisma models for follow graph and badge projection; indexer handling for cheer/boost/tier-claim events; APIs for Backer Wall, badge shelf, and tier progress; a SPUMP sink ledger for observability.

Frontend surfaces (status must be visible to work psychologically):

- Badge chip next to a user's name on that creator's content (e.g., "铁粉 · 守护者 #3").
- Creator Backer Wall / 粉丝榜, ranked by tier and founding rank — the creator's social proof.
- "我支持的创作者" badge shelf on `/me`.
- Cheer and Boost actions on posts; tier-progress UI with the next-tier goal gradient.

## Anti-Abuse

- SPUMP-derived badge_xp is capped per day, so tiers cannot be bought overnight; the duration floor still gates eligibility.
- Cheer and boost costs scale super-linearly to prevent a single whale from dominating discovery.
- Boost is signal-weighted and decaying, capped per user per creator.
- Founding rank is strictly derived from the on-chain early-cohort fact and can never be purchased.

## Phased Rollout and Readiness

This is a design. Suggested order, each phase ending with code, tests, and a readiness label:

1. DB-first follow graph + duration tracking + badge projection (no chain change). Surfaces the Backer Wall and badge shelf as `MOCK_PREVIEW` until chain burns exist.
2. On-chain `cheer_content` as the first real SPUMP sink (smallest, highest-frequency). Establishes the burn -> momentum -> rating loop.
3. On-chain `claim_badge_tier` with duration/engagement gating.
4. Loyalty-gated S1 daily cap modifier in `buy_s1_token` (changes an existing guardrail -> requires S1 tests and careful review).
5. `boost_content` and perk unlocks.

Do not promote any of these by copy alone. Each must remove a real gap and add verification per the roadmap rules.

## Open Questions / Parameters To Decide

- Exact duration floors and tier multipliers for the S1 cap (start conservative).
- Burn-vs-momentum split for cheer/boost SPUMP.
- Whether gentle tier decay on inactivity is worth the loss-aversion benefit vs the punitive feel.
- Whether `follow_creator` needs any chain footprint before the first SPUMP action, or stays DB-only until then.
- Legal: the recharacterization of backer USDC as a capped, platform-funded discovery/loyalty reward (rather than a pro-rata investment return) is specified in `docs/protocol/spump-compliance-and-value-model.md`; it requires counsel sign-off and is a gating blocker for public launch.
