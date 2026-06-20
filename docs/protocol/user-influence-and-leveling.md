# Platform User Leveling and Weighted Influence (Design)

Status: DESIGN / PROPOSAL — not implemented as a product system yet. The on-chain primitives (`UserProfile.level`, `xp`, `activity_score`, oracle-attested via `claim_engagement_reward`) already exist; this document specifies what they should *mean* and how action weighting should work. Treat the weighting system as `NOT_STARTED`.
Last updated: 2026-06-21

This spec refines a platform-wide user level (Bilibili-style) where a user's actions (like, cheer, endorse) carry weight proportional to their standing, so that higher-standing users' attention allocates more discovery/traffic to creators and contributes more to creator momentum.

Read with `docs/protocol/fan-loyalty-and-spump-economy.md` (per-creator loyalty badges) and especially `docs/protocol/spump-compliance-and-value-model.md` — the compliance firewall below is what keeps weighted influence from re-introducing the Howey/implicit-price problems that document solves.

## The Idea and the Trap (read first)

Idea: give each user a platform standing earned through interaction. Weight their actions by that standing, so a higher-standing user's like/cheer/endorse gives a creator more traffic and more momentum.

The trap: the user-facing phrasing "higher level gives the creator a valuation boost (估值加成)" is the single most dangerous mechanic in the entire product. A creator's S1 valuation (`s1_rating_bps` -> bonding-curve slope -> price -> eventually buyout USDC) is a financial quantity. If platform level mechanically inflates valuation, then:

```text
level (earned by activity)  ->  creator valuation  ->  backer USDC
```

That re-creates exactly what `spump-compliance-and-value-model.md` works to remove: a path from non-financial standing into USDC, plus a manipulable financial-influence market (buy/farm level -> move price). It would also make level a de facto financial instrument.

The resolution (non-negotiable design rule): **weighted influence is a reputation/discovery currency, not a financial one.** Weight moves traffic, ranking, and a displayed momentum score freely. Weight reaches creator *valuation* only as one bounded input to the oracle's rating model — never as a direct, user-triggered multiplier on price, on a backer's claim, or on USDC payouts. See the Compliance Firewall section; it is the core of this design, not a footnote.

## Builds On What Already Exists

| On-chain today | Role |
|---|---|
| `UserProfile.level: u8` | Platform level, set by oracle in `claim_engagement_reward` (`new_level`, strictly increasing) |
| `UserProfile.xp` / `activity_score` | Accumulated from oracle-reported missions |
| `daily_spump_amount_for_level(level)` | Daily SPUMP allowance already scales with level |
| `update_creator_s1_rating` | Oracle-only creator valuation update, with bounds, daily delta cap, cooldown, delayed activation |

So the platform level exists; this design defines (a) how level + a new curation-reputation axis compose into an Influence Weight, (b) where that weight applies, and (c) the firewall that keeps it out of direct financial claims.

## Two-Axis Standing

A single "level" number conflates two different things and invites farming. Split standing into two axes, because they answer different questions and earn weight differently.

### Axis 1 — Platform Level (seniority / trust)

Bilibili-style `Lv0`–`Lv6`, the existing `UserProfile.level`. Earned by sustained, quality participation over time. Sticky (no hard decay; trust is slow to build and slow to lose). It gates privileges and sets a base Influence Weight floor, and it already governs the daily SPUMP allowance.

Level answers: "how established and trusted is this account on StreamPump?"

### Axis 2 — Curation Reputation (taste / 伯乐值, "scout score")

A separate, outcome-validated score that rises when creators a user engaged with *early* actually grow, and falls when a user's signals are low-quality or flagged. This is the legitimate earner of discovery weight: it rewards a demonstrated good eye, not mere seniority or spending.

Curation reputation answers: "how good is this user's judgment about creators, proven by results?"

Why two axes: Level is hard to lose (trust), Curation Reputation is responsive (skill). Making the discovery multiplier depend mostly on the responsive, slashable axis is what prevents an entrenched-old-user oligarchy and what makes weighting feel *earned* rather than *aged into*.

## Naming and Positioning (final)

