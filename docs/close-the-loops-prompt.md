# Close the Loops — Frontend Wiring Prompt

## Context

You are working on the `codex/post-deadline-phase-0` branch of the StreamPump repo.
Read `CLAUDE.md` at the repo root before starting.

This task closes 5 frontend gaps where **backend endpoints already exist** but the
frontend doesn't call them. No backend or chain changes needed — pure frontend wiring.

After all changes, verify:
```
npm run build --prefix app
```

Do NOT commit. Do NOT touch protected files or backend/chain code.

---

## Task 1: Wire Publication Verification on Manifest Detail Page

**The gap:** `PATCH /api/v1/content/publications/:publicationId/verify` exists in
backend (`contentManifestRoutes.ts` line 32, `contentManifestController.ts` lines
556–599). Frontend never calls it — publications stay `PENDING` forever, blocking
the content → feed pipeline.

### 1a: Add API client function

**File:** `app/src/lib/api/workspace.ts`

Add after `createContentPublication`:

```typescript
export const verifyContentPublication = async (
  token: string,
  publicationId: string
): Promise<ApiResponse<{ publicationId: string; verificationStatus: string }>> =>
  client.patch(`/content/publications/${publicationId}/verify`, {}, { token });
```

If `client.patch` doesn't exist, check `client.ts` — it may only have `get`/`post`.
If so, add a `patch` method following the same pattern as `post`.

### 1b: Add verify button on manifest detail page

**File:** `app/src/pages/workspace/content/[manifestId].tsx`

Find where publications are listed (around lines 405–414). For each publication
with `verificationStatus === "PENDING"`:

1. Show the current verification status as a badge (e.g., "Pending Verification")
2. Add a "Verify Publication" button that calls `verifyContentPublication`
3. On success, refresh the manifest data (re-fetch or optimistic update)
4. Show `isPublicFeedEligible` status after verification

Use existing UI patterns (glass buttons, i18n where available). Keep it simple —
a small button next to each publication row.

### 1c: Show feed eligibility on manifest page

After the publications section, show a status indicator:
- If `isPublicFeedEligible`: green badge "Public Feed Eligible"
- If not: gray badge with reason (e.g., "Awaiting verification" or "Assets processing")

---

## Task 2: Wire Daily SPUMP Claim for External Wallets on /rewards

**The gap:** `/rewards` page only calls the managed execute path for managed wallets.
External wallet users see a claim button that does nothing real. Backend
`POST /s1/claim-daily-spump/build` exists (`s1Routes.ts` line 27).

### 2a: Wire external wallet claim

**File:** `app/src/pages/rewards.tsx`

Find `handleDailyClaim` (around line 54–66). Currently:
- Managed wallet: calls `flow.execute` with managed action — correct
- External wallet: just `setClaimed(true)` locally — broken

Fix the external wallet path:

```typescript
const handleDailyClaim = async () => {
  if (isManagedWallet) {
    // existing managed path
    await flow.execute(token, "/s1/claim-daily-spump/build", {
      managedAction: "claim-daily-spump",
    });
  } else {
    // External wallet: build → sign → submit via useS1TransactionFlow
    await flow.execute(token, "/s1/claim-daily-spump/build");
  }
  setClaimed(true);
};
```

Check how `useS1TransactionFlow.execute` is called — the external path needs
the build endpoint URL and then wallet-adapter signing. Follow the pattern used
on `/market/[creatorId]` for buy/sell transactions.

### 2b: Update banner copy

**File:** `app/src/pages/rewards.tsx`

