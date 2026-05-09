import { expect } from "chai";
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  assertS1TransactionSignedByWallet,
  syncSubmittedS1Projection,
} from "../src/controllers/s1ActionController";

const buildFixtureTransaction = (params: {
  signer: Keypair;
  sign: boolean;
}): string => {
  const recipient = Keypair.generate().publicKey;
  const message = new TransactionMessage({
    payerKey: params.signer.publicKey,
    recentBlockhash: "11111111111111111111111111111111",
    instructions: [
      SystemProgram.transfer({
        fromPubkey: params.signer.publicKey,
        toPubkey: recipient,
        lamports: 1,
      }),
    ],
  }).compileToV0Message();
  const transaction = new VersionedTransaction(message);

  if (params.sign) {
    transaction.sign([params.signer]);
  }

  return Buffer.from(transaction.serialize()).toString("base64");
};

describe("s1ActionController helpers", () => {
  it("accepts a transaction signed by the authenticated wallet", () => {
    const signer = Keypair.generate();
    const serialized = buildFixtureTransaction({ signer, sign: true });

    expect(() =>
      assertS1TransactionSignedByWallet(serialized, signer.publicKey.toBase58())
    ).not.to.throw();
  });

  it("rejects unsigned or wrong-wallet submitted transactions", () => {
    const signer = Keypair.generate();
    const other = Keypair.generate();
    const unsigned = buildFixtureTransaction({ signer, sign: false });
    const signed = buildFixtureTransaction({ signer, sign: true });

    expect(() =>
      assertS1TransactionSignedByWallet(unsigned, signer.publicKey.toBase58())
    ).to.throw("missing the authenticated wallet signature");
    expect(() =>
      assertS1TransactionSignedByWallet(signed, other.publicKey.toBase58())
    ).to.throw("does not require the authenticated wallet");
  });

  it("maps submitted transaction projection sync success without advancing the indexer cursor", async () => {
    let receivedUpdateCursor: boolean | undefined;
    const projectionSync = await syncSubmittedS1Projection("sig-success", async (_signature, options) => {
      receivedUpdateCursor = options.updateCursor;
      return {
        signature: "sig-success",
        slot: "123",
        status: "SYNCED",
        instructionCount: 2,
      };
    });

    expect(receivedUpdateCursor).to.equal(false);
    expect(projectionSync).to.deep.equal({
      status: "SYNCED",
      instructionCount: 2,
      indexerStatus: "SYNCED",
    });
  });

  it("keeps submit responses successful when projection sync fails", async () => {
    const projectionSync = await syncSubmittedS1Projection("sig-failure", async () => {
      throw new Error("projection unavailable");
    });

    expect(projectionSync).to.deep.equal({
      status: "FAILED",
      error: "projection unavailable",
    });
  });
});