| Internal axis | User-facing name (EN) | User-facing name (ZH) | What the user sees |
|---|---|---|---|
| Platform Level (Axis 1) | Level (Lv0–Lv6) | 等级 (Lv0–Lv6) | A single primary number + XP bar — the Bilibili-familiar grind |
| Curation Reputation (Axis 2) | Scout title badge | 星探称号 | A tiered title/badge, **not** a second XP bar |

Scout title tiers:

| Internal score range | EN title | ZH title |
|---|---|---|
| 0 (default) | Passerby | 路人 |
| low | Observer | 观察者 |
| medium | Scout | 星探 |
| high | Gold Scout | 金牌伯乐 |

Level is the zero-learning-cost axis (everyone understands Lv1–Lv6). Scout is the differentiating, flex-worthy title — earned by validated taste, not bought.

## Presentation and Learning Curve

The dual-track is an **internal model**, not a user-facing "two-system" experience. Users already contend with three token-like concepts (SPUMP, USDC, FanBadge). Adding two parallel progress bars would overload cognitive budget.

Surface discipline: **one primary number + one earned title**.

- Level = the single main number. It is the onboarding/retention hook, the XP bar, and the gating mechanism for daily SPUMP. Everyone gets it instantly (Bilibili mental model).
- Scout = a title badge that appears **next to the level** as a compact chip, never as a competing progress bar. It is the differentiator and the bragging unit. Power users who want to inspect their score can drill into a detail view; most users see only the badge.

Three-layer progressive disclosure:

1. **Name-adjacent chip** (everywhere: comments, posts, Backer Wall). Compact: `Lv3 · Scout`. This is the only thing most users ever need to parse.
2. **Profile summary** (`/me`). One card: level + XP progress + scout title + a one-sentence "your influence" summary. Still no second XP bar.
3. **Detail page** (optional, for power users). Full breakdown: XP sources, curation history, weight computation, attribution to creator growth. Only shown on request.

Marketing constraint (binding): influence is always positioned as "reach + reputation," never as "earn more USDC" or "higher returns." This constraint is tied to `docs/protocol/spump-compliance-and-value-model.md` Layer 4 narrative discipline. Banned phrasing: "level up your earnings," "higher level = more rewards," "influence your returns." Permitted: "your taste moves discovery," "your judgment carries weight," "your vote counts more."

### Composite: Influence Weight

```text
influence_weight(user) = base(=1.0 for everyone)
                       + f_level(platform_level)          // sublinear, capped
                       + g_reputation(curation_reputation) // dominant term, slashable
```

Hard rules on the shape:

- Everyone starts at weight 1.0. A brand-new user's action always counts fully; weight is a bonus on top of a universal base, never a gate to zero.
- Sublinear and capped. Total multiplier is bounded (target range ~1.0x–3x, not 1x–100x). A `Lv6` top curator is a few times a newcomer, not orders of magnitude. This is the anti-plutocracy guarantee.
- Curation reputation dominates and can fall. Most of the above-base weight comes from validated taste, which is slashable — so weight is continuously *re-earned*, not banked forever.

## Where Weight Applies (and the firewall)

| Surface | Weighted by Influence Weight? | Financial? | Guard |
|---|---|---|---|
| Feed / traffic ranking (weighted like/cheer pushes content up) | Yes | No | sublinear cap; anti-cheat velocity checks |
| Creator momentum score (displayed reputation number) | Yes | No (display/reputation) | aggregated, time-decaying |
| Trending / discovery placement | Yes | No | anti-cheat |
| Oracle S1 rating *input* (evidence the oracle weighs) | Yes, as one input | Indirect | existing on-chain bounds + delta cap + cooldown + delayed activation; oracle discretion |
| Endorsement USDC reward share | **No** | Yes | stays decoupled + per-user capped per compliance doc |
| Backer buyout USDC claim | **No** | Yes | capped/decoupled discovery reward per compliance doc |
| SPUMP a user can mint/claim | Level only (existing daily allowance) | No (SPUMP is de-monetized utility) | existing emission decay |

"More traffic allocation" = the top rows, and is fully safe to weight aggressively. "Valuation boost" is allowed only via the oracle-rating *input* row, under the existing guards.

## Compliance Firewall (the core)

Three rules, each tied to `spump-compliance-and-value-model.md`:

