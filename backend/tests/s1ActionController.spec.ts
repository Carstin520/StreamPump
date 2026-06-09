import { expect } from "chai";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
} from "@solana/web3.js";

import {
  assertS1TransactionSignedByWallet,
  executeManagedWalletActionForSession,
  syncSubmittedS1Projection,
} from "../src/controllers/s1ActionController";
import { HttpError } from "../src/controllers/http";
import { ManagedWalletSecretMissingError } from "../src/services/managedWalletService";

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

  it("executes managed daily claims with oracle as fee payer and backend signers", async () => {
    const managed = Keypair.generate();
    const oracle = Keypair.generate();
    const instruction = new TransactionInstruction({
      keys: [],
      programId: SystemProgram.programId,
      data: Buffer.alloc(0),
    });
    let capturedBuild: any = null;

    const result = await executeManagedWalletActionForSession(
      {
        userWallet: managed.publicKey.toBase58(),
        action: "claim-daily-spump",
        rawParams: {},
      },
      {
        loadManagedWalletKeypair: async () => managed,
        getAnchorService: (() => ({
          oracleAuthority: oracle,
          buildClaimDailySpumpInstruction: async () => instruction,
          buildClaimEngagementRewardInstruction: async () => {
            throw new Error("unexpected engagement build");
          },
          buildEndorseProposalInstruction: async () => {
            throw new Error("unexpected endorse build");
          },
          buildClientSignedTransaction: async (params: any) => {
            capturedBuild = params;
            return {
              transactionBase64: "tx-base64",
              recentBlockhash: "blockhash",
              lastValidBlockHeight: 123n,
            };
          },
          sendAndConfirmVersionedTransaction: async () => "sig-managed-daily",
        })) as never,
        syncSubmittedS1Projection: async () => ({
          status: "SYNCED",
          instructionCount: 1,
          indexerStatus: "SYNCED",
        }),
      }
    );

    expect(result.signature).to.equal("sig-managed-daily");
    expect(capturedBuild.payerWallet).to.equal(oracle.publicKey.toBase58());
    expect(capturedBuild.instructions).to.deep.equal([instruction]);
    expect(capturedBuild.backendSigners.map((keypair: Keypair) => keypair.publicKey.toBase58())).to.deep.equal([
      managed.publicKey.toBase58(),
      oracle.publicKey.toBase58(),
    ]);
  });

  it("returns a specific managed-wallet error when encrypted key material is missing", async () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    let thrown: unknown = null;

    try {
      await executeManagedWalletActionForSession(
        {
          userWallet: wallet,
          action: "claim-daily-spump",
          rawParams: {},
        },
        {
          loadManagedWalletKeypair: async () => {
            throw new ManagedWalletSecretMissingError(wallet);
          },
          getAnchorService: (() => {
            throw new Error("anchor service should not be loaded");
          }) as never,
          syncSubmittedS1Projection: async () => ({
            status: "FAILED",
            error: "unexpected",
          }),
        }
      );
    } catch (error) {
      thrown = error;
    }

    expect(thrown).to.be.instanceOf(HttpError);
    expect((thrown as HttpError).code).to.equal("MANAGED_WALLET_KEY_MISSING");
  });

  it("uses oracle as fee payer for managed endorsement execution", async () => {
    const managed = Keypair.generate();
    const oracle = Keypair.generate();
    const proposal = Keypair.generate().publicKey;
    let capturedBuild: any = null;
    let capturedEndorse: any = null;

    await executeManagedWalletActionForSession(
      {
        userWallet: managed.publicKey.toBase58(),
        action: "endorse-proposal",
        rawParams: {
          proposalPda: proposal.toBase58(),
          amount: "1000",
        },
      },
      {
        loadManagedWalletKeypair: async () => managed,
        getAnchorService: (() => ({
          oracleAuthority: oracle,
          buildClaimDailySpumpInstruction: async () => {
            throw new Error("unexpected daily build");
          },
          buildClaimEngagementRewardInstruction: async () => {
            throw new Error("unexpected engagement build");
          },
          buildEndorseProposalInstruction: async (params: any) => {
            capturedEndorse = params;
            return new TransactionInstruction({
              keys: [],
              programId: PublicKey.default,
              data: Buffer.alloc(0),
            });
          },
          buildClientSignedTransaction: async (params: any) => {
            capturedBuild = params;
            return {
              transactionBase64: "tx-base64",
              recentBlockhash: "blockhash",
              lastValidBlockHeight: 123n,
            };
          },
          sendAndConfirmVersionedTransaction: async () => "sig-managed-endorse",
        })) as never,
        syncSubmittedS1Projection: async () => ({
          status: "SYNCED",
          instructionCount: 1,
          indexerStatus: "SYNCED",
        }),
      }
    );

    expect(capturedEndorse).to.deep.equal({
      userWallet: managed.publicKey.toBase58(),
      proposalPda: proposal.toBase58(),
      amount: 1000n,
    });
    expect(capturedBuild.payerWallet).to.equal(oracle.publicKey.toBase58());
  });
});
