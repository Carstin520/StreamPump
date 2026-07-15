# StreamPump Account Wallet Model

## Product Intent

StreamPump accounts are identity-first. A user can register with a social/provider identity, and the platform assigns a managed wallet address to that account. Later, the user can link external self-custody wallets to the same account through a separate wallet challenge/signature flow.

## Current Public Identity Boundary

Google and Apple registration are open to everyone. The backend creates an encrypted platform-managed wallet, stores its address as `AuthIdentity.managedWalletAddress`, and uses it as the stable session subject for product state. Registration and onboarding do not request or require a user-owned wallet.

This supports:

- stable account identity,
- workspace ownership,
- creator/sponsor role checks,
- reward/projection attribution,
- managed-wallet signing for explicitly supported devnet actions.

The managed secret is encrypted at rest with `MANAGED_WALLET_ENCRYPTION_KEY`. This remains an early custodial design rather than production-grade MPC/KMS custody: recovery, key rotation, export, account deletion, and operational controls still require hardening before real-funds use.

An external Phantom/Solflare wallet remains a separate login method. It is not requested after social registration. Signed external-wallet binding is reserved for an explicit withdrawal/transfer flow or another action that clearly requires user custody.

## Reward Settlement Direction

For active reward settlement, users should not need to manually claim in the normal consumer flow. The intended direction is:

- backend/oracle computes approved rewards,
- protocol/backend settles rewards to the account's managed settlement address or a protocol-controlled reward escrow,
- the user sees rewards as credited,
- users connect and sign with an external wallet only when they explicitly request withdrawal/transfer.

The custodial-to-personal withdrawal flow is not implemented yet. UI copy must state that limitation and must not prompt for a personal wallet before a real withdrawal action exists.

## Security Rule

Clients must not be allowed to choose `managedWalletAddress` during social/provider registration. The platform assigns it. External wallets must be linked only after an explicit user action and proof of ownership through wallet signature auth; email matching alone must never link or merge wallets.
