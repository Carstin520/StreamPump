import { createSign, generateKeyPairSync, verify as verifySignature } from "crypto";

import { expect } from "chai";

import { config } from "../config/default";
import {
  clearSocialAuthJwksCacheForTests,
  createAppleClientSecretForTests,
  createSocialAuthorization,
  renderSocialCallbackHtml,
  resolveSocialCallbackTarget,
  verifySocialIdentityTokenForTests,
} from "../src/services/socialAuth";

const signRs256Jwt = (params: {
  privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];
  kid: string;
  claims: Record<string, unknown>;
}): string => {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: params.kid, typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(JSON.stringify(params.claims)).toString("base64url");
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  signer.end();
  return `${header}.${payload}.${signer.sign(params.privateKey).toString("base64url")}`;
};

describe("social auth", () => {
  const originalFetch = globalThis.fetch;
  const original = {
    enabled: config.auth.social.enabled,
    stateTtlSeconds: config.auth.social.stateTtlSeconds,
    frontendOrigins: [...config.auth.social.frontendOrigins],
    google: { ...config.auth.social.google },
    apple: { ...config.auth.social.apple },
  };

  beforeEach(() => {
    config.auth.social.enabled = true;
    config.auth.social.stateTtlSeconds = 600;
    config.auth.social.frontendOrigins = ["http://localhost:3000"];
    config.auth.social.google.clientId = "google-client.apps.googleusercontent.com";
    config.auth.social.google.clientSecret = "google-secret";
    config.auth.social.google.redirectUri = "http://localhost:4000/api/v1/auth/social/google/callback";
    config.auth.social.apple.clientId = "com.example.streampump.web";
    config.auth.social.apple.teamId = "TEAM123456";
    config.auth.social.apple.keyId = "KEY1234567";
    config.auth.social.apple.privateKey = "test-key";
    config.auth.social.apple.redirectUri = "https://api.example.com/api/v1/auth/social/apple/callback";
    clearSocialAuthJwksCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    clearSocialAuthJwksCacheForTests();
  });

  after(() => {
    config.auth.social.enabled = original.enabled;
    config.auth.social.stateTtlSeconds = original.stateTtlSeconds;
    config.auth.social.frontendOrigins = original.frontendOrigins;
    Object.assign(config.auth.social.google, original.google);
    Object.assign(config.auth.social.apple, original.apple);
  });

  it("builds a Google authorization-code URL with PKCE and an authenticated callback state", () => {
    const result = createSocialAuthorization({
      provider: "GOOGLE",
      requestOrigin: "http://localhost:3000",
    });
    const url = new URL(result.authorizationUrl);

    expect(url.origin).to.equal("https://accounts.google.com");
    expect(url.searchParams.get("response_type")).to.equal("code");
    expect(url.searchParams.get("code_challenge_method")).to.equal("S256");
    expect(url.searchParams.get("code_challenge")).to.match(/^[A-Za-z0-9_-]{43}$/);
    expect(url.searchParams.get("nonce")).to.match(/^[A-Za-z0-9_-]{32,128}$/);
    expect(resolveSocialCallbackTarget("GOOGLE", url.searchParams.get("state") ?? ""))
      .to.equal("http://localhost:3000");
  });

  it("rejects callback state for a different provider or frontend origin", () => {
    const result = createSocialAuthorization({
      provider: "GOOGLE",
      requestOrigin: "http://localhost:3000",
    });
    const state = new URL(result.authorizationUrl).searchParams.get("state") ?? "";

    expect(() => resolveSocialCallbackTarget("APPLE", state)).to.throw("invalid");
    expect(() => createSocialAuthorization({
      provider: "GOOGLE",
      requestOrigin: "https://attacker.example",
    })).to.throw("not allowed");
  });

  it("verifies a Google ID token signature, issuer, audience, expiry, and nonce", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const jwk = publicKey.export({ format: "jwk" });
    globalThis.fetch = async () => new Response(JSON.stringify({
      keys: [{ ...jwk, kid: "google-test-key", alg: "RS256", use: "sig" }],
    }), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "max-age=60" },
    });
    const nonce = "nonce-for-google-test";
    const now = Math.floor(Date.now() / 1000);
    const idToken = signRs256Jwt({
      privateKey,
      kid: "google-test-key",
      claims: {
        iss: "https://accounts.google.com",
        aud: config.auth.social.google.clientId,
        sub: "google-user-123",
        exp: now + 300,
        iat: now,
        nonce,
        email: "User@Example.com",
        email_verified: true,
      },
    });

    const claims = await verifySocialIdentityTokenForTests({
      provider: "GOOGLE",
      idToken,
      expectedNonce: nonce,
    });
    expect(claims.sub).to.equal("google-user-123");

    let rejected = false;
    try {
      await verifySocialIdentityTokenForTests({
        provider: "GOOGLE",
        idToken,
        expectedNonce: "wrong-nonce",
      });
    } catch (_error) {
      rejected = true;
    }
    expect(rejected).to.equal(true);
  });

  it("verifies an Apple ID token and generates an ES256 Apple client secret", async () => {
    const appleSigningKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const appleJwk = appleSigningKeys.publicKey.export({ format: "jwk" });
    globalThis.fetch = async () => new Response(JSON.stringify({
      keys: [{ ...appleJwk, kid: "apple-test-key", alg: "RS256", use: "sig" }],
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const nonce = "nonce-for-apple-test";
    const now = Math.floor(Date.now() / 1000);
    const idToken = signRs256Jwt({
      privateKey: appleSigningKeys.privateKey,
      kid: "apple-test-key",
      claims: {
        iss: "https://appleid.apple.com",
        aud: config.auth.social.apple.clientId,
        sub: "apple-user-123",
        exp: now + 300,
        iat: now,
        nonce,
        email: "relay@privaterelay.appleid.com",
        email_verified: "true",
      },
    });
    const claims = await verifySocialIdentityTokenForTests({
      provider: "APPLE",
      idToken,
      expectedNonce: nonce,
    });
    expect(claims.sub).to.equal("apple-user-123");

    const clientSecretKeys = generateKeyPairSync("ec", { namedCurve: "P-256" });
    config.auth.social.apple.privateKey = clientSecretKeys.privateKey.export({
      format: "pem",
      type: "pkcs8",
    }).toString();
    const clientSecret = createAppleClientSecretForTests();
    const [header, payload, signature] = clientSecret.split(".");
    expect(JSON.parse(Buffer.from(header, "base64url").toString("utf8"))).to.include({
      alg: "ES256",
      kid: config.auth.social.apple.keyId,
    });
    expect(JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))).to.include({
      iss: config.auth.social.apple.teamId,
      aud: "https://appleid.apple.com",
      sub: config.auth.social.apple.clientId,
    });
    expect(verifySignature(
      "SHA256",
      Buffer.from(`${header}.${payload}`),
      { key: clientSecretKeys.publicKey, dsaEncoding: "ieee-p1363" },
      Buffer.from(signature, "base64url")
    )).to.equal(true);
  });

  it("renders a nonce-protected popup response without allowing script-tag injection", () => {
    const page = renderSocialCallbackHtml({
      targetOrigin: "http://localhost:3000",
      message: {
        type: "streampump-social-auth",
        ok: false,
        error: "</script><script>alert(1)</script>",
      },
    });

    expect(page.csp).to.match(/script-src 'nonce-[^']+'/);
    expect(page.html).not.to.include("</script><script>alert(1)</script>");
    expect(page.html).to.include("\\u003c/script>");
  });
});
