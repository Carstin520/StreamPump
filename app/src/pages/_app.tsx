import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { Fragment } from "react";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@/styles/globals.css";

const ClientProviders = dynamic(
  () => import("@/components/Wallet/ClientProviders").then((mod) => mod.ClientProviders),
  { ssr: false }
);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Fragment>
      <ClientProviders>
        <Component {...pageProps} />
      </ClientProviders>
    </Fragment>
  );
}
