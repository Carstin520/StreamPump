# StreamPump

**Turn every creator into a one-person company (OPC). Discover them early, back them with real money, and share the upside — all on Solana.**

StreamPump is a creator-growth protocol that bridges Web2 content performance with Web3 incentive design. Sponsors fund creator milestones in USDC; fans endorse those milestones by burning $SPUMP; and an oracle network settles outcomes based on verified engagement metrics plus delayed CPS payout reports. The result is a transparent, on-chain marketplace where creator success directly translates to financial returns for everyone involved.

---

## Vision

Millions of creators earn less than they deserve because the attention economy has no native capital layer. StreamPump fixes this by introducing three primitives:

1. **Creator IPO (Season 1)** — A bonding-curve launchpad that lets fans invest in a creator's potential *before* sponsors arrive. Early believers get in cheaply; growing demand raises the price for later buyers.
2. **Tri-Track Traffic Market (Season 2)** — Creators run one proposal with three independent settlement tracks:
   - **Track 1 (Fixed Base Pay):** A fixed USDC amount guaranteed to creator, claimable via oracle-authorized settlement.
   - **Track 2 (Performance + Fans, T+7 style):** Fans burn $SPUMP to endorse high-intent metrics (Views/Clicks/Saves). Settlement uses cliff + pro-rata: failed cliff refunds sponsor; passed cliff splits achieved budget to creator and fan pool.
   - **Track 3 (CPS Sales, T+45 style):** Fans do not participate. Oracle reports final approved commission after return window; creator gets approved payout, sponsor gets unused budget back.
3. **Oracle-Verified Outcomes** — Engagement metrics and delayed CPS commission values are settled on-chain via oracle/backend proofs, ensuring tamper-resistant resolution.

StreamPump is designed for real people — creators who know nothing about crypto, fans who just want to support someone they believe in, and sponsors who need transparent ROI on influencer marketing spend.

---

## $SPUMP: A Non-Transferable Burn-to-Earn Utility Token

$SPUMP is **not** a speculative trading token. It is a **Solana Token-2022** asset issued with the **NonTransferable** extension, meaning it cannot be transferred between wallets or listed on any DEX/AMM.

### How it works

| Action | SPUMP Flow | Economic Effect |
|--------|-----------|-----------------|
| **Buy S1 creator token** | User's SPUMP is **burned** | Permanent supply contraction |
| **Sell S1 creator token** | Protocol **mints** SPUMP back to user (minus dynamic exit tax) | Partial re-inflation; tax split: 50% to creator, 50% permanently unissued |
| **Endorse a proposal** | User's SPUMP is **burned** | Permanent supply contraction |
| **Claim (Track2 success)** | Protocol **mints** 100% SPUMP back + user earns pro-rata USDC | Full principal restoration + real yield |
| **Claim (Track2 fail)** | Protocol **mints** 95% SPUMP back | 5% permanent deflation via non-mint |
| **Claim (cancel/void)** | Protocol **mints** 100% back | Neutral |
| **S1 Graduation** | 50% of virtual pool minted to creator; 50% **permanently burned** | Large one-time deflation event |

Because $SPUMP is non-transferable, it has **no secondary market price** and **no impermanent loss**. Users acquire SPUMP exclusively through protocol distribution (airdrops, engagement rewards, etc.) and consume it by participating in the platform. This design isolates the platform from external market manipulation — a whale cannot dump $SPUMP on Raydium because there is no $SPUMP trading pair.

### Mint Authority

The `protocol_config` PDA is the sole mint authority for $SPUMP. Minting only occurs through verified smart contract paths: selling S1 tokens, claiming endorsement outcomes, and S1 graduation payouts.

---

## Product Model

### Season 1 (S1) — Creator Discovery & Bonding Curve

1. A creator **registers** a profile with a handle and USDC payout address.
2. Fans **buy internal creator tokens** by burning $SPUMP. The price follows a linear bonding curve: `cost = k/2 × ((S+ΔS)² − S²)`.
3. Fans can **sell** creator tokens back for freshly minted SPUMP, subject to a **dynamic exit tax** (higher when supply is low to discourage early dumps; decays as popularity grows).
4. When a sponsor sees a promising creator, they submit a **USDC buyout offer**.
5. The creator **accepts an offer**, which opens a **48-hour rage-quit window** — during this window, any fan can exit at zero tax.
6. After the window closes, **S1 graduation** executes: the creator transitions to S2, receiving 50% of the virtual SPUMP pool; the other 50% is permanently burned.