1. Influence weight never multiplies a financial claim. It must not change how much USDC any user receives, how much SPUMP they can mint, the per-token bonding-curve price, or a backer's pro-rata/discovery reward. Those remain governed by actual SPUMP consumed / position, with the compliance caps.

2. Weight reaches valuation only as oracle *evidence*, never as an automatic on-chain multiplier. Weighted engagement is aggregated off-chain into a momentum signal that the oracle *considers* alongside external metrics when it sets `s1_rating_bps`. The oracle remains the gatekeeper; the on-chain rating update keeps its bounds, daily delta cap, cooldown, and delayed activation. So even a coordinated influence campaign cannot move valuation faster or further than those guards allow, and the oracle can dampen or ignore anomalous weighted signals.

3. Standing is non-transferable and unbuyable with money. Level and curation reputation are earned (time, quality, validated taste) and tied to the account; they cannot be transferred, sold, or purchased with fiat. Combined with rule 1, this means there is no market in "weighted influence for money."

Net effect: weighted influence is a high-energy *discovery/reputation* economy and a deliberately low-bandwidth, oracle-mediated *valuation* signal. That split is what lets you have the flywheel without the securities/implied-price/manipulation downside.

## Anti-Abuse and Anti-Plutocracy

- Universal base weight (1.0) + sublinear cap: protects newcomers and prevents oligarchy.
- XP from quality, daily-capped: XP sources favor genuine contribution (watch-through, comments that earn engagement, costly cheers/boosts, early backs that validate). Daily XP caps defeat grind-to-win.
- Outcome-based, slashable curation reputation: mass-endorsing junk lowers your scout score; this directly punishes vote-farming and pay-for-influence schemes.
- Anomaly/velocity guards: weighted actions feed the existing anti-cheat path (`antiCheat.ts`); suspicious bursts are discounted before they affect ranking or the oracle input.
- Earliness path independent of level: a "fresh-eyes / first-mover" bonus (tied to FanBadge founding rank) lets even a brand-new user's *early* discovery matter, so the system rewards scouting, not just seniority. New users have a real lever on day one.
- Gentle decay on the responsive axis only: curation reputation decays slowly with inactivity (loss aversion, keeps signals current); platform level does not hard-decay (trust is sticky).

## Psychology

Why this drives the user<->creator flywheel, with the lever named at each point:

- Agency / impact (the primary motivator). "My vote counts more" satisfies autonomy + competence (self-determination theory). It is intrinsically rewarding — but only if it feels *earned*, hence reputation-based weighting.
- Mastery / "good eye" (伯乐 identity). Curation reputation turns taste into a skill you level up. This is the deep reward for the early-discoverer persona the founding-badge design already cultivates: discovery becomes a game of skill, not luck.
- Status / identity. A visible level + scout badge is positional, scarce, and flex-worthy (the Bilibili `Lv6` effect) — it drives both the grind and pride.
- Endowed progress + loss aversion. An account with accumulated standing is not abandoned (retention); slashable reputation and gentle decay keep it alive.
- Goal-gradient. Fast early levels so newcomers feel momentum; the bar steepens later. Prevents early churn.
- Recognition / reciprocity. Creators can see their high-influence supporters (the Backer Wall) and thank/perk them; being recognized by a creator you admire deepens loyalty and feeds the loop.
- Procedural fairness. Because weight is earned by contribution quality and validated taste (not money or mere age), and is sublinear with a universal base, the majority perceives it as legitimate rather than oligarchic.

Anti-patterns this design explicitly avoids (each is a real failure mode of naive weighting):

- Disenfranchisement of the many -> universal base weight + sublinear cap + earliness path.
- Grind-to-win / extrinsic over-justification -> daily XP caps + outcome-based reputation.
- Pay-to-win perception -> standing unbuyable with money; weight never buys USDC.
- Vote-selling / collusion -> slashable reputation + anomaly guards + non-transferable standing + sublinear cap (a cartel of mid users cannot dominate).
- Oligarchy of early adopters -> the dominant weight term is the responsive, re-earned curation axis, not sticky seniority.

## Flywheel

