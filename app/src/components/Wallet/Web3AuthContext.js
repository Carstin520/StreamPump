"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWeb3Auth = exports.Web3AuthProvider = void 0;
const base_1 = require("@web3auth/base");
const modal_1 = require("@web3auth/modal");
const solana_provider_1 = require("@web3auth/solana-provider");
const react_1 = require("react");
const fallbackContextValue = {
    provider: null,
    isReady: false,
    connect: async () => undefined,
    disconnect: async () => undefined,
};
const Web3AuthContext = (0, react_1.createContext)(fallbackContextValue);
const Web3AuthProvider = ({ children }) => {
    const [web3auth, setWeb3Auth] = (0, react_1.useState)(null);
    const [provider, setProvider] = (0, react_1.useState)(null);
    const [isReady, setIsReady] = (0, react_1.useState)(false);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        const init = async () => {
            const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;
            const rpcTarget = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
            if (!clientId || !rpcTarget) {
                setIsReady(false);
                return;
            }
            const privateKeyProvider = new solana_provider_1.SolanaPrivateKeyProvider({
                config: {
                    chainConfig: {
                        chainNamespace: base_1.CHAIN_NAMESPACES.SOLANA,
                        chainId: "0x3",
                        rpcTarget,
                        displayName: "Solana Devnet",
                        ticker: "SOL",
                        tickerName: "Solana",
                    },
                },
            });
            const instance = new modal_1.Web3Auth({
                clientId,
                web3AuthNetwork: base_1.WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
                privateKeyProvider,
                chainConfig: {
                    chainNamespace: base_1.CHAIN_NAMESPACES.SOLANA,
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
    const value = (0, react_1.useMemo)(() => ({
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
    }), [isReady, provider, web3auth]);
    return <Web3AuthContext.Provider value={value}>{children}</Web3AuthContext.Provider>;
};
exports.Web3AuthProvider = Web3AuthProvider;
const useWeb3Auth = () => {
    return (0, react_1.useContext)(Web3AuthContext);
};
exports.useWeb3Auth = useWeb3Auth;
