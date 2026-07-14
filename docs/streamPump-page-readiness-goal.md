# StreamPump Page Readiness `/goal`

Use this prompt in Codex `/goal` for ongoing StreamPump page-level optimization.

```text
Use GPT-5.5 with high reasoning.

Goal: optimize StreamPump one page or API surface at a time toward the long-term product target in docs/streamPump-long-term-roadmap.md, without re-planning baseline capabilities that are already implemented. Each surface should have truthful readiness, clear user behavior, and verified wiring status.

Repository:
Use the repository root of your local StreamPump checkout (do not hard-code an iCloud/Desktop path; those trigger macOS file-provider ECANCELED reads during Node/TypeScript builds — clone under a plain path such as ~/Projects/StreamPump).

Required branch:
Work on the current integration/Pilot branch, not main.

main is no longer frozen after hackathon judging, but it is the canonical release branch: keep it deployable and merge only reviewed, verified work. The current product target is a code-verified invite-only Pilot candidate on Solana devnet/test-USDC — not a deployed production system and not live.

Current Pilot route truth (respect this when auditing readiness): the only corridor open to Pilot users is external-wallet auth → content create/upload (R2/Mux) → public feed/post projection → proposal intent → creator + sponsor dual sign → backend relay → manual Track 1 fixed-base → campaign proof. Closed for all Pilot users: email/social/provider managed wallet, public managed execution, S1, Track 2 endorsement/fan rewards, Track 3 CPS, daily/engagement rewards, automatic settlement, and prototype routes. Do not label any page as production, deployed, live, audited, or handling real funds.

Preflight:
1. Run git branch --show-current. Confirm it matches the review/integration branch named by the current task. Do not make unreviewed changes directly on main.
2. Run git status --short.
3. Read:
   - docs/streamPump-long-term-roadmap.md
   - docs/product-readiness-phase-0.md
   - pitch/script.md
   - README.md
   - DEMO.md

Protected files:
- backend/package-lock.json
- pitch/colosseum-submission.md
- pitch/demo-youtube-description.md

Do not stage, commit, delete, or rewrite protected files unless explicitly instructed later. Use explicit git add paths only. Never use git add .

Work loop:
1. Pick exactly one page, route, or API surface from the roadmap page order. Prefer the first unaudited surface unless the user asks for a different page.
2. Inspect what it claims and what it actually does:
   - backend/API connection;
   - chain/Solana connection;
   - local mocks, seeded data, or operator scripts;
   - third-party requirements such as R2, Mux, Web3Auth, Neon, Render, Vercel, RPC, or merchant APIs;
   - loading, error, unauthenticated, wallet mismatch, and empty states;
   - any copy that could make preview behavior look production-ready.
3. Implement one coherent page-level improvement only:
   - connect to an existing safe API;
   - add/refine readiness labels;
   - correct misleading copy;
   - improve loading/error/empty/auth/wallet mismatch states;
   - document a blocker when real external input is required.
4. Do not invent fake integrations. Do not promote mocks into production claims. If a page has both live API wiring and local fallback, keep the live wiring as baseline and label the fallback clearly.
5. Update the Progress Ledger in docs/streamPump-long-term-roadmap.md.
6. Run the smallest relevant verification:
   - frontend: npm run build --prefix app, plus browser smoke when practical;
   - backend: npm run build --prefix backend and targeted tests;
   - chain: npm run build:anchor or targeted Anchor tests;
   - docs-only: git diff --check.
7. Confirm protected files are not staged.
8. Create a single fixed commit on the task branch (never push or merge directly). The commit must record the fixed base..HEAD range, the diff, the verification/tests run, and the residual risk. Hand that fixed range to an independent Fable 5 review. Fix every blocker/major finding and re-submit for review. Only after Fable 5 returns PASS, stop at the human review gate: do not push, merge, or deploy without explicit user approval.

Definition of done:
- The surface has a clear readiness classification.
- User-facing copy does not overclaim.
- Mock, seeded, or operator-only behavior is labeled.
- Live paths have credible loading/error states.
- Blockers are documented rather than hidden.
- Verification results are recorded in the roadmap ledger.
- The fixed base..HEAD range, Fable 5 PASS, and the truthful human-gate state (pending / approved) are all recorded.
```