### Season 2 (S2) — Tri-Track Settlement (Base + Performance + CPS)

1. Graduated creators (**level ≥ 2**) create one proposal with:
   - `track1_base_usdc` (fixed creator base pay)
   - `track2_metric_type`, `track2_target_value`, `track2_min_achievement_bps` (performance + cliff)
   - `track3_delay_days` (CPS return-window delay)
2. Fans endorse **Track 2 only** by burning $SPUMP into virtual staking ledgers.
3. Sponsor funds three budgets in one call: `track1_amount + track2_amount + track3_amount` into proposal USDC vault.
   - `track1_amount` must equal `track1_base_usdc`.
4. **Track 1 settlement (`settle_track1_base`)**:
   - Oracle-authorized fixed base payout transfer from proposal vault to creator.
   - One-time claim guarded by `track1_claimed`.
5. **Track 2 settlement (`settle_track2`)** after deadline:
   - Oracle submits `actual_value`.
   - If achievement < `track2_min_achievement_bps`: sponsor gets 100% Track2 refund, status `Resolved_Fail`.
   - Else: `achieved_usdc = track2_usdc_deposited * min(actual, target) / target` (u128 safe math).
     - Unachieved part refunded to sponsor.
     - Achieved part split: 80% creator, 20% fan reward pool.
     - Status `Resolved_Success`.
6. **Track 3 settlement (`settle_track3_cps`)** after `deadline + track3_delay_days`:
   - Oracle submits `approved_cps_payout`.
   - Creator receives approved payout.
   - Sponsor receives `track3_budget - approved_cps_payout` refund.
7. Endorsers claim from Track 2 result:
   - `Resolved_Success`: 100% SPUMP principal minted back + pro-rata USDC from Track2 fan pool.
   - `Resolved_Fail`: 95% SPUMP minted back (5% slash via non-mint).
   - `Cancelled/Voided`: 100% SPUMP principal minted back.

---

## Monorepo Layout

```
programs/streampump-core     Anchor on-chain program (Rust)
programs/tests               Anchor TypeScript test scaffold
app/                         Next.js client scaffold
backend/                     API, storage, anti-cheat, oracle prep
scripts/                     Local deployment helpers
```

---

## On-Chain Components (Anchor)

Source: `programs/streampump-core/src`

### Protocol & Identity

| Instruction | Description |
|-------------|-------------|
| `initialize_protocol` | Sets admin, oracle authority, USDC/SPUMP mints, fee params, and S2 upgrade thresholds. Stores `protocol_config` PDA as SPUMP mint authority. |
| `register_creator` | Creates or updates creator profile (handle + USDC payout address). |
| `upgrade_creator` | Oracle-authorized level upgrade with replay-safe `UpgradeReceipt`. |
| `anchor_content_hash` | Anchors canonical URL digest and content SHA-256 on-chain. |

### S1 Lifecycle

| Instruction | Description |
|-------------|-------------|
| `buy_s1_token` | Burns SPUMP via Token-2022 `Burn` CPI; increments virtual S1 supply and user position. |
| `sell_s1_token` | Mints SPUMP via `MintTo` CPI (net of dynamic exit tax); 50% of tax goes to creator, 50% is permanently unissued. |
| `init_s1_buyout` | Opens the creator for buyout offers. |
| `submit_buyout_offer` | Sponsor escrows USDC into an offer-specific vault. |
| `accept_buyout_offer` | Creator accepts one offer and opens a 48h rage-quit window. |
| `cancel_buyout_offer` | Sponsor cancels a non-winning offer and reclaims USDC. |
| `rage_quit_s1` | Fan exits during the rage-quit window at zero exit tax (SPUMP minted back in full). |
| `execute_s1_graduation` | After rage-quit window closes: mints 50% of remaining virtual SPUMP to creator; other 50% permanently burned. Creator status → S2. |
| `claim_s1_buyout_usdc` | S1 token holders claim pro-rata USDC from the winning buyout offer. |

