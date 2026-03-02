import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWeb3Auth } from "./Web3AuthContext";

export const WalletPanel = () => {
  const { provider, isReady, connect, disconnect } = useWeb3Auth();

  return (
    <div className="rounded-xl bg-white/80 p-4 shadow-md backdrop-blur-sm">
      <h2 className="mb-3 text-lg font-semibold">Wallet Access</h2>
      <div className="mb-3">
        <WalletMultiButton />
      </div>
      <div className="flex gap-2">
        <button
          className="rounded bg-ink px-3 py-2 text-sm font-medium text-surf disabled:opacity-60"
          disabled={!isReady || Boolean(provider)}
          onClick={() => void connect()}
          type="button"
        >
          Social Login
        </button>
        <button
          className="rounded bg-heat px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={!provider}
          onClick={() => void disconnect()}
          type="button"
        >
          Logout
        </button>
      </div>
      {!isReady && (
        <p className="mt-2 text-xs text-ink/70">
          Set NEXT_PUBLIC_WEB3AUTH_CLIENT_ID and NEXT_PUBLIC_RPC_ENDPOINT to enable social login.
        </p>
      )}
    </div>
  );
};
