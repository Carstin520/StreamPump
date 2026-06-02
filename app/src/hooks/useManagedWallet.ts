import { getStoredAuthSession } from "@/lib/auth-session";

export const useManagedWallet = () => {
  const session = getStoredAuthSession();
  const isManagedWallet =
    Boolean(session?.identity?.managedWalletAddress) &&
    session?.wallet === session?.identity?.managedWalletAddress;

  return {
    isManagedWallet,
    walletAddress: session?.wallet ?? null,
  };
};
