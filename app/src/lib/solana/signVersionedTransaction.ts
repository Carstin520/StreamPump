import { VersionedTransaction } from "@solana/web3.js";

type VersionedTransactionSigner = {
  signTransaction?: (transaction: VersionedTransaction) => Promise<VersionedTransaction>;
};

export const decodeVersionedTransactionBase64 = (base64: string) => {
  const normalized = base64.trim();
  if (!normalized) {
    throw new Error("versioned transaction payload is required");
  }

  const bytes = Uint8Array.from(atob(normalized), (char) => char.charCodeAt(0));
  return VersionedTransaction.deserialize(bytes);
};

export const encodeVersionedTransactionBase64 = (transaction: VersionedTransaction) =>
  btoa(String.fromCharCode(...transaction.serialize()));

export const signVersionedTransactionBase64 = async (
  signer: VersionedTransactionSigner,
  base64: string,
) => {
  if (typeof signer.signTransaction !== "function") {
    throw new Error("connected wallet does not support transaction signing");
  }

  const transaction = decodeVersionedTransactionBase64(base64);
  const signed = await signer.signTransaction(transaction);

  return encodeVersionedTransactionBase64(signed);
};
