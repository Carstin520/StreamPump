# StreamPump Page Readiness `/goal`

Paste this into Codex `/goal` when starting the ongoing StreamPump optimization work.

```text
Use GPT-5.5 with high reasoning.

Goal: optimize StreamPump page by page until every product surface has a truthful readiness state, clear user-facing behavior, and verified wiring status.

Repository:
/Users/jamesli/Desktop/Sol Projects/StreamPump

Required branch:
codex/post-deadline-phase-0

Do not modify main. main is the frozen hackathon submission branch.

Before editing:
1. Run git branch --show-current. If it is not codex/post-deadline-phase-0, stop and report the mismatch.
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

Core work style:
1. Pick exactly one page, route, or API surface from the readiness inventory.
2. Inspect what the page claims to do and what it actually does:
   - Is it connected to backend APIs?
   - Is it connected to chain builders or Solana state?
   - Does it depend on local mocks, seeded data, or operator scripts?
   - Does it require third-party services such as R2, Mux, Web3Auth, Neon, Render, Vercel, RPC providers, or merchant APIs?
   - Are loading, error, unauthenticated, wallet mismatch, and empty states truthful?
   - Could a user mistake preview/mock behavior for production capability?
3. Implement one coherent page-level improvement only:
   - connect to an existing API if the API is already present and safe to use;
   - add or refine readiness banners when behavior is mock/operator/seeded;
   - correct misleading copy;
   - improve loading/error/empty/auth/wallet mismatch states;
   - document a blocker when a real third-party service, secret, paid upgrade, production DB, dashboard action, or business decision is required.
4. Do not invent fake integrations. Do not convert mock previews into production claims.
5. Update the Progress Ledger in docs/streamPump-long-term-roadmap.md with:
   - page or API audited;
   - what changed;
   - exact tests/checks run;
   - blockers;
   - next safe page.
6. Run the smallest relevant verification:
   - frontend page change: npm run build --prefix app, plus browser smoke when practical;
   - backend change: npm run build --prefix backend and targeted tests;
   - chain change: npm run build:anchor or targeted Anchor tests;
   - docs-only change: git diff --check.
7. Confirm protected files are not staged.
8. Commit and push to origin/codex/post-deadline-phase-0 when checks pass.

Page audit order:
1. /login
2. /demo
3. /workspace/sponsorships
4. /workspace/intents/[intentId]
5. /workspace/content/new
6. /workspace/content/[manifestId]
7. /workspace
8. /campaigns/[proposalId]
9. /campaigns/[proposalId]/endorse
10. /campaigns/[proposalId]/settlement
11. /rewards
12. /portfolio
13. /market/[creatorId]
14. /buyout/[creatorId]
15. /creators/[creatorId]
16. /explore and /trending
17. /posts/[postId]
18. /activity
19. /me and /onboarding

Definition of done for each page:
- The page has a clear readiness classification.
- The user-facing copy does not overclaim.
- Mock/seeded/operator-only behavior is labeled.
- Live API or chain-connected paths have error and loading states.
- Any blocker is documented rather than hidden.
- Verification results are recorded in the roadmap ledger.
```
