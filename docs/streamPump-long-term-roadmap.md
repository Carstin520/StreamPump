# StreamPump Product Roadmap

Last updated: 2026-07-15
Main branch: `main` (unfrozen after hackathon judging)
Integration branch: `codex/post-deadline-phase-0`
Current target: technical Pilot on Solana devnet/test-USDC — public Google/Apple registration, optional wallet login, Track1-only, no real funds, and not a real-funds production launch. **The 2026-07-15 identity-policy decision supersedes the former invite-only/external-wallet-first access boundary.** It does not reopen any closed financial lane.

This is the compact execution roadmap for moving StreamPump from a hackathon controlled demo to the product promised in `pitch/script.md`: a Web2.5 creator sponsorship market where content, sponsor budgets, fan participation, and Solana settlement form one verifiable loop.

Read with:

- `pitch/script.md`
- `docs/product-readiness-phase-0.md`
- `README.md`
- `DEMO.md`
- `docs/streamPump-page-readiness-goal.md`

## North Star

StreamPump is a creator sponsorship trust layer.

- **Creator**: publishes content, builds momentum, and earns structured sponsorship payouts.
- **Fan / Backer**: supports creators with non-transferable utility `SPUMP`, receives internal S1 positions plus permanent founding status / curation reputation, and can earn a capped, sponsor-funded discovery reward — never a stake-proportional return.
- **Sponsor**: spends USDC as marketing budget and receives verifiable campaign proof.

The durable driver of participation is **status, identity, access, and curation reputation** — not financial upside; USDC is a bounded bonus.

Core flow:

```text
content -> creator momentum -> fan participation -> sponsor USDC budget -> Solana settlement
```

Product boundaries:

- Do not make `SPUMP` transferable.
- Do not list `SPUMP` on DEX/CEX.
- Do not couple backer/endorser USDC to stake size; rewards stay capped and decoupled, with the creator taking the majority of a buyout.
- Influence/reputation may move discovery and reach freely but must never multiply USDC, price, or claims.
- Do not present mock or local preview flows as production integrations.
- Keep workflow state DB-first and financial truth chain-first.

## Implemented Baseline

The following capabilities already exist in the current code on `codex/post-deadline-phase-0`. Future planning should not restate these as new work unless the task is explicitly about hardening, replacing mocks, or production verification.

| Area | Implemented baseline |
| --- | --- |
| Public product shell | Social-first routes exist for explore, trending, post detail, creator profile, activity, profile, onboarding, workspace, campaigns, market, buyout, portfolio, and rewards. |
| Auth entry | `/login` offers server-verified Google/Apple authorization-code registration to everyone plus optional wallet challenge login. A social identity receives a platform-managed account and enters directly; signup/onboarding do not request a personal wallet. External wallet binding is reserved for an explicit future withdrawal/transfer action. |
| Account profile spine | `/api/v1/account/me` persists a current-session `AccountProfile` for role, display name, handle, and onboarding completion once the Prisma migration is applied. `/onboarding` and `/me` now prefer this session-backed profile over local-only identity fixtures. |
| Content workflow | Workspace content pages call manifest create, R2 presign, browser upload, asset complete, finalize, publication record, and proposal intent APIs. |
| Workspace overview | `/workspace` calls the workspace overview API when authenticated and uses labeled preview fallback when the API/session is unavailable. |
| Proposal intent flow | Intent detail can lock terms, build bundles, collect creator partial signature, collect sponsor signature, and submit via existing APIs and wallet signing. |
| Campaign detail | Campaign detail can load public/auth proposal API data and has known demo fallback records. |
| S1 market and portfolio | Market and portfolio pages read creator profile/portfolio state, build buy/sell/rage-quit/claim transactions, request wallet signatures, submit, and sync projections for seeded paths. |
| Preview labeling | `/login`, `/workspace/buyout`, `/workspace/sponsorships`, demo intent signing, `/campaigns/*/endorse`, `/campaigns/*/settlement`, `/rewards`, and `/portfolio` have readiness labels where needed. |

## Historical pre-P4 code-state inventory (non-binding snapshot)

> This table preserves the **historical pre-P4 backlog snapshot** and is non-binding. Its "not deployed/not live" statements describe that earlier snapshot and were superseded by the controlled P4 execution recorded below. For current availability and boundaries, use **Current Pilot Execution Plan** and the newest Progress Ledger entry. No P4 result authorizes real funds or a formal production launch. Readiness label vocabulary comes from `docs/product-readiness-phase-0.md`.

| Area | Historical code-state label | Historical Pilot availability | Remaining backlog work |
| --- | --- | --- | --- |
| Auth and managed wallet | `SEEDED_DEMO` + `MOCK_PREVIEW` | **External-wallet challenge/verify only.** Managed / email / social / provider identity and managed execution are **closed** for all Pilot users. Devnet, not deployed. | Apply/operate migrations, replace preview provider exchange with production OAuth/passkey/Web3Auth verification, add custodial-to-personal USDC withdrawal, and harden stable `AuthIdentity -> managedWalletAddress -> WalletSession` mapping before managed identity can reopen. |
| Media reliability | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | In-scope only as the external-wallet content upload → feed/post corridor on devnet; **not deployed, not live.** | Add deployed R2/Mux smoke, webhook/reconciliation visibility, retry/resume UX, publish eligibility rules, and failed-asset recovery. |
| Feed and post projection | `SEEDED_DEMO` | Feed / post-detail projection is exercised only inside the devnet external-wallet corridor; **not deployed, not live.** | Prevent silent local media fallback and expose creator market truth on profile/detail surfaces. |
| Workspace truth | `SEEDED_DEMO` | Open only to invite external-wallet creators inside the devnet corridor. | Reduce mock persona fallback and make each panel show live, preview, empty, blocked, or operator-required state explicitly. |
| S1 self-serve | `SEEDED_DEMO` | **Closed** for all Pilot users. | Add non-seeded creator onboarding, rating provenance, cap usage, projection coverage, and devnet smoke from registration to claim. |
| S1 buyout lifecycle | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | **Closed** for all Pilot users. | Productize offer creation, creator acceptance, graduation, reclaim, post-rage-quit accounting, and re-entry. |
| S2 campaign proof | `SEEDED_DEMO` | Campaign proof (projection / on-chain evidence) is in the corridor, but only alongside **manual operator Track 1** settlement on devnet; no automatic or Track 2/3 settlement. | Harden role switching, projection reconciliation after Solana confirmation, fallback labeling, and full campaign proof read models. |
| S2 endorsement (Track 2) | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | **Closed** for all Pilot users. | Apply the migration, deploy the upgraded program, productize claim/reward UI, broaden portfolio views, and keep local fallback labeled. |
| Settlement | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | **Manual operator Track 1 only** on devnet. Track 2, Track 3, and automatic settlement schedulers are **closed**. | Add operator trigger UI, evidence digests, fraud/review state, guarded schedulers, and real merchant reconciliation for Track 3. |
| Rewards | `SEEDED_DEMO` + `MOCK_PREVIEW` | **Closed** for all Pilot users. | Wire durable reward ledger views, missions, anti-abuse gates, and production claim smoke. |
| Operator/deployment | `OPERATOR_REQUIRED` + `BACKEND_READY_UI_GAP` | **Not deployed, not live.** | Add dashboards for indexer/oracle/media/settlement/retry/fraud plus Vercel/Render/Neon/R2/Mux smoke checks. |

## Current Pilot Execution Plan (authoritative — supersedes the staged plan below for present work)

The current target is a **technical Pilot on Solana devnet / test-USDC — public identity entry, Track 1 only, no real funds, and not a real-funds production launch.** Google and Apple registration are open to everyone; external-wallet login remains optional. The platform assigns social users a managed account and does not request their personal wallet during login or onboarding. Custodial-to-personal withdrawal is not implemented and is the first action that should require personal-wallet connection. Track 2/3, S1, rewards, unrestricted managed execution, and automatic settlement remain off.

> **Supersession notice (2026-07-15):** P0–P6 rows and acceptance text below preserve point-in-time historical evidence. Their invite-only, allowlist, and “social auth closed” statements no longer define the current identity policy. Their devnet/test-USDC, no-real-funds, financial-lane, audit, and operator controls remain in force.

**Current user lane:** preserve and verify the public identity corridor:

- server-verified Google/Apple OAuth registration with direct managed-account entry;
- optional external-wallet challenge/verify login with no allowlist requirement;
- content create/upload through R2/Mux to completion;
- public feed and post-detail projection;
- proposal intent creation;
- creator + sponsor dual signature and backend relay of the fully signed transaction;
- manual operator Track 1 fixed-base settlement;
- campaign proof as projection / on-chain evidence.

**Closed for all Pilot users (post-Pilot backlog — each needs a later H gate plus its own audit/legal/provider prerequisites before it can reopen):**

- custodial-to-personal withdrawal and unrestricted public managed execution — needs an explicit signed transfer flow, custody/KMS hardening, recovery, and legal review;
- S1 self-serve market and buyout lifecycle (Stages 4–5) — needs audit of settlement math and creator-eligibility/legal rules;
- S2 Track 2 endorsement and fan rewards, and daily/engagement rewards (Stage 6) — needs the reward-decoupling redesign audit and legal token-classification opinion;
- Track 3 CPS and automatic settlement schedulers (Stage 7) — needs a real merchant/reconciliation provider;
- operator dashboards and prototype/legacy routes (Stage 8).

### P5 exact scope, acceptance, and mutation gates (H4 approved)

P5 is **invite-only Pilot operations plus reliability/security/observability hardening for the already-open corridor only**. It may harden fail-closed runtime behavior, control-plane freshness, operator-only diagnostics, tests, runbooks, and truth-aligned documentation. It must not open S1, Track 2, Track 3, endorsement, rewards, managed/email/social auth, public managed execution, prototype routes, automatic settlement, public access, real funds, or any readiness promotion.

The bounded P5 candidate addresses one live-audited control-plane gap: `/health`, `/ready`, and `/api/v1/internal/*` currently rely on edge `DYNAMIC` behavior instead of application-owned no-store headers, and the backend exposes `X-Powered-By: Express`. P5 adds explicit application and surrogate no-store guarantees, removes framework disclosure, and makes the deployment verifier reject either regression. No chain, Prisma, Neon, R2, Mux, Render, Vercel, allowlist, or financial mutation is part of this candidate.

P5 acceptance:

1. Freeze one candidate from accepted boundary `34f3d96363cc63a2dac046a529dc34f9ff41b778` and review only the uncovered contiguous range.
2. Pass backend build, focused readiness/header tests, deployment-verifier self-test, `git diff --check`, protected-file/staging checks, and one public browser/HTTP smoke if the delta warrants it.
3. Obtain one Fable 5 release verdict for the exact P5 range; fix every blocker/major and use fix-only closure unless the threat model changes materially.
4. Preserve live P4 runtime `88c0deb`, the Neon recovery branch, program rollback artifacts, invite-only allowlist, and every closed flag; do not deploy or mutate provider/data/chain state inside P5 without a separately frozen mutation.
5. Stop at H5. H5 approval is required before P6 final audit remediation/release preparation begins.

P5 closure: final accepted commit `f72c33d`; backend build, focused readiness suite (6/6), deployment-verifier self-test, diff/protected-file checks passed. Fable 5 initially found one alias-path major, which was fixed in `f72c33d`; fix-only closure returned PASS with 0 blocker/major. H5 was explicitly approved on 2026-07-14.

### P6 exact scope, acceptance, and mutation gates (H5 approved)

P6 is **final release-gate audit remediation and release preparation for the already-open Pilot corridor only**. The final audit found one bounded continuity gap: the deployment-verifier self-test accepted in P5 was not executed by GitHub CI. P6 adds that existing self-test as a permanent CI gate, aligns H5/P6/H6 truth, and provides a command-ready post-H6 deployment/rollback handoff. It does not change application, backend business, Anchor, Prisma, financial, auth, product-lane, or readiness semantics.

P6 acceptance:

1. Freeze one candidate from accepted boundary `f72c33db05d563e03c80f03a5a812ec16d332d85` and review only the uncovered contiguous range.
2. Pass CI-workflow syntax inspection, the deployment-verifier self-test, `git diff --check`, protected-file/staging checks, and documentation truth consistency. No browser smoke is required without a frontend delta; no deployment smoke is allowed before separate post-H6 mutation approval.
3. Obtain one Fable 5 release verdict for the exact P6 range; fix every blocker/major using fix-only closure unless the threat model changes materially.
4. Preserve live P4 runtime `88c0deb`, the Neon recovery branch, program rollback artifacts, invite-only allowlist, and every closed flag. Do not deploy or mutate provider/data/chain state in P6.
5. Stop at H6. H6 completes release preparation only; it does not authorize deployment, public access, real funds, or a closed lane.

Operational handoff: [`docs/pilot/p6-final-audit-and-release-handoff.md`](pilot/p6-final-audit-and-release-handoff.md).

**Remaining blockers before any public or real-funds launch:** external security audit, legal/token-classification review, production policy and jurisdiction/KYC decisions, and separate approval for every currently closed lane. The dedicated devnet RPC, run-scoped test-USDC freeze, packaged production IDL, deployment preflight, and controlled corridor smoke are completed P4 evidence; they authorize only the current technical Pilot boundary. Do not present any closed lane, or the "production corridor" framing below, as current Pilot availability.

## Next Behavior

> Post-Pilot backlog framing. The narrow corridor below is the long-term production target. In the current Pilot it is exercised only on devnet/test-USDC through the invite-only external-wallet lane defined in **Current Pilot Execution Plan** above; the money-flow expansions it references (S1 self-serve, S2 endorsement/settlement/rewards, operator dashboards) stay closed until their own H gates and audit/legal/provider prerequisites are met.

The page-readiness audit is complete. The next product behavior should not be another mock cleanup pass. The next step is to make one narrow production corridor real and repeatedly verified:

```text
authenticated creator
-> create/upload/finalize/publish content through R2/Mux/backend
-> post appears in public feed and post detail from backend projection
-> creator can open a real proposal intent from that content
-> campaign detail shows verifiable proof state without local fallback claims
```

This corridor is the correct first landing target because it sits before every money-flow promise:

- Sponsors cannot buy credible campaigns until content publication and campaign proof are reliable.
- S1 creator markets should not open self-serve before identity, creator profile, content eligibility, and projection rules are stable.
- S2 endorsement, settlement, and rewards should not become live until campaign proof and account-specific state exist.
- Operator dashboards need real media/proposal/settlement events to observe.

Immediate engineering behavior:

1. Stop expanding preview surfaces unless they unblock this corridor.
2. Stabilize production auth/session enough for one creator and one sponsor account.
3. Turn media publication from "API exists" into an end-to-end smoke-tested workflow.
4. Make public feed/post/detail consume only backend-projected records for this corridor.
5. Make proposal intent and campaign detail reconcile DB state with Solana confirmation state.
6. Keep readiness labels on every non-corridor mock until its own production gate is met.

## Demo To Production Plan

> **Post-Pilot backlog — not current P1 scope.** The stages below are the long-term product target, not the current invite-only Pilot. Managed/email/social identity (Stage 1), S1 self-serve and buyout (Stages 4–5), S2 endorsement/rewards (Stage 6), Track 3 CPS / automatic settlement (Stage 7), and operator dashboards (Stage 8) are **closed for all Pilot users** and each requires its own later human (H) gate plus audit/legal/provider prerequisites before it can reopen. The only present P1 work is the invite-only external-wallet corridor in **Current Pilot Execution Plan** above. Do not treat any stage here — including the "production corridor" framing — as current Pilot availability, deployed, live, or handling real funds.

This is the execution plan for moving from the current controlled demo to a limited production pilot, then to the full StreamPump product. Each milestone must remove a real mock/seed/operator dependency and add verification. Do not promote a milestone by changing copy alone.

### Stage 1: Production Identity And Session Spine

Goal: one user identity model works across creator, fan/backer, and sponsor surfaces.

Current state:

- `/login` can attempt email OTP and wallet auth.
- Preview social/local fallback is labeled but still useful for demos.
- Google and Apple authorization-code login is implemented locally behind disabled flags, with backend code exchange, ID-token/JWKS verification, nonce/audience/issuer checks, and popup-origin confinement. It is not configured, deployed, approved, or open in the current Pilot.
- Current product surfaces can still rely on local session/persona assumptions.

