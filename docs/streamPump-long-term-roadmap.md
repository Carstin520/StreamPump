# StreamPump Product Roadmap

Last updated: 2026-05-16  
Post-deadline branch: `codex/post-deadline-phase-0`

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
- **Fan / Backer**: supports creators with non-transferable utility `SPUMP`, receives internal S1 positions, and can claim USDC from sponsor-funded outcomes.
- **Sponsor**: spends USDC as marketing budget and receives verifiable campaign proof.

Core flow:

```text
content -> creator momentum -> fan participation -> sponsor USDC budget -> Solana settlement
```

Product boundaries:

- Do not make `SPUMP` transferable.
- Do not list `SPUMP` on DEX/CEX.
- Do not present mock or local preview flows as production integrations.
- Keep workflow state DB-first and financial truth chain-first.

## Implemented Baseline

The following capabilities already exist in the current code on `codex/post-deadline-phase-0`. Future planning should not restate these as new work unless the task is explicitly about hardening, replacing mocks, or production verification.

| Area | Implemented baseline |
| --- | --- |
| Public product shell | Social-first routes exist for explore, trending, post detail, creator profile, activity, profile, onboarding, workspace, campaigns, market, buyout, portfolio, and rewards. |
| Auth entry | `/login` attempts email OTP and wallet challenge APIs; preview social/local fallback is labeled in dev/demo mode. |
| Content workflow | Workspace content pages call manifest create, R2 presign, browser upload, asset complete, finalize, publication record, and proposal intent APIs. |
| Workspace overview | `/workspace` calls the workspace overview API when authenticated and uses labeled preview fallback when the API/session is unavailable. |
| Proposal intent flow | Intent detail can lock terms, build bundles, collect creator partial signature, collect sponsor signature, and submit via existing APIs and wallet signing. |
| Campaign detail | Campaign detail can load public/auth proposal API data and has known demo fallback records. |
| S1 market and portfolio | Market and portfolio pages read creator profile/portfolio state, build buy/sell/rage-quit/claim transactions, request wallet signatures, submit, and sync projections for seeded paths. |
| Preview labeling | `/login`, `/workspace/buyout`, `/workspace/sponsorships`, demo intent signing, `/campaigns/*/endorse`, `/campaigns/*/settlement`, `/rewards`, and `/portfolio` have readiness labels where needed. |

## Remaining Product Gaps

Status values come from `docs/product-readiness-phase-0.md`.

| Area | Status | Remaining gap |
| --- | --- | --- |
| Auth and managed wallet | `SEEDED_DEMO` + `MOCK_PREVIEW` | Replace preview provider exchange with production OAuth/passkey/Web3Auth verification and stable `AuthIdentity -> managedWalletAddress -> WalletSession` mapping. |
| Media reliability | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Add deployed R2/Mux smoke, webhook/reconciliation visibility, retry/resume UX, publish eligibility rules, and failed-asset recovery. |
| Public feed truth | `LIVE` + `SEEDED_DEMO` | Prevent silent local media fallback in production claims and expose creator market truth on profile/detail surfaces. |
| Workspace truth | `SEEDED_DEMO` | Reduce mock persona fallback and make each panel show live, preview, empty, blocked, or operator-required state explicitly. |
| S1 self-serve | `SEEDED_DEMO` | Add non-seeded creator onboarding, rating provenance, cap usage, projection coverage, and devnet smoke from registration to claim. |
| S1 buyout lifecycle | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | Productize offer creation, creator acceptance, graduation, reclaim, post-rage-quit accounting, and re-entry. |
| S2 campaign proof | `SEEDED_DEMO` | Harden role switching, projection reconciliation after Solana confirmation, fallback labeling, and full campaign proof read models. |
| S2 endorsement | `MOCK_PREVIEW` | Replace local interaction with real SPUMP burn, endorsement PDA, reward pool projection, and claim state. |
| Settlement | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Add operator trigger UI, evidence digests, fraud/review state, guarded schedulers, and real merchant reconciliation for Track3. |
| Rewards | `MOCK_PREVIEW` | Implement real daily SPUMP claim before missions; add anti-abuse gates. |
| Operator/deployment | `OPERATOR_REQUIRED` + `BACKEND_READY_UI_GAP` | Add dashboards for indexer/oracle/media/settlement/retry/fraud plus Vercel/Render/Neon/R2/Mux smoke checks. |

