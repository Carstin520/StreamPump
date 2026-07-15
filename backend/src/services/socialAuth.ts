import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPublicKey,
  createSign,
  randomBytes,
  verify as verifySignature,
} from "crypto";

import { IdentityProvider } from "@prisma/client";

import { config } from "../../config/default";
import { HttpError } from "../controllers/http";
import { exchangeProviderIdentitySession } from "./auth";

export type SocialAuthProvider = "GOOGLE" | "APPLE";

type SocialStatePayload = {
  version: 1;
  provider: SocialAuthProvider;
  targetOrigin: string;
  nonce: string;
  codeVerifier: string | null;
  issuedAtMs: number;
  expiresAtMs: number;
  tokenId: string;
};

type JsonWebKeyRecord = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type IdTokenClaims = {
  iss?: unknown;
  aud?: unknown;
  azp?: unknown;
  sub?: unknown;
  exp?: unknown;
  iat?: unknown;
  nonce?: unknown;
  email?: unknown;
  email_verified?: unknown;
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
};

type TokenEndpointResponse = {
  id_token?: unknown;
  error?: unknown;
  error_description?: unknown;
};

const GOOGLE_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const APPLE_AUTHORIZATION_URL = "https://appleid.apple.com/auth/authorize";
const APPLE_TOKEN_URL = "https://appleid.apple.com/auth/token";
const APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_ISSUER = "https://appleid.apple.com";
const STATE_AAD = Buffer.from("streampump-social-oauth-state-v1", "utf8");
const CLOCK_SKEW_SECONDS = 60;
const JWKS_FALLBACK_TTL_MS = 60 * 60 * 1000;

const jwksCache = new Map<string, { expiresAtMs: number; keys: JsonWebKeyRecord[] }>();

const stateEncryptionKey = (): Buffer =>
  createHash("sha256")
    .update(`streampump-social-oauth:${config.auth.sessionSecret}`, "utf8")
    .digest();

const sha256Base64Url = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("base64url");

const encryptState = (payload: SocialStatePayload): string => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", stateEncryptionKey(), iv);
  cipher.setAAD(STATE_AAD);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, ciphertext].map((part) => part.toString("base64url")).join(".");
};

const decryptState = (state: string): SocialStatePayload => {
  const parts = state.trim().split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new HttpError(400, "SOCIAL_AUTH_STATE_INVALID", "Social login state is invalid.");
  }

  try {
    const [ivEncoded, tagEncoded, ciphertextEncoded] = parts;
    const iv = Buffer.from(ivEncoded, "base64url");
    const tag = Buffer.from(tagEncoded, "base64url");
    const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
    if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
      throw new Error("invalid state envelope");
    }

    const decipher = createDecipheriv("aes-256-gcm", stateEncryptionKey(), iv);
    decipher.setAAD(STATE_AAD);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString("utf8")) as SocialStatePayload;
  } catch (_error) {
    throw new HttpError(400, "SOCIAL_AUTH_STATE_INVALID", "Social login state is invalid.");
  }
};

const allowedFrontendOrigins = (): string[] => {
  const configured = config.auth.social.frontendOrigins.length > 0
    ? config.auth.social.frontendOrigins
    : config.app.corsAllowedOrigins;

  return [...new Set(configured.map((origin) => origin.trim()).filter(Boolean))];
};

const normalizeAllowedOrigin = (origin: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch (_error) {
    throw new HttpError(403, "SOCIAL_AUTH_ORIGIN_FORBIDDEN", "Social login origin is not allowed.");
  }

  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
    throw new HttpError(403, "SOCIAL_AUTH_ORIGIN_FORBIDDEN", "Social login origin is not allowed.");
  }

  const allowed = allowedFrontendOrigins();
  if (!allowed.includes(parsed.origin)) {
    throw new HttpError(403, "SOCIAL_AUTH_ORIGIN_FORBIDDEN", "Social login origin is not allowed.");
  }

  return parsed.origin;
};

const assertSocialAuthEnabled = (): void => {
  if (!config.auth.social.enabled) {
    throw new HttpError(403, "SOCIAL_AUTH_DISABLED", "Social login is disabled.");
  }
};

