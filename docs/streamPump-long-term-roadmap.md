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

## Current Product Snapshot

Status values come from `docs/product-readiness-phase-0.md`. This snapshot reflects the current code on `codex/post-deadline-phase-0`, not the original hackathon submission branch.

| Area | Current implementation | Gap |
| --- | --- | --- |
| Public feed and detail | `LIVE` + `SEEDED_DEMO`: social surfaces and imported media routes exist. | Need stricter deployed R2/Mux smoke, no silent local media fallback in production claims, and creator market truth on profiles. |
| Auth and wallet sessions | `SEEDED_DEMO` + `MOCK_PREVIEW`: `/login` attempts email OTP and wallet challenge APIs; Google/Apple and backend-unavailable paths still create local preview sessions and are now labeled. | Production OAuth/passkey/Web3Auth verification and managed-wallet mapping remain Phase 2 work. |
| Media publication | `SEEDED_DEMO`: content creation/detail pages call manifest create, R2 presign, direct upload, asset complete, finalize, publication record, and proposal intent APIs. | Need deployed R2/Mux webhook/reconciliation smoke, review/retry UX, eligibility rules, and failure recovery visibility. |
| Workspace overview | `SEEDED_DEMO`: `/workspace` calls the workspace API with auth, falls back to labeled demo state for preview/offline/session errors. | Need less reliance on mock personas and clearer operator/live state in each panel. |
| S1 market | `SEEDED_DEMO`: market pages call creator profile, portfolio, buy/sell transaction builders, wallet signing, submit, and projection sync; demo slug routes still use local fallback. | Need self-serve creator onboarding, rating provenance, cap visibility, non-seeded readiness, and broader projection coverage. |
| S1 buyout and portfolio | `SEEDED_DEMO` + `OPERATOR_REQUIRED`: portfolio reads live S1 positions and claim builders for seeded state; buyout pages expose prepared rage quit/claim demo behavior. | Offer creation, creator acceptance, graduation, reclaim, post-rage-quit accounting, and re-entry must become fully projection-backed product flows. |
| S2 proposal launch | `SEEDED_DEMO`: content detail checks S2 readiness, creates proposal intents, and intent detail can lock/build/sign/submit bundles via wallet/API; `?demo=1` signing route is local-only and labeled. | Needs production auth, better role switching, confirmed projection reconciliation, and real user-ready error recovery. |
| Campaign detail | `SEEDED_DEMO`: campaign detail can load public/auth proposal API data and also supports known local fallback demo proposals. | Needs clearer readiness labeling when fallback data is used and fuller campaign proof projection. |
| S2 endorsement | `MOCK_PREVIEW`: endorsement page is explicitly local interaction state. | Must move to real SPUMP burn, endorsement PDA, reward pool projection, and claim state. |
| Settlement | `MOCK_PREVIEW` + `OPERATOR_REQUIRED`: dashboard is labeled local data; Track1/2 can be smoked with seeded/operator data; Track3 is still mock/operator. | Needs operator trigger UI, evidence digests, fraud/review state, schedulers, and real merchant reconciliation for Track3. |
| Rewards | `MOCK_PREVIEW`: missions/daily claim are local preview data with readiness banner. | Real daily SPUMP claim and anti-abuse gates must precede missions. |
| Operator/deployment | `OPERATOR_REQUIRED` + `BACKEND_READY_UI_GAP`: services and deployment plan exist, but no full operator console or continuously verified environment loop. | Need dashboards for indexer/oracle/media/settlement/retry/fraud plus Vercel/Render/Neon/R2/Mux smoke checks. |

## Route Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| `/login` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Current page is labeled; promote only after production provider verification and managed-wallet mapping. |
| `/demo`, `/pitch` | `SEEDED_DEMO` | Audit next so demo copy matches current route/API status and does not overclaim financial flows. |
| `/workspace` | `SEEDED_DEMO` | Live workspace API is used when auth succeeds; reduce mock persona fallback and improve panel-level readiness. |
| `/workspace/content/new` | `SEEDED_DEMO` | API-wired manifest create + R2 upload flow; needs deployed R2/Mux smoke, retry/resume, and production media error recovery. |
| `/workspace/content/[manifestId]` | `SEEDED_DEMO` | API-wired detail/upload/finalize/publication/intent flow; needs stronger i18n, failed asset recovery, and clearer S2 readiness blockers. |
| `/workspace/intents/[intentId]` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Live route is API/wallet-wired; `?demo=1` is local-only and labeled. Needs role-state polish and projection reconciliation. |
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
| Auth/session services | `SEEDED_DEMO` + `MOCK_PREVIEW` | Wallet challenge and email OTP paths exist; production provider exchange, managed-wallet mapping, and preview fallback gating remain. |
| Feed and media services | `LIVE` + `BACKEND_READY_UI_GAP` | R2/Mux plumbing exists; need deployed smoke, publication eligibility, and recovery states. |
| Content manifests | `SEEDED_DEMO` | Create/presign/complete/finalize/publication APIs are used by UI; need retry/resume, review, and Mux reconciliation UX. |
| Proposal intents and bundles | `SEEDED_DEMO` | Lock/build/creator partial sign/sponsor submit APIs are used by UI; need role-aware errors and Solana confirmation reconciliation hardening. |
| Campaign projections | `SEEDED_DEMO` | Proposal detail API is used; need complete launch/funding/content-anchor/settlement read models. |
| S1 routes and market projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Buy/sell/rage-quit/claim builders and portfolio/profile reads exist; need full self-serve and lifecycle projection coverage. |
| Oracle/indexer/settlement jobs | `OPERATOR_REQUIRED` | Services exist; need queue/status views, idempotent manual triggers, evidence digests, and scheduler guards. |
| Prototype routes | `MOCK_PREVIEW` | Keep isolated; do not mount as v1 product capability. |

## Roadmap

| Phase | Goal | Primary work |
| --- | --- | --- |
| 1. Boundary hardening | Keep product claims truthful. | Readiness labels, README/DEMO cleanup, page-level `/goal` audit. |
| 2. Auth/session | Make identity usable without wallet-first UX. | Provider verification, email/passkey/OAuth path, managed-wallet mapping, preview fallback gating. |
| 3. Media/feed | Make content a reliable product asset. | R2/Mux upload/finalize/retry, publish eligibility, feed proof. |
| 4. S1 lifecycle | Move S1 from seeded demo to self-serve market. | Creator onboarding, rating/cap reads, buy/sell, buyout offer, rage quit, graduation, claim. |
| 5. S2 lifecycle | Productize sponsorship launch, endorsement, and settlement. | Proposal role actions, endorsement PDA/burn, Track1/2 operator settlement, Track3 gated reconciliation. |
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
| 2026-05-16 | Roadmap refresh | Recalibrated this document against current frontend/API wiring: auth, media manifest, workspace, proposal intent, campaign, S1 market, portfolio, and preview-only surfaces. | `git diff --check` passed for updated docs. | Phase 0 readiness remains frozen separately; continue `/goal` with `/demo`. |
