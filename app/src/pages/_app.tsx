import type { AppProps } from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import { Fragment, useEffect } from "react";

import { AppBootGate } from "@/components/layout/AppBootGate";
import { PilotClosedSurface } from "@/components/layout/PilotClosedSurface";
import { publicDemoEnabled } from "@/lib/feature-flags";
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

/**
 * P0 closed-lane guard. These routes expose on-chain fund actions and stay
 * closed while their financial/product gates remain in place. Matched against `router.pathname`
 * (the Pages Router route pattern, known synchronously on first render) so the
 * gated page component never mounts and none of its effects run. `publicDemoEnabled`
 * reopens them for explicitly-labeled demo builds. The read-only campaign
 * proof/detail route (`/campaigns/[proposalId]`) is intentionally NOT listed.
 */
const CLOSED_PILOT_ROUTES = new Set<string>([
  "/market/[creatorId]",
  "/buyout/[creatorId]",
  "/portfolio",
  "/rewards",
  "/campaigns/[proposalId]/endorse",
]);

function FoucRecoveryGuard() {
  useEffect(() => {
    document.querySelectorAll("style[data-next-hide-fouc]").forEach((node) => node.remove());
    document.body.style.removeProperty("display");
  }, []);

  return null;
}

export default function App({ Component, pageProps }: StreamPumpAppProps) {
  const router = useRouter();
  const pilotClosed =
    !publicDemoEnabled() && CLOSED_PILOT_ROUTES.has(router.pathname);

  // When a lane is closed, render the honest closed surface instead of the page.
  // The gated component (and its wallet providers/effects) never mounts.
  const page = pilotClosed ? <PilotClosedSurface /> : <Component {...pageProps} />;
  const needsWalletProviders = !pilotClosed && Component.requiresWalletProviders;

  return (
    <Fragment>
      <FoucRecoveryGuard />
      <I18nProvider>
        <AppBootGate>
          {needsWalletProviders ? (
            <ClientProviders>{page}</ClientProviders>
          ) : (
            page
          )}
        </AppBootGate>
      </I18nProvider>
    </Fragment>
  );
}
