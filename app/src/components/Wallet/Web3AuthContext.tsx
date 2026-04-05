import {
  CHAIN_NAMESPACES,
  IProvider,
  WEB3AUTH_NETWORK,
} from "@web3auth/base";
import { Web3Auth } from "@web3auth/modal";
import { SolanaPrivateKeyProvider } from "@web3auth/solana-provider";
import { FC, ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";

interface Web3AuthContextValue {
  provider: IProvider | null;
  isReady: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
}

const fallbackContextValue: Web3AuthContextValue = {
  provider: null,
  isReady: false,
  connect: async () => undefined,
  disconnect: async () => undefined,
};

const Web3AuthContext = createContext<Web3AuthContextValue>(fallbackContextValue);

interface Web3AuthProviderProps {
  children: ReactNode;
}

export const Web3AuthProvider: FC<Web3AuthProviderProps> = ({ children }) => {
  const [web3auth, setWeb3Auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
      const rpcTarget = process.env.NEXT_PUBLIC_RPC_ENDPOINT;

      if (!clientId || !rpcTarget) {
        setIsReady(false);
        return;
      }

      const privateKeyProvider = new SolanaPrivateKeyProvider({
        config: {
          chainConfig: {
            chainNamespace: CHAIN_NAMESPACES.SOLANA,
            chainId: "0x3",
            rpcTarget,
            displayName: "Solana Devnet",
            ticker: "SOL",
            tickerName: "Solana",
          },
        },
      });

      const instance = new Web3Auth({
        clientId,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        privateKeyProvider,
        chainConfig: {
          chainNamespace: CHAIN_NAMESPACES.SOLANA,
          chainId: "0x3",
          rpcTarget,
          displayName: "Solana Devnet",
          ticker: "SOL",
          tickerName: "Solana",
        },
      });

      await instance.initModal();
      if (cancelled) {
        return;
      }

      setProvider(instance.provider);
      setWeb3Auth(instance);
      setIsReady(true);
    };

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<Web3AuthContextValue>(
    () => ({
      provider,
      isReady,
      connect: async () => {
        if (!web3auth) {
          return;
        }
        const nextProvider = await web3auth.connect();
        setProvider(nextProvider);
      },
      disconnect: async () => {
        if (!web3auth) {
          return;
        }
        await web3auth.logout();
        setProvider(null);
      },
    }),
    [isReady, provider, web3auth]
  );

  return <Web3AuthContext.Provider value={value}>{children}</Web3AuthContext.Provider>;
};

export const useWeb3Auth = (): Web3AuthContextValue => {
  return useContext(Web3AuthContext);
};
