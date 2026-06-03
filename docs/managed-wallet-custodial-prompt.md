# Managed Wallet Backend-Custodial — Implementation Prompt

## Context

You are working on the `codex/post-deadline-phase-0` branch of the StreamPump repo.
Read `CLAUDE.md` at the repo root before starting.

StreamPump is a Web2.5 platform. Users who sign up via email/social login (not
Phantom/Solflare) get a **managed wallet** — a platform-custodied Solana keypair.
These users should never need SOL, never see a wallet adapter popup, and never
know they're on a blockchain. The platform signs and pays for everything.

### Current State (Critical — Read Before Coding)

1. `createPlatformManagedWalletAddress()` in `backend/src/services/auth.ts` line 159
   generates a `Keypair` but **discards the secret key** — only the public key is
   stored in `AuthIdentity.managedWalletAddress`. This is the core gap.

2. `AccountWallet` model exists in Prisma with `WalletType.MANAGED | EXTERNAL`.
   The data model is ready; only the signing infrastructure is missing.

3. Oracle/admin keypairs are already loaded from env vars in `AnchorService.ts`
   lines 403–464, pattern: `ORACLE_AUTHORITY_SECRET_KEY` (JSON byte array) or
   `ORACLE_AUTHORITY_KEYPAIR_PATH` (file path). Follow this exact pattern.

4. The engagement reward builder (`s1ActionController.ts` line 553) already uses
   `backendSigners: [reward.oracleSigner]` + `payerWallet: oracle` as the
   oracle-pays-rent pattern. This is the model for backend signing.

5. `submitS1Transaction` (`s1ActionController.ts` lines 566–593) uses
   `assertS1TransactionSignedByWallet` to verify the session wallet signed.
   Managed wallet submissions must bypass this check since backend signs.

6. Frontend hooks (`useS1TransactionFlow.ts`, `useProposalTransactionFlow.ts`)
   hard-require a connected wallet adapter. Managed wallet users have no wallet
   adapter — they need a different code path.

7. Frontend API clients (`app/src/lib/api/s1.ts`) are missing wrappers for
   `POST /s1/claim-daily-spump/build` and `POST /s1/engagement-reward/build`.

### Design Principle

- **MANAGED wallet**: Backend holds keypair, signs everything, pays all fees/rent.
  User sees a button, clicks it, gets a result. Zero SOL, zero wallet popups.
- **EXTERNAL wallet**: User connects Phantom/Solflare, signs via wallet adapter,
  pays their own fees. Standard Web3 flow.
- Both wallet types on the same account share the same `AccountProfile`.

---

## Tasks (execute in order)

### Task 1: Store Managed Wallet Secret Keys

**The most security-sensitive part. Be careful.**

#### 1a: Add encrypted secret key storage to `AccountWallet`

**File:** `backend/prisma/schema.prisma`

Add to the `AccountWallet` model (around line 709):

```prisma
  /// Encrypted secret key bytes (only for MANAGED wallets; null for EXTERNAL)
  encryptedSecretKey  Bytes?
```

Create migration: `npx prisma migrate dev --name add_encrypted_wallet_secret`

#### 1b: Add encryption utility

**New file:** `backend/src/services/walletEncryption.ts`

Implement AES-256-GCM encryption using Node.js `crypto` module:

```typescript
import crypto from "crypto";
import { config } from "../config/default";

// Key from env, 32 bytes hex-encoded
const getEncryptionKey = (): Buffer => {
  const hex = config.managedWallet.encryptionKey;
  if (!hex || hex.length !== 64) {
    throw new Error("MANAGED_WALLET_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(hex, "hex");
};

export const encryptSecretKey = (secretKey: Uint8Array): Buffer => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretKey), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: [12 bytes IV][16 bytes tag][encrypted data]
  return Buffer.concat([iv, tag, encrypted]);
};

export const decryptSecretKey = (encryptedData: Buffer): Uint8Array => {
  const key = getEncryptionKey();
  const iv = encryptedData.subarray(0, 12);
  const tag = encryptedData.subarray(12, 28);
  const encrypted = encryptedData.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return new Uint8Array(decrypted);
};
```

