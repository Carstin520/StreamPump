import type { AppProps } from "next/app";
import { Fragment } from "react";

import { AppLoadingOverlay } from "@/components/shared/AppLoadingOverlay";
import "@/styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Fragment>
      <AppLoadingOverlay />
      <Component {...pageProps} />
    </Fragment>
  );
}
