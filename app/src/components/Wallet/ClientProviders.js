"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientProviders = void 0;
const WalletContextProvider_1 = require("./WalletContextProvider");
const Web3AuthContext_1 = require("./Web3AuthContext");
const ClientProviders = ({ children }) => (<Web3AuthContext_1.Web3AuthProvider>
    <WalletContextProvider_1.WalletContextProvider>{children}</WalletContextProvider_1.WalletContextProvider>
  </Web3AuthContext_1.Web3AuthProvider>);
exports.ClientProviders = ClientProviders;