#### 1c: Add config entry

**File:** `backend/config/default.ts`

Add a new section (after the `auth` block):

```typescript
managedWallet: {
  encryptionKey: process.env.MANAGED_WALLET_ENCRYPTION_KEY ?? "",
},
```

In the production validation function (if one exists), require this key when
`NODE_ENV === "production"`.

#### 1d: Update managed wallet generation to store encrypted secret

**File:** `backend/src/services/auth.ts`

Replace `createPlatformManagedWalletAddress` (line 159–160):

```typescript
import { encryptSecretKey } from "./walletEncryption";

const createPlatformManagedWallet = (): {
  address: string;
  encryptedSecretKey: Buffer;
} => {
  const keypair = Keypair.generate();
  return {
    address: keypair.publicKey.toBase58(),
    encryptedSecretKey: encryptSecretKey(keypair.secretKey),
  };
};
```

Update `exchangeProviderIdentitySession` (around line 510) to use the new
function. When creating a new `AuthIdentity`, also store the encrypted secret
on the corresponding `AccountWallet` record:

- In `ensureFanAccountProfile`, when creating a MANAGED `AccountWallet`,
  pass and store `encryptedSecretKey`.
- When reusing an existing identity (line 497–504), the encrypted key already
  exists on the `AccountWallet` row.

**IMPORTANT:** The `AuthIdentity` model does NOT need a secret key field.
The secret lives on `AccountWallet.encryptedSecretKey` only.

Update `ensureFanAccountProfile` (line 162–211) to accept an optional
`encryptedSecretKey?: Buffer` parameter and pass it to the `AccountWallet`
upsert when `walletType === MANAGED`.

---

### Task 2: Managed Wallet Signing Service

**New file:** `backend/src/services/managedWalletService.ts`

This service loads a managed wallet's keypair from DB and signs transactions.

```typescript
import { Keypair } from "@solana/web3.js";
import { prisma } from "../config/prisma";
import { decryptSecretKey } from "./walletEncryption";

export const loadManagedWalletKeypair = async (
  walletAddress: string
): Promise<Keypair | null> => {
  const accountWallet = await prisma.accountWallet.findUnique({
    where: { walletAddress },
  });

  if (!accountWallet || accountWallet.walletType !== "MANAGED" || !accountWallet.encryptedSecretKey) {
    return null;
  }

  const secretKey = decryptSecretKey(accountWallet.encryptedSecretKey);
  const keypair = Keypair.fromSecretKey(secretKey);

  // Sanity check
  if (keypair.publicKey.toBase58() !== walletAddress) {
    throw new Error("Managed wallet keypair mismatch after decryption");
  }

  return keypair;
};

export const isManagedWallet = async (walletAddress: string): Promise<boolean> => {
  const accountWallet = await prisma.accountWallet.findUnique({
    where: { walletAddress },
    select: { walletType: true },
  });
  return accountWallet?.walletType === "MANAGED";
};
```

---

### Task 3: Backend-Signed Transaction Submission

**File:** `backend/src/controllers/s1ActionController.ts`

Currently all S1 tx builders return `submitMode: "CLIENT_RELAY"` and expect the
frontend to sign via wallet adapter then call `submitS1Transaction`.

Add a **new endpoint** for managed wallet users that builds, signs, and relays
in one call. This is the "one-click" path.

#### 3a: New managed wallet executor endpoint

Add a new controller function and route:

```
POST /api/v1/s1/managed/execute
Body: { action: string, params: Record<string, unknown> }
```

Flow:
1. `requireSessionAuth` — get `req.walletAddress`
2. `loadManagedWalletKeypair(walletAddress)` — if null, return 400 "not a managed wallet"
3. Based on `action`, build the instruction:
   - `"claim-daily-spump"` → `buildClaimDailySpumpInstruction`
   - `"claim-engagement-reward"` → `buildClaimEngagementRewardInstruction`
   - `"endorse-proposal"` → `buildEndorseProposalInstruction` (future)
