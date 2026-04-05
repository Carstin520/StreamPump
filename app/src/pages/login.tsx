import Head from "next/head";

import { AuthOptionsPanel } from "@/components/auth/AuthOptionsPanel";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/shared/Panel";

export default function LoginPage() {
  return (
    <>
      <Head>
        <title>StreamPump | Login</title>
      </Head>
      <AppShell
        subtitle="This preview keeps social login and wallet entry in the same place, but makes social + embedded wallet the default product story."
        title="Account access without forcing wallet-first UX"
      >
        <div className="space-y-5">
          <AuthOptionsPanel />
          <Panel className="grid gap-5 lg:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Phase 1 intent</p>
              <h3 className="mt-3 text-xl font-semibold text-white">Reduce onboarding intimidation</h3>
            </div>
            <p className="text-sm leading-7 text-slate-300 lg:col-span-2">
              The production direction is social login, managed or embedded wallet setup, and a StreamPump session that can later authorize S1 trades and S2 launch actions. External wallet connect remains available for power users and sign-heavy flows.
            </p>
          </Panel>
        </div>
      </AppShell>
    </>
  );
}
