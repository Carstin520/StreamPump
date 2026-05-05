# StreamPump Account Wallet Model

## Product Intent

StreamPump accounts are identity-first. A user can register with a social/provider identity, and the platform assigns a managed wallet address to that account. Later, the user can link external self-custody wallets to the same account through a separate wallet challenge/signature flow.

## Current Hackathon Boundary

The current backend stores `AuthIdentity.managedWalletAddress` and uses it as the session wallet for product state. This is enough for:

- stable account identity,
- workspace ownership,
- creator/sponsor role checks,
- reward/projection attribution,
- demo read/write flows that do not require the managed wallet to sign.

It is not yet a full custodial wallet system. The current preview path generates a public address but does not persist a private key or integrate MPC/embedded-wallet custody. Any flow that requires the managed wallet to sign must use a real custody provider or a linked external wallet.

## Reward Settlement Direction

For active reward settlement, users should not need to manually claim in the normal consumer flow. The intended direction is:

- backend/oracle computes approved rewards,
- protocol/backend settles rewards to the account's managed settlement address or a protocol-controlled reward escrow,
- the user sees rewards as credited,
- users can later link an external wallet and withdraw/transfer according to the product policy.

If rewards must be transferable by the user, the managed wallet must be controlled by a real embedded wallet provider or the reward funds must live in a protocol escrow that supports a verified withdrawal flow.

## Security Rule

Clients must not be allowed to choose `managedWalletAddress` during social/provider registration. The platform assigns it. External wallets must be linked only after proving ownership with wallet signature auth.
