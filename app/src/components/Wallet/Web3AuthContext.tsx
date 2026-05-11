import type { IProvider } from "@web3auth/base";
import type { Web3Auth } from "@web3auth/modal";
import {
  FC,
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

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

const createWeb3AuthInstance = async (): Promise<Web3Auth> => {
  const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
  const rpcTarget = process.env.NEXT_PUBLIC_RPC_ENDPOINT;

  if (!clientId || !rpcTarget) {
    throw new Error("Web3Auth requires NEXT_PUBLIC_WEB3AUTH_CLIENT_ID and NEXT_PUBLIC_RPC_ENDPOINT.");
  }

  const [{ CHAIN_NAMESPACES, WEB3AUTH_NETWORK }, { Web3Auth }, { SolanaPrivateKeyProvider }] =
    await Promise.all([
      import("@web3auth/base"),
      import("@web3auth/modal"),
      import("@web3auth/solana-provider"),
    ]);

  const chainConfig = {
    chainNamespace: CHAIN_NAMESPACES.SOLANA,
    chainId: "0x3",
    rpcTarget,
    displayName: "Solana Devnet",
    ticker: "SOL",
    tickerName: "Solana",
  };

  const privateKeyProvider = new SolanaPrivateKeyProvider({
    config: {
      chainConfig,
    },
  });

  const instance = new Web3Auth({
    clientId,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
    privateKeyProvider,
    chainConfig,
  });

  await instance.initModal();
  return instance;
};

export const Web3AuthProvider: FC<Web3AuthProviderProps> = ({ children }) => {
  const [provider, setProvider] = useState<IProvider | null>(null);
  const web3authRef = useRef<Web3Auth | null>(null);
  const initPromiseRef = useRef<Promise<Web3Auth> | null>(null);
  const isConfigured = Boolean(
    process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID && process.env.NEXT_PUBLIC_RPC_ENDPOINT
  );

  const getWeb3Auth = useCallback(async () => {
    if (web3authRef.current) {
      return web3authRef.current;
    }

    if (!initPromiseRef.current) {
      initPromiseRef.current = createWeb3AuthInstance().catch((error) => {
        initPromiseRef.current = null;
        throw error;
      });
    }

    const instance = await initPromiseRef.current;
    web3authRef.current = instance;
    setProvider(instance.provider);
    return instance;
  }, []);

  const value = useMemo<Web3AuthContextValue>(
    () => ({
      provider,
      isReady: isConfigured,
      connect: async () => {
        if (!isConfigured) {
          return;
        }
        const web3auth = await getWeb3Auth();
        const nextProvider = await web3auth.connect();
        setProvider(nextProvider);
      },
      disconnect: async () => {
        const web3auth = web3authRef.current;
        if (!web3auth) {
          return;
        }
        await web3auth.logout();
        setProvider(null);
      },
    }),
    [getWeb3Auth, isConfigured, provider]
  );

  return <Web3AuthContext.Provider value={value}>{children}</Web3AuthContext.Provider>;
};

export const useWeb3Auth = (): Web3AuthContextValue => {
  return useContext(Web3AuthContext);
};
