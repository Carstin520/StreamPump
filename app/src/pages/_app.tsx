import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { Fragment } from "react";

import { AppBootGate } from "@/components/layout/AppBootGate";

import "@solana/wallet-adapter-react-ui/styles.css";
import "@/styles/globals.css";

type StreamPumpPage = AppProps["Component"] & {
  requiresWalletProviders?: boolean;
};

type StreamPumpAppProps = AppProps & {
  Component: StreamPumpPage;
};

const ClientProviders = dynamic(
  () => import("@/components/Wallet/ClientProviders").then((mod) => mod.ClientProviders),
  { ssr: false }
);

export default function App({ Component, pageProps }: StreamPumpAppProps) {
  const page = <Component {...pageProps} />;

  return (
    <Fragment>
      <AppBootGate>
        {Component.requiresWalletProviders ? (
          <ClientProviders>{page}</ClientProviders>
        ) : (
          page
        )}
      </AppBootGate>
    </Fragment>
  );
}
