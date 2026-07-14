# P6 Final Audit and Release Handoff

Status: P6 release preparation after explicit H5 approval. This document does not authorize deployment. Stop at H6 after the exact-range Fable 5 gate.

## Boundary

The only releasable Pilot lane remains invite-only, external-wallet-first, Solana devnet, test-USDC, Track1-only, manual/operator-only, no real funds, and not a public production launch. S1, Track2, Track3, endorsement, rewards, managed/email/social auth, public managed execution, prototype routes, and automatic settlement remain closed.

H6 does not replace an external security audit, legal/token-classification review, production policy, jurisdiction/KYC decisions, or separate approval for any closed lane.

## Accepted state and P6 delta

- Accepted P5 boundary: `f72c33db05d563e03c80f03a5a812ec16d332d85`; its Fable 5 fix-only closure passed with 0 blocker/major.
- Last-known-good runtime: Render deploy `dep-d9auio7lk1mc73c4r18g`, backend release `88c0debad6ecb7eacfe9e24793951f3794353f4c`.
- Frontend remains `097e9805b197398ae1c04cf5bf84f1044b3b2f19`; P6 has no frontend delta and must not trigger a Vercel deployment.
- P6 makes the deployment-verifier self-test a permanent CI gate and aligns release/gate documentation. It does not change application, backend business, Anchor, Prisma, financial, auth, product-lane, or readiness semantics.
- P6 does not deploy or mutate Render, Vercel, Neon, R2, Mux, Solana, the invite allowlist, or financial state.

## H6 candidate freeze

From a clean `codex/p6-release-readiness` worktree:

```bash
P6_BASE_SHA="f72c33db05d563e03c80f03a5a812ec16d332d85"
P6_FINAL_SHA="$(git rev-parse HEAD)"
P6_RANGE="$P6_BASE_SHA..$P6_FINAL_SHA"
test -z "$(git status --short)"
git diff --check "$P6_RANGE"
test -z "$(git diff --name-only "$P6_RANGE" -- backend/package-lock.json pitch/colosseum-submission.md pitch/demo-youtube-description.md)"
npm run test:p4:deployment-verifier
```

The local P6 gate requires workflow inspection plus the verifier self-test. Exact-SHA CI green is mandatory before any post-H6 deployment; if the branch has not been pushed at H6, record CI as intentionally deferred rather than claiming it passed. Fable 5 reviews only `f72c33d..$P6_FINAL_SHA`; if it finds a blocker/major, review only the verdict plus fix-only delta unless the threat model changes.

## Post-H6 deployment mutation — separate approval required

H6 acceptance freezes a release candidate; it is not deployment approval. A later deployment must use one consolidated preflight, one Render mutation, and one consolidated postflight.

### Preflight

1. Confirm the H6-approved full `P6_FINAL_SHA`, clean branch, exact-SHA CI result, and Fable verdict.
2. Confirm Render auto-deploy remains off and the live service still reports last-known-good `88c0deb` before mutation.
3. Preserve the current Render environment revision and prior `PILOT_EXPECTED_RELEASE_SHA` in an access-controlled recovery location without printing values.
4. Confirm P4 rollback evidence remains mode-restricted and Neon recovery branch `br-frosty-fire-an0lsiq2` still exists; do not migrate or delete it.
5. Confirm the invite allowlist is unchanged and every closed flag remains false. No Vercel, Neon, R2, Mux, Solana, allowlist, or financial mutation is part of this release.
6. Stop if the deployed commit cannot be pinned exactly, the expected release SHA cannot be updated atomically with the deploy, readiness is not green before mutation, or rollback identity/config cannot be restored.

### One mutation

Update the access-controlled Render release-SHA binding to the full H6-approved commit and deploy that exact commit to the existing backend service. Do not deploy a moving branch head. Do not promote Vercel because P6 has no frontend delta.

### Consolidated postflight

Obtain Render's deployed full SHA without exposing credentials, assign it to `RENDER_DEPLOYED_SHA`, then run:

```bash
npm run verify:p4:deployment -- \
  --api-origin https://api.stream-pump.com \
  --expected-release-sha "$P6_FINAL_SHA" \
  --deployed-release-sha "$RENDER_DEPLOYED_SHA" \
  --allowed-origin https://app.stream-pump.com \
  --disallowed-origin https://blocked.invalid
```

The verifier must observe at least 91 seconds of stable `/health` and `/ready`, exact release identity, allow/deny CORS, closed routes, unauthenticated operator denial, canonical plus alias no-store headers, and no `X-Powered-By`. Record only sanitized output and deployment identifiers in the durable evidence ledger.

Do not rerun the disposable P4 media/proposal/Track1 corridor: P6 does not change those surfaces, and its accepted evidence remains keyed to the unchanged chain/data/provider state.

### Rollback

If deploy or postflight fails, restore the prior Render environment revision and redeploy exact last-known-good `88c0debad6ecb7eacfe9e24793951f3794353f4c`. Verify its release identity plus `/health` and `/ready` once. The new P5/P6 deployment verifier is expected to reject that historical runtime because it predates application-owned no-store headers; use the retained P4 evidence contract for rollback verification, record the failed stage and exact cause, and do not continue downstream work.

## H6 handoff contents

- final P6 branch and full commit SHA;
- exact `f72c33d..candidate` diff and the exact-SHA CI result, or an explicit deferred reason when the branch was not pushed;
- local risk-based checks and Fable 5 verdict;
- last-known-good runtime and preserved rollback/config identities;
- intentionally deferred deployment smoke and why it requires separate approval;
- unchanged external audit/legal/public-launch blockers;
- explicit statement that H6 completes release preparation only, not public or real-funds launch authorization.