Required backend work:

- Define `AuthIdentity`, `ManagedWallet`, and `WalletSession` as the canonical session subject.
- Add provider verification for the chosen first provider path:
  - Recommended first landing path: email OTP + wallet signature.
  - Next providers: Google, Apple, passkey, Web3Auth/embedded wallet.
- Add explicit role/profile records:
  - creator profile;
  - fan/backer profile;
  - sponsor organization/member profile.
- Disable preview provider exchange in production by environment guard.
- Remove production dependence on legacy wallet headers.
- Add audit events for sign-in, wallet binding, session refresh, role switch, and failed auth.

Required frontend work:

- `/login`: show production provider state, preview fallback only in dev/demo mode.
- `/onboarding`: replace local preview with real profile creation and wallet/session binding.
- `/me`: read current-session profile, wallets, saved posts, holdings summary, and rewards summary from APIs.
- Add wallet mismatch states wherever a transaction builder requires a specific wallet.

Third-party requirements:

- Email delivery provider or console-only local mode for development.
- OAuth/Web3Auth/passkey provider when expanding beyond email/wallet.
- Production session secret and secure cookie/session settings.

Verification gate:

- A new user can sign in, bind or confirm a wallet, complete onboarding, reload the app, and keep the same identity.
- Preview social auth is unavailable in production unless explicitly enabled for a demo environment.
- Backend auth build and targeted auth tests pass.
- Browser smoke covers `/login`, `/onboarding`, `/me`, and one wallet-required route.

### Stage 2: Media Publication And Public Feed Reliability

Goal: creator content becomes a reliable product asset instead of a seeded/local fixture.

Current state:

- Workspace content pages call manifest create, R2 presign, browser upload, asset complete, finalize, publication record, and proposal intent APIs.
- Explore/trending/post detail can consume public feed records.
- R2/Mux plumbing exists, but recovery, eligibility, and deployed smoke are incomplete.

Required backend work:

- Add manifest list/detail APIs with stable statuses:
  - draft;
  - uploading;
  - processing;
  - ready;
  - published;
  - failed;
  - archived.
- Add idempotent retry endpoints for failed upload completion, finalize, Mux ingest, and publication record creation.
- Add publication eligibility rules:
  - creator is verified enough;
  - asset upload complete;
  - Mux processing or image variant ready;
  - required metadata present;
  - content is not blocked by review.
- Add media event projection:
  - R2 object key;
  - public/signed URL strategy;
  - Mux asset/playback id;
  - webhook status;
  - last reconciliation attempt;
  - failure reason.
- Add public feed read model that never silently swaps in local seeded content for production claims.

Required frontend work:

- `/workspace/content/new`: make upload retry/resume first-class.
- `/workspace/content/[manifestId]`: show per-asset status, failed asset recovery, finalize/publish eligibility, and proposal blockers.
- `/explore`, `/trending`, `/posts/[postId]`: distinguish backend feed, empty feed, API failure, and demo fallback.
- Creator profile pages should show whether media is live backend content or seeded/demo content.

Third-party requirements:

- Cloudflare R2 bucket, CORS, public base URL or signed URL strategy.
- Mux token, webhook secret, and webhook endpoint.
- Production backend URL reachable by Mux.

Verification gate:

- A real creator account uploads an image and/or short video.
- R2 object is readable through the chosen delivery path.
- Mux webhook or reconciliation moves video to a usable playback state.
- The post appears in `/explore` and `/posts/[postId]` from backend feed APIs.
- No local feed fallback is used in the production smoke.

### Stage 3: Workspace And Proposal Intent Production Corridor

Goal: creator and sponsor can move from real content to a proposal intent and verifiable campaign detail.

Current state:

- Proposal intent detail can lock terms, build bundles, collect signatures, and submit.
- Campaign detail can load API data or seeded fallback.
- Workspace overview has live API wiring but still has preview fallback paths.

Required backend work:

- Make proposal intent state machine explicit:
  - draft;
  - terms_locked;
  - creator_signed;
  - sponsor_signed;
  - submitted;
  - confirmed;
  - failed;
  - expired;
  - cancelled.
- Add role-aware errors:
  - wrong wallet;
  - wrong role;
  - stale bundle;
  - expired intent;
  - missing creator readiness;
  - missing content anchor;
  - relay failure.
- Store Solana transaction signatures, confirmation slot, proposal PDA, vault, manifest hash, and content anchor.
- Add reconciliation job from submitted transaction to confirmed campaign projection.
- Add campaign proof read model for public and authenticated views.

Required frontend work:

- `/workspace`: replace broad preview panels with live empty, blocked, ready, or operator-required panels.
- `/workspace/intents/[intentId]`: remove pasted-signature fallback from normal UX; keep it as dev/operator debug only.
- `/campaigns/[proposalId]`: show proposal PDA, vault, manifest, content anchor, funding, and confirmation state from projection.
- `/workspace/sponsorships`: connect to real proposal/campaign list APIs or keep it explicitly preview-only.

Third-party requirements:

- Reliable Solana RPC provider.
- Wallet adapters for creator/sponsor signature collection.
- Backend relay configuration and key management where required.

Verification gate:

- With two real sessions, creator locks/signs and sponsor final-signs/submits one proposal.
- Campaign detail updates from pending to confirmed through backend projection.
- Wrong-wallet and expired-bundle states are visible and recoverable.
- No mock campaign cards link into fake live intent ids.

### Stage 4: S1 Self-Serve Market

Goal: S1 moves from seeded demo to controlled self-serve creator market.

Current state:

- Market and portfolio pages can read creator/portfolio state and build buy/sell/claim transactions for seeded paths.
- Creator onboarding, rating provenance, cap usage, and full lifecycle projection coverage remain incomplete.

Required backend work:

- Add creator registration/readiness API:
  - creator profile;
  - wallet;
  - content eligibility;
  - S1 status;
  - rating source;
  - cap configuration.
- Add market read API:
  - current price;
  - supply;
  - curve parameters;
  - daily SPUMP cap used/remaining;
  - pending rating and effective time;
  - buyout status;
  - user position state.
- Add projection coverage for:
  - buy;
  - sell;
  - rating update;
  - paused/cancelled market;
  - buyout started;
  - rage quit;
  - graduated;
  - claimed;
  - re-entry rules.
- Add anti-abuse gates for daily utility SPUMP issuance and S1 buying.

Required frontend work:

- `/market/[creatorId]`: show rating provenance, pending rating, cap usage, transaction readiness, and wallet mismatch.
- `/portfolio`: show live holdings, claim windows, rage quit history, claim status, and re-entry eligibility.
- `/creators/[creatorId]`: show real market truth without projection-only labels when live.
- `/rewards`: implement real daily SPUMP claim before mission expansion.

Chain/indexer requirements:

- Confirm S1 events fully cover projection states.
- Add devnet smoke from user registration to S1 buy/sell/portfolio projection.
- Add unhappy-path tests for caps, role guards, insufficient balances, paused markets, and stale ratings.

Verification gate:

- A non-seeded creator can become S1-ready through operator-approved or self-serve flow.
- A user can claim daily SPUMP, buy S1, sell S1, and see portfolio projection update.
- Projection balances match chain events after refresh.

### Stage 5: S1 Buyout Lifecycle Productization

Goal: sponsor buyout is created and completed through product UI, not prepared state.

Current state:

- Protocol/backend builder paths exist.
- UI can show prepared buyout state and demo rage quit/claim flows.
- Offer creation, creator acceptance, graduation, and reclaim are not productized.

Required backend work:

- Add buyout lifecycle APIs:
  - sponsor init offer;
  - sponsor submit/fund offer;
  - creator list/review offers;
  - creator accept offer;
  - open rage quit window;
  - execute graduation;
  - reclaim rejected/expired offers;
  - claim USDC.
- Add operator guardrails:
  - offer validation;
  - minimum/maximum offer;
  - creator eligibility;
  - deadline enforcement;
  - idempotency keys.
- Complete projection for offer, rage quit, graduation, claim, and reclaim states.

Required frontend work:

- `/workspace/buyout`: replace static mock sponsor desk with live offer creation/review.
- `/buyout/[creatorId]`: separate live buyout, local demo, and unavailable states.
- `/portfolio`: make rage quit, claim, and re-entry state consistent after every action.

Chain/indexer requirements:

- Devnet smoke: sponsor offer -> creator accept -> fan rage quit -> graduation -> holder claim -> sponsor/creator final state.
- Unhappy-path tests for expired offer, rejected offer, double claim, late rage quit, insufficient vault, and unauthorized actions.

Verification gate:

- No operator script is required for a happy-path S1 buyout on devnet except initial environment setup.
- The two values that should match after rage quit/claim are derived from one backend projection formula and chain source.

### Stage 6: S2 Endorsement And Fan Rewards

Goal: fan endorsement becomes a real chain/backend flow, not a local simulator.

Current state:

- `/campaigns/[proposalId]/endorse` is `MOCK_PREVIEW`.
- `/rewards` is a local preview.

Required backend work:

- Add endorsement builder:
  - SPUMP burn or lock payload;
  - endorsement PDA;
  - campaign/fan relation;
  - reward pool share.
- Add endorsement projection:
  - pending;
  - confirmed;
  - failed;
  - claimable;
  - claimed.
- Add reward ledger:
  - daily SPUMP issuance;
  - campaign endorsement reward;
  - anti-abuse risk;
  - claim history.

Required frontend work:

- `/campaigns/[proposalId]/endorse`: replace local slider confirmation with wallet-signed transaction flow.
- `/rewards`: show real daily claim, reward ledger, campaign claim state, and abuse/blocked states.
- `/me`: replace preview reward cards with account-specific reward data.

Verification gate:

- Fan endorses a confirmed campaign with SPUMP.
- Endorsement appears in campaign proof and reward ledger.
- Rewards become claimable only after settlement/projection conditions are met.

### Stage 7: Settlement, Oracle, And Reconciliation

Goal: settlement moves from operator/mock dashboard to guarded production operations.

Current state:

- Track1/2 settlement can be smoked with controlled data.
- Track3 remains mock/operator-required.
- Oracle and Mux jobs exist but need observable control surfaces.

Required backend work:

- Track1:
  - operator/manual trigger;
  - publication evidence check;
  - idempotent payout settlement.
- Track2:
  - metric ingestion API;
  - fraud/review status;
  - oracle-signed evidence digest;
  - cliff calculation;
  - creator/endorser split projection.
- Track3:
  - merchant/reconciliation provider abstraction;
  - approved order import;
  - refund/return window;
  - settlement evidence;
  - sponsor refund projection.
- Add settlement job dashboard data:
  - queued;
  - running;
  - succeeded;
  - failed;
  - retryable;
  - blocked by review.

Required frontend work:

- `/campaigns/[proposalId]/settlement`: render only projection-backed track state in production.
- Add operator-only settlement trigger/retry UI.
- Add evidence digest display and fraud/review status.
- Keep Track3 clearly disabled until a real merchant provider exists.

Third-party requirements:

- First metric source for Track2.
- First merchant/reconciliation provider for Track3.
- Optional oracle network integration after operator/manual payloads are stable.

Verification gate:

- Track1 and Track2 settle from projection/evidence without editing local mock data.
- Failed settlement can be retried idempotently.
- Track3 remains gated unless real provider evidence exists.

### Stage 8: Operator, Observability, And Deployment Hardening

Goal: production demos and pilot users are observable and recoverable.

Required work:

- Add operator dashboard or admin routes for:
  - auth/session failures;
  - media upload/Mux/R2 failures;
  - feed publication status;
  - proposal intent state;
  - Solana relay/reconciliation state;
  - S1/S2 projection lag;
  - oracle/settlement jobs;
  - fraud/review queues.
- Add health checks:
  - backend `/health`;
  - DB connection;
  - R2 presign smoke;
  - Mux API/webhook smoke;
  - Solana RPC health;
  - Vercel frontend health;
  - Render backend health.
- Add runbooks:
  - failed media upload;
  - stale proposal intent;
  - failed Solana relay;
  - stuck settlement;
  - incorrect projection;
  - compromised/rotated key.

Verification gate:

- A fresh environment can be deployed and smoke-tested from README/DEMO instructions.
- Operator can identify and resolve at least the top five expected pilot failures without database spelunking.

### Stage 9: Security, Audit, And Pilot Launch

Goal: freeze financial semantics, reduce abuse risk, and prepare controlled users.

Required work:

- Freeze Anchor instruction interface before audit.
- Expand tests:
  - S1 happy/unhappy;
  - S1 buyout lifecycle;
  - S2 proposal launch;
  - S2 endorsement;
  - settlement edge cases;
  - role guards;
  - expired bundles;
  - double claim/refund/reclaim;
  - cap/rate limits.
- Add abuse controls:
  - daily SPUMP claim limits;
  - endorsement spam limits;
  - content upload quotas;
  - sponsor offer throttles;
  - fraud review gates.
- Run pilot acceptance:
  - one creator;
  - one sponsor;
  - three fan/backer accounts;
  - one complete content/proposal/campaign proof path;
  - one S1 market path;
  - one S1 buyout path;
  - one Track1/Track2 settlement path.

Verification gate:

- Two consecutive clean full verification passes:
  - app build;
  - backend build;
  - backend tests;
  - relevant Anchor tests;
  - media smoke;
  - S1 devnet smoke;
  - S2 devnet smoke;
  - deployment health checks.

## Mock Retirement Order

Retire mocks in this order. Each row should end with code, verification, and documentation updates.

| Order | Mock/seeded area | Replace with | Why this order |
| --- | --- | --- | --- |
| 1 | Preview auth/onboarding/profile | Production session spine and account profile APIs | Every production flow needs current-user truth. |
| 2 | Media/feed fallback | R2/Mux-backed publication and public feed projection | Content is the product entry point and sponsor proof base. |
| 3 | Workspace persona fallback | Live workspace overview/list/detail APIs | Creators and sponsors need honest work queues. |
| 4 | Proposal/campaign fallback | Projection-backed proposal and campaign proof | S2 money flows depend on this state. |
| 5 | Rewards mock | Real daily SPUMP and reward ledger | Fan utility must be accountable before endorsement. |
| 6 | S1 seeded market assumptions | Self-serve creator readiness, rating, cap, projection reads | S1 must be fair and explainable before public use. |
| 7 | Prepared buyout state | Live buyout offer/accept/rage quit/graduation/claim lifecycle | This is the highest-stakes S1 financial path. |
| 8 | Endorsement simulator | SPUMP burn/lock, endorsement PDA, reward projection | Depends on campaign proof and reward ledger. |
| 9 | Settlement mock/operator data | Evidence-backed Track1/2 and gated Track3 reconciliation | Final financial truth needs operator-grade auditability. |
| 10 | Prototype/legacy routes | Remove, hide, or relabel as internal | Avoid accidental public claims. |

## Blocker Policy

Stop and report instead of inventing fake production behavior when a task requires:

- OAuth/Web3Auth/passkey dashboard setup;
- production secrets or key rotation;
- Cloudflare R2 bucket/CORS changes;
- Mux webhook configuration;
- paid RPC provider setup;
- Neon production migration approval;
- Vercel/Render dashboard changes;
- real metric provider contract;
- real merchant/reconciliation provider;
- legal/business rules for sponsor offers, creator eligibility, or fraud review.

When blocked, continue only with adjacent safe work:

- improve state visibility;
- add idempotent backend transitions;
- add tests;
- add operator runbook text;
- add dev-only smoke scripts;
- remove misleading copy;
- isolate prototype routes.

