import { expect } from "chai";
import { type AddressInfo } from "net";

import { createApp } from "../src/app";

describe("proposal intent readiness route", () => {
  it("exists before the dynamic intent route and requires a bearer session", async () => {
    const server = createApp().listen(0);
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/proposal-intents/readiness?creatorWallet=x&sponsorWallet=y`
      );
      expect(response.status).to.equal(401);
      expect(await response.json()).to.deep.include({
        ok: false,
        error: { code: "AUTH_REQUIRED", message: "bearer session authentication is required", details: null },
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    }
  });
});