const assertProviderConfigured = (provider: SocialAuthProvider): void => {
  assertSocialAuthEnabled();

  const missing = provider === "GOOGLE"
    ? [
        [config.auth.social.google.clientId, "GOOGLE_OAUTH_CLIENT_ID"],
        [config.auth.social.google.clientSecret, "GOOGLE_OAUTH_CLIENT_SECRET"],
        [config.auth.social.google.redirectUri, "GOOGLE_OAUTH_REDIRECT_URI"],
      ]
    : [
        [config.auth.social.apple.clientId, "APPLE_OAUTH_CLIENT_ID"],
        [config.auth.social.apple.teamId, "APPLE_OAUTH_TEAM_ID"],
        [config.auth.social.apple.keyId, "APPLE_OAUTH_KEY_ID"],
        [config.auth.social.apple.privateKey, "APPLE_OAUTH_PRIVATE_KEY"],
        [config.auth.social.apple.redirectUri, "APPLE_OAUTH_REDIRECT_URI"],
      ];
  const missingNames = missing
    .filter(([value]) => !value.trim())
    .map(([, name]) => name);
  if (missingNames.length > 0) {
    throw new HttpError(
      503,
      "SOCIAL_AUTH_NOT_CONFIGURED",
      `Social login provider is missing required configuration: ${missingNames.join(", ")}`
    );
  }

  if (
    !Number.isFinite(config.auth.social.stateTtlSeconds) ||
    config.auth.social.stateTtlSeconds < 60 ||
    config.auth.social.stateTtlSeconds > 30 * 60
  ) {
    throw new HttpError(
      503,
      "SOCIAL_AUTH_NOT_CONFIGURED",
      "SOCIAL_AUTH_STATE_TTL_SECONDS must be between 60 and 1800 seconds."
    );
  }
  if (allowedFrontendOrigins().length === 0) {
    throw new HttpError(
      503,
      "SOCIAL_AUTH_NOT_CONFIGURED",
      "SOCIAL_AUTH_FRONTEND_ORIGINS must include at least one exact frontend origin."
    );
  }

  let redirectUri: URL;
  try {
    redirectUri = new URL(resolveProviderRedirectUri(provider));
  } catch (_error) {
    throw new HttpError(503, "SOCIAL_AUTH_NOT_CONFIGURED", "Social login redirect URI is invalid.");
  }
  const isLoopback = redirectUri.hostname === "localhost" || redirectUri.hostname === "127.0.0.1";
  if (
    redirectUri.username ||
    redirectUri.password ||
    (provider === "APPLE" && redirectUri.protocol !== "https:") ||
    (provider === "GOOGLE" && redirectUri.protocol !== "https:" && !(isLoopback && redirectUri.protocol === "http:"))
  ) {
    throw new HttpError(
      503,
      "SOCIAL_AUTH_NOT_CONFIGURED",
      "Social login redirect URI must use HTTPS (Google may use HTTP only on loopback development)."
    );
  }
};

const validateStatePayload = (
  payload: SocialStatePayload,
  expectedProvider: SocialAuthProvider
): SocialStatePayload => {
  const ttlMs = config.auth.social.stateTtlSeconds * 1000;
  const now = Date.now();
  if (
    payload.version !== 1 ||
    payload.provider !== expectedProvider ||
    !Number.isSafeInteger(payload.issuedAtMs) ||
    !Number.isSafeInteger(payload.expiresAtMs) ||
    payload.expiresAtMs - payload.issuedAtMs !== ttlMs ||
    payload.issuedAtMs > now + CLOCK_SKEW_SECONDS * 1000 ||
    payload.expiresAtMs <= now ||
    !/^[A-Za-z0-9_-]{32,128}$/.test(payload.nonce) ||
    !/^[0-9a-f]{32}$/.test(payload.tokenId) ||
    (payload.codeVerifier !== null && !/^[A-Za-z0-9_-]{43,128}$/.test(payload.codeVerifier))
  ) {
    throw new HttpError(400, "SOCIAL_AUTH_STATE_INVALID", "Social login state is invalid or expired.");
  }

  normalizeAllowedOrigin(payload.targetOrigin);
  return payload;
};