```text
user does quality engagement
  -> platform level + curation reputation rise (status, mastery)
  -> their like/cheer/endorse carries more DISCOVERY weight (agency)
  -> creators they spotlight get more traffic + momentum
  -> those creators grow
       -> user's taste is validated -> curation reputation rises further (competence loop)
       -> creator sees & thanks the high-influence supporter (recognition/reciprocity)
       -> if the user was early, they earn founding/early status (status)
  -> user is more invested and active -> repeat
meanwhile:
  creators compete for the attention of high-influence users (their endorsement = real traffic)
  -> creators make better content and engage top fans
  -> platform quality rises -> attracts more users -> more curators
```

Two-sided: users chase standing because it grants real (non-financial) influence; creators chase high-standing users because their attention grants real traffic. The firewall ensures the prize on both sides is reach and reputation, not money — which is what keeps it a healthy curation economy instead of a financial-influence market.

## Composition With Other Layers

- vs FanBadge (per-creator loyalty): FanBadge measures conviction toward one creator; Influence Weight measures the platform's trust in your judgment overall. For a *cheer on creator X*, effective discovery push can combine them: `influence_weight(user) x small_loyalty_factor(fan_badge_tier_for_X)`, with the loyalty factor tightly bounded so global standing dominates and per-creator grinding cannot manufacture influence.
- vs oracle creator rating: weighted engagement is an *input* to the oracle's off-chain momentum model only; the on-chain `update_creator_s1_rating` guards are unchanged and remain authoritative.
- vs SPUMP sinks: cheering/boosting are the costly actions that *carry* weight; spending SPUMP (earned time) is the skin-in-the-game, and standing scales how far that spend echoes in discovery.

## Data Model and Surfaces

DB/oracle-first for the signal, chain-first only where it already is:

- Chain-first (exists): `UserProfile.level/xp/activity_score` (oracle-attested), `update_creator_s1_rating` (oracle, guarded). No new financial on-chain mechanism is introduced by this design.
- DB/oracle-first (new): curation reputation computation, Influence Weight, weighted feed ranking, displayed creator momentum score, leaderboards. These are read models + oracle inputs, not financial truth.

Proposed additions (additive; no seed or financial-semantics change):

- Backend: a reputation/weight service; weighted ranking in feed/trending; a creator momentum projection; an influence ledger for observability; anti-cheat hooks on weighted actions.
- Oracle: fold the weighted-engagement aggregate into the rating model as one bounded input.
- Frontend: level + scout-reputation badge on profile and next to names; "your influence" panel; creator momentum display labeled as a reputation signal, not a price; tier/goal-gradient progress UI.

## Phased Rollout and Blockers

Each phase ends with code, tests, and a readiness label; no copy-only promotion.

1. Define XP/level curve and curation-reputation formula (off-chain), surfaced read-only. `MOCK_PREVIEW` until real signals exist.
2. Weighted feed/trending ranking (pure discovery; fully safe to ship without touching valuation).
3. Creator momentum score (displayed reputation), anti-cheat integrated.
4. Fold weighted aggregate into the oracle rating *input* (financial-adjacent -> requires careful evaluation, keeps all on-chain rating guards, oracle dampening).
5. Recognition surfaces (Backer Wall integration, creator thank/perk).

Blockers (stop-and-report):

- Any change that would let influence weight alter USDC/price/claim directly is prohibited by the compliance firewall and must not be implemented; valuation effects stay oracle-mediated and bounded.
- A real, abuse-resistant curation-reputation model needs data and anti-fraud review before it can affect the oracle input; until then it stays a displayed/discovery signal only.
- Oracle centralization remains a known systemic dependency (the oracle gatekeeps valuation); decentralizing/attesting the oracle is separate future work.

## Open Questions

- Exact level curve (Bilibili-like fast early, steep late) and the cap on `f_level`.
- Curation-reputation formula: how to attribute a creator's growth to early supporters without rewarding pure luck or enabling collusion; decay rate.
- Weight cap value (2x? 3x?) and how aggressively to weight discovery vs how lightly to weight the oracle input.
- Whether the per-creator loyalty factor should touch endorsement at all, or be confined to cheering/traffic.
- How to display the creator momentum score so users never read it as a price or a guaranteed-return signal.
