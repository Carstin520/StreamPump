/**
 * CN: Proposal intent 控制器辅助逻辑测试，覆盖 bundle 复用判断和签名提取。
 * EN: Proposal intent controller helper tests covering bundle reuse rules and signature extraction.
 */
import { expect } from "chai";
import {
  BundleStatus,
} from "@prisma/client";
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  extractTransactionSignature,
  isBundleReusable,
} from "../src/controllers/proposalIntentController";

describe("proposalIntentController helpers", () => {
  it("reuses an active built bundle", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.BUILT,
      expiresAt: new Date(Date.now() + 60_000),
    });

    expect(reusable).to.equal(true);
  });

  it("does not reuse an expired partial bundle", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.PARTIAL,
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(reusable).to.equal(false);
  });

  it("always reuses a confirmed bundle even after expiry", () => {
    const reusable = isBundleReusable({
      status: BundleStatus.CONFIRMED,
      expiresAt: new Date(Date.now() - 1_000),
    });

    expect(reusable).to.equal(true);
  });

  it("extracts the canonical transaction signature from a fully signed v0 transaction", () => {
    const sponsor = Keypair.generate();
    const recipient = Keypair.generate().publicKey;
    const tx = new VersionedTransaction(
      new TransactionMessage({
        payerKey: sponsor.publicKey,
        recentBlockhash: Keypair.generate().publicKey.toBase58(),
        instructions: [
          SystemProgram.transfer({
            fromPubkey: sponsor.publicKey,
            toPubkey: recipient,
            lamports: 1,
          }),
        ],
      }).compileToV0Message()
    );

    tx.sign([sponsor]);
    const extracted = extractTransactionSignature(Buffer.from(tx.serialize()).toString("base64"));

    expect(extracted).to.be.a("string");
    expect(extracted.length).to.be.greaterThan(20);
  });
});
