# Google and Apple login setup

Status: approved public identity entry. Google and Apple registration are open to everyone when the production provider settings below are configured. The Solana devnet/test-USDC and no-real-funds boundaries remain unchanged.

## What the implementation does

StreamPump keeps its existing identity spine:

```text
Google / Apple authorization code
-> backend code exchange
-> backend ID-token signature + issuer + audience + nonce validation
-> AuthIdentity(provider, providerSubject)
-> managed wallet session subject
-> WalletSession + AccountProfile
-> direct product entry
```

The platform-managed wallet is the account's internal identity/settlement address. The login and onboarding flows do not ask for a user-owned wallet. Phantom/Solflare remains a separate login method; signed wallet binding is deferred until the user explicitly requests withdrawal/transfer.

The browser never chooses `providerSubject`, email, or the StreamPump session wallet. OAuth completion happens in a popup, and the backend posts the completed StreamPump session only to an explicitly allowed frontend origin. Access tokens are not placed in callback URLs.

## Backend environment

```env
SOCIAL_AUTH_ENABLED=true
SOCIAL_AUTH_STATE_TTL_SECONDS=600
SOCIAL_AUTH_FRONTEND_ORIGINS=https://app.stream-pump.com

GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=https://api.stream-pump.com/api/v1/auth/social/google/callback

APPLE_OAUTH_CLIENT_ID=com.example.streampump.web
APPLE_OAUTH_TEAM_ID=...
APPLE_OAUTH_KEY_ID=...
APPLE_OAUTH_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APPLE_OAUTH_REDIRECT_URI=https://api.example.com/api/v1/auth/social/apple/callback

MANAGED_WALLET_ENCRYPTION_KEY=<64 hex chars from openssl rand -hex 32>
```

The login page always renders Google and Apple alongside wallet login. The Render backend's `SOCIAL_AUTH_ENABLED` setting is the single runtime source of truth, so a separate Vercel build-time feature flag is not required. `SOCIAL_AUTH_FRONTEND_ORIGINS` must contain exact origins only, without paths. Provider redirect URIs must exactly match the values registered in the provider dashboards.

## Google Cloud setup

1. Create or select a Google Cloud project.
2. Configure the OAuth consent screen and the basic `openid`, `email`, and `profile` scopes.
3. Create an OAuth 2.0 Client ID of type **Web application**.
4. Add the deployed frontend domain under Authorized JavaScript origins: `https://app.stream-pump.com`.
5. Add the backend callback under Authorized redirect URIs:

   ```text
   https://api.stream-pump.com/api/v1/auth/social/google/callback
   ```

6. Put the client ID and client secret in the backend secret manager. They do not belong in the frontend environment.

Google requires the backend to verify the ID token rather than accepting a plain Google user ID. StreamPump performs that verification against Google's published signing keys and checks issuer, audience, expiration, and nonce.

Official references:

- [Create a Google OAuth client ID](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid)
- [Verify Google ID tokens on the server](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token)

## Apple Developer setup

Sign in with Apple for a website needs an Apple-platform App ID enabled for Sign in with Apple and configured as a primary App ID.

1. In Certificates, Identifiers & Profiles, enable **Sign in with Apple** for the related App ID and make it the primary App ID if it is not grouped under another primary.
2. Create a **Services ID** for the website, for example `com.streampump.web`. This Services ID is `APPLE_OAUTH_CLIENT_ID`.
3. Configure Sign in with Apple on that Services ID and associate it with the primary App ID.
4. Register the production web domain and the exact return URL:

   ```text
   https://api.stream-pump.com/api/v1/auth/social/apple/callback
   ```

5. Create a Sign in with Apple private key associated with the primary App ID. Record the Team ID and Key ID, download the `.p8` once, and store it only in a secret manager.
6. If StreamPump will email users who choose Hide My Email, register and authenticate the outbound email domain for Apple's Private Email Relay.
7. Before adding account deletion, implement refresh-token retention/revocation and Apple's server-to-server account-change notifications. The current login path exchanges the single-use authorization code and verifies identity, but it does not yet retain Apple refresh tokens.

Official references:

- [Configure Sign in with Apple for the web](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web)
- [Create a Sign in with Apple private key](https://developer.apple.com/help/account/capabilities/create-a-sign-in-with-apple-private-key)
- [Configure the Sign in with Apple environment](https://developer.apple.com/documentation/signinwithapple/configuring-your-environment-for-sign-in-with-apple)

## Verification checklist

1. Set `PILOT_INVITE_ONLY=false`; leave `PILOT_INVITE_WALLETS` empty for public access.
2. Sign in once with Google and once with Apple.
3. Confirm `/api/v1/auth/session` reports `GOOGLE` or `APPLE` and a stable provider subject.
4. Reload and sign in again; the same `AuthIdentity` and managed wallet address must be reused.
5. Test Apple both with a real email and Hide My Email.
6. Confirm social login enters the product directly without showing a wallet-choice or wallet-address prompt.
7. Confirm standalone Phantom/Solflare login still requires a wallet challenge signature.
8. Reject mismatched redirect URIs, audiences, nonces, expired state, cancelled provider flows, disallowed frontend origins, and popup messages from unexpected origins.
9. Run backend tests/build and the frontend production build, then perform browser smoke on `/login`.

## Remaining production gates

- Provider dashboard and secret values must remain valid and owned by an operator.
- Managed-wallet custody/KMS and recovery review.
- Account linking policy when the same person uses Google and Apple (never merge by email alone; Apple relay addresses make that unsafe).
- Apple refresh-token revocation and server-to-server notification handling before account deletion is offered.
- A real, audited custodial-to-personal withdrawal flow. Until then, do not request a personal wallet during signup or onboarding and do not claim withdrawals are available.
