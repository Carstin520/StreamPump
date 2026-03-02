import type { AppProps } from "next/app";
import "@solana/wallet-adapter-react-ui/styles.css";
import "@/styles/globals.css";
import { WalletContextProvider } from "@/components/Wallet/WalletContextProvider";
import { Web3AuthProvider } from "@/components/Wallet/Web3AuthContext";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Web3AuthProvider>
      <WalletContextProvider>
        <Component {...pageProps} />
      </WalletContextProvider>
    </Web3AuthProvider>
  );
}
