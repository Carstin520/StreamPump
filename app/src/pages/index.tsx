import Head from "next/head";
import { Dashboard } from "@/components/Dashboard";
import { VideoPlayer } from "@/components/VideoPlayer";
import { WalletPanel } from "@/components/Wallet";

export default function HomePage() {
  return (
    <>
      <Head>
        <title>StreamPump</title>
      </Head>
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.3em] text-ink/70">Solana Creator Economy</p>
          <h1 className="text-4xl font-bold tracking-tight">StreamPump</h1>
          <p className="max-w-2xl text-sm text-ink/80">
            Web 2.5 creator incubation with sponsor-funded proposals, SPUMP endorsement staking,
            and oracle-settled USDC/SPUMP payouts.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-[1fr_340px]">
          <div className="space-y-6">
            <VideoPlayer />
            <Dashboard />
          </div>
          <WalletPanel />
        </div>
      </main>
    </>
  );
}