4. Build versioned transaction with `payerWallet` = managed wallet (or oracle
   for rent-heavy PDAs), `backendSigners` = `[managedKeypair]` (+ oracle if needed)
5. `sendAndConfirmVersionedTransaction` — relay to chain
6. Return `{ signature, action }`

**Important:** This endpoint does NOT require a wallet adapter. The session
token (from email/social login) is the only auth. Backend signs with the
managed keypair loaded from DB.

#### 3b: Route registration

**File:** `backend/src/routes/v1/s1Routes.ts`

Add the new route:

```typescript
router.post("/managed/execute", requireSessionAuth, managedWalletExecute);
```

#### 3c: Update `submitS1Transaction` to support managed wallets

In `submitS1Transaction` (lines 566–593), `assertS1TransactionSignedByWallet`
(line 578) will fail for managed wallets if the managed wallet signed server-side
but the session wallet is the same managed wallet. This should actually work
because the managed wallet IS the session wallet. Verify this path works.

If there are issues, add a check: if `isManagedWallet(wallet)`, skip the
client-signature assertion (the backend already signed it).

---

### Task 4: Frontend — Detect Managed Wallet and Route Accordingly

#### 4a: Add managed wallet detection hook

**New file:** `app/src/hooks/useManagedWallet.ts`

```typescript
import { getStoredAuthSession } from "@/lib/api/auth";

export const useManagedWallet = () => {
  const session = getStoredAuthSession();

  const isManagedWallet =
    !!session?.identity?.managedWalletAddress &&
    session.wallet === session.identity.managedWalletAddress;

  return {
    isManagedWallet,
    walletAddress: session?.wallet ?? null,
  };
};
```

#### 4b: Add managed wallet API client

**File:** `app/src/lib/api/s1.ts`

Add the missing client functions:

```typescript
export const executeManagedWalletAction = async (
  token: string,
  params: { action: string; params?: Record<string, unknown> }
): Promise<ApiResponse<{ signature: string; action: string }>> =>
  client.post("/s1/managed/execute", params, { token });

export const buildClaimDailySpumpTransaction = async (
  token: string
): Promise<ApiResponse<S1BuildTransactionResponse>> =>
  client.post("/s1/claim-daily-spump/build", {}, { token });

export const buildClaimEngagementRewardTransaction = async (
  token: string,
  params: { missionType: string }
): Promise<ApiResponse<S1BuildTransactionResponse>> =>
  client.post("/s1/engagement-reward/build", params, { token });
```

#### 4c: Update `useS1TransactionFlow` to support managed wallets

**File:** `app/src/hooks/useS1TransactionFlow.ts`

The hook currently hard-requires a connected wallet adapter (lines 58–66).
Add a managed wallet branch:

```typescript
// Inside the execute function:
if (isManagedWallet) {
  // Managed path: call backend execute endpoint directly
  const result = await executeManagedWalletAction(token, { action, params });
  if (!result.ok) throw new Error(result.error ?? "Managed execute failed");
  return result.data;
}

// External path: existing build → sign → submit flow
// ... (existing code)
```

The hook should detect managed vs external using `useManagedWallet()` and
branch accordingly. Managed wallet users never see a wallet adapter popup.

#### 4d: Rewards page integration (optional but recommended)

If `app/src/pages/rewards.tsx` is still `MOCK_PREVIEW`, consider wiring the
daily SPUMP claim button to the managed wallet execute endpoint for managed
users. This gives managed wallet users their first real on-chain interaction
with zero friction.

---

### Task 5: SOL Buffer for Managed Wallets

Managed wallets need a small SOL balance to exist as fee payers. For instructions
where the managed wallet is the fee payer (not oracle-pays-rent), the wallet
needs ~0.005 SOL.

#### 5a: SOL airdrop on managed wallet creation (devnet only)

**File:** `backend/src/services/auth.ts`

After creating a managed wallet, request a devnet airdrop:

```typescript
if (config.solana.isDevnet) {
  const connection = new Connection(config.solana.rpcEndpoint);
  try {
    await connection.requestAirdrop(
      new PublicKey(managedWallet.address),
      0.01 * LAMPORTS_PER_SOL
    );
  } catch (e) {
    console.warn("Managed wallet devnet airdrop failed (non-fatal):", e);
  }
}
```