## Route Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| `/login` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Current page is labeled; promote only after production provider verification and managed-wallet mapping. |
| `/demo`, `/pitch` | `SEEDED_DEMO` | `/demo` is audited as a boundary-first demo map. `/pitch` is a support/presentation route and must not be used to imply missing financial flows are live. |
| `/workspace` | `SEEDED_DEMO` | Remove or narrow mock persona fallback and improve panel-level readiness. |
| `/workspace/content/new` | `SEEDED_DEMO` | Add retry/resume, deployed R2/Mux smoke documentation, and production media error recovery. |
| `/workspace/content/[manifestId]` | `SEEDED_DEMO` | Add failed asset recovery, clearer S2 readiness blockers, and remaining i18n cleanup. |
| `/workspace/intents/[intentId]` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Live route is already API/wallet-wired; next work is role-state polish, fallback labeling, and projection reconciliation. |
| `/workspace/sponsor-onboarding` | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | Multi-step Sponsor KYB UI submits backend SponsorProfile records. Promotion requires R2 document upload smoke, operator approval UI, notification delivery, and production migration approval. |
| `/workspace/sponsorships`, `/workspace/buyout`, `/workspace/overview-v2` | `MOCK_PREVIEW` | Sponsorships and buyout are labeled local previews. `overview-v2` is a legacy/experimental workspace entry; remove, hide, or relabel before public product claims. |
| `/campaigns/[proposalId]` | `SEEDED_DEMO` | Can load proposal API or local fallback; add fallback readiness clarity and fuller campaign proof projection. |
| `/campaigns/[proposalId]/endorse` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Live campaign proof paths can build/sign/submit `endorse_proposal`; unavailable campaigns still fall back to the labeled local simulator. Remaining work: claim UI, reward-ledger UX, deployed migration/program smoke, and broader portfolio projection display. |
| `/campaigns/[proposalId]/settlement` | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Track data must come from projection and permitted operator/oracle flows. |
| `/rewards` | `MOCK_PREVIEW` | Real daily SPUMP claim before missions. |
| `/portfolio` | `SEEDED_DEMO` | Live portfolio/claim builder exists for seeded state; needs full rage quit/re-entry/projection consistency. |
| `/market/[creatorId]` | `SEEDED_DEMO` | Live buy/sell builders exist; needs non-seeded onboarding, rating provenance, and cap usage. |
| `/buyout/[creatorId]` | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Prepared buyout/rage quit/claim path exists; productize offer, acceptance, graduation, and reclaim. |
| `/creators/[creatorId]`, `/explore`, `/trending`, `/posts/[postId]`, `/activity` | `LIVE` + `SEEDED_DEMO` | Keep social-first; expose real media and creator market states without silent local fallbacks. |
| `/me`, `/onboarding` | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | These routes now read/write AccountProfile for the current session when migrated. Portfolio, rewards, saved content, and activity still use preview/derived records; production DB migration and account-specific ledgers remain required. |

## API / Service Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| Auth/session/account services | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Email/wallet sessions and AccountProfile read/write APIs exist. Google/Apple server OAuth code exchange and token verification are locally implemented behind disabled flags; remaining work is provider dashboard/secrets setup, deployed real-account smoke, managed-wallet custody/mapping hardening, account linking/revocation policy, audit events, and a later human gate before the closed social lane can reopen. |
| Sponsor KYB services | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | SponsorProfile schema/API and internal operator review endpoints exist. Remaining work is production R2 credentials/CORS smoke, operator UI, admin auth policy, notification delivery, and migration approval. |
| Feed and media services | `LIVE` + `BACKEND_READY_UI_GAP` | Remaining work is deployed smoke, publication eligibility, and recovery states. |
| Content manifests | `SEEDED_DEMO` | Remaining work is retry/resume, review/eligibility, and Mux reconciliation UX. |
| Proposal intents and bundles | `SEEDED_DEMO` | Remaining work is role-aware errors and Solana confirmation reconciliation hardening. |
| Creator auth signature service | `BACKEND_READY_UI_GAP` | `/api/v1/content/creator-auth-signature` can issue oracle Ed25519 authorization messages for chain `register_creator`. Production promotion requires real Twitter/X OAuth setup, nonce replay persistence, and deployed program upgrade. |
| Campaign projections | `SEEDED_DEMO` | Proposal detail API is used; need complete launch/funding/content-anchor/settlement read models. |
| S2 endorsement routes and projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | `/api/v1/proposals/:id/endorse/build`, `/api/v1/proposals/:id/endorsement/claim/build`, transaction submit, and `S2EndorsementPositionProjection` exist for seeded proposals. Production promotion requires applying the migration, deploying the upgraded program, running a wallet-backed devnet smoke, and exposing claim/reward state in user-facing UI. |
| S1 routes and market projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Buy/sell/rage-quit/claim builders and portfolio/profile reads exist; need full self-serve and lifecycle projection coverage. |
| Oracle/indexer/settlement jobs | `OPERATOR_REQUIRED` | Services exist; need queue/status views, idempotent manual triggers, evidence digests, and scheduler guards. |
| Prototype routes | `MOCK_PREVIEW` | Keep isolated; do not mount as v1 product capability. |

## Roadmap

| Phase | Goal | Primary work |
| --- | --- | --- |
| 1. Production corridor bootstrap | Move the first creator/sponsor path from preview to verifiable product behavior. | Account profile APIs, session-backed onboarding/profile, media/feed smoke, proposal proof reconciliation, and readiness labels for non-corridor mocks. |
| 2. Auth/session | Make identity usable without wallet-first UX. | Production provider verification, passkey/OAuth hardening, managed-wallet mapping, preview fallback gating. |
| 3. Media/feed | Make content a reliable product asset. | Retry/recovery, publish eligibility, Mux reconciliation UX, deployed media smoke, feed proof. |
| 4. S1 lifecycle | Move S1 from seeded demo to self-serve market. | Creator onboarding, rating/cap reads, buyout offer/accept/graduation/reclaim, projection-complete claim/re-entry. |
| 5. S2 lifecycle | Productize sponsorship launch, endorsement, and settlement. | Proposal reconciliation, endorsement PDA/burn, fan claim, Track1/2 operator settlement, Track3 gated reconciliation. |
| 6. Operations/deployment | Make demos and test users observable. | Indexer/oracle/media/settlement dashboards, retry controls, Vercel/Render/Neon/R2/Mux smoke. |
| 7. Audit/growth | Prepare for broader users. | Anchor unhappy-path tests, abuse controls, audit freeze, mobile-critical surfaces, non-speculative growth loops. |

## Execution Rules

Use `docs/streamPump-page-readiness-goal.md` for ongoing page-level work.

- Canonical release branch: `main`.
- Integration/governance branch: `codex/post-deadline-phase-0`.
- Keep `codex/post-deadline-phase-0` synced with `main` before PR merge work.
- Protected files: `backend/package-lock.json`, `pitch/colosseum-submission.md`, `pitch/demo-youtube-description.md`.
- Use explicit `git add` paths only.
- Pick one page, route, or API surface per pass.
- Do not invent fake integrations or relabel mocks as production.
- Record verification and blockers in the Progress Ledger.

Page order:

```text
/login (audited)
/demo (audited)
/workspace/sponsorships (audited)
/workspace/intents/[intentId] (audited)
/workspace/content/new (audited)
/workspace/content/[manifestId] (audited)
/workspace (audited)
/campaigns/[proposalId] (audited)
/campaigns/[proposalId]/endorse (audited)
/campaigns/[proposalId]/settlement (audited)
/rewards (audited)
/portfolio (audited)
/market/[creatorId] (audited)
/buyout/[creatorId] (audited)
/creators/[creatorId] (audited)
/explore and /trending (audited)
/posts/[postId] (audited)
/activity (audited)
/me and /onboarding (audited)
/pitch (support route)
/workspace/overview-v2 (legacy/experimental route: remove, hide, or relabel)
```

## Verification

| Change type | Minimum checks |
| --- | --- |
| Docs only | `git diff --check`; confirm protected files are not staged. |
| Frontend UI | `npm run build --prefix app`; browser smoke for changed pages when practical. |
| Backend API/service | `npm run build --prefix backend`; targeted tests; broader backend tests when practical. |
| Prisma/schema | Migration review, backend build, affected tests. |
| Chain program | `npm run build:anchor` or `cargo check`; targeted Anchor tests. |
| S1 milestone | S1 local/devnet smoke plus projection/chain consistency check. |
| S2 milestone | S2 launch smoke plus campaign proof/settlement projection check. |
| Media milestone | R2 upload smoke plus Mux webhook/reconciliation smoke. |
| Deployment milestone | Vercel app health, Render `/health`, CORS/API smoke. |

Full acceptance requires two clean passes of app build, backend build, backend tests, relevant Anchor tests, and available devnet smoke checks.

## Progress Ledger

