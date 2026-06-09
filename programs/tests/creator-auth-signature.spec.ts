import { expect } from "chai";
import { createAssociatedTokenAccount, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

import { getTestContext, type TestContext } from "./helpers/test_context";

const fundSigner = async (ctx: TestContext, signer: Keypair): Promise<void> => {
  await sendAndConfirmTransaction(
    ctx.connection,
    new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: ctx.payer.publicKey,
        toPubkey: signer.publicKey,
        lamports: LAMPORTS_PER_SOL,
      })
    ),
    [ctx.payer]
  );
};

const registerCreator = async (
  ctx: TestContext,
  creator: Keypair,
  handle: string,
  signerOverride?: Keypair
) => {
  const payoutUsdcAta = await createAssociatedTokenAccount(
    ctx.connection,
    ctx.payer,
    ctx.usdcMint,
    creator.publicKey,
    undefined,
    TOKEN_PROGRAM_ID
  );
  const creatorProfile = ctx.deriveCreatorProfile(creator.publicKey);

  return ctx.program.methods
    .registerCreator({
      handle,
      payoutUsdcAta,
    })
    .accounts({
      authority: creator.publicKey,
      protocolConfig: ctx.protocolConfig,
      creatorProfile,
      instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([
      ctx.creatorAuthPreInstruction(creator.publicKey, handle, signerOverride),
    ])
    .signers([creator])
    .rpc();
};

describe("streampump-core creator registration authorization", function () {
  this.timeout(180_000);

  let ctx: TestContext;

  before(async () => {
    ctx = await getTestContext();
  });

  it("rejects register_creator when the Ed25519 authorization is not signed by oracle_authority", async () => {
    const creator = Keypair.generate();
    const wrongOperator = Keypair.generate();
    await fundSigner(ctx, creator);
    const handle = `bad_auth_${creator.publicKey.toBase58().slice(0, 8)}`;

    await ctx.expectAnchorError(
      () => registerCreator(ctx, creator, handle, wrongOperator),
      "InvalidCreatorSignature"
    );
  });

  it("accepts register_creator with an oracle-signed Ed25519 authorization", async () => {
    const creator = Keypair.generate();
    await fundSigner(ctx, creator);
    const handle = `Ok_Auth_${creator.publicKey.toBase58().slice(0, 8)}`;

    await registerCreator(ctx, creator, handle);

    const creatorProfile = ctx.deriveCreatorProfile(creator.publicKey);
    const profile = await ctx.program.account.creatorProfile.fetch(creatorProfile);
    expect(profile.authority.toBase58()).to.equal(creator.publicKey.toBase58());
    expect(profile.handle).to.equal(handle.toLowerCase());
  });
});
