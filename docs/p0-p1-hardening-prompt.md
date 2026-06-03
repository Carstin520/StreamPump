# StreamPump P0/P1 Hardening — Implementation Prompt

## Context

You are working on the `codex/post-deadline-phase-0` branch of the StreamPump repo.
Read `CLAUDE.md` at the repo root before starting — it contains the full repo structure,
conventions, build commands, and verification checklist.

This task covers 16 fixes across on-chain (Rust/Anchor), backend (TypeScript/Prisma),
and frontend (Next.js). Execute them in the order listed. After all changes, verify with:

```
cargo check
npm run build --prefix backend
npm run build --prefix app
```

Do NOT commit. Do NOT modify `main`. Do NOT touch protected files
(`backend/package-lock.json`, `pitch/colosseum-submission.md`, `pitch/demo-youtube-description.md`).

---

## On-Chain Fixes (6 items)

### OC-1: Guard `upgrade_creator` against S1 buyout states

**File:** `programs/streampump-core/src/instructions/upgrade_creator.rs`

**Problem:** Lines 106–108 unconditionally set `CreatorStatus::S2_Active` when
`profile.level >= MIN_PROPOSAL_CREATOR_LEVEL`. If the creator is in
`S1_Auction_Pending` or `S1_Execution_Pending` (active buyout), this overwrites
the buyout state, bricking `execute_s1_graduation` and allowing the sponsor to
reclaim escrowed USDC via `cancel_buyout_offer` while fans still hold positions.

**Fix:** Before setting `S2_Active`, check that `profile.status` is not a buyout
state. Only set `S2_Active` if the current status is `Discovery`, `S1_Active`,
or `S2_Active` (idempotent). Add a new error variant if needed, or reuse
`InvalidCreatorStatus`. Do NOT change it for `S1_Auction_Pending` or
`S1_Execution_Pending` — leave those untouched.

```rust
// Suggested logic (replace lines 106-108):
if profile.level >= MIN_PROPOSAL_CREATOR_LEVEL {
    match profile.status {
        CreatorStatus::Discovery | CreatorStatus::S1_Active | CreatorStatus::S2_Active => {
            profile.status = CreatorStatus::S2_Active;
        }
        // S1_Auction_Pending, S1_Execution_Pending, Suspended — do not override
        _ => {}
    }
}
```

### OC-2: Guard `emergency_void` with status check and fix comments

**File:** `programs/streampump-core/src/instructions/emergency_void.rs`

**Problem:** No `ProposalStatus` guard — can void already-settled or already-voided
proposals. Entire vault (including fan Track 2 pool) is refunded to sponsor.
Module comment (lines 9–10) says endorsers get "100% SPUMP principal" but code
applies 5% slash via `CANCEL_VOID_SLASH_BPS`.

**Fix (3 parts):**

1. Add status constraint in the `#[account]` attribute for `proposal` (around line 35):
   - Reject `Voided` (idempotency — already voided).
   - Reject `Resolved_Success` and `Resolved_Fail` (already settled).
   - Allow: `Open`, `Funded`, `Cancelled` (admin can void a cancelled proposal too).

2. Fix the module-level comments (lines 9–10) to match the actual slash behavior:
   endorsers get 95% SPUMP refund (5% slash) on `Voided`, not 100%.

3. Do NOT change the vault refund logic or slash constants — those are correct per
   the design decision. Just add the status guard and fix the comments.

### OC-3: Enforce `Suspended` status in instructions

**File:** `programs/streampump-core/src/instructions/create_proposal.rs`

**Problem:** `CreatorStatus::Suspended` (variant 4) was added to `state.rs` and
`CreatorSuspended` error was added to `errors.rs`, but no instruction checks for it.
Suspended creators can still create proposals.

**Fix:** In `create_proposal.rs`, the existing check (around line 139) requires
`S2_Active`. Since `Suspended` is not `S2_Active`, it's already implicitly blocked
with `InvalidCreatorStatus`. However, for clarity, add an explicit early check:

```rust
require!(
    creator_profile.status != CreatorStatus::Suspended,
    StreamPumpError::CreatorSuspended
);
```

Place this BEFORE the existing `S2_Active` check so the error message is specific.
Also add the same check in `endorse_proposal.rs` for the user's creator profile
if applicable, but endorsement is by fans not creators, so only `create_proposal`
needs this.

### OC-4: Add protocol-level hard ceiling for uncapped endorsements

**File:** `programs/streampump-core/src/instructions/endorse_proposal.rs`

**Problem:** When `proposal.max_endorsement_spump == 0` (lines 132–160), the entire
cap block is skipped. There's no limit on total SPUMP burn per proposal.

**Fix:** Add a protocol-level hard ceiling. In `state.rs`, add a new field to
`ProtocolConfig`:

```rust
pub max_endorsement_hard_ceiling: u64,  // 0 = truly uncapped (admin intent)
```

Update `INIT_SPACE` (+8). Set a default in `initialize_protocol.rs` and
`migrate_legacy_protocol_config.rs` (e.g., `1_000_000_000` = 1B SPUMP).

