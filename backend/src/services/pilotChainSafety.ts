import { Connection, PublicKey } from "@solana/web3.js";

import { type config } from "../../config/default";
import { getAnchorService } from "./AnchorService";

export const SOLANA_DEVNET_GENESIS_HASH =
  "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

type RuntimeConfig = typeof config;

export interface PilotChainSafetyDependencies {
  getGenesisHash(endpoint: string, timeoutMs: number): Promise<string>;
  getProgramAccountInfo(
    endpoint: string,
    programId: string,
    timeoutMs: number
  ): Promise<{ executable: boolean } | null>;
  fetchProtocolUsdcMint(timeoutMs: number): Promise<string>;
}

export const withPilotChainTimeout = async <T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> => {
  let timeout: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timeout = setTimeout(() => reject(new Error("chain preflight timed out")), timeoutMs);
  });

  try {
    return await Promise.race([operation, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
};

export const defaultPilotChainSafetyDependencies: PilotChainSafetyDependencies = {
  async getGenesisHash(endpoint, timeoutMs) {
    const connection = new Connection(endpoint, "confirmed");
    return withPilotChainTimeout(connection.getGenesisHash(), timeoutMs);
  },

  async getProgramAccountInfo(endpoint, programId, timeoutMs) {
    const connection = new Connection(endpoint, "confirmed");
    const account = await withPilotChainTimeout(
      connection.getAccountInfo(new PublicKey(programId), "confirmed"),
      timeoutMs
    );
    return account ? { executable: account.executable } : null;
  },

  async fetchProtocolUsdcMint(timeoutMs) {
    const account = await withPilotChainTimeout(
      getAnchorService().fetchProtocolConfigAccount(),
      timeoutMs
    );
    return new PublicKey(account.usdcMint).toBase58();
  },
};

const preflightError = (reason: string): Error =>
  new Error(`Pilot chain safety preflight failed: ${reason}`);

/**
 * Refuse to expose the production HTTP listener until every active RPC and the
 * deployed protocol state have been checked against the Pilot chain contract.
 * Dependency errors are deliberately replaced so credentials embedded in RPC
 * URLs cannot escape into startup logs.
 */
export const assertProductionPilotChainSafety = async (
  runtimeConfig: RuntimeConfig,
  dependencies: PilotChainSafetyDependencies = defaultPilotChainSafetyDependencies,
  nodeEnv: string | undefined = process.env.NODE_ENV
): Promise<void> => {
  if (nodeEnv !== "production") {
    return;
  }

  const timeoutMs = runtimeConfig.pilot.chainPreflightTimeoutMs;
  const endpointRoles = new Map<string, string[]>();
  const addEndpoint = (endpoint: string, role: string) => {
    const roles = endpointRoles.get(endpoint) ?? [];
    roles.push(role);
    endpointRoles.set(endpoint, roles);
  };

  addEndpoint(runtimeConfig.solana.rpcEndpoint, "primary");
  addEndpoint(runtimeConfig.solana.txRpcEndpoint, "transaction");
  if (runtimeConfig.indexer.enabled) {
    addEndpoint(runtimeConfig.solana.indexerRpcEndpoint, "indexer");
  }

  await Promise.all(
    [...endpointRoles.entries()].map(async ([endpoint, roles]) => {
      let genesisHash: string;
      try {
        genesisHash = await dependencies.getGenesisHash(endpoint, timeoutMs);
      } catch (_error) {
        throw preflightError(`could not verify ${roles.join("/")} RPC cluster identity`);
      }

      if (genesisHash !== SOLANA_DEVNET_GENESIS_HASH) {
        throw preflightError(`${roles.join("/")} RPC is not Solana devnet`);
      }
    })
  );

  let programAccount: { executable: boolean } | null;
  try {
    programAccount = await dependencies.getProgramAccountInfo(
      runtimeConfig.solana.txRpcEndpoint,
      runtimeConfig.solana.programId,
      timeoutMs
    );
  } catch (_error) {
    throw preflightError("could not verify the configured program deployment");
  }

  if (!programAccount) {
    throw preflightError("configured program is not deployed on the transaction RPC");
  }
  if (!programAccount.executable) {
    throw preflightError("configured program account is not executable");
  }

  let actualUsdcMint: string;
  try {
    actualUsdcMint = new PublicKey(
      await dependencies.fetchProtocolUsdcMint(timeoutMs)
    ).toBase58();
  } catch (_error) {
    throw preflightError("could not read the on-chain protocol USDC mint");
  }

  if (actualUsdcMint !== runtimeConfig.pilot.expectedUsdcMint) {
    throw preflightError("on-chain protocol USDC mint does not match PILOT_EXPECTED_USDC_MINT");
  }
};
