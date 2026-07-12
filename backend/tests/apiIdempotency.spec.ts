import { ApiIdempotencyStatus } from "@prisma/client";
import { expect } from "chai";
import { Request, Response } from "express";

import {
  buildIdempotencyScope,
  durableApiIdempotency,
  DurableIdempotencyDependencies,
} from "../src/middleware/apiIdempotency";
import {
  buildIdempotencyRequestHash,
  bindApiIdempotencyResource,
  decideExistingIdempotencyRecord,
  getRecoveredIdempotencyResourceId,
  hashIdempotencyKey,
  shouldPreserveBoundResourceOnReacquire,
} from "../src/services/apiIdempotency";

describe("durable API idempotency", () => {
  const now = new Date("2026-07-12T12:00:00.000Z");

  it("hashes keys and canonical payloads without persisting their raw values", () => {
    expect(hashIdempotencyKey("secret-client-key")).to.match(/^[0-9a-f]{64}$/);
    expect(hashIdempotencyKey("secret-client-key")).not.to.contain("secret-client-key");
    expect(
      buildIdempotencyRequestHash({
        method: "post",
        scope: "content.manifest.create",
        body: { b: 2, a: 1 },
      })
    ).to.equal(
      buildIdempotencyRequestHash({
        method: "POST",
        scope: "content.manifest.create",
        body: { a: 1, b: 2 },
      })
    );
  });

  it("scopes the same key by route resource", () => {
    expect(
      buildIdempotencyScope(
        { manifestId: "manifest-1", assetId: "asset-2" },
        {
          scope: "content.asset.complete",
          resourceParams: ["manifestId", "assetId"],
        }
      )
    ).to.equal("content.asset.complete:manifestId=manifest-1:assetId=asset-2");
  });

  it("rejects payload conflicts, excludes concurrent execution, and recovers expired leases", () => {
    const base = {
      requestHash: "request-a",
      responseExpiresAt: null,
      responseStatus: null,
      responseBody: null,
    };
    expect(
      decideExistingIdempotencyRecord({
        record: {
          ...base,
          status: ApiIdempotencyStatus.IN_PROGRESS,
          leaseExpiresAt: new Date(now.getTime() + 1_000),
        },
        requestHash: "request-b",
        now,
      }).kind
    ).to.equal("CONFLICT");
    expect(
      decideExistingIdempotencyRecord({
        record: {
          ...base,
          status: ApiIdempotencyStatus.IN_PROGRESS,
          leaseExpiresAt: new Date(now.getTime() + 1_000),
        },
        requestHash: "request-a",
        now,
      }).kind
    ).to.equal("IN_PROGRESS");
    expect(
      decideExistingIdempotencyRecord({
        record: {
          ...base,
          status: ApiIdempotencyStatus.IN_PROGRESS,
          leaseExpiresAt: new Date(now.getTime() - 1),
        },
        requestHash: "request-a",
        now,
      }).kind
    ).to.equal("REACQUIRE");
  });

  it("replays successful responses until an explicit response TTL expires", () => {
    const succeeded = {
      requestHash: "request-a",
      status: ApiIdempotencyStatus.SUCCEEDED,
      leaseExpiresAt: null,
      responseStatus: 201,
      responseBody: { ok: true },
    };
    expect(
      decideExistingIdempotencyRecord({
        record: { ...succeeded, responseExpiresAt: null },
        requestHash: "request-a",
        now,
      }).kind
    ).to.equal("REPLAY");
    expect(
      decideExistingIdempotencyRecord({
        record: {
          ...succeeded,
          responseExpiresAt: new Date(now.getTime() - 1),
        },
        requestHash: "request-a",
        now,
      }).kind
    ).to.equal("REACQUIRE");
    expect(
      shouldPreserveBoundResourceOnReacquire(ApiIdempotencyStatus.SUCCEEDED)
    ).to.equal(false);
    expect(
      shouldPreserveBoundResourceOnReacquire(ApiIdempotencyStatus.IN_PROGRESS)
    ).to.equal(true);
  });

  it("exposes transaction-bound resources only for the matching recovery type", () => {
    const req = {
      idempotency: {
        recordId: "record-1",
        leaseToken: "lease-1",
        resourceType: "CONTENT_MANIFEST",
        resourceId: "manifest-1",
      },
    } as Request;
    expect(getRecoveredIdempotencyResourceId(req, "CONTENT_MANIFEST")).to.equal("manifest-1");
    expect(getRecoveredIdempotencyResourceId(req, "PROPOSAL_INTENT")).to.equal(null);
  });

  it("binds a created resource under the active lease before its transaction commits", async () => {
    const req = {
      idempotency: {
        recordId: "record-1",
        leaseToken: "lease-1",
        resourceType: null,
        resourceId: null,
      },
    } as Request;
    const writes: unknown[] = [];
    const tx = {
      apiIdempotencyRecord: {
        updateMany: async (args: unknown) => {
          writes.push(args);
          return { count: 1 };
        },
      },
    } as any;
    await bindApiIdempotencyResource(tx, req, "CONTENT_MANIFEST", "manifest-1");
    expect(writes).to.have.length(1);
    expect(req.idempotency?.resourceType).to.equal("CONTENT_MANIFEST");
    expect(req.idempotency?.resourceId).to.equal("manifest-1");
  });

  const runMiddlewareResponse = async (completeFails: boolean) => {
    const order: string[] = [];
    let finish: (() => void) | undefined;
    let resolveSent: (value: { status: number; body: any }) => void = () => undefined;
    const sent = new Promise<{ status: number; body: any }>((resolve) => {
      resolveSent = resolve;
    });
    const req = {
      auth: { wallet: "wallet-1", sessionId: "session-1", source: "session" },
      body: { value: 1 },
      header: (name: string) => (name === "x-idempotency-key" ? "key-1" : undefined),
      method: "POST",
      params: {},
    } as unknown as Request;
    const res = {
      statusCode: 200,
      set() {
        return this;
      },
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      json(body: any) {
        order.push("send");
        finish?.();
        resolveSent({ status: this.statusCode, body });
        return this;
      },
      once(event: string, listener: () => void) {
        if (event === "finish") finish = listener;
        return this;
      },
    } as unknown as Response;
    const dependencies: DurableIdempotencyDependencies = {
      acquire: async () => ({
        kind: "EXECUTE",
        execution: {
          recordId: "record-1",
          leaseToken: "lease-1",
          resourceType: null,
          resourceId: null,
        },
      }),
      complete: async () => {
        order.push("complete");
        if (completeFails) throw new Error("db unavailable");
      },
      fail: async () => {
        order.push("fail");
      },
      renew: async () => undefined,
    };

    await durableApiIdempotency(
      { scope: "content.manifest.create" },
      dependencies
    )(req, res, () => {
      res.status(201).json({ ok: true, data: { id: "manifest-1" } });
    });
    return { order, sent: await sent };
  };

  it("persists the replay response before exposing a 2xx response to the client", async () => {
    const result = await runMiddlewareResponse(false);
    expect(result.order).to.deep.equal(["complete", "send"]);
    expect(result.sent.status).to.equal(201);
  });

  it("fails closed with 503 when the success response cannot be persisted", async () => {
    const result = await runMiddlewareResponse(true);
    expect(result.order).to.deep.equal(["complete", "fail", "send"]);
    expect(result.sent.status).to.equal(503);
    expect(result.sent.body.error.code).to.equal("IDEMPOTENCY_COMMIT_FAILED");
  });
});
