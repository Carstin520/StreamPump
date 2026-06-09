import crypto from "crypto";

import { config } from "../../config/default";

const ENCRYPTED_SECRET_MIN_LENGTH = 12 + 16 + 1;

const getEncryptionKey = (): Buffer => {
  const hex = config.managedWallet.encryptionKey.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("MANAGED_WALLET_ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }

  return Buffer.from(hex, "hex");
};

const toArrayBufferBytes = (value: Uint8Array): Uint8Array<ArrayBuffer> => {
  const copy = new Uint8Array(value.length);
  copy.set(value);
  return copy;
};

export const encryptSecretKey = (secretKey: Uint8Array): Uint8Array<ArrayBuffer> => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(secretKey), cipher.final()]);
  const tag = cipher.getAuthTag();

  return toArrayBufferBytes(Buffer.concat([iv, tag, encrypted]));
};

export const decryptSecretKey = (encryptedData: Uint8Array): Uint8Array => {
  const payload = Buffer.from(encryptedData);
  if (payload.length < ENCRYPTED_SECRET_MIN_LENGTH) {
    throw new Error("encrypted managed wallet secret is malformed");
  }

  const key = getEncryptionKey();
  const iv = payload.subarray(0, 12);
  const tag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  return new Uint8Array(Buffer.concat([decipher.update(encrypted), decipher.final()]));
};
