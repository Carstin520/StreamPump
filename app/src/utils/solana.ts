import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

export const STREAMPUMP_PROGRAM_ID = new PublicKey(
  "FYphzoVLs1MB7aqHbGeT2DjqwTz1d6yyhtKXzvmjiDmp"
);

export const getConnection = () =>
  new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? clusterApiUrl("devnet"), "confirmed");
