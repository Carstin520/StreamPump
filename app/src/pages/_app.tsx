import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { Fragment, useEffect } from "react";

import { AppBootGate } from "@/components/layout/AppBootGate";
import { I18nProvider } from "@/lib/i18n";

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

function FoucRecoveryGuard() {
  useEffect(() => {
    document.querySelectorAll("style[data-next-hide-fouc]").forEach((node) => node.remove());
    document.body.style.removeProperty("display");
  }, []);

  return null;
}

export default function App({ Component, pageProps }: StreamPumpAppProps) {
  const page = <Component {...pageProps} />;

  return (
    <Fragment>
      <FoucRecoveryGuard />
      <I18nProvider>
        <AppBootGate>
          {Component.requiresWalletProviders ? (
            <ClientProviders>{page}</ClientProviders>
          ) : (
            page
          )}
        </AppBootGate>
      </I18nProvider>
    </Fragment>
  );
}