const resolveProviderRedirectUri = (provider: SocialAuthProvider): string =>
  provider === "GOOGLE"
    ? config.auth.social.google.redirectUri
    : config.auth.social.apple.redirectUri;

const resolveProviderClientId = (provider: SocialAuthProvider): string =>
  provider === "GOOGLE"
    ? config.auth.social.google.clientId
    : config.auth.social.apple.clientId;

export const createSocialAuthorization = (params: {
  provider: SocialAuthProvider;
  requestOrigin: string;
}) => {
  assertProviderConfigured(params.provider);
  const targetOrigin = normalizeAllowedOrigin(params.requestOrigin);
  const issuedAtMs = Date.now();
  const expiresAtMs = issuedAtMs + config.auth.social.stateTtlSeconds * 1000;
  const nonce = randomBytes(32).toString("base64url");
  const codeVerifier = params.provider === "GOOGLE"
    ? randomBytes(48).toString("base64url")
    : null;
  const state = encryptState({
    version: 1,
    provider: params.provider,
    targetOrigin,
    nonce,
    codeVerifier,
    issuedAtMs,
    expiresAtMs,
    tokenId: randomBytes(16).toString("hex"),
  });

  const authorizationUrl = new URL(
    params.provider === "GOOGLE" ? GOOGLE_AUTHORIZATION_URL : APPLE_AUTHORIZATION_URL
  );
  authorizationUrl.searchParams.set("client_id", resolveProviderClientId(params.provider));
  authorizationUrl.searchParams.set("redirect_uri", resolveProviderRedirectUri(params.provider));
  authorizationUrl.searchParams.set("response_type", "code");
  authorizationUrl.searchParams.set("scope", params.provider === "GOOGLE" ? "openid email profile" : "name email");
  authorizationUrl.searchParams.set("state", state);
  authorizationUrl.searchParams.set("nonce", nonce);
  if (params.provider === "GOOGLE" && codeVerifier) {
    authorizationUrl.searchParams.set("code_challenge", sha256Base64Url(codeVerifier));
    authorizationUrl.searchParams.set("code_challenge_method", "S256");
    authorizationUrl.searchParams.set("prompt", "select_account");
  } else {
    authorizationUrl.searchParams.set("response_mode", "form_post");
  }

  return {
    provider: params.provider,
    authorizationUrl: authorizationUrl.toString(),
    popupOrigin: new URL(resolveProviderRedirectUri(params.provider)).origin,
    expiresAt: new Date(expiresAtMs),
  };
};

export const resolveSocialCallbackTarget = (
  provider: SocialAuthProvider,
  state: string
): string => {
  assertProviderConfigured(provider);
  return validateStatePayload(decryptState(state), provider).targetOrigin;
};

const createAppleClientSecret = (): string => {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({
    alg: "ES256",
    kid: config.auth.social.apple.keyId,
    typ: "JWT",
  })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: config.auth.social.apple.teamId,
    iat: now,
    exp: now + 5 * 60,
    aud: APPLE_ISSUER,
    sub: config.auth.social.apple.clientId,
  })).toString("base64url");
  const unsigned = `${header}.${payload}`;
  const signer = createSign("SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign({
    key: config.auth.social.apple.privateKey,
    dsaEncoding: "ieee-p1363",
  });

  return `${unsigned}.${signature.toString("base64url")}`;
};

const postTokenRequest = async (url: string, body: URLSearchParams): Promise<string> => {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (_error) {
    throw new HttpError(502, "SOCIAL_AUTH_PROVIDER_UNAVAILABLE", "Social login provider is unavailable.");
  }

  let payload: TokenEndpointResponse;
  try {
    payload = await response.json() as TokenEndpointResponse;
  } catch (_error) {
    throw new HttpError(502, "SOCIAL_AUTH_PROVIDER_INVALID_RESPONSE", "Social login provider returned an invalid response.");
  }

  if (!response.ok || typeof payload.id_token !== "string" || !payload.id_token) {
    throw new HttpError(401, "SOCIAL_AUTH_CODE_INVALID", "Social login authorization could not be verified.");
  }

  return payload.id_token;
};

