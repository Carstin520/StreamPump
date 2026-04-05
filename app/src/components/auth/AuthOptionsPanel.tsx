import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { Panel } from "@/components/shared/Panel";
import { useWeb3Auth } from "@/components/Wallet/Web3AuthContext";

export const AuthOptionsPanel = () => {
  const { connect, disconnect, isReady, provider } = useWeb3Auth();

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Panel className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Primary path</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">Social sign-in + embedded wallet</h3>
          <p className="mt-2 text-sm text-slate-300">
            Users enter with Google, Apple, email, or passkey. Wallets stay behind the product surface unless the user asks for more control.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!isReady || Boolean(provider)}
            onClick={() => void connect()}
            type="button"
          >
            Continue with social login
          </button>
          <button
            className="rounded-full border border-white/12 px-4 py-2 text-sm text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!provider}
            onClick={() => void disconnect()}
            type="button"
          >
            End social session
          </button>
        </div>
        <p className="text-xs text-slate-400">
          Current scaffold still uses Web3Auth wiring as the temporary social login bridge for this preview build.
        </p>
      </Panel>

      <Panel className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Advanced path</p>
          <h3 className="mt-2 text-2xl font-semibold text-white">External wallet</h3>
          <p className="mt-2 text-sm text-slate-300">
            Power users can still connect Phantom or Solflare, sign launch bundles, and stay in full wallet-native control.
          </p>
        </div>
        <div className="max-w-xs">
          <WalletMultiButton />
        </div>
      </Panel>
    </div>
  );
};
