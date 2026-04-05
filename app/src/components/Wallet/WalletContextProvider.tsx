import { FC, ReactNode, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

interface WalletContextProviderProps {
  children: ReactNode;
}

export const WalletContextProvider: FC<WalletContextProviderProps> = ({ children }) => {
  const endpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? clusterApiUrl("devnet");
  const SafeConnectionProvider = ConnectionProvider as unknown as FC<{
    endpoint: string;
    children: ReactNode;
  }>;
  const SafeWalletProvider = WalletProvider as unknown as FC<{
    wallets: unknown[];
    autoConnect?: boolean;
    children: ReactNode;
  }>;
  const SafeWalletModalProvider = WalletModalProvider as unknown as FC<{
    children: ReactNode;
  }>;

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <SafeConnectionProvider endpoint={endpoint}>
      <SafeWalletProvider autoConnect wallets={wallets}>
        <SafeWalletModalProvider>{children}</SafeWalletModalProvider>
      </SafeWalletProvider>
    </SafeConnectionProvider>
  );
};
