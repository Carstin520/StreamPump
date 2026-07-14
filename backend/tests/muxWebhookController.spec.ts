import { expect } from "chai";
import { type AddressInfo } from "net";

import { createApp } from "../src/app";

describe("Mux webhook authentication", () => {
  let server: ReturnType<ReturnType<typeof createApp>["listen"]>;
  let webhookUrl: string;
  const originalWebhookSecret = process.env.MUX_WEBHOOK_SECRET;

  before(() => {
    process.env.MUX_WEBHOOK_SECRET = "mux-webhook-test-secret";
    server = createApp().listen(0);
    const { port } = server.address() as AddressInfo;
    webhookUrl = `http://127.0.0.1:${port}/api/webhooks/mux`;
  });

  after(async () => {
    if (originalWebhookSecret === undefined) {
      delete process.env.MUX_WEBHOOK_SECRET;
    } else {
      process.env.MUX_WEBHOOK_SECRET = originalWebhookSecret;
    }

    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("fails closed with 401 when mux-signature is missing", async () => {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        type: "video.asset.ready",
        data: { id: "mux-asset-without-signature" },
      }),
    });

    expect(response.status).to.equal(401);
    expect(await response.json()).to.deep.equal({
      error: "mux-signature header is required",
    });
  });

  it("continues to reject an invalid mux-signature with 401", async () => {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": "t=1,v1=invalid",
      },
      body: JSON.stringify({
        type: "video.asset.ready",
        data: { id: "mux-asset-with-invalid-signature" },
      }),
    });

    expect(response.status).to.equal(401);
    expect(await response.json()).to.have.property("error");
  });

  it("treats a blank mux-signature as missing and returns 401", async () => {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "mux-signature": "   ",
      },
      body: JSON.stringify({
        type: "video.asset.ready",
        data: { id: "mux-asset-with-blank-signature" },
      }),
    });

    expect(response.status).to.equal(401);
    expect(await response.json()).to.deep.equal({
      error: "mux-signature header is required",
    });
  });
});
