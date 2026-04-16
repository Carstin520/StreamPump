"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletContextProvider = void 0;
const react_1 = require("react");
const wallet_adapter_react_1 = require("@solana/wallet-adapter-react");
const wallet_adapter_react_ui_1 = require("@solana/wallet-adapter-react-ui");
const wallet_adapter_wallets_1 = require("@solana/wallet-adapter-wallets");
const web3_js_1 = require("@solana/web3.js");
const WalletContextProvider = ({ children }) => {
    const endpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT ?? (0, web3_js_1.clusterApiUrl)("devnet");
    const SafeConnectionProvider = wallet_adapter_react_1.ConnectionProvider;
    const SafeWalletProvider = wallet_adapter_react_1.WalletProvider;
    const SafeWalletModalProvider = wallet_adapter_react_ui_1.WalletModalProvider;
    const wallets = (0, react_1.useMemo)(() => [new wallet_adapter_wallets_1.PhantomWalletAdapter(), new wallet_adapter_wallets_1.SolflareWalletAdapter()], []);
    return (<SafeConnectionProvider endpoint={endpoint}>
      <SafeWalletProvider autoConnect wallets={wallets}>
        <SafeWalletModalProvider>{children}</SafeWalletModalProvider>
      </SafeWalletProvider>
    </SafeConnectionProvider>);
};
exports.WalletContextProvider = WalletContextProvider;
