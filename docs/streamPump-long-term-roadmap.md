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

## Current Gaps

Status values come from `docs/product-readiness-phase-0.md`.

| Area | Status | Gap |
| --- | --- | --- |
| Public feed and post detail | `LIVE` + `SEEDED_DEMO` | R2/Mux media and creator market truth need stronger production-state handling. |
| Auth and wallet sessions | `SEEDED_DEMO` + `MOCK_PREVIEW` | Production OAuth/passkey/Web3Auth verification and managed-wallet mapping are incomplete. |
| Media publication | `BACKEND_READY_UI_GAP` | Upload/finalize plumbing exists; review, retry, eligibility, and failure recovery need completion. |
| S1 market | `SEEDED_DEMO` | Needs self-serve creator onboarding, rating provenance, cap visibility, and projection completeness. |
| S1 buyout lifecycle | `BACKEND_READY_UI_GAP` + `OPERATOR_REQUIRED` | Offer creation, acceptance, rage quit, graduation, reclaim, and claim must become product flows. |
| Portfolio claim | `SEEDED_DEMO` | Seeded claim works; post-rage-quit and re-entry accounting must be projection-backed. |
| S2 proposal launch | `SEEDED_DEMO` | Intent and signing spine exists; workspace state and role-specific actions need hardening. |
| S2 endorsement | `MOCK_PREVIEW` | Must move to real SPUMP burn, endorsement PDA, reward projection, and claim state. |
| Settlement Track 1 | `SEEDED_DEMO` | Needs operator trigger, idempotent scheduler, and observability. |
| Settlement Track 2 | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Needs metrics ingestion, fraud/review state, evidence digest, and oracle payload generation. |
| Settlement Track 3 | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Requires a real merchant/reconciliation provider before production claims. |
| Operator tooling | `OPERATOR_REQUIRED` | Needs dashboards for indexer, oracle, settlement, media failures, retry, and fraud review. |
| Deployment | `BACKEND_READY_UI_GAP` | Vercel/Render/Neon/R2/Mux path is documented but not continuously smoke-tested. |

## Route Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| `/login` | `SEEDED_DEMO` + `MOCK_PREVIEW` | Production provider verification and managed-wallet mapping. |
| `/demo`, `/pitch`, `/me`, `/onboarding` | `SEEDED_DEMO` | Keep as support/profile surfaces; do not imply missing financial flows are live. |
| `/workspace`, `/workspace/content/new`, `/workspace/content/[manifestId]`, `/workspace/intents/[intentId]` | `SEEDED_DEMO` | Complete publication state, upload recovery, list/detail APIs, and role-specific actions. |
| `/workspace/sponsorships`, `/workspace/buyout` | `MOCK_PREVIEW` | Connect to live proposal/buyout lifecycle before product claims. |
| `/campaigns/[proposalId]` | `SEEDED_DEMO` | Campaign proof projection for PDA, vault, manifest hash, anchor, and settlements. |
| `/campaigns/[proposalId]/endorse` | `MOCK_PREVIEW` | Real SPUMP burn, endorsement PDA, reward pool projection, and claim state. |
| `/campaigns/[proposalId]/settlement` | `MOCK_PREVIEW` + `OPERATOR_REQUIRED` | Track data must come from projection and permitted operator/oracle flows. |
| `/rewards` | `MOCK_PREVIEW` | Real daily SPUMP claim before missions. |
| `/portfolio` | `SEEDED_DEMO` | Projection-backed holdings, rage quit, buyout claim, and re-entry state. |
| `/market/[creatorId]` | `SEEDED_DEMO` | Non-seeded onboarding, rating provenance, cap usage, and buy/sell state. |
| `/buyout/[creatorId]` | `SEEDED_DEMO` + `OPERATOR_REQUIRED` | Productized offer, acceptance, rage quit, graduation, and reclaim flows. |
| `/creators/[creatorId]`, `/explore`, `/trending`, `/posts/[postId]`, `/activity` | `LIVE` + `SEEDED_DEMO` | Keep social-first and expose real media/market states without silent local fallbacks. |

## API / Service Inventory

| Surface | Status | Promotion gate |
| --- | --- | --- |
| Auth/session services | `SEEDED_DEMO` + `MOCK_PREVIEW` | Production provider exchange, managed-wallet mapping, production-disabled preview fallbacks. |
| Feed and media services | `LIVE` + `BACKEND_READY_UI_GAP` | Publication eligibility, R2/Mux smoke, retry/recovery states. |
| Content manifests | `SEEDED_DEMO` | List/detail, presign, complete, finalize, publish eligibility, Mux reconciliation. |
| Proposal intents and bundles | `SEEDED_DEMO` | Idempotent state transitions, role-aware errors, Solana confirmation reconciliation. |
| Campaign projections | `SEEDED_DEMO` | Launch, funding, content anchor, and settlement signature read models. |
| S1 routes and market projections | `SEEDED_DEMO` + `BACKEND_READY_UI_GAP` | Self-serve S1 lifecycle, buyout lifecycle, rage quit, graduation, and claim projections. |
| Oracle/indexer/settlement jobs | `OPERATOR_REQUIRED` | Queue/status views, idempotent manual triggers, evidence digests, scheduler guards. |
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
/login
/demo
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
