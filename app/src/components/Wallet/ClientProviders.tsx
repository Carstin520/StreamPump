import { ReactNode } from "react";

import { WalletContextProvider } from "./WalletContextProvider";
import { Web3AuthProvider } from "./Web3AuthContext";

export const ClientProviders = ({ children }: { children: ReactNode }) => (
  <Web3AuthProvider>
    <WalletContextProvider>{children}</WalletContextProvider>
  </Web3AuthProvider>
);
