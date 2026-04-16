"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = App;
const react_1 = require("react");
const ClientProviders_1 = require("@/components/Wallet/ClientProviders");
const AppLoadingOverlay_1 = require("@/components/shared/AppLoadingOverlay");
require("@solana/wallet-adapter-react-ui/styles.css");
require("@/styles/globals.css");
function App({ Component, pageProps }) {
    return (<react_1.Fragment>
      <ClientProviders_1.ClientProviders>
        <AppLoadingOverlay_1.AppLoadingOverlay />
        <Component {...pageProps}/>
      </ClientProviders_1.ClientProviders>
    </react_1.Fragment>);
}