const exchangeAuthorizationCode = async (
  provider: SocialAuthProvider,
  code: string,
  state: SocialStatePayload
): Promise<string> => {
  const body = new URLSearchParams({
    client_id: resolveProviderClientId(provider),
    code,
    grant_type: "authorization_code",
    redirect_uri: resolveProviderRedirectUri(provider),
  });

  if (provider === "GOOGLE") {
    body.set("client_secret", config.auth.social.google.clientSecret);
    if (!state.codeVerifier) {
      throw new HttpError(400, "SOCIAL_AUTH_STATE_INVALID", "Social login state is invalid.");
    }
    body.set("code_verifier", state.codeVerifier);
    return postTokenRequest(GOOGLE_TOKEN_URL, body);
  }

  body.set("client_secret", createAppleClientSecret());
  return postTokenRequest(APPLE_TOKEN_URL, body);
};

const parseCacheMaxAgeMs = (header: string | null): number => {
  const match = header?.match(/(?:^|,)\s*max-age=(\d+)/i);
  const seconds = match ? Number(match[1]) : NaN;
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(seconds * 1000, 24 * 60 * 60 * 1000)
    : JWKS_FALLBACK_TTL_MS;
};

const fetchJwks = async (url: string, forceRefresh = false): Promise<JsonWebKeyRecord[]> => {
  const cached = jwksCache.get(url);
  if (!forceRefresh && cached && cached.expiresAtMs > Date.now()) {
    return cached.keys;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (_error) {
    throw new HttpError(502, "SOCIAL_AUTH_JWKS_UNAVAILABLE", "Social login verification keys are unavailable.");
  }

  if (!response.ok) {
    throw new HttpError(502, "SOCIAL_AUTH_JWKS_UNAVAILABLE", "Social login verification keys are unavailable.");
  }

  const payload = await response.json() as { keys?: unknown };
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new HttpError(502, "SOCIAL_AUTH_JWKS_INVALID", "Social login verification keys are invalid.");
  }

  const keys = payload.keys as JsonWebKeyRecord[];
  jwksCache.set(url, {
    keys,
    expiresAtMs: Date.now() + parseCacheMaxAgeMs(response.headers.get("cache-control")),
  });
  return keys;
};

const decodeJwtJson = <T>(segment: string): T => {
  try {
    return JSON.parse(Buffer.from(segment, "base64url").toString("utf8")) as T;
  } catch (_error) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }
};

const audienceMatches = (audience: unknown, expected: string): boolean =>
  audience === expected || (Array.isArray(audience) && audience.includes(expected));

const verifiedEmail = (claims: IdTokenClaims): string | null => {
  if (typeof claims.email !== "string" || !claims.email.trim()) {
    return null;
  }
  const verified = claims.email_verified === true || claims.email_verified === "true";
  return verified ? claims.email.trim().toLowerCase() : null;
};

const verifyIdentityToken = async (params: {
  provider: SocialAuthProvider;
  idToken: string;
  expectedNonce: string;
}): Promise<IdTokenClaims & { sub: string }> => {
  const parts = params.idToken.split(".");
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
  const header = decodeJwtJson<{ alg?: unknown; kid?: unknown }>(headerEncoded);
  const claims = decodeJwtJson<IdTokenClaims>(payloadEncoded);
  if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }

  const jwksUrl = params.provider === "GOOGLE" ? GOOGLE_JWKS_URL : APPLE_JWKS_URL;
  let keys = await fetchJwks(jwksUrl);
  let jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!jwk) {
    jwksCache.delete(jwksUrl);
    keys = await fetchJwks(jwksUrl, true);
    jwk = keys.find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  }
  if (!jwk) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }

  let publicKey;
  try {
    publicKey = createPublicKey({ key: jwk, format: "jwk" });
  } catch (_error) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }
  const verified = verifySignature(
    "RSA-SHA256",
    Buffer.from(`${headerEncoded}.${payloadEncoded}`, "utf8"),
    publicKey,
    Buffer.from(signatureEncoded, "base64url")
  );
  if (!verified) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }

  const expectedIssuer = params.provider === "GOOGLE"
    ? ["https://accounts.google.com", "accounts.google.com"]
    : [APPLE_ISSUER];
  const expectedAudience = resolveProviderClientId(params.provider);
  const now = Math.floor(Date.now() / 1000);
  if (
    typeof claims.iss !== "string" ||
    !expectedIssuer.includes(claims.iss) ||
    !audienceMatches(claims.aud, expectedAudience) ||
    (Array.isArray(claims.aud) && claims.aud.length > 1 && claims.azp !== expectedAudience) ||
    typeof claims.sub !== "string" ||
    !claims.sub.trim() ||
    typeof claims.exp !== "number" ||
    claims.exp <= now - CLOCK_SKEW_SECONDS ||
    (typeof claims.iat === "number" && claims.iat > now + CLOCK_SKEW_SECONDS) ||
    claims.nonce !== params.expectedNonce
  ) {
    throw new HttpError(401, "SOCIAL_AUTH_ID_TOKEN_INVALID", "Social login identity token is invalid.");
  }

  return { ...claims, sub: claims.sub.trim() };
};