| Date | Scope | Result | Verification | Blockers / next |
| --- | --- | --- | --- | --- |
| Note | Ledger interpretation | Each row is a point-in-time snapshot. Use the newest row for current policy and preserve older rows as historical evidence; later scoped entries reopen only the lanes they explicitly name. | Preserve each row's point-in-time verification evidence. | Keep devnet/test-USDC, no-real-funds, audit, and financial-lane gates unless a newer row explicitly changes them. |
| 2026-07-15 | Permanent public-access boundary + independent publication review gate | The backend now ignores the retired `PILOT_INVITE_ONLY` and `PILOT_INVITE_WALLETS` environment variables, so stale Render values cannot restore wallet allowlisting. `/health` always reports an open access policy. Content truth is decoupled through `PILOT_OPERATOR_PUBLICATION_REVIEW_REQUIRED`, which defaults to `true` and is mandatory in production; creator self-verification and trusted-publication queries continue to require operator-approved evidence. This changes access only: withdrawal, unrestricted managed-wallet execution, real funds, S1, Track 2/3, rewards, and automatic settlement remain closed. | Backend build PASS; focused boundary/content/proposal/smoke suite **76/76** PASS; deployment-verifier self-test PASS; full backend **243/243** PASS; app production build PASS; `git diff --check` PASS. | Merge to `main` and verify Render serves the exact commit with `PUBLIC_SOCIAL_PILOT`, open access, `/ready` 200, and real Google/Apple authorization URLs. |
| 2026-07-15 | Public Google/Apple registration + wallet-on-withdrawal identity boundary | **The former invite-only access boundary is formally superseded.** Production config permits `PILOT_INVITE_ONLY=false` with no allowlist and permits server-verified `SOCIAL_AUTH_ENABLED=true`; complete Google and Apple provider settings plus the managed-wallet encryption key fail closed at startup. Google/Apple verification now stores the platform-managed session and enters directly instead of asking the user to choose or bind a personal wallet. Standalone Phantom/Solflare login remains available. Onboarding, Sponsor KYB, README/demo/runbooks, and health truth are aligned. Render auto-deploy now takes release identity from platform-injected `RENDER_GIT_COMMIT`, so a stale legacy `PILOT_EXPECTED_RELEASE_SHA` no longer blocks new main commits. No withdrawal flow, real funds, S1, Track 2/3, rewards, or automatic settlement was opened. | Backend build PASS; full backend **242/242** PASS before the final Render-release-identity adjustment, followed by focused Pilot safety **29/29** PASS and backend build PASS after that adjustment; app production build PASS; `git diff --check` PASS. In-app Browser QA on `/login`, `/onboarding`, and `/workspace/sponsor-onboarding` confirmed Google/Apple/wallet entry, no wallet-choice layer, and no personal-wallet request in signup/onboarding/KYB. | Merge to `main`, allow Render auto-deploy, then require `/health` mode `PUBLIC_SOCIAL_PILOT`, open access policy, exact deployed commit, `/ready` 200, and real Google/Apple authorization-start responses. Custodial-to-personal withdrawal remains future work and must be the first personal-wallet prompt. |
| 2026-07-14 | H5 approval + P6 final release-gate audit and preparation | **H5 explicitly approved. P5 final commit `f72c33d` is accepted after Fable 5 fix-only closure returned 0 blocker/major. P6 runs on isolated branch `codex/p6-release-readiness` from that exact boundary.** Final audit identified one bounded release-continuity gap: the accepted deployment-verifier self-test was absent from GitHub CI. P6 adds the existing self-test as a permanent CI step, aligns H5/P6/H6 truth, and adds a post-H6 exact-SHA deployment/rollback handoff. No application, backend business, Anchor, Prisma, financial, auth, product-lane, readiness, provider, data, chain, allowlist, or live-runtime mutation. | Reuse P4 runtime `88c0deb` / `dep-d9auio7lk1mc73c4r18g`, P5 test/review evidence, redacted config fingerprint `70558f49…dce`, and the durable rollback/recovery bundle. P6 risk checks are CI syntax, deployment-verifier self-test, diff/protected-file checks, docs truth, and one exact-range Fable 5 gate. | **H6 pending.** Freeze the P6 candidate, obtain 0 blocker/major, then stop. H6 is release preparation only and does not approve deploy, public launch, real funds, external-audit clearance, or any closed lane. |
| 2026-07-14 | H4 approval + P5 control-plane freshness/disclosure hardening | **H4 explicitly approved. P5 candidate is frozen on isolated branch `codex/p5-pilot-hardening`, based on accepted handoff `34f3d96`.** The bounded delta adds application-owned `Cache-Control: no-store` and `Surrogate-Control: no-store` to `/health`, `/ready`, and internal operator paths; disables `X-Powered-By`; and extends the deployment verifier to reject missing headers or framework disclosure. No chain, DB, provider, allowlist, financial, closed-lane, or readiness mutation. | Live preflight reused P4 key `88c0deb` / `dep-d9auio7lk1mc73c4r18g` and redacted runtime fingerprint `70558f49…dce`; `/ready` DB/indexer/Mux all READY. Backend build, focused readiness suite (6/6), deployment-verifier self-test, final diff check, and protected-file check pass. Exact-range Fable 5 review is pending. | **H5 pending.** Obtain one non-overlapping Fable 5 verdict with 0 blocker/major, then stop. P6 remains unauthorized. |
| 2026-07-15 | `/login` Google + Apple entry repair | Removed the extra Vercel build-time social-auth gate from the login surface. Outside explicitly labeled demo mode, `/login` now renders Google, Apple, and external-wallet entry points and sends Google/Apple clicks only through the server-verified OAuth start flow. A follow-up visual pass removed the redundant hero explanation, per-method subtitles, idle readiness badges, and default status copy; only actionable in-progress/error state remains. No failed real provider request falls back to a preview identity. | App production build PASS; backend TypeScript build PASS; focused social-auth tests 5/5 PASS; `git diff --check` PASS. In-app Browser QA PASS at 1280x720 and 390x844: three buttons visible, no horizontal overflow, no framework overlay, no console warning/error; Google click reached the real API path and showed an honest error against the local disabled backend. Live read-only probe: `https://api.stream-pump.com/health` HTTP 200 at release `88c0deb`, while both Google/Apple `POST /api/v1/auth/social/start` return `Cannot POST`, proving the OAuth backend route is not in the deployed Render release. | Do not deploy the frontend alone: the live backend route is absent. Before a backend deployment, explicitly decide whether social identities remain invite-restricted or public; the current production safety policy still forbids `SOCIAL_AUTH_ENABLED=true` in the invite-only Pilot because provider login otherwise bypasses the external-wallet allowlist. Render/Vercel mutation requires a separate approval. |
| 2026-07-15 | Google + Apple login code preparation (local only; closed Pilot lane) | Added a real server-side authorization-code path for Google and Apple that maps verified provider subjects into the existing `AuthIdentity -> managed wallet -> WalletSession -> AccountProfile` spine. OAuth state is encrypted/authenticated; Google uses PKCE; both providers exchange single-use codes and validate signed ID-token issuer, audience, expiry, and nonce; callback sessions return through a CSP-nonce popup page restricted to an allowed frontend origin. Preview `providerSubject` exchange remains demo-only. `SOCIAL_AUTH_ENABLED` is explicitly forbidden by the current invite-only Pilot safety gate and defaults false. | Backend build PASS; app lint/build PASS; focused social-auth tests 5/5 PASS; full backend 240/240 PASS when overriding two pre-existing local env drifts (`AUTH_ALLOW_PREVIEW_PROVIDER_EXCHANGE=false`, packaged `STREAMPUMP_IDL_PATH`). Setup/runbook added at `docs/backend/google-apple-login-setup.md`; no real Google/Apple account smoke was possible without provider credentials. | Google Cloud consent/client setup; Apple primary App ID + Services ID + domain/return URL + `.p8` key; secret-manager ownership; managed-wallet custody/recovery review; account-linking policy; Apple refresh-token revocation/server notifications; separate human approval before deploy or reopening social identity. This scoped code preparation does not authorize deploy, public launch, reopening social identity, real funds, or readiness promotion; the repository-wide release gate remains H6. |
| 2026-07-14 | P4 H4 allowlist cleanup and runtime-gate stabilization | **Completed.** The sole invite entry is the human-approved external wallet `GYjk…HqCMH`; both disposable actors are removed. Runtime `88c0debad6ecb7eacfe9e24793951f3794353f4c` / Render `dep-d9auio7lk1mc73c4r18g` separates M3 baseline verification from steady-state Neon data and remains invite-only with all closed lanes disabled. | `/health`: `INVITE_ONLY_PILOT`, release `88c0deb`, automated settlement false; `/ready`: `READY`; 17 closed flags false. Both disposable actors produced locally verified signatures and received concealed `401 AUTH_CHALLENGE_INVALID`, matching the controller's anti-enumeration contract. The runtime-gate fix-only Fable closure passed 0 blocker/major/minor; no further review loop is needed. | **H4 ready for human review, not approved. Stop here.** No P5/P6, public launch, real funds, readiness promotion, or closed lane is authorized. |
| 2026-07-14 | P4 M6 disposable external-wallet corridor + manual Track 1 replay | **Completed through settlement/replay within the approved devnet/test-USDC boundary.** Run `p4m6-20260713-a` used role-separated disposable creator `EbsRj…dBF7` and sponsor `Bfjyj…kaKW`; actor prep finalized ten transactions with no forbidden-lane instruction. Manifest `cmrk8utz6000ohw2d7cqnata4` (hash `70d1afea…c7c47`) passed real R2/Mux processing, operator publication approval, feed/post proof, and dual-sign proposal funding. Proposal `FPV64F3YL2uCnU1PLfMzUH34WAAvbPFV5ERcJRKGen29` held Track 1 exactly 1,000,000 raw and Track 2/3 zero. After the fixed deadline elapsed naturally, operator-only settlement and same-key replay both returned `5hjVwnw5QAvApWbNda2okCkN7mkQHcTZfyN6GaPbn4fGzhtU4x5GfVqzqG42F4V8SzEdR1KXQkhTtC3MBVUKrdFV`; attempt count remained 1 and creator balance was `0 -> 1,000,000 -> 1,000,000`. | Runtime `67ec60c7679aca2d7adad24780ae043370c426e3` / Render `dep-d9at6enavr4c73b0rc20`; GitHub checks + `pilot-chain` passed. Fable covered three contiguous exact ranges: `80be8eb..a1de424`, `a1de424..5d07748`, and `5d07748..67ec60c`; all passed with zero blocker/major, so no repeated full scan is required. Independent read-only chain verification: settlement finalized at slot 476146057, `settle_track1_base` discriminator matched, creator ATA delta +1,000,000 raw, proposal `track1Claimed=true`, Track 2/3 zero. `/health` remained `INVITE_ONLY_PILOT` with automated settlement off and `/ready` remained `READY`; public proof is `SETTLED`. | **H4 pending / cleanup blocked.** M4 created `PILOT_INVITE_WALLETS` with only the two disposable actors, so no non-disposable baseline can be restored and removing both would empty the fail-closed allowlist. Human must supply or approve at least one legitimate non-disposable external Pilot wallet public key; then replace both actors and verify each receives 403. Do not use fee payer/admin/oracle or inferred DB wallets. No P5/P6, public launch, real funds, readiness promotion, or closed lane is authorized. |
| 2026-07-13 | P4 M2–M5 controlled technical Pilot deployment (devnet/test-USDC, no real funds) | **M2, M3, M4, and M5 completed successfully as controlled technical Pilot verification — invite-only, external-wallet-first, Solana devnet, test-USDC, Track 1 only, not a formal production launch. P4 M6 is unapproved and not started behind a separate human gate.** M2: the fixed devnet program was upgraded to capacity 1,328,344 with finalized padded SHA256 `a6008d9c11304c73324db9f5645ccd4e303015f0e0f03671f3d41fd42a720732`; no chain rollback required. M3: Neon production has exactly 26 applied migrations with recovery branch `br-frosty-fire-an0lsiq2` retained unchanged. M4/M5: Render service `srv-d79rs0450q8c73fp2lmg` deploy `dep-d9aed2t8nd3s73au07qg` is live at the exact **backend** commit `73df4e2c7a6367b5b28871510d8ced095e59be6c` (the hardened Mux webhook authentication), while Vercel Production `dpl_6f9LBgHRqB8hCywV5DimXfV9YqUK` (Ready) remains at the **frontend** commit `097e9805b197398ae1c04cf5bf84f1044b3b2f19` because this change was backend-only. Mux environment `lnv5m1` has only `https://api.stream-pump.com/api/webhooks/mux` enabled (older `onrender`/`trycloudflare` endpoints disabled); an endpoint-specific signed probe returned 202; a disposable Mux asset `vbmHviLSWRCMAPSoTk6zQG02l2BscN01Nhl79sL9v5wh8` produced `video.asset.ready` event `8e29cc91-fd05-d0f0-f453-9f5067c05d90`, its single production-endpoint attempt returned 200, and its playback returned HLS 200; R2 delivery `streampump-delivery-dev` at `https://media.stream-pump.com` served a 241,514-byte disposable object matching SHA256 `1fc5800b7e1365de2e959c37ee47e5dd07fbb1023ded7f53279639ef485b1582`. Scoped disposable cleanup is proven (Mux asset GET 404, R2 object HEAD 404 and public URL 404, deleted event `1a4b2f34-3cf8-f837-2423-cfc818a1d410`) — this is not global bucket truth. No SPUMP transferability, S1/S2 economics, program ID, PDA seeds, or financial semantics changed; S1, Track 2, Track 3, rewards, managed/email/social auth, public managed execution, and automatic settlement remain closed. | Controlled technical Pilot verification, not a formal production/real-funds launch. The Mux webhook-authentication hardening is now **deployed** at backend commit `73df4e2c7a6367b5b28871510d8ced095e59be6c` (Render `dep-d9aed2t8nd3s73au07qg`). Post-deploy checks against the live backend passed: `/health` HTTP 200 with mode `INVITE_ONLY_PILOT`, `automatedSettlement` false, invite-only access configured; `/ready` HTTP 200 `READY`; a signed-but-ignored Mux event 200, a missing signature 401, an invalid signature 401; and the current Vercel `/explore` HTTP 200 with neither `Service Suspended` nor `Feed unavailable`. The prior endpoint-specific signed probe (202) and the provider-backed disposable Mux `video.asset.ready` event evidence remain intact; the signed probe proves signed-delivery acceptance only and must **not** be treated alone as DB reconciliation proof. Scope: this M5 PASS covers deployment and webhook signature-handling truth only — operator feed approval and full media/DB/auth/corridor reconciliation are **deferred to M6, which requires separate human approval**, and were **not** part of the M5 PASS. | **Next gate: P4 M6** — disposable allowlisted external-wallet corridor + manual Track 1 replay on devnet/test-USDC, unapproved and not started. The missing-signature 401 fix is deployed in backend commit `73df4e2c7a6367b5b28871510d8ced095e59be6c`, but the application rollback target stays exactly `097e9805b197398ae1c04cf5bf84f1044b3b2f19` and honestly restores the prior missing-signature 500 behavior. Rotate Mux endpoint and signing secret as a pair; never restore an exposed old endpoint secret; keep origin/delivery buckets and the custom domain intact. Remaining external launch blockers stand: external security audit + legal review before any real-funds/production promotion. |
| 2026-07-12 | P4-A read-only release-readiness preflight + H3 approval | **H3 is approved.** After that approval, the human authorized **one commit/push/merge round**, and this execution round targets the long-lived integration branch `codex/post-deadline-phase-0` instead of production `main` as an operational safety choice — it must NOT trigger Render/Vercel production. P3 remains implemented and **verified locally + Fable-5 re-reviewed PASS**, but is **still not deployed, not live, and no real-credential smoke has occurred**. P4-A is **read-only**: no chain, DB, or platform state was mutated. Findings — Render backend is **live at `b362910`** (`/health` 200, `/ready` 404, i.e. the deployed commit predates the P3 readiness probe); Vercel production is at **`cbdf76a`**. Neon has **6 unapplied migrations** (`20260712120000`, `130000`, `150000`, `160000`, `170000`, `180000`); **no migration was applied**. The fail-closed migration impact preview reports **10 feed-eligible manifests**, **13 open/funded unclaimed proposals**, and **8/8 unproved manifest anchor signatures cleared**. Devnet Program ID remains `FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp`, but the **deployed program bytes differ from the local candidate** — a program **extend by 3,088 bytes plus a controlled upgrade/rollback** is required before any corridor smoke. Pilot test-USDC (`5Z5M…BXQJ`) and oracle authority (`HnGF…sUvC`) are identified. The exact production IDL is **35 instructions / 13 accounts / 66 types / 87 errors**. No SPUMP transferability, S1/S2 economics, program ID, PDA seeds, or financial semantics changed; S1, Track 2, Track 3, rewards, managed/email/social wallets, public managed execution, and automatic settlement remain closed. | **Read-only preflight only** — no program extend/upgrade, no Neon migration, no Render/Vercel deploy, no Mux webhook change, and no corridor/Track 1 smoke were executed. Live services were **inspected, not mutated**. | **Next gate: an explicit production-mutation approval (P4)** covering program extend (3,088 bytes) + controlled upgrade/rollback, a Neon restore point + migration application, controlled Render/Vercel deployment, Mux webhook setup, and a **disposable allowlisted-wallet corridor + Track 1 replay smoke** — **devnet/test-USDC only, no real funds**. Render/Vercel production must NOT be triggered by the integration merge. Remaining external launch blockers stand: real dedicated devnet RPC, a formal freeze/approval of the identified Pilot test-USDC mint, external security audit + legal review. |
| 2026-07-12 | P3 pilot recovery + readiness gates (integrated Codex backend base `d14a20f` plus follow-up fix `96e9075`, and this frontend/docs pass) | **H2 approved; P3 is implemented and verified locally only — NOT deployed, migrations added locally but not applied by this work, no live smoke. The first Fable 5 review of the initial P3 range (`84c3415..109767f`) found no blocker but 2 major findings; both were fixed locally in `96e9075`, and the mandatory Fable 5 re-review of the fixed range `84c3415..d783301` is now PASS (2026-07-12, no blocker/major remains). H3 is now approved (see the 2026-07-12 P4-A entry above); the human subsequently authorized one commit/push/merge round, and this execution round targets `codex/post-deadline-phase-0` instead of production `main` as an operational safety choice; the next gate is an explicit production-mutation approval (P4).** Integrated Codex backend `d14a20f` adds: **`/health` liveness always-200** and a distinct **`/ready` that returns 503 until DB + enabled Indexer + enabled Mux reconciliation report ready**; a **production preflight** that validates devnet/program/test-USDC and that the **manual Track 1 Oracle signer equals on-chain `ProtocolConfig.oracleAuthority`**; **persisted chain attempts** with **operator-only replay** and **no-resend intent reconcile**, all **audited**; creator manifest-detail **safe media/storage/publication diagnostics** plus **`isPublicFeedEligible`**; **audited** operator publication reopen/revoke and Mux **requeue** (requeue only verified immutable bytes in `ERRORED`/exhausted state); **no-resend, audited** operator Track 1 status/reconcile that **never auto-submits**; and a corridor smoke requiring a **stable run id/deadline**, **real creator + sponsor wallet auth**, **resumable idempotency**, and **public proof**, with the Track 1 smoke asserting **replay**. CI adds **Prisma / exact-IDL / Anchor / Track 1 chain** gates. **Two P3 migrations — `20260712170000_chain_ingestion_recovery` and `20260712180000_pilot_operator_events` — were added locally in earlier P3 work and are NOT applied by this work** (the actual environment/DB applied state was not inspected); the follow-up fix `96e9075` amended the existing P3 schema/migrations rather than adding a new migration. **Follow-up fix `96e9075` fails the indexer closed on stalled subscriptions:** startup requires a real public `onSlotChange` notification plus `getSlot`, and at runtime a stalled slot heartbeat (90s) or an RPC probe failure downgrades the readiness Indexer signal to FAILED so `/ready` returns 503; ordered signature backfill marks a signature terminal-`PRUNED` on its third bounded NOT_FOUND (operator replay can reset it to PROCESSING and later SYNCED). This frontend/docs pass wires `app/src/lib/api/workspace.ts` types to the new manifest serializer fields, extends `/workspace/content/[manifestId]` to distinguish storage verification, Mux ingest state/attempts, publication review evidence, feed eligibility, immutable finalized content, and an operator-intervention handoff (copy only — no internal endpoints, no fake actions), and records this P3 status across docs. No SPUMP transferability, S1/S2 economics, program ID, or financial semantics changed; S1, Track 2/3, rewards, email/social/managed identity, public managed wallets, and automatic settlement remain closed. | Backend P3 verification (post-fix `96e9075`): Prisma validate PASS; backend build PASS; focused suite **20/20**; **full backend 187/187 pass**; exact production-IDL verifier (**35 instructions / 13 accounts / 66 types / 87 errors**); Anchor build plus the P2 Track1-only local-chain suite (**3 passing**); app lint and production build **PASS**; `git diff --check` run after edits. **No real production-corridor or Track 1 smoke was executed** — live credentials/proposal unavailable; the smoke scripts fail closed. Do not call the corridor live or production-ready. **The first Fable 5 review of the initial P3 range found no blocker but 2 major findings, both fixed locally in `96e9075`; the mandatory Fable 5 re-review of the fixed range `84c3415..d783301` is now PASS (2026-07-12, no blocker/major). Fable's own Bash test rerun was permission-denied, so its verdict rests on code/test inspection plus the orchestrator's already-executed evidence above — Fable itself did not execute the test suite. Human review node H3 is now approved (2026-07-12).** | No readiness/production promotion; devnet/test-USDC only, not deployed, not live. The two new migrations were added locally in this work and are not applied by this work (DB state not inspected). **H3 is approved; the next gate is an explicit production-mutation approval (P4) — see the 2026-07-12 P4-A entry.** Remaining external launch blockers are unchanged: real dedicated devnet RPC, a formal freeze/approval of the identified Pilot test-USDC mint, real deployment chain preflight, a deployed-corridor + Track 1 smoke with live credentials, and external security audit + legal review. |
| 2026-07-12 | P2 pilot corridor-truth enforcement (fixed range `d78815b..e0b6028`) | **H1 approved; P2 passed an independent Fable 5 review (PASS, 2026-07-12, no blocker/major) and human review node H2 is approved — not deployed, not live for real funds.** Pilot stays invite-only (external real-wallet allowlist), Solana devnet/test-USDC, **Track 1 only**; S1, Track 2, Track 3, engagement rewards, email/preview identity, public managed-wallet execution, and automatic oracle settlement remain closed. **Content truth** (`32dff7d`, backend): uploads land in a **private R2 origin bucket** while a **distinct public delivery bucket** (`R2_DELIVERY_BUCKET` ≠ `R2_BUCKET`) holds only verified media; the backend records **server-observed bytes/MIME/size/SHA-256**, does **verified promotion then origin cleanup**, **serializes the monthly upload quota**, runs **Mux reconciliation**, forbids **creator self-verification**, and requires **operator approval for feed eligibility**. **Durable DB-backed API idempotency** now guards content and proposal-intent mutations. **Proposal truth**: launch requires a **feed-eligible immutable manifest**, a **positive Track 1**, **creator + sponsor signatures**, and a **confirmed chain-state match**; **Track 2/3 are zero and rejected if partially configured** (`36a92e6`, program — track1-only proposals). **Manual Track 1 operator settlement** is **evidence-bound, idempotent, lease-fenced, signature-verified**, and the proof **separates anchor/funding/settlement signatures**; **historical unprovable anchor-tx signatures were cleared by migration**. Frontend (`2e5130c`) enforces the corridor truth states, and the final Opus UI truth fix (`5ad0065`) corrects onboarding external-wallet/Track 1 copy, carries no preview/seeded badge, and removes portfolio/rewards from normal Pilot navigation (legacy routes remain labeled and direct-link only). New env/runbook: `R2_DELIVERY_BUCKET` distinct from `R2_BUCKET`, `INTERNAL_OPERATOR_API_KEY`, `INDEXER_ENABLED`/`MUX_RECONCILIATION_ENABLED` gates, and a **packaged production IDL** (`STREAMPUMP_IDL_PATH=./idl/streampump_core.json`). No SPUMP transferability, S1/S2 economics, program ID, or financial semantics changed. | Verified locally: Prisma generate + validate; backend build; **150 backend tests**; production-IDL verifier (**35 instructions / 13 accounts / 66 types / 87 errors**); Anchor build; **12 key local chain tests**; app lint + build; `git diff --check`. Browser-verified in the in-app Browser on `/onboarding` and `/campaigns/not-a-pda` at desktop and 390px mobile: clean console, no framework overlay or horizontal overflow, external-wallet login navigation works, and the campaign error is fail-closed with no local fallback. **Real production-corridor and Track 1 smoke were NOT executed** — live Pilot credentials/proposal unavailable; `smoke:production-corridor` and `smoke-pilot-track1` fail closed with explicit blockers. Do not call the corridor live or production-ready. **Independent Fable 5 review of the fixed range ending `e0b6028`: PASS on 2026-07-12, no blocker/major finding (no rerun required).** Two non-gating observations: (1) hosted platforms outside the recognized Render/Cloud Run/Railway markers still rely on `NODE_ENV=production` or an explicit `PILOT_INVITE_ONLY` to enter the production-gated path; (2) monthly upload-quota attribution keys off asset `createdAt`, so cross-month re-presign attribution is approximate. | No readiness/production promotion; devnet/test-USDC only, not deployed, not live; no deploy, migration application, real-credential smoke, or readiness promotion occurred. Human review node H2 is now approved; **P3 has since passed its mandatory Fable 5 re-review (2026-07-12, no blocker/major) and human review node H3 is now approved (2026-07-12); the next gate is an explicit production-mutation approval (P4).** Remaining external launch blockers: real dedicated devnet RPC, decided Pilot test-USDC mint, real deployment chain preflight, a deployed-corridor + Track 1 smoke with live credentials, and external security audit + legal review. |
| 2026-07-11 | P1 pilot hardening: invite-only runtime gates + docs truth | Backend now enforces invite-only Pilot runtime gates (commit `b393bac`): each challenge request returns a freshly randomized, uniformly-shaped, stateless HMAC challenge and the challenge endpoint touches zero DB (no per-wallet state written or read), with the invite (allowlist) check running only after a valid signature, so the allowlist cannot be probed in advance. Added a fail-closed production chain preflight (`pilotChainSafety.ts`) that refuses to start unless every active RPC reports the full Solana devnet genesis hash, the configured program account exists and is `executable`, and on-chain `ProtocolConfig.usdcMint` exactly equals `PILOT_EXPECTED_USDC_MINT`; added `pilotInvitePolicy.ts`, rate limiting, and `.env.example`/config for `PILOT_INVITE_ONLY`, `PILOT_INVITE_WALLETS`, `PILOT_EXPECTED_USDC_MINT`, `PILOT_CHAIN_PREFLIGHT_TIMEOUT_MS`. The only Pilot-user corridor is external-wallet auth → R2/Mux content → public feed/post → proposal intent → creator + sponsor dual sign → backend relay → manual Track 1 fixed-base → campaign proof; managed/email-social wallet, public managed execution, S1, Track 2 endorsement/fan rewards, Track 3 CPS, daily/engagement rewards, automatic settlement, and prototype routes are closed for all Pilot users. This Opus docs/UI pass touched 12 files in total — 6 frontend files (`app/src/components/auth/AuthOptionsPanel.tsx`, `app/src/components/layout/PilotClosedSurface.tsx`, `app/src/lib/i18n.tsx`, `app/src/pages/campaigns/[proposalId].tsx`, `app/src/pages/campaigns/[proposalId]/settlement.tsx`, `app/src/pages/demo.tsx`) that close Pilot-out-of-scope entry points and align surface copy, plus 6 docs (`README.md`, `README.zh-CN.md`, `DEMO.md`, `docs/streamPump-page-readiness-goal.md`, `docs/backend/vercel-render-deployment.md`, and this roadmap) aligned to that Pilot truth. No SPUMP transferability, S1/S2 economics, Anchor instruction semantics, program ID, or financial semantics changed. | P1 backend (`b393bac`): Node 22 backend build + 107 tests, frontend lint/build, `cargo check`, and an HTTP contract smoke all passed. Opus docs/UI pass: `git diff --check`; protected-file diff clean; 12 files touched (6 frontend + 6 docs), all within the allowed surface. **P1 Fable review is pending; human review node H1 is closed / not opened until Fable returns PASS** — not yet reviewed, not yet approved. | No production/readiness promotion. Not deployed, not live, no real funds. Do not claim server-side SHA256 verification of uploaded bytes, independent third-party publication verification, program-side allowlist enforcement, audit, deployment, or real funds. Remaining blockers before a real Pilot launch: a real dedicated devnet RPC, a formal freeze/approval of the identified Pilot test-USDC mint, a complete production IDL artifact/package (the Render `Root Directory=backend` layout currently leaves `../target/idl` outside the deployed artifact), a real deployment chain preflight, a deployed-corridor smoke, and external security audit + legal review. |
| 2026-07-11 | P0 production safety gates | Landed the P0 pilot safety fixes over the fixed range `5a7f355..6ee771e`: enforced production safety gates, required complete immutable campaign-proof fields, closed managed-identity entry points, enforced frontend production truth boundaries, and revalidated stored launch terms. Scope was limited to safety/boundary hardening; no economics, program ID, or SPUMP semantics changed. | Fable 5 automated review: **PASS**. Human review node **H0: approved**. | No readiness promotion. This range is the safety baseline the P1 invite-only gates build on; all P1/launch blockers still stand. |
| 2026-06-26 | Demo-day managed wallet capacity path | Added demo-day managed-wallet pool and async execution infrastructure: `POST /api/v1/auth/ephemeral-session` allocates a pre-generated encrypted managed wallet from the pool using an HMAC subject, `/api/v1/s1/managed/execute` now enqueues idempotent managed-wallet jobs, and `GET /api/v1/s1/managed/jobs/:jobId` reports queued/running/succeeded/failed state plus signature/projection/error details. Added Prisma pool/job enums and `ManagedWalletExecutionJob`, wallet-pool seeding, in-memory rate limits, daily wallet quotas, worker concurrency controls, split transaction/indexer RPC config, and production fail-fast checks for dedicated RPC and Neon pooled connection settings. Added `/try` as the QR/mobile demo entry and a demo-day capacity runbook plus k6 load-test script. No SPUMP transferability, S1/S2 economics, Anchor instruction semantics, program ID, or readiness label changed. | `npm run build --prefix backend` passed; `npm run build --prefix app` passed with `/try` generated; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/s1ActionController.spec.ts` passed 9 tests. Recorder checked branch/status, current dirty/untracked API/schema/frontend/demo collateral, and canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No production readiness promotion. Migration is not applied; deployed k6 load test, Render/Neon/RPC configuration, funded wallet pool preparation, browser smoke, production auth replacement, KMS/MPC custody, recovery/export, KYC/legal/audit gates, and custodial-to-personal USDC withdrawal remain blockers. This path remains devnet/demo-day operator-prepared `SEEDED_DEMO`, not production custody or public real-money readiness. |
| 2026-06-25 | Managed portfolio wallet devnet claim path | Added a dev-only managed demo wallet provision script that encrypts the assigned keypair into `AccountWallet`, binds `AuthIdentity`/`AccountProfile`, and verifies `isManagedWallet`. Extended the devnet S1 buyout seed so the assigned managed wallet can be injected as an unclaimed early backer without writing its secret into `.local` state. Added `claim-s1-buyout-usdc` to `/api/v1/s1/managed/execute`, so the backend can co-sign seeded S1 buyout claims with the managed wallet and oracle. `/portfolio` now obtains a real backend managed-wallet session through the preview provider-exchange path instead of writing the local S1 mock token, treats that managed session as active without an external wallet, and labels the source as `SEEDED_DEMO`; withdrawal copy now honestly says claimed USDC lands in the custodial wallet first and personal-wallet transfer remains next-step work. Devnet was upgraded with a narrow legacy `ProtocolConfig` migration compatibility patch, the historical config account was migrated, the assigned managed wallet was seeded as a claimable early backer, and a real managed claim completed with signature `2f5zuHmoV2s7fzzhp7iGfD259ZBuhhWvd963yM55sLgnbivus3ryXRssVLoUrcR9avSS325naMvom2bA2QytRHGn`. | Devnet program upgrade `3FGX3nasG3t5MZgoKFeRcHuR8W4EHY1bZeAj9NMSQBmKrJd1k6tVRgK9s7LR8A7rD7NwmxktZB5ApL4fHp92nuyx`; protocol migration `216BtGN68EE1jCSsx7ZkKW1qJejHFbmBoJBeKNC4xL7EoTEEfis2yscd9He9aP1nVCGXVmCneFoHSYtVGnTvVCpk`; oracle graduation `4DCKwwnJmUMYh5V8NECQaLk83LWbXy1ZeJhRQ3ACTMFjuji8mDXvWv53sv8bp6STdwhdB8gVRFzGZNfAJE7t4CLD`; managed claim projection sync `SYNCED`. Checks: `cargo test -p streampump-core pre_endorsement_limit -- --nocapture`; `npm run build:anchor`; `npm run build --prefix backend`; focused `s1ActionController` + `managedWalletService` tests; `npm run build --prefix app`; `git diff --check`; protected-file diff clean. | No production readiness promotion. The path is devnet/seeded only and still uses preview provider exchange for demo session issuance. Remaining blockers: add custodial-to-personal USDC withdrawal, replace preview auth with production verification, move custody to KMS/MPC/recovery controls, finish KYC/legal/audit gates, and make the devnet seed recovery path fully idempotent. |
| 2026-06-25 | Shell + explore + scout preview pass | Consumer shell/sidebar now matches the energy/backing content prototype more closely, with Feed/Discover/Backings/Energy/Creator Studio navigation, seeded SPUMP energy chip, compact language/profile controls, and duplicate topbar profile removal. `/explore` moved recommended/following tabs into the topbar, added video duration/play affordances, image-count labels, pending-metric copy, and seeded local engagement enrichment for imported feed rows. `/trending` has a new discover-board preview with seeded category/market-projection joins, and `/portfolio` has a `MOCK_PREVIEW` scout scoreboard plus platform-managed wallet browsing copy. Added Chinese/English demo-day scripts and a standalone HTML pitch artifact under `pitch/`. No backend, Prisma, Anchor, settlement, financial semantics, or readiness labels changed. | `npm run build --prefix app` passed on the current working tree; protected-file diff check clean; recorder checked branch/status, `c584802..482882b` committed diff evidence, current staged/unstaged frontend/demo collateral, and canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. The following feed still has no real follow graph; seeded engagement/market/category/scout values are preview context, not chain truth; platform-wallet browsing copy does not implement backend managed-wallet signing, custody secret handling, S1 managed execution, USDC withdrawal, KYC/legal approval, or production account recovery. Public shell remains mixed `LIVE` + `SEEDED_DEMO`; S1 portfolio/claim remains `SEEDED_DEMO`; S1 buyout formation remains `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED`; rewards remain mixed `SEEDED_DEMO`/`MOCK_PREVIEW`; Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`. |
| 2026-06-25 | Content feed + endorsement surface pass | `/campaigns/[proposalId]` and `/campaigns/[proposalId]/endorse` now have fuller localized status, oracle/sync, metric, track, wallet, managed-endorsement, claim, and seeded/local-simulator notices. Endorsement copy keeps live seeded campaigns labeled as API/wallet-wired but still `SEEDED_DEMO`, local fallback routes as simulators, Track 3 visibly gated, and fan rewards capped/flat/non-stake-proportional rather than earnings. `/activity` gives buyout/S2 events stronger visual weight, post detail separates content/actions from the creator/backing/comment rail, seeded local comments attach by title, `/explore` adds a shorts shelf plus immersive overlay and recommended/following tabs, and primary navigation shifts toward Feed/Discover/Backings/Energy/Creator Studio language. No backend, Prisma, Anchor, settlement, financial semantics, or readiness labels changed. | `npm run build --prefix app` passed; protected-file diff check clean; recorder checked branch/status, `857a685..c584802` diff evidence, and canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. This frontend pass does not verify devnet endorsement balances/ATAs, indexer projection sync, reward-claim lifecycle, oracle settlement, comment persistence, a follow graph, backend recommendation APIs, media reliability, or production campaign endorsement readiness. S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`; S1 market buy/sell remains `SEEDED_DEMO`; S1 buyout formation remains `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED`; rewards remain mixed `SEEDED_DEMO`/`MOCK_PREVIEW`; Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`. |
| 2026-06-25 | Market + buyout truth-copy pass | `/creators/[creatorId]` now presents creator momentum/content signals instead of investment/price-history framing. `/market/[creatorId]` has localized trade/readiness/demo copy, an explicit note that the current seeded-market price is projection-backed while the price-history curve is synthetic display context, and a visible capped/non-proportional discovery-reward disclaimer. `/buyout/[creatorId]` has full localized copy, a standalone capped-reward disclaimer, eligibility-chip language, and clearer seeded/demo vs local-preview claim-state wording. Shared S1 demo/action affordances and `/trending` Back CTA semantics were tightened. No backend, Prisma, Anchor, settlement, financial semantics, or readiness labels changed. | `npm run build --prefix app` passed; protected-file diff check clean; recorder checked branch/status, `bef53c7..857a685` diff evidence, and canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. This copy/i18n pass does not productize open creator onboarding, sponsor buyout offer creation, creator acceptance, graduation, reclaim, re-entry, reward ledger views, KYC, legal approval, audit clearance, program deployment, backend claim APIs, or production backing readiness. S1 market buy/sell remains `SEEDED_DEMO`; S1 buyout formation remains `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED`; S1 portfolio/claim remains `SEEDED_DEMO`; Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`. |
| 2026-06-24 | Onboarding + discovery board pass | `/onboarding` now carries localized session-backed readiness/data-source copy and a discovery-not-investment orientation while preserving AccountProfile write gates and preview reward/SPUMP boundaries. `/trending` S1 now behaves like a discovery board with slogan copy, niche chips, top momentum movers, momentum/backer/graduation columns, deterministic `MomentumLine`, and a `Back` navigation CTA into existing market/creator routes. `/portfolio` wording now uses backing/energy-basis/capped-reward language, `ProductReadinessBanner` localizes its Phase 0 eyebrow, and standalone `/posts/[postId]` loads related feed posts through existing public feed helpers. No backend, Prisma, Anchor, settlement, financial semantics, or readiness labels changed. | `npm run build --prefix app` passed; recorder checked branch/status, `2122b3c..bef53c7` diff evidence, and canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. The `Back` CTA is navigation only and does not add new transaction behavior, creator onboarding, buyout lifecycle productization, backend recommendation APIs, billing, reward ledger, or production backing readiness. S1 remains `SEEDED_DEMO`; S1 buyout formation remains `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED`; rewards remain mixed `SEEDED_DEMO`/`MOCK_PREVIEW`; Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`. |
| 2026-06-24 | Content surface energy/backing pass | Feed and post-detail surfaces now carry the first implementation slice of the energy/backing language: stage-aware energy tail chips on feed cards, a post-detail right rail with `BackingCard` teaser linking to `/market/:creatorId`, related-post rows, and the existing comment panel. Added shared primitives (`EnergyAmount`, `MomentumMeter`, `MomentumLine`, `TierBadge`, `ScarcityBar`, `LockedPanel`) plus additive energy/tier/momentum tokens and committed the landing/prototype frontend contracts. No backend, Prisma, Anchor, settlement, financial semantics, or readiness labels changed. | `npm run build --prefix app` passed; protected-file diff check clean; recorder checked branch/status, `e6872a3..2122b3c` diff evidence, and canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. The backing teaser routes into the existing S1 market surface and does not add new creator onboarding, buyout lifecycle productization, backend recommendation APIs, billing, reward ledger, or production backing readiness. S1 remains `SEEDED_DEMO`; S1 buyout formation remains `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED`; Track3 CPS remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`. |
| 2026-06-23 | Explore category filters + frontend design handoff | `/explore` category chips now filter the loaded feed client-side using real post tags/title/location/stage fields, with Creator Watch preferring season metadata and falling back deterministically when imported feed rows lack stage data. Added category empty-state i18n, documented the frontend design-system continuation rules in `docs/frontend/design-system-handoff-2026-06.md`, added a standalone content-page prototype, and removed the unused legacy `PortfolioSections.tsx` component. No backend, Prisma, Anchor, settlement, financial semantics, or readiness labels changed. | `npm run build --prefix app` passed; protected-file diff check clean; recorder checked branch/status plus canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. Explore filtering remains client-side over the loaded feed model, not a backend category/search API. Production auth, media recovery, S1 buyout productization, S2 endorsement claim/reward UI, Track3 merchant reconciliation, and operator dashboards remain open. |
| 2026-06-22 | Frontend design-system migration smoke status | Recorded the uncommitted frontend token/texture migration and navigation cleanup as presentation-system progress only: broader token consumption, semantic readiness/status tone classes for exact labels (`LIVE`, `SEEDED_DEMO`, `MOCK_PREVIEW`, `BACKEND_READY_UI_GAP`, `OPERATOR_REQUIRED`, `NOT_STARTED`), calmer texture controls, `/demo` removed from primary consumer navigation while the route remains available, and Chinese follow-up docs for restrained glass/texture polish. No backend, Prisma, Anchor, settlement, route/API contract, or financial semantics changed. | `npm run build --prefix app` passed; protected-file diff check clean; recorder checked branch/status plus canonical context (`pitch/script.md`, Phase 0 readiness, README variants, DEMO, page-readiness goal) before updating docs. | No readiness promotion; browser smoke was not run by the recorder. The pass remains user-owned/uncommitted frontend work and does not complete production auth, media recovery, S1 buyout productization, S2 endorsement UI/productization, Track3 merchant reconciliation, or operator dashboards. |
| 2026-06-21 | Whitepaper + investor/demo collateral + doc alignment (docs only) | Authored a single-page HTML whitepaper (`whitepaper/index.html`) in the app's dark-glass theme (16 sections, 5 inline SVG diagrams), covering problem, protocol, S1/buyout, S2 three-track, SPUMP utility, level/scout reputation, settlement/metric architecture, Web2.5 architecture, compliance-aware design (worded as design intent, not a legal conclusion), GTM, status, risks, disclaimer. Re-themed the demo-day pitch deck (`demo-day/StreamPump-DemoDay.pptx`) to the same palette and folded in capped/decoupled-reward and treasury-abstraction messaging. Updated `README.md` / `README.zh-CN.md` (themed badges, capped/decoupled buyout + flat endorsement language, instruction 32→35, migrations 17→19, compliance note now "implemented at code level on working branch, gated"). Synced `CLAUDE.md` and `AGENTS.md` (35 instructions incl. `abort_s1_buyout`/`sweep_s1_buyout_residual`/`migrate_legacy_creator_profile`/`migrate_legacy_s1_buyout_state`, 84 error variants, expanded `S1BuyoutState`/`CreatorProfile` notes, refreshed status + migration table, resolved stale-program-id caveat). Updated this roadmap's North Star (status-over-money, capped/decoupled boundary, influence firewall boundary). | `git diff --check` clean; protected files untouched; no code/schema/financial-semantics changed; deck rebuilt and visually QA'd (12 slides, no defects); whitepaper structure validated (anchors resolve, tags balanced, no placeholders); nothing staged or committed. | No readiness promotion; docs/collateral only. All prior gating blockers stand unchanged (legal token classification, jurisdiction/KYC, Anchor audit, production migration approval, program deployment, devnet wallet smoke, holder-counter backfill). |
| 2026-06-21 | S1 buyout holder-counter integrity + residual sweep liveness | Hardened the capped non-proportional S1 buyout implementation without reverting the creator-share/discovery-reward semantics. Graduation is oracle-gated and now reads chain-maintained `CreatorProfile` holder counters instead of caller-supplied counts. `buy_s1_token`, `sell_s1_token`, and `rage_quit_s1` maintain eligible/early/regular holder counters by bucket diff with underflow errors. Added `graduated_at`, default 30-day `s1_discovery_claim_window_seconds`, normal final-claim vault close, authorized `sweep_s1_buyout_residual`, explicit ineligible-claim rejection without clearing positions, and zero-reward eligible finalize behavior. Added Prisma/backend projection fields and sweep/graduation builders/routes, frontend status copy for ineligible/swept/closed states, migration paths for legacy config/profile/buyout accounts, and protocol docs. | `cargo check` passed; `npm run build:anchor` passed with existing Anchor cfg/realloc warnings; `cargo test -p streampump-core counted_claimant_guard` passed 3 tests; `scripts/test-anchor-local.sh programs/tests/s1-happy-path.spec.ts` passed 1 test; `s1-buyout.spec.ts` passed 1; `s1-buyout-unhappy-path.spec.ts` passed 5; `s1-guards.spec.ts` passed 8; `s2-traffic-market.spec.ts` passed 6; `s2-unhappy-path.spec.ts` passed 3; `npm run test:chain:local` passed 22; `npx prisma generate` passed; `npm run build --prefix backend` passed; `npm run test:backend` passed 68; `npm run build --prefix app` passed; `git diff --check` clean; no staged files; protected-file diff empty. | No readiness promotion; not legal-cleared, audited, migrated, deployed, or production-live. Known blocker: legacy `CreatorProfile` holder counters default to zero after migration, so pre-counter in-flight buyouts need an oracle snapshot fallback or one-time `S1UserPosition` backfill before graduation. Remaining blockers: legal token classification, first-launch jurisdiction/KYC, Anchor audit, production migration approval, upgraded program deployment, wallet-level devnet smoke, and operator/audit validation of sweep policy. Defaults needing confirmation: oracle-only graduation, oracle/admin sweep, 30-day claim window, residual destination snapshot, vault rent returned to sponsor, and whether permissionless graduation should return after audit. |
| 2026-06-20 | Platform leveling + weighted influence (design only) | Specified a Bilibili-style platform standing where user actions carry weight: a sticky **platform level** (seniority/trust, the existing `UserProfile.level`) plus a slashable, outcome-validated **curation reputation** (scout score) compose into a sublinear, capped **Influence Weight**. Higher-standing users' likes/cheers/endorsements allocate more discovery traffic and contribute more to creator momentum. Core design contribution is the **compliance firewall**: influence is a reputation/discovery currency, never financial — it moves traffic/ranking/displayed momentum freely but reaches creator valuation (`s1_rating_bps`) only as one bounded input to the oracle's existing guarded rating path, and never multiplies USDC/price/claims. Includes anti-plutocracy rules (universal base weight, sublinear cap, earliness path for newcomers), anti-abuse (daily XP caps, slashable reputation, anti-cheat hooks), and the psychology levers/anti-patterns. New doc `docs/protocol/user-influence-and-leveling.md`; cross-linked from the loyalty and compliance docs; compact design subsection + doc-index link added to `README.md` / `README.zh-CN.md`. | `git diff --check` clean; protected files untouched; no code, schema, or financial-semantics changed; nothing staged or committed. | No readiness promotion; `NOT_STARTED` design. Hard rule: nothing may let influence weight alter USDC/price/claims directly. Valuation effects stay oracle-mediated and bounded; a real abuse-resistant curation-reputation model needs data + anti-fraud review before it can affect the oracle input; oracle centralization remains a systemic dependency. Safe first steps: weighted feed/trending ranking and displayed creator momentum (pure discovery), before any oracle-input integration. |
| 2026-06-19 | Content anchor honest reframe (attribution, not ownership) | Resolved the contradiction between the pitch listing "fake content ownership" as a Web3 failure and the implementation being a bare keccak URL/content-hash anchor. Stated the honest scope: the on-chain `ContentHashAnchor` is a creator-signed publication timestamp + integrity fingerprint of an external URL — it proves authorship attestation, priority/precedence, and tamper-evidence, but NOT originality, ownership, exclusive rights, or anti-copy. Committed to zero content lock-in (content stays on the creator's own platforms; StreamPump stores only a reference + digest + attestation), positioned the anchor's real job as verifiable attribution that routes S2 revenue to the right identity, and laid out an honest, optional strengthening path (cross-platform publication verification first, then C2PA, then a real fingerprint provider). New doc `docs/protocol/content-attribution-and-anchoring.md`; added the explicit non-ownership stance to `pitch/script.md` Slide 4 and to the README convictions; doc-index links added. | `git diff --check` clean; protected pitch files (`pitch/colosseum-submission.md`, `pitch/demo-youtube-description.md`) reviewed and found to contain no ownership overclaim, left untouched; no code or seed/financial semantics changed; nothing staged or committed. | No readiness promotion; narrative/scope correction plus design. `pitch/index.html` already labels "False Content Ownership" as a failure and needs no correctness fix; optionally align its insight copy with the new explicit stance. Strengthening toward originality (publication verification, C2PA) is future design; a perceptual-fingerprint provider remains a third-party blocker. |
| 2026-06-19 | SPUMP compliance posture + value model + loyalty layer (design only) | Added two design specs and aligned README framing to address the two highest-priority feasibility blockers: (1) the Howey/securities risk of the pro-rata "back creator -> claim buyout USDC" structure, and (2) SPUMP's implicit USD price. Identified the shared root cause (a stake-proportional path from cost-bearing SPUMP to USDC profit) and specified the fix: decouple reward from stake size, recharacterize backer USDC as a capped platform-funded discovery/loyalty reward with permanent founding status as the headline reward, make most SPUMP demand pure non-monetary utility via cheer/boost/badge sinks, and add geofencing/KYC/disclosure layers. Documents: `docs/protocol/spump-compliance-and-value-model.md` (Howey before/after, four-layer defense, implicit-price fix, settlement code-change spec) and `docs/protocol/fan-loyalty-and-spump-economy.md` (fan badges, following-duration tiers, founding rank, loyalty-gated S1 caps, sinks). Added a Compliance & token posture note and conviction framing to `README.md` / `README.zh-CN.md`, all labeled design/planned. | `git diff --check` clean; protected-file check clean; no code, schema, or financial-semantics changed; nothing staged or committed. | No readiness promotion; everything is `NOT_STARTED` design. Hard blockers before any public/real-money launch: legal token-classification opinion, first-launch jurisdiction decision, and an Anchor audit of the settlement-math redesign. `claim_s1_buyout_usdc` and `settle_track2`/`claim_endorsement` still implement the pro-rata model and must not serve real public users until the redesign + legal sign-off land. Next safe steps: narrative/UX language discipline, then build the non-monetary SPUMP utility sinks. |
| 2026-06-15 | Render runtime env hardening | Diagnosed the Render backend deploy failure as a runtime production-config failure after successful build and Prisma pre-deploy: `MANAGED_WALLET_ENCRYPTION_KEY` was missing from the Render service environment. Added the variable to `backend/.env.example`, added a Render-specific recovery note and generation command to the deployment guide, and made the backend startup error actionable without weakening the production secret requirement. | Verified locally with `npm run build --prefix backend` and a production config-load smoke using a dummy 64-hex local key. | No readiness promotion. The real Render service still must set `MANAGED_WALLET_ENCRYPTION_KEY` to a freshly generated `openssl rand -hex 32` value in Render Environment or another secret manager, then redeploy. Do not commit the real key. |
| 2026-06-14 | Vercel build recovery and branch unfreeze | Restored the deployed app to the Vercel-compatible Next 15.5.18 / React 18.3.1 / Tailwind 3.4.17 / TypeScript 5.7.3 / ESLint 8 toolchain; pinned Vercel Node to 22.x; removed the inert app middleware; switched `npm run lint --prefix app` to the ESLint CLI; and updated branch policy so `main` is no longer frozen after hackathon review while `codex/post-deadline-phase-0` remains the long-lived integration/governance branch. | Verified with `npm run lint --prefix app`, `npm run build --prefix app`, Vercel deployment `dpl_EJaWdxv2VLE8g2b41cpZNUy1d2JF` in `READY`, and authenticated fetch of `/explore` returning 200. The merge-conflict resolution also kept current-branch deletions for stale `app/middleware.ts`, `app/src/hooks/useProgram.ts`, and `app/src/lib/api/content.ts`. | No product readiness promotion. Remaining deployment warnings are Node engine override and transitive Solana wallet adapter peer-dependency warnings, not ESLint errors. Production promotion still needs Render/Neon/R2/Mux smoke, operator visibility, and Track3 merchant/reconciliation integration. |
| 2026-06-09 | Local startup and test harness follow-up | Isolated backend background-service startup failures across indexer, Mux reconciliation, and oracle scheduler startup; added background rejection logging for Mux reconciliation runs; routed `npm run test:anchor` through the local validator wrapper; defaulted fast Anchor builds to `--no-idl` unless IDL generation is explicitly requested; expanded the local Anchor wrapper default to all specs; adjusted S2 tests/helpers for proposal nonce PDA usage and current settlement/claim semantics; disabled Next telemetry in app scripts and added an inert middleware matcher for local runtime compatibility. | Verified locally with `git diff --check`, `npm run build --prefix app`, `npm run build --prefix backend`, `npm run test:backend`, `cargo check`, `npm run build:anchor`, and `npm run test:anchor`. Runtime smoke confirmed Next dev served `/login`, `/trending`, and `/activity` without framework errors or broken feed media, and backend `/health` plus `/api/v1/feed/posts` responded when the database was reachable. | No readiness promotion. Local startup and test harness behavior is healthier, but production promotion still needs deployed Vercel/Render/Neon/R2/Mux smoke, operator visibility, and the existing Track3 merchant reconciliation blocker remains. |
| 2026-06-09 | Frontend closed-loop actions and feed media stability | Wired content publication verification and public-feed eligibility visibility into content detail, refreshed endorsement/campaign proof and user endorsement state after live actions, added managed/external endorsement and claim UI paths, mapped settlement display from public campaign proof when available, changed daily SPUMP claim to use the transaction flow while keeping missions preview-labeled, and eager-loaded fill-mode feed images to reduce blank media tiles. | Recorder evidence: `git branch --show-current` returned `codex/post-deadline-phase-0`; `git status --short` showed only user-owned uncommitted Anchor/test/script changes before docs edits; `git diff 7cbd66b..HEAD --stat --find-renames` identified the changed frontend/docs files; `git diff --check` passed before documentation edits. App/backend/Anchor builds were not rerun by the recorder. | No production readiness promotion. S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`; settlement remains `MOCK_PREVIEW` + `OPERATOR_REQUIRED`; rewards are mixed with daily claim transaction-wired but missions/reward ledger still `MOCK_PREVIEW`. Full promotion still needs applied migrations, upgraded program deployment, wallet-backed devnet smoke, R2/Mux smoke, operator visibility, and Track3 merchant reconciliation. |
| 2026-05-16 | Roadmap setup | Created long-term roadmap and page-level `/goal` operating model; deleted the recurring automation. | Docs-only checks before commit. | Continue with page-level audits instead of timed automation. |
| 2026-05-16 | Route/API inventory | Added readiness inventory and linked roadmap from README/DEMO. | Docs-only checks before commit. | Use inventory as the source for future `/goal` passes. |
| 2026-05-16 | `/workspace/buyout` | Labeled static sponsor offer data as `MOCK_PREVIEW`. | `npm run build --prefix app`; local HTTP smoke. | Real buyout offer lifecycle still needs backend/UI productization. |
| 2026-05-16 | `/workspace/sponsorships` and `/workspace/intents/[intentId]?demo=1` | Added readiness banners for mock campaign desk and mock signing states. | `npm run build --prefix app`. | Audit live workspace intent/content routes next. |
| 2026-05-16 | `/login` | Added readiness banner for mixed live wallet/email auth plus preview social/local fallback; moved remaining login hardcoded Chinese copy into i18n. | `npm run build --prefix app`; browser smoke on `/login` with English locale; `git diff --check`. | Production OAuth/Web3Auth verification and managed-wallet mapping remain Phase 2 work. Next page: `/demo`. |
| 2026-05-16 | Roadmap refresh | Recalibrated the roadmap so already implemented baseline work is not repeated as future work, while preserving the long-term product target and remaining gaps. | `git diff --check` passed for updated docs. | Phase 0 readiness remains frozen separately; continue `/goal` with `/demo`. |
| 2026-05-16 | `/demo` | Audited the demo hub and changed it from navigation-only cards into a boundary-first demo map. The page now separates seeded S1/S2 demo paths, operator-prepared buyout/settlement dependencies, and preview-only endorsement/rewards/Track3 surfaces without changing route behavior. | `npm run build --prefix app`; browser smoke on `/demo` confirmed readiness and boundary copy, and confirmed the old navigation-only copy is gone. | `/demo` still depends on seeded/devnet/operator setup for live paths. Next page: `/workspace/sponsorships`. |
| 2026-05-16 | `/workspace/sponsorships` | Tightened the mock sponsorship desk so local fixture data cannot be mistaken for a live proposal console. Header actions are disabled/labeled, mock PDA/proof labels are explicit, and fixture rows no longer link into live intent routes with mock IDs. | `npm run build --prefix app`; browser smoke on `/workspace/sponsorships` confirmed local fixture copy, blocked/preview actions, mock chain labels, and no `/workspace/intents/*` fixture links. | Real sponsorship desk still needs live proposal import/list APIs, operator queue permissions, oracle controls, and settlement actions. Next page: `/workspace/intents/[intentId]`. |
| 2026-05-16 | `/workspace/intents/[intentId]` | Added a live-route readiness banner that distinguishes the API/wallet-wired proposal intent path from the local demo signing route, and relabeled pasted-signature controls as operator/debug fallback for controlled demos and bundle verification. | `npm run build --prefix app`; browser smoke on `/workspace/intents/test-intent` confirmed the `SEEDED_DEMO` live readiness copy, auth gate, and absence of the mock signing banner. | Full happy-path verification still requires an authenticated seeded S2 intent, correct creator/sponsor wallets, backend relay/RPC, and projection reconciliation after confirmation. Next page: `/workspace/content/new`. |
| 2026-05-16 | `/workspace/content/new` | Added readiness labeling for the API/R2-wired content creation path and improved recoverability when manifest creation succeeds but upload, asset completion, or finalize fails. The page now surfaces a recoverable draft link instead of treating post-manifest failures as a total loss. | `npm run build --prefix app`; browser smoke on `/workspace/content/new` confirmed `SEEDED_DEMO` readiness copy, R2 dependency text, auth gate, and no mock-preview label. | Full media milestone still needs authenticated R2/Mux smoke, deployed storage config verification, retry/resume UX beyond content detail recovery, webhook/reconciliation visibility, and failed-asset cleanup. Next page: `/workspace/content/[manifestId]`. |
| 2026-05-16 | `/workspace/content/[manifestId]` | Added readiness labeling for the live content detail/recovery surface, added asset issue/processing recovery visibility, and refreshed manifest state after partial upload failures so successfully completed assets are not hidden by a later failed upload. | `npm run build --prefix app`; browser smoke on `/workspace/content/demo-manifest` confirmed `SEEDED_DEMO` readiness copy, R2/Mux/backend dependency text, auth gate, and no mock-preview label. | Full recovery verification still needs an authenticated manifest with real R2/Mux assets, failed asset fixtures, webhook/reconciliation visibility, and cleanup/delete controls. Next page: `/workspace`. |
| 2026-05-16 | `/workspace` | Added page-level readiness labeling and narrowed live overview behavior so authenticated API responses no longer silently borrow demo content pipeline data when the workspace has no manifests. Live overview claimable balances now defer to detail pages instead of showing seeded demo claim values. | `npm run build --prefix app`; browser smoke on `/workspace` confirmed readiness copy, login-required state, no framework overlay, clean console, and Sign in routing to `/login`. | Workspace still needs production auth/session hardening, operator state visibility, and live claim/settlement projections in the overview API. Next page: `/campaigns/[proposalId]`. |
| 2026-05-16 | `/campaigns/[proposalId]` | Added page-level readiness labeling and explicit data-source messaging for live proposal API reads versus the seeded Colosseum demo fallback. Settlement navigation now says preview, documents the remaining operator/oracle/reconciliation gap, and the English demo heading no longer leaks the Chinese mock creator name. | `npm run build --prefix app`; browser smoke on `/campaigns/prop-neo-park-2026q2` confirmed readiness copy, seeded data-source copy, settlement preview labeling, English heading, no Chinese heading leak in EN mode, no framework overlay, and clean console. | Full campaign proof still needs complete launch/funding/content-anchor/settlement read models and production settlement projections. Next page: `/campaigns/[proposalId]/endorse`. |
| 2026-05-16 | `/campaigns/[proposalId]/endorse` | Clarified the endorsement page as a local simulator: route proposal id is shown only as context, core action labels now say preview/simulating, confirmation copy states no wallet signature, SPUMP burn, endorsement PDA, or backend write occurs, and the English creator name no longer leaks the Chinese fixture label. | `npm run build --prefix app`; browser smoke on `/campaigns/prop-neo-park-2026q2/endorse` confirmed readiness copy, local simulator copy, proposal-id context, preview action labels, English creator name, no Chinese creator leak in EN mode, no framework overlay, clean console, and local confirm/success state. | Real promotion requires SPUMP burn, endorsement PDA creation, reward pool projection, and claim state from backend/indexer. Next page: `/campaigns/[proposalId]/settlement`. |
| 2026-05-17 | `/campaigns/[proposalId]/settlement` | Clarified the settlement page as an operator/mock preview: page title and subtitle no longer claim oracle-resolved live data, route proposal id is shown only as context, Track values are labeled as local mock data, and English mode no longer leaks the Chinese creator fixture name. | `npm run build --prefix app`; browser smoke on `/campaigns/prop-neo-park-2026q2/settlement` confirmed preview title, readiness copy, operator preview copy, proposal-id context, English creator name, no Chinese creator leak in EN mode, no framework overlay, and clean console. | Production promotion needs proposal settlement read models, oracle permission checks, idempotent operator triggers, evidence digests, and Track 3 merchant reconciliation. Next page: `/rewards`. |
| 2026-05-17 | `/rewards` | Clarified the rewards page as a local preview: the daily claim button now uses preview language, fixture mission states are labeled, and a persistent page notice explains that no SPUMP mint, reward ledger, backend claim API, or account balance update occurs. | `npm run build --prefix app`; browser smoke on `/rewards` confirmed readiness copy, persistent mock ledger notice, preview claim interaction, final English title after locale hydration, no framework overlay, and clean console. | Real daily SPUMP claim still needs signed-in account state, anti-abuse controls, backend claim records, and verifiable balance/projection updates. Next page: `/portfolio`. |
| 2026-05-17 | `/portfolio` | Clarified portfolio data-source states across signed-out, backend projection, local demo session, and API fallback modes. Demo portfolio sessions now state that they do not call portfolio APIs, build claim transactions, request wallet signatures, or update balances; claim controls are disabled for non-live sessions, and English mode no longer leaks the Chinese fixture creator name. | `npm run build --prefix app`; browser smoke on `/portfolio` confirmed signed-out source notice, local demo `MOCK_PREVIEW` source notice, demo portfolio label, claim queue tab interaction, English demo creator label, no framework overlay, and clean console. | Full production readiness still needs non-seeded creator onboarding, complete buyout lifecycle projections after rage quit/graduation/re-entry, and live devnet smoke for claim consistency. Next page: `/market/[creatorId]`. |
| 2026-05-17 | `/market/[creatorId]` | Clarified S1 market data-source states for demo slugs versus backend wallet routes. Demo buy/sell labels now say preview and state that no S1 builder, wallet signature, SPUMP burn, or Solana transaction occurs; live routes no longer treat a local mock portfolio token as a valid trading session, and English mode no longer leaks the Chinese fixture creator name. | `npm run build --prefix app`; browser smoke on `/market/mika-zhou` confirmed readiness copy, local `MOCK_PREVIEW` source notice, preview buy confirmation copy, local preview interaction updating only page state, English demo creator label, no framework overlay, and clean console. | Full production readiness still needs non-seeded creator onboarding, rating provenance, daily cap usage, projection coverage, and devnet buy/sell smoke beyond demo slug interaction. Next page: `/buyout/[creatorId]`. |
| 2026-05-17 | `/buyout/[creatorId]` | Clarified S1 buyout data-source and action states for demo slugs versus backend wallet routes. Demo rage quit and claim labels now say preview and state that no S1 builder, claim builder, wallet signature, USDC transfer, or Solana transaction occurs; live routes no longer treat a local mock portfolio token as a valid rage quit/claim session, and English mode no longer leaks the Chinese fixture creator name. | `npm run build --prefix app`; browser smoke on `/buyout/luna-cai` confirmed readiness copy, local `MOCK_PREVIEW` source notice, preview rage quit confirmation copy, local-only position/claimable update, English demo creator label, no framework overlay, and clean console. | Production buyout readiness still needs self-serve offer creation, creator acceptance, graduation execution, reclaim, complete post-rage-quit projections, and devnet smoke beyond local preview interaction. Next page: `/creators/[creatorId]`. |
| 2026-05-17 | `/creators/[creatorId]` | Clarified creator profile data-source states for seeded creator slugs, public-feed-derived profiles, and API fallback. Market-facing labels now use projection/seeded language instead of claiming live on-chain lifecycle, fan token trading, or live buyout offers; the page explains that posts/media can be live while price history, holders, sponsors, and lifecycle remain derived or seeded UI projections. | `npm run build --prefix app`; browser smoke on `/creators/mika-zhou` confirmed readiness copy, seeded creator source notice, seeded market/buyout labels, projection price/lifecycle labels, removal of old live/fan-token/on-chain copy, no framework overlay, and clean console. | Production creator profile readiness still needs creator market read models, rating provenance, daily cap usage, real holder data, R2/Mux media smoke, and projection-backed S1/S2 lifecycle state. Next page: `/explore` and `/trending`. |
| 2026-05-17 | Remaining page audit: `/explore`, `/trending`, `/posts/[postId]`, `/activity`, `/me`, `/onboarding` | Completed the remaining page-level readiness pass. Explore/trending now show public-feed versus fallback source state and label market/ranking numbers as projected. Post detail now has readiness/source notices for both successful public post records and API unavailable/not-found states. Activity now labels feed-derived activity, unread, share, highlight, and video-count projections. Profile now keeps readiness visible even when feed API fails and labels portfolio/reward/watchlist data as local preview fixtures. Onboarding now states that wallet/auth/profile/reward steps are local preview only. | `npm run build --prefix app`; browser smoke covered `/explore`, `/trending`, `/posts/post-f1-aesthetics`, `/activity`, `/me`, and `/onboarding`; `/onboarding` `Preview Wallet Setup` advanced to role selection; no framework overlay. Console showed only Next dev HMR ISR-manifest warnings during local dev navigation. | Page-readiness audit inventory is complete. Remaining product work moves from labeling to real integrations: deployed feed/media smoke, account-specific activity/profile APIs, production onboarding/auth mapping, reward ledger, and S1/S2 projection hardening. |
| 2026-05-17 | Demo-to-production roadmap | Added the next concrete product behavior and a staged landing plan from demo to production pilot. The plan prioritizes one real corridor first: authenticated creator -> R2/Mux/backend publication -> public feed/post detail -> proposal intent -> campaign proof. It also defines nine production stages, mock retirement order, third-party blocker policy, and clarifies `/workspace/overview-v2` as legacy/experimental. | `git diff --check` passed for the docs-only update. | Next execution should start with Stage 1 identity/session hardening, then Stage 2 media/feed smoke. Keep existing readiness labels until each mock retirement gate is actually verified. |
| 2026-05-17 | Production corridor bootstrap: AccountProfile | Added `AccountProfile` schema/migration, `/api/v1/account/me` read/write APIs, account profile service tests, and frontend account client wiring. `/onboarding` now requires a real stored auth session and writes role/display name/handle when AccountProfile storage is migrated. `/me` now uses current-session profile data for the profile header while keeping portfolio, rewards, watchlist, and activity labeled as preview/derived records. Added a small FOUC recovery guard so Next dev previews do not remain hidden behind `data-next-hide-fouc`. | `npm run prisma:generate --prefix backend`; `npm run build --prefix backend`; `npm run build --prefix app`; `npx ts-mocha --exit --timeout 10000 -p backend/tsconfig.test.json backend/tests/accountProfileService.spec.ts`; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/authService.spec.ts backend/tests/proposalIntentController.spec.ts`; `npm run test:backend`; `curl -H 'Authorization: Bearer mock-s1-demo' http://localhost:4000/api/v1/account/me`; browser smoke on `/onboarding` and `/me` confirmed `display:block`, no FOUC style, no console errors; `git diff --check`. | Production DB migration was not applied automatically because Neon/production migration approval is a blocker. Next safe task: run approved migration in the target environment, then smoke `/login -> /onboarding -> /me`, followed by Stage 2 media/feed R2/Mux smoke. |
| 2026-05-17 | Production corridor smoke tool | Added `npm run smoke:production-corridor`, a real-session smoke that exercises AccountProfile readiness, R2 presign/upload, optional Mux reconciliation/readiness, manifest finalize/publication, backend feed/detail projection, proposal intent creation, optional creator/sponsor signing, server relay, and campaign proof reads. The script exits with expected blockers instead of marking missing integrations as complete. | `npm run smoke:production-corridor` returned `STREAM_PUMP_SMOKE_CREATOR_TOKEN_REQUIRED`; `STREAM_PUMP_SMOKE_CREATOR_TOKEN=mock-s1-demo npm run smoke:production-corridor` returned `ACCOUNT_PROFILE_MIGRATION_REQUIRED`; `npm run build --prefix backend`; `git diff --check`. Root `tsc --noEmit -p tsconfig.json` was started but did not finish promptly because the root script test project is broad; the smoke script runtime paths above were used for validation. | Current live corridor is still blocked before content upload by the unapplied AccountProfile migration on the configured Neon database. After approved migration, run the smoke with a real creator session token; next blockers will likely be creator onboarding role, S2_ACTIVE creator readiness, sponsor session/signing, and chain relay funding/config. |
| 2026-05-18 | Production corridor verified | Applied the AccountProfile migration to the configured Neon database, generated real wallet challenge sessions for the seeded devnet S2 creator and sponsor, and completed the first real corridor. The smoke published a real video through backend R2 presign and Mux reconciliation, confirmed backend feed/post detail projection, created and locked a proposal intent from that content, collected creator and sponsor signatures, relayed the launch transaction, and read the campaign proof projection. The smoke deadline default was reduced from 14 days to 6 days so it stays within the seeded protocol `max_proposal_duration_seconds` of 7 days. | `npx prisma migrate deploy` applied `20260517143000_account_profile`; `npx prisma migrate status` returned database up to date; `curl /health`; `curl -H 'Authorization: Bearer mock-s1-demo' /api/v1/account/me` returned `storageStatus: LIVE`; real-session `npm run smoke:production-corridor` returned `ok: true` with manifest `cmpau99ki000cqtjhyc6d3t3l`, post detail projection, proposal PDA `9uATJ4cGDW5Q2NyNqLkMyyhyEZRUaywrxzaUBPUje7C9`, relay `CONFIRMED`, and campaign detail proof `FUNDED`; browser smoke verified `/explore`, `/posts/cmpau99ki000cqtjhyc6d3t3l`, and `/campaigns/9uATJ4cGDW5Q2NyNqLkMyyhyEZRUaywrxzaUBPUje7C9`; direct video element inspection confirmed Mux HLS playback ready with no media error. | The first production corridor is verified on the seeded devnet S2 creator/sponsor setup. Next product work should move from corridor proof to pilot hardening: expose this route through normal UI without local keypair scripts, add clear campaign proof fields for public/auth views, improve creator/sponsor account management, and retire remaining preview-only endorsement/rewards/settlement flows only after their own chain/API projections are verified. |
| 2026-05-20 | `/posts/[postId]` real API presentation | Removed the old demo readiness banner and post data-source notice from the successful post detail render now that the page loads backend public post records directly. Simplified the API unavailable/not-found state and replaced the comment composer's mock current user fixture with a neutral anonymous `You` identity for local-only interaction. | `npm run build --prefix app`; browser smoke on `/posts/cmpbdjcei000jqt94urkde9jf` confirmed real post content, no `SEEDED_DEMO` or source notice text, clean console, and anonymous comment publish behavior. | Engagement counts remain hash-derived display values until a backend engagement API exists; persisted comments, follow/like/save/share, and creator-profile links still need production APIs. |
| 2026-05-21 | `/activity` | Removed `ProductReadinessBanner` and `ActivitySourceNotice` success-state banner from activity surface. Simplified error display to error-only notice. Added empty state for when feed returns zero posts. No mock data injection occurs after previous `usePublicFeedViewModel` cleanup. | `npm run build --prefix app`; browser smoke on `/activity`. | Activity items, engagement counts, unread dots, and sidebar highlights are still feed-derived projections. Production activity needs account-specific notification/follow/engagement APIs. |
| 2026-05-21 | `/creators/[creatorId]` | Removed mock creator seed fallbacks (`fallbackCreators`, `findCreatorStrict`, `fallbackPosts`) from creator detail page. Creator resolution now only uses API-derived creators from `usePublicFeedViewModel`. Removed `ProductReadinessBanner` and simplified `CreatorProfileReadinessNotice` to error-only. Simplified `getStaticProps` to always use `loadPublicFeedPageProps()`. | `npm run build --prefix app`; browser smoke on `/creators/<known-api-creator-id>`. | Creator market fields (price, holders, graduation, top holders, buyout offer, price history) are still derived projections from `CreatorStageView`. Real creator profile read model, S1 market state, and buyout state need backend API support. If no API creators match the URL, the page correctly shows not-found. |
| 2026-05-21 | `/me` page wrapper | Removed `ProductReadinessBanner` and simplified `MeReadinessNotice` to error-only display. Removed redundant inline feed error message. Profile header remains session-backed via AccountProfile when signed in. | `npm run build --prefix app`; browser smoke on `/me` signed-in and signed-out. | `MeSurface` tabs (Holdings, Watchlist, Rewards, Activity, Saved) remain fully mock-driven via `lib/public-data` fixtures. These need dedicated backend APIs (portfolio, engagement ledger, watchlist, rewards) before they can be migrated. All mock sections already carry "Preview" labels. |
| 2026-05-21 | `/login` | Removed `ProductReadinessBanner` and dev-facing `?preview=` hint pill from login page. Wallet challenge and email OTP auth flows are unaffected. Social auth preview gating via `NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH` remains handled internally by `AuthOptionsPanel`. | `npm run build --prefix app`; browser smoke on `/login`. | Social auth (Google/Apple) still uses preview provider exchange when enabled. Production social auth requires real OAuth dashboard setup (blocker). |
| 2026-05-22 | Role onboarding and access gates | Added two-step login wallet choice for social/email identities, AccountProfile creation for managed/external wallet sessions, creator register Ed25519 oracle authorization gate, SponsorProfile KYB schema/API/operator routes, `/workspace/sponsor-onboarding`, and login guards for public interaction triggers. | `npm run prisma:generate --prefix backend`; `npm run build --prefix backend`; `npm run test:backend`; `npm run build --prefix app`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/creator-auth-signature.spec.ts`. Browser smoke covered `/login` wallet-choice handoff and `/workspace/sponsor-onboarding` wizard render in local dev; console only showed the existing Next dev HMR ISR-manifest warning. | Production blockers remain: real Google/Apple/Twitter OAuth dashboard setup, production managed-wallet custody/KMS/MPC, R2 document upload smoke, operator approval UI/notification delivery, production migration approval, deployed program upgrade, and persistent nonce replay storage. Broad root `npx tsc --noEmit -p tsconfig.json` still fails on existing monorepo-wide Express request augmentation and Anchor typed-client test/script issues, so targeted workspace builds remain the accepted checks. |
| 2026-05-23 | KYB/auth security hardening | Closed the Sponsor KYB production bypass by requiring an approved SponsorProfile when S1 mock APIs are disabled, added signed review URLs instead of returning private R2 KYB keys from the internal pending-sponsor route, blocked external wallet binding after managed-account onboarding, rejected already-bound external wallets with a 409, prevented Creator accounts from being overwritten as Sponsor accounts, and normalized creator handles to lowercase before chain auth verification and storage. | `npm run build --prefix backend`; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/authService.spec.ts backend/tests/sponsorProfileService.spec.ts`; `npm run test:backend`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/creator-auth-signature.spec.ts`; `npm run test:chain:local`; `git diff --check`. | Production promotion still requires deployed program upgrade, production SponsorProfile migration approval, configured R2 credentials for signed KYB download URLs, operator UI consumption of `businessLicenseUrl`/`powerOfAttorneyUrl`, and persistent nonce replay storage for creator auth signatures. |
| 2026-05-23 | S1 buyout abort and cohort reconciliation | Added `abort_s1_buyout` for all-holder rage-quit abort/refund, blocked zero-supply graduation, emitted early/regular buyout pool snapshots, added Prisma cohort/pool projection fields, changed portfolio claimable USDC to dynamic early/regular pro-rata reconciliation, skipped buyout-state RPC when events contain pool snapshots, and added sponsor lock/countdown plus rage-quit-vs-graduation calculator UI. | `npm run prisma:generate --prefix backend`; `./node_modules/.bin/prisma format --schema prisma/schema.prisma` from `backend`; `npm run build --prefix backend`; `npm run build --prefix app`; `npm run build:anchor`; `npm run test:backend`; `scripts/test-anchor-local.sh programs/tests/s1-buyout-unhappy-path.spec.ts`; `npm run test:chain:local`; `git diff --check`. | Production promotion still requires applying the new Prisma migration in the target DB and deploying/upgrading the Anchor program. `/workspace/buyout` remains `MOCK_PREVIEW`; the abort builder exists, but full self-serve buyout UI productization is still pending. |
| 2026-05-23 | S2 endorsement projection and transaction path | Added static Track2 fan-pool/SPUMP snapshots to eliminate claim-order reward drift, switched Track2 claim estimates to the locked settlement pool with last-claimer dust protection inside Track2 accounting, added `S2EndorsementPositionProjection`, indexed endorse/settle/claim events, exposed S2 endorse/claim transaction builders, and wired `/campaigns/[proposalId]/endorse` to real API/wallet flow for live campaign proofs while preserving labeled local fallback. | `npm run prisma:generate --prefix backend`; `./node_modules/.bin/prisma format --schema prisma/schema.prisma` from `backend`; `npm run build --prefix backend`; `npm run test:backend`; `npm run build --prefix app`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/s2-traffic-market.spec.ts`; Playwright/Chrome smoke on `/campaigns/s2-seeded-proof/endorse` with mocked public proof; `git diff --check`. | Production promotion still requires applying the new Prisma migration, deploying/upgrading the Anchor program, running a wallet-backed devnet endorsement smoke, and productizing claim/reward display beyond the endorse page. |
| 2026-05-23 | S2 design consolidation | Added nonce-based Proposal PDA derivation to avoid creator/deadline collisions, restricted endorsements to funded proposals, added per-proposal and per-user SPUMP endorsement caps, moved failed-campaign endorsement refunds to 100% SPUMP principal, reserved the 5% slash for cancelled/voided proposals, added content anchor versioning, added `CreatorStatus::Suspended`, and consolidated campaign proof/endorsement aggregate fields onto `Proposal` with KYB, wallet, endorsement withdrawal, and Track2 reviewer audit schema support. | Recorder evidence: clean branch on `codex/post-deadline-phase-0`; `git diff aa31bcd..HEAD --stat --find-renames` showed 24 changed files; `git diff --check` passed after documentation recording. App, backend, and Anchor builds/tests were not rerun by the recorder. | No readiness promotion: S2 endorsement remains `SEEDED_DEMO` + `BACKEND_READY_UI_GAP`. Promotion requires applying migration `20260523210000_design_consolidation`, deploying/upgrading the Anchor program, regenerating or reconciling seeded nonce-based proposal state/projections, and running a wallet-backed devnet endorsement smoke. |
| 2026-05-24 | Pilot hardening: S2 intent/media/feed truth | New proposal intents now allocate and serialize non-zero nonce values before lock/build so nonce-based Proposal PDAs are actually used by the normal API path. Endorsement UI now matches chain settlement semantics: failed campaigns refund 100% SPUMP, while 5% slash is shown only for cancelled/voided cases. Publication creation no longer marks pending publications as public-feed eligible; public feed/API-derived creator surfaces no longer synthesize likes, holders, S1 price, supply, buyout, or valuation values. Ordinary creator proposal creation now submits Track 3 as 0 USDC / 0 days and labels CPS as operator-gated. | `npm run build --prefix backend`; `npm run build --prefix app`; `npx ts-mocha -p backend/tsconfig.test.json backend/tests/proposalIntentController.spec.ts backend/tests/proposalLaunchService.spec.ts backend/tests/s2EndorsementProjection.spec.ts`; `git diff --check`; Playwright fallback smoke on `/campaigns/prop-neo-park-2026q2/endorse` confirmed the fail path shows 100% SPUMP returned and 0 fail slash. | No readiness promotion. Browser plugin `iab` was unavailable, so Playwright CLI was used for smoke after installing Chromium into the user cache. `/trending` still shows API unavailable when the backend is not running; production feed verification still requires backend/R2/Mux configured data, verified publication flow, applied migrations, and devnet wallet-backed S2 endorsement smoke. |
| 2026-06-02 | P0/P1 hardening pass | Guarded creator upgrades from overwriting S1 buyout statuses, added emergency void settlement-state guards, enforced suspended creator proposal errors, added a protocol hard ceiling for uncapped endorsements, gated Track1 settlement by deadline, emitted endorsement creation events, auth-gated internal Mux routes, preserved proposal settlement signatures, stored Proposal nonce, synced endorsement aggregates from chain, added publication verification, fixed endorsement USDC atomic formatting and program id, and removed mock portfolio hero/snapshot panels from live portfolio data. | `cargo check`; `npx prisma generate` in `backend/`; `npm run build --prefix backend`; `npm run build --prefix app`; Browser smoke on `/campaigns/prop-neo-park-2026q2/endorse` and `/portfolio` confirmed render, clean console, slider state update, no atomic-USDC overformat, and no portfolio mock hero/snapshot in the signed-out live branch. | No readiness promotion. Migration `20260602120000_add_proposal_nonce` still needs approval/application in target DB, and the upgraded Anchor program still needs deployment plus wallet-backed devnet endorsement/projection smoke before promotion. |
| 2026-06-02 | Publication eligibility ordering fix | Added a shared backend sync that promotes a manifest to public-feed eligible and backfills `Proposal.contentPublishedVerifiedAt` once both conditions are true: at least one verified publication and all assets delivery-ready. The sync now runs from publication verification, image upload completion, Mux webhook ready events, and Mux reconciliation ready events. | `npm run build --prefix backend`; `git diff --check`. | No readiness promotion. Full media promotion still needs deployed R2/Mux smoke and operator visibility for failed/retried assets. |
| 2026-06-02 | Auth/reward hardening | Multi-wallet sessions now resolve profile data through `AccountWallet`; external wallet binding preserves the managed wallet identity and links the external wallet to the existing profile instead of creating an abandoned profile. Daily SPUMP claims now apply the on-chain streak bonus, and engagement reward receipt rent plus transaction fee are paid by the oracle/backend signer. | `cargo check`; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/authService.spec.ts backend/tests/accountProfileService.spec.ts`; `npm run build --prefix backend`; `git diff --check`. | No readiness promotion. The upgraded Anchor program still needs deployment, and devnet/localnet reward-claim smoke should confirm the oracle wallet has enough SOL buffer for receipt PDA rent and transaction fees. |
| 2026-06-03 | Managed wallet custodial signing | Added encrypted managed-wallet secret storage on `AccountWallet`, AES-256-GCM key encryption utilities, managed keypair loading, and a backend-signed `/api/v1/s1/managed/execute` path. Email/social-created managed wallets now store encrypted secret material, daily SPUMP and engagement reward actions can execute without a wallet adapter, broken managed rows without encrypted secrets get a specific key-missing error, `/rewards` exposes managed daily claim, and managed endorsement now uses oracle as transaction fee payer. | `npx prisma generate`; `npx ts-mocha --exit --timeout 20000 -p backend/tsconfig.test.json backend/tests/walletEncryption.spec.ts backend/tests/managedWalletService.spec.ts backend/tests/s1ActionController.spec.ts backend/tests/authService.spec.ts backend/tests/accountProfileService.spec.ts`; `npm run build --prefix backend`; `npm run build --prefix app`; `cargo check`; `git diff --check`; protected-file grep returned no files. | No readiness promotion. Future work: KMS/Vault migration, managed wallet recovery/export, SOL budget monitoring, production migration approval, and wallet-backed devnet smoke for daily claim, engagement reward, and endorsement. |
| 2026-06-21 | Influence dual-track naming + Phase 1 read-only skeleton | Finalized naming for the two-axis influence model: **Level (Lv0–Lv6)** = seniority/trust, **Scout title badge** (Passerby → Observer → Scout → Gold Scout / 路人 → 观察者 → 星探 → 金牌伯乐) = curation reputation. Added Presentation and Learning Curve, Naming and Positioning (final), and marketing constraint sections to `docs/protocol/user-influence-and-leveling.md`. Updated README (EN/ZH) influence sections with finalized names. Added `GET /api/v1/account/me/influence` backend stub (session-required, returns mock-preview influence snapshot via new `influenceService.ts`). Added frontend `InfluenceChip` component, `influence.ts` API client, i18n keys (zh/en), and wired chip into `/me` profile header and `/rewards` level bar. All surfaces labeled `MOCK_PREVIEW`. | `npm run build --prefix backend`; `npm run build --prefix app`; `git diff --check`; protected-file check clean; no Prisma migration, no `programs/` change, no financial semantics changed. | No readiness promotion; everything remains `MOCK_PREVIEW`. Phase 2+ work: real curation-reputation model (outcome-based, slashable), weighted feed/trending ranking, creator momentum projection, oracle-input integration (requires anti-fraud review). Marketing constraint binding: influence = reach + reputation, never earnings. |
| 2026-06-21 | S1/S2 capped non-proportional reward semantics | Implemented code-level S1 buyout creator-share settlement plus capped discovery rewards (`FlatEqual`, default `EarlinessTiered`, `StatusPrimary`), Track2 capped flat fan rewards, reward-model/residual snapshots, legacy config migration defaults, Prisma projection fields/migration, backend projection/builders, frontend copy/type updates, and protocol docs. USDC rewards are now modeled as capped, eligibility/tier/count-based rewards rather than stake-proportional payouts. No readiness label was upgraded. | `cargo check`; `npm run build:anchor`; `scripts/test-anchor-local.sh programs/tests/s1-buyout.spec.ts`; `scripts/test-anchor-local.sh programs/tests/s1-buyout-unhappy-path.spec.ts`; `scripts/test-anchor-local.sh programs/tests/s1-happy-path.spec.ts`; `scripts/test-anchor-local.sh programs/tests/s2-traffic-market.spec.ts`; `scripts/test-anchor-local.sh programs/tests/s2-unhappy-path.spec.ts`; `npm run test:chain:local`; `npx prisma generate`; `npm run build --prefix backend`; `npm run test:backend`; `npm run build --prefix app`; `git diff --check`. Latest full local chain run passed 19 tests; Track2 traffic spec passed 6 tests; backend passed 68 tests. | No readiness promotion; this is not legal-cleared, audited, deployed, or production-live. Remaining blockers: legal token classification opinion, first-launch jurisdiction/KYC decisions, Anchor audit, production migration approval, upgraded program deployment, wallet-level devnet smoke, and operator/audit validation of eligible-holder count snapshots before promotion. |
