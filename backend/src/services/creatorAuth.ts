/**
 * CN: 创作者链上注册授权签名服务，签发 register_creator 前置 Ed25519 验签消息。
 * EN: Creator registration authorization service that signs the Ed25519 pre-instruction message.
 */
import { randomBytes } from "crypto";

import { ed25519 } from "@noble/curves/ed25519";
import { PublicKey } from "@solana/web3.js";

import { config } from "../../config/default";
import { getAnchorService } from "./AnchorService";

const CREATOR_AUTH_DOMAIN = Buffer.from("streampump:creator-register:v1", "utf8");

export type CreatorAuthVerificationMode = "TWITTER_OAUTH" | "PREVIEW_HANDLE";

type TwitterUserMeResponse = {
  data?: {
    id?: string;
    username?: string;
    name?: string;
  };
  errors?: unknown;
};

const normalizeTwitterHandle = (handle: string): string => {
  const normalized = handle.trim().replace(/^@+/, "").toLowerCase();
  if (!/^[a-z0-9_]{1,15}$/.test(normalized)) {
    throw new Error("twitterHandle must be a valid X/Twitter username");
  }

  return normalized;
};

const verifyTwitterAccessToken = async (
  twitterAccessToken: string,
  expectedHandle?: string | null
): Promise<{ handle: string; subject: string; displayName: string | null }> => {
  const response = await fetch("https://api.twitter.com/2/users/me?user.fields=username", {
    headers: {
      Authorization: `Bearer ${twitterAccessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`twitter token verification failed (${response.status})`);
  }

  const payload = (await response.json()) as TwitterUserMeResponse;
  const username = normalizeTwitterHandle(payload.data?.username ?? "");
  const expected = expectedHandle ? normalizeTwitterHandle(expectedHandle) : null;

  if (expected && expected !== username) {
    throw new Error("twitterHandle does not match verified Twitter account");
  }

  return {
    handle: username,
    subject: String(payload.data?.id ?? username),
    displayName: payload.data?.name ?? null,
  };
};

export const buildCreatorAuthMessage = (params: {
  creatorWallet: string;
  twitterHandle: string;
  nonce: Uint8Array;
  timestampUnix: number;
}): Buffer => {
  const creator = new PublicKey(params.creatorWallet);
  const handleBytes = Buffer.from(normalizeTwitterHandle(params.twitterHandle), "utf8");
  const handleLength = Buffer.alloc(2);
  const timestamp = Buffer.alloc(8);

  handleLength.writeUInt16LE(handleBytes.length, 0);
  timestamp.writeBigInt64LE(BigInt(params.timestampUnix), 0);

  return Buffer.concat([
    CREATOR_AUTH_DOMAIN,
    creator.toBuffer(),
    handleLength,
    handleBytes,
    Buffer.from(params.nonce),
    timestamp,
  ]);
};

export const issueCreatorAuthSignature = async (params: {
  creatorWallet: string;
  twitterHandle?: string | null;
  twitterAccessToken?: string | null;
}) => {
  const creatorWallet = new PublicKey(params.creatorWallet).toBase58();
  const token = params.twitterAccessToken?.trim();
  let verified:
    | {
        handle: string;
        subject: string | null;
        displayName: string | null;
        mode: CreatorAuthVerificationMode;
      }
    | null = null;

  if (token) {
    const twitter = await verifyTwitterAccessToken(token, params.twitterHandle);
    verified = {
      ...twitter,
      mode: "TWITTER_OAUTH",
    };
  } else {
    if (!config.auth.creatorAuthAllowPreviewTwitter) {
      throw new Error("twitterAccessToken is required for creator authorization");
    }

    const handle = normalizeTwitterHandle(params.twitterHandle ?? "");
    verified = {
      handle,
      subject: null,
      displayName: null,
      mode: "PREVIEW_HANDLE",
    };
  }

  const nonce = randomBytes(32);
  const timestampUnix = Math.floor(Date.now() / 1000);
  const message = buildCreatorAuthMessage({
    creatorWallet,
    twitterHandle: verified.handle,
    nonce,
    timestampUnix,
  });
  const oracle = getAnchorService().oracleAuthority;
  const signature = ed25519.sign(message, oracle.secretKey.slice(0, 32));

  return {
    creatorWallet,
    handle: verified.handle,
    twitterSubject: verified.subject,
    displayName: verified.displayName,
    nonceHex: Buffer.from(nonce).toString("hex"),
    timestampUnix,
    messageBase64: message.toString("base64"),
    signatureBase64: Buffer.from(signature).toString("base64"),
    oracleAuthority: oracle.publicKey.toBase58(),
    verificationMode: verified.mode,
    expiresAt: new Date((timestampUnix + 10 * 60) * 1000).toISOString(),
  };
};
