import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import { config } from "../config/default";
import * as authService from "../src/services/auth";
import { PilotInviteRequiredError } from "../src/services/pilotInvitePolicy";
import {
  createAuthChallenge,
  verifyAuthChallenge,
} from "../src/controllers/authController";
import { createApp } from "../src/app";
import {
  assertRateLimit,
  getClientIp,
  getRateLimiterBucketCountForTests,
  resetRateLimiterForTests,
} from "../src/services/rateLimiter";

const createMockResponse = () => ({
  statusCode: 200,
  body: null as any,
  status(code: number) {
    this.statusCode = code;
    return this;
  },
  json(payload: unknown) {
    this.body = payload;
    return this;
  },
});

const createMockRequest = (params: {
  wallet: string;
  ip: string;
  nonce?: string;
  signature?: string;
}) => ({
  ip: params.ip,
  body: {
    wallet: params.wallet,
    nonce: params.nonce,
    signature: params.signature,
  },
  header: (_name: string) => undefined,
});

describe("wallet auth abuse protection", () => {
  const authServiceAny = authService as any;
  let originalCreateWalletAuthChallenge: typeof authService.createWalletAuthChallenge;
  let originalVerifyWalletAuthChallenge: typeof authService.verifyWalletAuthChallenge;

  beforeEach(() => {
    resetRateLimiterForTests();
    originalCreateWalletAuthChallenge = authService.createWalletAuthChallenge;
    originalVerifyWalletAuthChallenge = authService.verifyWalletAuthChallenge;
  });

  afterEach(() => {
    authServiceAny.createWalletAuthChallenge = originalCreateWalletAuthChallenge;
    authServiceAny.verifyWalletAuthChallenge = originalVerifyWalletAuthChallenge;
    resetRateLimiterForTests();
  });

  it("applies both per-IP and per-wallet limits to challenge issuance", async () => {
    authServiceAny.createWalletAuthChallenge = async (wallet: string) => ({
      wallet,
      challengeId: "9d5a42b0-b7a0-4cec-b97e-c57d5a54070d",
      nonce: "nonce",
      message: "message",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    for (let index = 0; index < 30; index += 1) {
      const response = createMockResponse();
      await createAuthChallenge(
        createMockRequest({
          wallet: Keypair.generate().publicKey.toBase58(),
          ip: "203.0.113.10",
        }) as any,
        response as any
      );
      expect(response.statusCode).to.equal(201);
    }

    const ipLimited = createMockResponse();
    await createAuthChallenge(
      createMockRequest({
        wallet: Keypair.generate().publicKey.toBase58(),
        ip: "203.0.113.10",
      }) as any,
      ipLimited as any
    );
    expect(ipLimited.statusCode).to.equal(429);
    expect(ipLimited.body.error.code).to.equal("AUTH_RATE_LIMITED");

    resetRateLimiterForTests();
    const wallet = Keypair.generate().publicKey.toBase58();
    for (let index = 0; index < 60; index += 1) {
      const response = createMockResponse();
      await createAuthChallenge(
        createMockRequest({ wallet, ip: `198.51.100.${index + 1}` }) as any,
        response as any
      );
      expect(response.statusCode).to.equal(201);
    }

    const walletLimited = createMockResponse();
    await createAuthChallenge(
      createMockRequest({ wallet, ip: "198.51.100.100" }) as any,
      walletLimited as any
    );
    expect(walletLimited.statusCode).to.equal(429);
    expect(walletLimited.body.error.code).to.equal("AUTH_RATE_LIMITED");
  });

  it("returns one verification failure contract for anonymous challenge probes", async () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    const originalInviteOnly = config.pilot.inviteOnly;
    config.pilot.inviteOnly = true;
    const failures: unknown[] = [
      new Error("auth challenge not found"),
      new Error("invalid wallet signature"),
      new Error("auth challenge has expired"),
      new PilotInviteRequiredError(),
      new Error("database unavailable at secret-db-host.example.invalid"),
    ];
    const responses: Array<{ statusCode: number; body: any }> = [];

    try {
      for (let index = 0; index < failures.length; index += 1) {
        authServiceAny.verifyWalletAuthChallenge = async () => {
          throw failures[index];
        };
        const response = createMockResponse();
        await verifyAuthChallenge(
          createMockRequest({
            wallet,
            ip: `192.0.2.${index + 1}`,
            nonce: "probe-nonce",
            signature: "probe-signature",
          }) as any,
          response as any
        );
        responses.push({ statusCode: response.statusCode, body: response.body });
      }
    } finally {
      config.pilot.inviteOnly = originalInviteOnly;
    }

    for (const response of responses) {
      expect(response).to.deep.equal(responses[0]);
      expect(response.statusCode).to.equal(401);
      expect(response.body.error.code).to.equal("AUTH_CHALLENGE_INVALID");
    }
  });

  it("applies both per-IP and per-wallet limits to challenge verification", async () => {
    authServiceAny.verifyWalletAuthChallenge = async ({ wallet }: { wallet: string }) => ({
      wallet,
      accessToken: "session-token",
      expiresAt: new Date("2030-01-01T00:00:00.000Z"),
    });

    const wallet = Keypair.generate().publicKey.toBase58();
    for (let index = 0; index < 12; index += 1) {
      const response = createMockResponse();
      await verifyAuthChallenge(
        createMockRequest({
          wallet,
          ip: `203.0.113.${index + 1}`,
          nonce: "nonce",
          signature: "signature",
        }) as any,
        response as any
      );
      expect(response.statusCode).to.equal(200);
    }

    const walletLimited = createMockResponse();
    await verifyAuthChallenge(
      createMockRequest({
        wallet,
        ip: "203.0.113.100",
        nonce: "nonce",
        signature: "signature",
      }) as any,
      walletLimited as any
    );
    expect(walletLimited.statusCode).to.equal(429);

    resetRateLimiterForTests();
    for (let index = 0; index < 60; index += 1) {
      const response = createMockResponse();
      await verifyAuthChallenge(
        createMockRequest({
          wallet: Keypair.generate().publicKey.toBase58(),
          ip: "198.51.100.10",
          nonce: "nonce",
          signature: "signature",
        }) as any,
        response as any
      );
      expect(response.statusCode).to.equal(200);
    }

    const ipLimited = createMockResponse();
    await verifyAuthChallenge(
      createMockRequest({
        wallet: Keypair.generate().publicKey.toBase58(),
        ip: "198.51.100.10",
        nonce: "nonce",
        signature: "signature",
      }) as any,
      ipLimited as any
    );
    expect(ipLimited.statusCode).to.equal(429);
    expect(ipLimited.body.error.code).to.equal("AUTH_RATE_LIMITED");
  });

  it("uses only Express's trusted req.ip and keeps the in-memory limiter bounded", () => {
    expect(createApp().get("trust proxy")).to.equal(1);
    expect(
      getClientIp({
        ip: "203.0.113.20",
        header: () => "1.2.3.4",
      } as any)
    ).to.equal("203.0.113.20");

    for (let index = 0; index < 10_000; index += 1) {
      assertRateLimit({
        key: `bounded:${index}`,
        limit: 1,
        windowMs: 60_000,
        code: "TEST_RATE_LIMITED",
        message: "test",
      });
    }
    expect(() =>
      assertRateLimit({
        key: "bounded:overflow",
        limit: 1,
        windowMs: 60_000,
        code: "TEST_RATE_LIMITED",
        message: "test",
      })
    ).to.throw(/test/);
    expect(getRateLimiterBucketCountForTests()).to.equal(10_000);
  });

  it("removes expired limiter buckets before admitting new keys", () => {
    const originalDateNow = Date.now;
    let now = 1_000;
    Date.now = () => now;

    try {
      assertRateLimit({
        key: "expired:first",
        limit: 1,
        windowMs: 100,
        code: "TEST_RATE_LIMITED",
        message: "test",
      });
      now = 1_101;
      for (let index = 0; index < 10_000; index += 1) {
        assertRateLimit({
          key: `expired:replacement:${index}`,
          limit: 1,
          windowMs: 100,
          code: "TEST_RATE_LIMITED",
          message: "test",
        });
      }
      expect(getRateLimiterBucketCountForTests()).to.equal(10_000);
    } finally {
      Date.now = originalDateNow;
    }
  });
});