In `endorse_proposal.rs`, when `proposal.max_endorsement_spump == 0`, check
against `protocol_config.max_endorsement_hard_ceiling` if it's > 0:

```rust
if proposal.max_endorsement_spump > 0 {
    // existing per-proposal + per-user cap checks
} else if ctx.accounts.protocol_config.max_endorsement_hard_ceiling > 0 {
    let ceiling = ctx.accounts.protocol_config.max_endorsement_hard_ceiling;
    require!(
        proposal.total_spump_staked.checked_add(args.amount).ok_or(StreamPumpError::MathOverflow)? <= ceiling,
        StreamPumpError::EndorsementCapExceeded
    );
}
```

### OC-5: Add timing guard to `settle_track1_base`

**File:** `programs/streampump-core/src/instructions/settle_track1_base.rs`

**Problem:** Oracle can pay Track 1 base immediately after `sponsor_fund`, before
campaign deadline. Lines 34–36 only exclude Open/Cancelled/Voided.

**Fix:** Add a deadline check in the handler (after line 81):

```rust
let now = Clock::get()?.unix_timestamp;
require!(
    now >= proposal.deadline,
    StreamPumpError::ProposalNotExpired
);
```

If `ProposalNotExpired` doesn't exist in `errors.rs`, add it (or reuse an
appropriate variant like `ProposalExpired` with inverted semantics — check
what exists first and pick the clearest name).

### OC-6: Emit `EndorsementCreated` event

**File:** `programs/streampump-core/src/instructions/endorse_proposal.rs`

**Problem:** No event emitted for endorsements. The indexer cannot project
endorsement state changes.

**Fix:** Add an `EndorsementCreated` event to `events.rs`:

```rust
#[event]
pub struct EndorsementCreated {
    pub proposal: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
    pub total_staked: u64,
    pub endorser_count: u32,
}
```

Emit it at the end of `endorse_proposal.rs` handler, after the position
update and aggregate increment.

---

## Backend Fixes (7 items)

### BE-1: Auth-gate internal Mux routes

**File:** `backend/src/routes/v1/internalMuxRoutes.ts`

**Problem:** Routes have zero auth middleware. Anyone can trigger reconciliation.