Find the `ProductReadinessBanner` or equivalent notice (around line 87). Update:
- For managed wallets: change copy to reflect that daily claim IS real (not mock)
- For external wallets: same — claim now works
- Keep missions as `MOCK_PREVIEW` (they require an oracle pipeline that doesn't exist)

Suggested copy split:
- Daily claim section: "SEEDED_DEMO — claims real on-chain SPUMP"
- Missions section: "MOCK_PREVIEW — mission completion requires oracle integration"

---

## Task 3: Add Claim Button and Post-Endorse Refresh on Endorse Page

**The gap:** After endorsing, the page doesn't refresh campaign data. There's no
claim button on the endorse page — claims only exist on `/portfolio`.

### 3a: Post-endorse data refresh

**File:** `app/src/pages/campaigns/[proposalId]/endorse.tsx`

After a successful endorse transaction (around lines 244–247), re-fetch the
campaign proof data:

```typescript
// After successful endorse
const refreshed = await getPublicCampaignProof(routeProposalId);
if (refreshed.ok) {
  setCampaign(refreshed.data);
}
```

This ensures the endorsement count and staked amount update in the UI.

### 3b: Add claim section for endorsed users

Below the endorse dial/action area, add a conditional claim section that appears
when the user has an existing endorsement position AND the campaign is in a
claimable state (`RESOLVED_SUCCESS`, `RESOLVED_FAIL`, `CANCELLED`, `VOIDED`).

The claim API already exists: `buildClaimEndorsementTransaction` from
`app/src/lib/api/proposal.ts`. Wire it through `useProposalTransactionFlow`.

Keep it simple:
- Show "You endorsed X SPUMP" with current position
- If claimable: show claim button with expected outcome (SPUMP refund amount, USDC if success)
- If pending settlement: show "Awaiting Track 2 settlement"
- If already claimed: show "Claimed" badge

Use the endorsement data from `campaign.endorsementSummary` or add a new
API call to fetch the user's position (check if
`GET /proposals/:id/endorsement/position` exists in backend routes, or use
the portfolio endpoint to get the user's position for this specific proposal).

---

## Task 4: Wire Settlement Page to Real Campaign Data

**The gap:** `/campaigns/[proposalId]/settlement` is 100% hardcoded mock
(`const data = MOCK` at line 470). The same `getPublicCampaignProof` API
that the endorse page uses contains all settlement state.

### 4a: Fetch real data

**File:** `app/src/pages/campaigns/[proposalId]/settlement.tsx`

Replace the `MOCK` constant approach with an API fetch:

```typescript
const [campaign, setCampaign] = useState(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const load = async () => {
    const result = await getPublicCampaignProof(routeProposalId);
    if (result.ok) setCampaign(result.data);
    setLoading(false);
  };
  load();
}, [routeProposalId]);
```

Import `getPublicCampaignProof` from `@/lib/api/proposal`.

### 4b: Map campaign data to settlement display

The campaign proof response includes:
- `proofStatus` — DRAFT/FUNDED/ANCHORED/SETTLING/SETTLED/CANCELLED/VOIDED
- `track1Claimed` — boolean
- `track2SettledAt`, `track2ActualValue` — Track 2 outcome
- `track3SettledAt`, `track3CpsPayout` — Track 3 outcome
- Track budgets: `track1BaseUsdc`, `track2UsdcDeposited`, `track3UsdcDeposited`
- `endorsementSummary` — aggregate endorser data

Map these to the existing settlement UI sections (timeline, track cards, etc.).
Keep the existing visual design — just replace mock values with real data.

When campaign data is unavailable (API error or not found), fall back to the
existing mock with `MOCK_PREVIEW` banner. When real data loads, show
`SEEDED_DEMO` banner instead.

### 4c: Format USDC values correctly

Use `formatUsdcAtomic` from `@/lib/formatting` for all USDC fields (same fix
as the endorse page). Track target values (views, clicks) use regular number
formatting.

---

## Task 5: Gate Auth Preview Fallbacks for Production Clarity

**The gap:** `AuthOptionsPanel` creates `createLocalWalletSession` and
`createLocalProviderSession` on failures, sending users to workspace with
fake sessions. This is fine for dev but confusing in production.

### 5a: Add environment-aware fallback gating

**File:** `app/src/components/auth/AuthOptionsPanel.tsx`

Find `createLocalWalletSession` and `createLocalProviderSession` usage
(around lines 200–248).

Wrap each fallback in an environment check:

```typescript
const isPreviewAuthEnabled =
  process.env.NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH === "true" ||
  process.env.NODE_ENV === "development";
```

When `!isPreviewAuthEnabled`:
- Show an error message instead of silently creating a fake session
- Example: "Authentication failed. Please try again or use a different method."
- Do NOT redirect to workspace with a preview token

When `isPreviewAuthEnabled` (dev/demo):
- Keep existing behavior but add a visible "Preview Session" indicator

### 5b: Propagate managed wallet detection

Check the following pages and ensure they use `useManagedWallet()` where
transaction signing happens:

- `/campaigns/[proposalId]/endorse.tsx` — add managed path for endorse tx
- `/portfolio.tsx` — `S2ClaimButton` should support managed claim
- `/market/[creatorId].tsx` — managed buy/sell (lower priority, S1 market
  is operator-seeded anyway)

The pattern is the same everywhere:

```typescript
const { isManagedWallet } = useManagedWallet();

// In the transaction handler:
if (isManagedWallet) {
  await executeManagedWalletAction(token, {
    action: "endorse-proposal",  // or "claim-endorsement", etc.
    params: { proposalPda, amount },
  });
} else {
  // existing wallet-adapter build → sign → submit
}
```

Only wire this for actions that `managed/execute` already supports in
`s1ActionController.ts`. Check what actions are currently handled:
- `claim-daily-spump` ✓
- `claim-engagement-reward` ✓
- `endorse-proposal` ✓

If claim-endorsement is not in the managed execute handler, skip it for now.

---

## What Is NOT In Scope (Deferred)

These require fundamental backend/chain/infra work and should NOT be attempted:

- **Engagement reward missions** — needs oracle completion pipeline, report signing
- **Track 3 CPS settlement** — needs merchant/reconciliation provider
- **S1 self-serve creator onboarding** — needs rating/cap/verification infra
- **Settlement oracle triggers** — needs operator dashboard
- **KMS migration for managed wallets** — needs cloud infra setup
- **Managed wallet SOL budget monitoring** — needs operational tooling
- **Per-user endorsement position API** — add later if needed for endorse page claim

---

## Verification Checklist

1. `npm run build --prefix app` — must pass
2. `git diff --check` — no whitespace errors
3. Protected files not modified
4. No backend or chain files modified
5. Browser smoke (if dev server available):
   - `/workspace/content/[manifestId]` — verify button visible for PENDING publications
   - `/rewards` — daily claim button triggers transaction flow (managed or external)
   - `/campaigns/[proposalId]/endorse` — data refreshes after endorse
   - `/campaigns/[proposalId]/settlement` — shows real data when campaign exists
6. Report all changed files via `git diff --stat`
