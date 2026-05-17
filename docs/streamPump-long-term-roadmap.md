# StreamPump Product Roadmap

Last updated: 2026-05-17
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
