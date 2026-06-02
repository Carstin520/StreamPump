import { expect } from "chai";
import { Keypair } from "@solana/web3.js";

import { config } from "../config/default";
import { decryptSecretKey, encryptSecretKey } from "../src/services/walletEncryption";

describe("walletEncryption service", () => {
  const originalKey = config.managedWallet.encryptionKey;

  afterEach(() => {
    config.managedWallet.encryptionKey = originalKey;
  });

  it("round-trips managed wallet secret keys without exposing plaintext", () => {
    config.managedWallet.encryptionKey = "1".repeat(64);
    const keypair = Keypair.generate();

    const encrypted = encryptSecretKey(keypair.secretKey);
    const decrypted = decryptSecretKey(encrypted);
    const restored = Keypair.fromSecretKey(decrypted);

    expect(Buffer.from(encrypted).equals(Buffer.from(keypair.secretKey))).to.equal(false);
    expect(restored.publicKey.toBase58()).to.equal(keypair.publicKey.toBase58());
  });

  it("rejects missing or malformed encryption keys", () => {
    config.managedWallet.encryptionKey = "";
    expect(() => encryptSecretKey(Keypair.generate().secretKey)).to.throw(
      "MANAGED_WALLET_ENCRYPTION_KEY"
    );
  });
});