**Fix:** Apply the same `requireInternalOperatorAuth` pattern used in
`internalSponsorRoutes.ts`. Import the middleware from that file (or extract
to shared if it's inline) and apply it to the router:

```typescript
router.use(requireInternalOperatorAuth);  // before route handlers
```

If `requireInternalOperatorAuth` is defined inline in `internalSponsorRoutes.ts`,
extract it to `backend/src/middleware/` first, then import in both files.

### BE-2: Add participant check to `getProposalIntentStatus`

**File:** `backend/src/controllers/proposalIntentController.ts`

**Problem:** Lines 776–801: `getProposalIntentStatus` returns full intent details
without calling `assertProposalIntentParticipant`. Any authenticated wallet
that knows an intentId can read budgets, wallets, PDAs, bundle state.

**Fix:** Add `assertProposalIntentParticipant(intent, req.walletAddress)` after
the `findUnique` call, before `ok(res, ...)`. Follow the pattern used in
`getProposalIntentById` (line 866) and `lockProposalIntent` (line 244).

### BE-3: Fix `latestSettlementTxSignature` preservation in chain projection

**File:** `backend/src/services/chainProjectionService.ts`

**Problem:** Line 142: `latestSettlementTxSignature: isSettlingOrSettled ? params.signature : null`
— non-settlement syncs wipe a previously stored signature.

**Fix:** Preserve existing value when not settling:

```typescript
latestSettlementTxSignature: isSettlingOrSettled
  ? params.signature
  : existing?.latestSettlementTxSignature ?? null,
```

This matches the pattern used for `fundingTxSignature` on lines 138–141.

### BE-4: Add `nonce` field to `Proposal` model

**File:** `backend/prisma/schema.prisma`

**Problem:** `nonce` only exists on `ProposalIntent`. After intent cleanup,
you cannot re-derive the proposal PDA from the `Proposal` record alone.

**Fix:** Add to the `Proposal` model (near line 215, after `onChainTxSignature`):

```prisma
  /// On-chain PDA nonce (from ProposalIntent at launch time)
  nonce              BigInt?
```

Create a new migration: `npx prisma migrate dev --name add_proposal_nonce`
in the `backend` directory.

Then update `chainProjectionService.ts` `syncProposalProjectionFromChain` to
populate `nonce` from the on-chain state (which `AnchorService.fetchProposalState`
already returns as `nonce`).

Also update `proposalIntentShared.ts` `finalizeConfirmedLaunchBundle` to copy
`intent.nonce` to the Proposal upsert payload.

### BE-5: Sync endorsement aggregates from chain in projection

**File:** `backend/src/services/chainProjectionService.ts`

**Problem:** `AnchorService.fetchProposalState` returns `track2EndorserCount`
and `totalSpumpStaked`, but `syncProposalProjectionFromChain` never writes
them to the `Proposal` DB record. Also `endorse_proposal` is not in
`PROGRAM_INSTRUCTIONS_FOR_PROJECTION` in `indexer.ts`.

**Fix (2 parts):**

1. In `chainProjectionService.ts`, add to the upsert payload:
   ```typescript
   endorserCount: onChainState.track2EndorserCount,
   totalSpumpStaked: BigInt(onChainState.totalSpumpStaked.toString()),
   ```

2. In `backend/src/services/indexer.ts`, add `"endorse_proposal"` to the
   `PROGRAM_INSTRUCTIONS_FOR_PROJECTION` array so that endorsement events
   trigger a chain sync for the parent proposal.

### BE-6: Add `endorse_proposal` to indexer instruction projection list

This is part of BE-5 above. In `backend/src/services/indexer.ts`, find the
`PROGRAM_INSTRUCTIONS_FOR_PROJECTION` array and add `"endorse_proposal"`.

### BE-7: Wire publication verification transition

**File:** `backend/src/controllers/contentManifestController.ts`

**Problem:** `createContentPublication` always sets `verificationStatus: PENDING`.
No route/handler transitions to `VERIFIED`. This blocks `publicFeedEligible`
and `contentPublishedVerifiedAt` from ever being set through the product flow.

**Fix:** Add a new controller function `verifyContentPublication` and route
`PATCH /api/v1/content/publications/:publicationId/verify` behind
`requireSessionAuth`. For now, this is an operator/creator self-verify:

```typescript
export const verifyContentPublication = withController(
  "VERIFY_PUBLICATION_FAILED",
  async (req, res) => {
    const publicationId = parseNonEmptyString(req.params.publicationId, "publicationId");

    const publication = await prisma.contentPublication.findUnique({
      where: { id: publicationId },
      include: { manifest: { include: { assets: true } } },
    });

    if (!publication) {
      throw new HttpError(404, "PUBLICATION_NOT_FOUND", "publication not found");
    }

    // Update verification status
    const updated = await prisma.contentPublication.update({
      where: { id: publicationId },
      data: {
        verificationStatus: PublicationVerificationStatus.VERIFIED,
        verifiedAt: new Date(),
      },
    });

    // Re-derive public feed eligibility
    const manifest = publication.manifest;
    const assetsReady = manifest.assets.length > 0 &&
      manifest.assets.every(isAssetPublicDeliveryReady);
    const publicFeedEligible = assetsReady; // now verified

    if (publicFeedEligible && !manifest.isPublicFeedEligible) {
      await prisma.contentManifest.update({
        where: { id: manifest.id },
        data: {
          isPublicFeedEligible: true,
          publishedAt: new Date(),
          status: nextManifestStatusAfterPublication(manifest.status),
        },
      });
    }

    ok(res, { publicationId, verificationStatus: "VERIFIED" });
  }
);
```

Add the route in `contentManifestRoutes.ts`.

Also: when a `Proposal` is created/confirmed from an intent whose manifest has
a verified publication, set `contentPublishedVerifiedAt` on the Proposal.

---

## Frontend Fixes (3 items)

### FE-1: Fix program ID

**Files:**
- `app/src/utils/solana.ts` (line 3–5)
- `app/src/hooks/useProgram.ts` (line 6)

**Fix:** Replace `EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre` with
`FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp` in both files.

### FE-2: Fix USDC formatting on endorsement page

**File:** `app/src/pages/campaigns/[proposalId]/endorse.tsx`

**Problem:** `parseAmount()` (lines 47–50) treats micro-USDC strings as whole
dollars. Budget/pool/reward displays are off by 10^6.

**Fix:** Replace `parseAmount` + `formatUsd` usage for USDC fields with
`formatUsdcAtomic` from `app/src/lib/formatting.ts`. The fields that need
fixing are all the ones parsed from campaign proof API response:
`track2Budget`, `fanPoolShare`, `track2Target`, `track1Budget`, `track3Budget`,
and `successUsdc`. Keep `parseAmount` for non-USDC numeric fields if any exist.

### FE-3: Label or remove mock panels on live portfolio

**File:** `app/src/pages/portfolio.tsx`

**Problem:** Lines 1017–1018: `PreviewPortfolioHero` and `PreviewSnapshotStrip`
render fixture-based totals (mock PnL, mock SPUMP balance) above real API data
without a mock label.

**Fix:** Remove `PreviewPortfolioHero` and `PreviewSnapshotStrip` from the live
portfolio branch (the `portfolio ?` conditional around line 1001). These should
only render in the fallback/preview path. If removing them leaves the live view
too sparse, replace with a simple header showing the wallet address and a
"Portfolio data from API" notice. Do NOT render fixture financial data alongside
real chain-derived positions.

---

## Verification Checklist

After all changes:

1. `cargo check` — must pass with 0 errors
2. `npm run build --prefix backend` — must pass with 0 errors
3. `npm run build --prefix app` — must pass with 0 errors
4. `npx prisma generate` in `backend/` — must succeed (run before backend build
   if schema changed)
5. Confirm no protected files are modified: `git diff --name-only | grep -E "(package-lock|colosseum-submission|demo-youtube-description)"`
6. `git diff --stat` — report the full list of changed files

Report what was changed, file by file, and any issues encountered.