## Route Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| `/login` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Current page is labeled; promote only after production provider verification and managed-wallet mapping. |
| `/demo`, `/pitch` | `SEEDED_DEMO` | Audit next so demo copy matches current route/API status and does not overclaim financial flows. |
| `/workspace` | `SEEDED_DEMO` | Remove or narrow mock persona fallback and improve panel-level readiness. |
| `/workspace/content/new` | `SEEDED_DEMO` | Add retry/resume, deployed R2/Mux smoke documentation, and production media error recovery. |
| `/workspace/content/[manifestId]` | `SEEDED_DEMO` | Add failed asset recovery, clearer S2 readiness blockers, and remaining i18n cleanup. |
| `/workspace/intents/[intentId]` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Live route is already API/wallet-wired; next work is role-state polish, fallback labeling, and projection reconciliation. |
| `/workspace/sponsorships`, `/workspace/buyout` | `MOCK_PREVIEW` | Both are labeled local previews; connect to live proposal/buyout lifecycle before product claims. |
| `/campaigns/[proposalId]` | `SEEDED_DEMO` | Can load proposal API or local fallback; add fallback readiness clarity and fuller campaign proof projection. |
| `/campaigns/[proposalId]/endorse` | `MOCK_PREVIEW` | Real SPUMP burn, endorsement PDA, reward pool projection, and claim state. |
| `/campaigns/[proposalId]/settlement` | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Track data must come from projection and permitted operator/oracle flows. |
| `/rewards` | `MOCK_PREVIEW` | Real daily SPUMP claim before missions. |
| `/portfolio` | `SEEDED_DEMO` | Live portfolio/claim builder exists for seeded state; needs full rage quit/re-entry/projection consistency. |
| `/market/[creatorId]` | `SEEDED_DEMO` | Live buy/sell builders exist; needs non-seeded onboarding, rating provenance, and cap usage. |
| `/buyout/[creatorId]` | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Prepared buyout/rage quit/claim path exists; productize offer, acceptance, graduation, and reclaim. |
| `/creators/[creatorId]`, `/explore`, `/trending`, `/posts/[postId]`, `/activity` | `LIVE` + `SEEDED_DEMO` | Keep social-first; expose real media and creator market states without silent local fallbacks. |
| `/me`, `/onboarding` | `SEEDED_DEMO` | Profile/onboarding surfaces need current-session accuracy and complete English copy audit. |

## API / Service Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| Auth/session services | `SEEDED_DEMO` + `MOCK_PREVIEW` | Remaining work is production provider exchange, managed-wallet mapping, and preview fallback gating. |
| Feed and media services | `LIVE` + `BACKEND_READY_UI_GAP` | Remaining work is deployed smoke, publication eligibility, and recovery states. |
| Content manifests | `SEEDED_DEMO` | Remaining work is retry/resume, review/eligibility, and Mux reconciliation UX. |
| Proposal intents and bundles | `SEEDED_DEMO` | Remaining work is role-aware errors and Solana confirmation reconciliation hardening. |
| Campaign projections | `SEEDED_DEMO` | Proposal detail API is used; need complete launch/funding/content-anchor/settlement read models. |
| S1 routes and market projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Buy/sell/rage-quit/claim builders and portfolio/profile reads exist; need full self-serve and lifecycle projection coverage. |
| Oracle/indexer/settlement jobs | `OPERATOR_REQUIRED` | Services exist; need queue/status views, idempotent manual triggers, evidence digests, and scheduler guards. |
| Prototype routes | `MOCK_PREVIEW` | Keep isolated; do not mount as v1 product capability. |

## Roadmap

| Phase | Goal | Primary work |
| --- | --- | --- |
| 1. Boundary hardening | Keep product claims truthful. | Readiness labels, README/DEMO cleanup, page-level `/goal` audit. |
| 2. Auth/session | Make identity usable without wallet-first UX. | Production provider verification, passkey/OAuth hardening, managed-wallet mapping, preview fallback gating. |
| 3. Media/feed | Make content a reliable product asset. | Retry/recovery, publish eligibility, Mux reconciliation UX, deployed media smoke, feed proof. |
| 4. S1 lifecycle | Move S1 from seeded demo to self-serve market. | Creator onboarding, rating/cap reads, buyout offer/accept/graduation/reclaim, projection-complete claim/re-entry. |
| 5. S2 lifecycle | Productize sponsorship launch, endorsement, and settlement. | Proposal reconciliation, endorsement PDA/burn, fan claim, Track1/2 operator settlement, Track3 gated reconciliation. |
| 6. Operations/deployment | Make demos and test users observable. | Indexer/oracle/media/settlement dashboards, retry controls, Vercel/Render/Neon/R2/Mux smoke. |
| 7. Audit/growth | Prepare for broader users. | Anchor unhappy-path tests, abuse controls, audit freeze, mobile-critical surfaces, non-speculative growth loops. |

## Execution Rules

Use `docs/streamPump-page-readiness-goal.md` for ongoing page-level work.

- Required branch: `codex/post-deadline-phase-0`.
- Do not modify `main`; it is the frozen hackathon submission branch.
- Protected files: `backend/package-lock.json`, `pitch/colosseum-submission.md`, `pitch/demo-youtube-description.md`.
- Use explicit `git add` paths only.
- Pick one page, route, or API surface per pass.
- Do not invent fake integrations or relabel mocks as production.
- Record verification and blockers in the Progress Ledger.

Page order:

```text
/login (audited)
/demo (next)
/workspace/sponsorships
/workspace/intents/[intentId]
/workspace/content/new
/workspace/content/[manifestId]
/workspace
/campaigns/[proposalId]
/campaigns/[proposalId]/endorse
/campaigns/[proposalId]/settlement
/rewards
/portfolio
/market/[creatorId]
/buyout/[creatorId]
/creators/[creatorId]
/explore and /trending
/posts/[postId]
/activity
/me and /onboarding
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
