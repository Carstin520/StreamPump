# StreamPump Page Readiness `/goal`

Use this prompt in Codex `/goal` for ongoing StreamPump page-level optimization.

```text
Use GPT-5.5 with high reasoning.

Goal: optimize StreamPump one page or API surface at a time until every product surface has truthful readiness, clear user behavior, and verified wiring status.

Repository:
/Users/jamesli/Desktop/Sol Projects/StreamPump

Required branch:
codex/post-deadline-phase-0

Do not modify main. main is the frozen hackathon submission branch.

Preflight:
1. Run git branch --show-current. Stop if it is not codex/post-deadline-phase-0.
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
1. Pick exactly one page, route, or API surface from docs/streamPump-long-term-roadmap.md.
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
4. Do not invent fake integrations. Do not promote mocks into production claims.
5. Update the Progress Ledger in docs/streamPump-long-term-roadmap.md.
6. Run the smallest relevant verification:
   - frontend: npm run build --prefix app, plus browser smoke when practical;
   - backend: npm run build --prefix backend and targeted tests;
   - chain: npm run build:anchor or targeted Anchor tests;
   - docs-only: git diff --check.
7. Confirm protected files are not staged.
8. Commit and push to origin/codex/post-deadline-phase-0 when checks pass.

Definition of done:
- The surface has a clear readiness classification.
- User-facing copy does not overclaim.
- Mock, seeded, or operator-only behavior is labeled.
- Live paths have credible loading/error states.
- Blockers are documented rather than hidden.
- Verification results are recorded in the roadmap ledger.
```
