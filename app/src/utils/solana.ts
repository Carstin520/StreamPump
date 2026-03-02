import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";

export const STREAMPUMP_PROGRAM_ID = new PublicKey(
  "7V3f6AQMtkP8dwF5EYici3QnqTPZqyVv5JBy6s2fBfZW"
);

export const getConnection = () =>
  new Connection(process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? clusterApiUrl("devnet"), "confirmed");
