import { expect } from "chai";
import {
  Keypair,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";

import {
  assertS1TransactionSignedByWallet,
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
});