This is non-blocking and devnet-only. On mainnet, a separate funding service
or the oracle-pays-rent pattern handles it.

#### 5b: For production, prefer oracle-pays-rent pattern

For mainnet, the safest approach is to keep using the oracle-pays-rent pattern
(already implemented for `claim_engagement_reward`). Extend it to
`claim_daily_spump` as well:

**File:** `programs/streampump-core/src/instructions/claim_daily_spump.rs`

Make `oracle` (or a designated `fee_payer`) the payer for any PDA init in
daily claim. Currently `claim_daily_spump` does NOT init any new PDAs
(UserProfile must pre-exist), so this may not be needed. Verify:

- Does `claim_daily_spump` require any account to be initialized?
- If UserProfile already exists (from `register_user`), the only cost is tx fee.
- For tx fee: the managed wallet execute endpoint can set `payerWallet` to
  oracle for managed wallet users, since oracle is already a backend signer.

**Decision:** If managed wallet has no SOL and no PDA init is needed, set
`payerWallet: oraclePublicKey` in the managed execute endpoint for these
instructions. Oracle pays the ~5000 lamport tx fee. This avoids needing to
fund managed wallets with SOL at all.

---

## Files to Create

1. `backend/src/services/walletEncryption.ts` — AES-256-GCM encrypt/decrypt
2. `backend/src/services/managedWalletService.ts` — load keypair from DB
3. `app/src/hooks/useManagedWallet.ts` — frontend managed wallet detection

## Files to Modify

1. `backend/prisma/schema.prisma` — `AccountWallet.encryptedSecretKey`
2. `backend/config/default.ts` — `managedWallet.encryptionKey` config
3. `backend/src/services/auth.ts` — store encrypted secret on wallet creation
4. `backend/src/controllers/s1ActionController.ts` — managed wallet execute endpoint
5. `backend/src/routes/v1/s1Routes.ts` — new route
6. `app/src/lib/api/s1.ts` — missing API client functions
7. `app/src/hooks/useS1TransactionFlow.ts` — managed wallet branch

## Do NOT Modify

- `backend/package-lock.json` (protected)
- `pitch/colosseum-submission.md` (protected)
- `pitch/demo-youtube-description.md` (protected)
- On-chain Rust program — no changes needed for this task (oracle-pays-rent
  is already implemented for engagement reward; daily claim doesn't init PDAs)

## Verification Checklist

1. `npx prisma generate` — must succeed
2. `npm run build --prefix backend` — must pass
3. `npm run build --prefix app` — must pass
4. `git diff --check` — no whitespace errors
5. Protected files not modified
6. `git diff --stat` — report all changed files
7. Confirm: `createPlatformManagedWallet` now returns both address AND encrypted secret
8. Confirm: `AccountWallet` rows for MANAGED type have `encryptedSecretKey` populated
9. Confirm: `loadManagedWalletKeypair` round-trips correctly (encrypt → store → load → decrypt → same pubkey)
10. Confirm: managed execute endpoint builds, signs, and returns without requiring wallet adapter

## Security Notes

- `MANAGED_WALLET_ENCRYPTION_KEY` must NEVER be committed to git.
- Add `MANAGED_WALLET_ENCRYPTION_KEY` to `.env.local` only.
- The encrypted secret key in DB is useless without the env encryption key.
- For production, consider using a KMS (AWS KMS, Vault) instead of env-based
  encryption. The current approach is acceptable for devnet/pilot.
- Never log or expose secret key bytes in API responses.
- `loadManagedWalletKeypair` should only be called from backend services,
  never from controllers that expose data to clients.

## Roadmap Note

After this task, update `docs/streamPump-long-term-roadmap.md` progress ledger:
- Record managed wallet custodial implementation
- Note that `claim_daily_spump` and `claim_engagement_reward` now work for
  managed wallet users without SOL
- Note that `endorse_proposal` managed path is wired but not yet tested
- Note future work: KMS migration, SOL budget monitoring, managed wallet
  recovery/export flow