const sanitizeDisplayName = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const sanitized = value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  return sanitized ? sanitized.slice(0, 120) : null;
};

const parseAppleDisplayName = (rawUser: unknown): string | null => {
  if (typeof rawUser !== "string" || !rawUser.trim()) {
    return null;
  }

  try {
    const user = JSON.parse(rawUser) as {
      name?: { firstName?: unknown; lastName?: unknown };
    };
    return sanitizeDisplayName(
      [user.name?.firstName, user.name?.lastName]
        .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
        .join(" ")
    );
  } catch (_error) {
    return null;
  }
};

export const completeSocialAuthorization = async (params: {
  provider: SocialAuthProvider;
  code: string;
  state: string;
  appleUser?: unknown;
}) => {
  assertProviderConfigured(params.provider);
  const state = validateStatePayload(decryptState(params.state), params.provider);
  const code = params.code.trim();
  if (!code) {
    throw new HttpError(400, "SOCIAL_AUTH_CODE_REQUIRED", "Social login authorization code is required.");
  }

  const idToken = await exchangeAuthorizationCode(params.provider, code, state);
  const claims = await verifyIdentityToken({
    provider: params.provider,
    idToken,
    expectedNonce: state.nonce,
  });
  const displayName = params.provider === "GOOGLE"
    ? sanitizeDisplayName(claims.name) ?? sanitizeDisplayName(
        [claims.given_name, claims.family_name]
          .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
          .join(" ")
      )
    : parseAppleDisplayName(params.appleUser);
  const session = await exchangeProviderIdentitySession({
    provider: params.provider === "GOOGLE" ? IdentityProvider.GOOGLE : IdentityProvider.APPLE,
    providerSubject: claims.sub,
    email: verifiedEmail(claims),
    displayName,
  });

  return {
    targetOrigin: state.targetOrigin,
    session: {
      ...session,
      expiresAt: session.expiresAt.toISOString(),
      tokenType: "Bearer" as const,
    },
  };
};

export const renderSocialCallbackHtml = (params: {
  targetOrigin: string | null;
  message: Record<string, unknown>;
}): { csp: string; html: string } => {
  const scriptNonce = randomBytes(18).toString("base64");
  const serializedMessage = JSON.stringify(params.message).replace(/</g, "\\u003c");
  const serializedOrigin = JSON.stringify(params.targetOrigin ?? "").replace(/</g, "\\u003c");
  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>StreamPump sign-in</title></head>
  <body>
    <p>StreamPump sign-in is complete. You can close this window.</p>
    <script nonce="${scriptNonce}">
      const targetOrigin = ${serializedOrigin};
      const message = ${serializedMessage};
      if (targetOrigin && window.opener) window.opener.postMessage(message, targetOrigin);
      window.close();
    </script>
  </body>
</html>`;

  return {
    csp: `default-src 'none'; script-src 'nonce-${scriptNonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    html,
  };
};

export const clearSocialAuthJwksCacheForTests = (): void => {
  jwksCache.clear();
};

export const verifySocialIdentityTokenForTests = verifyIdentityToken;
export const createAppleClientSecretForTests = createAppleClientSecret;
