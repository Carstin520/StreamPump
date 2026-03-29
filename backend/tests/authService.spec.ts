/**
 * CN: 钱包认证服务测试，覆盖 challenge、签名验证、会话校验和 revoke。
 * EN: Wallet auth service tests covering challenge creation, signature verification, session validation, and revoke.
 */
import { expect } from "chai";
import { ed25519 } from "@noble/curves/ed25519";
import bs58 from "bs58";
import { Keypair } from "@solana/web3.js";

import { prisma } from "../src/services/prisma";
import {
  createWalletAuthChallenge,
  revokeWalletSession,
  verifyWalletAuthChallenge,
  verifyWalletSessionToken,
} from "../src/services/auth";

describe("wallet auth service", function () {
  this.timeout(20_000);

  it("creates a challenge, verifies a wallet signature, and validates the resulting session", async () => {
    const wallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();

    try {
      const challenge = await createWalletAuthChallenge(walletAddress);
      const signature = ed25519.sign(
        Buffer.from(challenge.message, "utf8"),
        wallet.secretKey.slice(0, 32)
      );

      const session = await verifyWalletAuthChallenge({
        wallet: walletAddress,
        nonce: challenge.nonce,
        signature: bs58.encode(signature),
      });

      expect(session.wallet).to.equal(walletAddress);
      expect(session.accessToken).to.be.a("string");

      const validated = await verifyWalletSessionToken(session.accessToken);
      expect(validated?.wallet).to.equal(walletAddress);

      await revokeWalletSession(session.accessToken);
      const revoked = await verifyWalletSessionToken(session.accessToken);
      expect(revoked).to.equal(null);
    } finally {
      await prisma.walletSession.deleteMany({
        where: { wallet: walletAddress },
      });
      await prisma.walletAuthChallenge.deleteMany({
        where: { wallet: walletAddress },
      });
    }
  });

  it("rejects challenge verification when the signature does not match the wallet", async () => {
    const wallet = Keypair.generate();
    const wrongWallet = Keypair.generate();
    const walletAddress = wallet.publicKey.toBase58();

    try {
      const challenge = await createWalletAuthChallenge(walletAddress);
      const invalidSignature = ed25519.sign(
        Buffer.from(challenge.message, "utf8"),
        wrongWallet.secretKey.slice(0, 32)
      );

      let thrown: unknown = null;
      try {
        await verifyWalletAuthChallenge({
          wallet: walletAddress,
          nonce: challenge.nonce,
          signature: bs58.encode(invalidSignature),
        });
      } catch (error) {
        thrown = error;
      }

      expect(String(thrown)).to.match(/invalid wallet signature/i);
    } finally {
      await prisma.walletSession.deleteMany({
        where: { wallet: walletAddress },
      });
      await prisma.walletAuthChallenge.deleteMany({
        where: { wallet: walletAddress },
      });
    }
  });
});
