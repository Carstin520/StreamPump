import { AnchorProvider, Idl, Program } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useMemo } from "react";

const PROGRAM_ID = new PublicKey("EV2frDqtvTfmshXxsNipDSEANWeZxzHEazzDu51rDzre");

export const useProgram = (idl?: Idl) => {
  const { connection } = useConnection();
  const wallet = useWallet();

  return useMemo(() => {
    if (!idl || !wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      return null;
    }

    const provider = new AnchorProvider(connection, wallet as never, {
      commitment: "confirmed",
    });

    return new Program(idl, PROGRAM_ID, provider);
  }, [connection, idl, wallet]);
};