### S2 Proposal Lifecycle

| Instruction | Description |
|-------------|-------------|
| `create_proposal` | Creator opens a tri-track proposal (`track1_base_usdc`, `track2_metric_type`, `track2_target_value`, `track2_min_achievement_bps`, `track3_delay_days`, `deadline`) and initializes USDC vault PDA. |
| `endorse_proposal` | Fans burn SPUMP to endorse Track 2; proposal/user virtual stake ledgers are updated. |
| `sponsor_fund` | Sponsor deposits `track1_amount + track2_amount + track3_amount` USDC (`track1_amount` must match `track1_base_usdc`) and proposal transitions to `Funded`. |
| `settle_track1_base` | Oracle-authorized fixed base payout transfer to creator (one-time claim). |
| `settle_track2` | Oracle settles performance track with cliff + pro-rata. Failed cliff refunds sponsor; passed cliff splits 80% creator / 20% fan pool. |
| `settle_track3_cps` | Oracle delayed-settles CPS payout after return window; creator paid, unused budget refunded to sponsor. |
| `claim_endorsement` | Endorser pull-claim: mint SPUMP principal/refund and claim Track 2 fan-pool USDC share on success. |
| `cancel_proposal` | Creator cancels an unfunded proposal. |
| `emergency_void` | Admin force-voids a proposal and refunds remaining vault USDC to sponsor. |

---

## Backend Components

Source: `backend/src`

### Hybrid Storage (S3 + R2)

- `services/storage.ts` — Uploads to S3 origin, mirrors to R2 edge. Computes SHA-256 content digest for the on-chain anchor flow.

### Anti-Cheat Pipeline

- `services/antiCheat.ts` — Scores view/interaction events using IP dedupe windows, session burst checks, weak fingerprint detection, and interaction-sequence anomalies. Emits `ACCEPT/REVIEW/REJECT` verdicts.

### Oracle Reporting

- `services/viewOracleAggregator.ts` — Builds conservative final view counts from anti-cheat-accepted events and produces settlement report digests.

### Chainlink Functions Script

- `oracle/chainlink/functions/functions-source.js` — Fetches YouTube/TikTok view APIs and encodes uint256 output for DON execution.

---

## Security Design

- **No secondary market attack surface**: $SPUMP uses Token-2022 `NonTransferable` — it cannot be listed on any DEX. There is no external price to manipulate.
- **Mint authority control**: Only the `protocol_config` PDA can mint SPUMP, and only through verified smart contract code paths.
- **Virtual stake accounting**: S2 endorsement stakes are burned on entry and re-minted on claim. There is no token vault to exploit.
- **PDA-seeded vault authorities**: All USDC movement uses proposal-owned PDA vaults.
- **Restricted oracle settlement**: Only the designated `oracle_authority` can execute `settle_track1_base`, `settle_track2`, and `settle_track3_cps`.
- **Time-bound validations**: Proposal creation, endorsement, and oracle resolution are all deadline-gated.
- **Track-aware settlement order**: Fan `claim_endorsement` depends on `settle_track2`; `settle_track3_cps` is independently delayed by CPS return-window days.

---

## Quick Start

### Program

```bash
anchor build
anchor test
```

### Frontend

```bash
cd app
npm install
npm run dev
```

Required env:
- `NEXT_PUBLIC_RPC_ENDPOINT`
- `NEXT_PUBLIC_BACKEND_BASE_URL`
- `NEXT_PUBLIC_WEB3AUTH_CLIENT_ID` (optional, for social login)

### Backend

```bash
cd backend
npm install
npm run dev
```

Required env:
- `PORT`, `SOLANA_RPC_ENDPOINT`, `STREAMPUMP_PROGRAM_ID`
- `S3_REGION`, `S3_BUCKET`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_PUBLIC_BASE_URL`
- `R2_REGION`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_PUBLIC_BASE_URL`
- `ANTICHEAT_MAX_RISK_SCORE`, `ANTICHEAT_IP_WINDOW_MS`, `ANTICHEAT_MIN_INTERACTIONS`
- `CHAINLINK_SOURCE_API_BASE_URL`, `CHAINLINK_GATEWAY_URL`

---

## License

MIT
