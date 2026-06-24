import type { ReactNode } from "react";
import { TierBadge } from "@/components/shared/TierBadge";

type FreeTier = "free";
type PaidTier = "starter" | "growth" | "studio";
type AnyTier = FreeTier | PaidTier;

const TIER_ORDER: AnyTier[] = ["free", "starter", "growth", "studio"];

function tierRank(tier: AnyTier): number {
  return TIER_ORDER.indexOf(tier);
}

export const LockedPanel = ({
  requiredTier,
  currentTier,
  unlockLabel,
  onUnlock,
  children,
  className = "",
}: {
  requiredTier: PaidTier;
  currentTier: AnyTier;
  unlockLabel: string;
  onUnlock?: () => void;
  children: ReactNode;
  className?: string;
}) => {
  const isUnlocked = tierRank(currentTier) >= tierRank(requiredTier);

  if (isUnlocked) {
    return <>{children}</>;
  }

  return (
    <div className={`relative ${className}`}>
      {/* Render children behind the overlay so layout is preserved */}
      <div aria-hidden className="pointer-events-none select-none">
        {children}
      </div>

      {/* Frosted lock overlay */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)]"
        style={{
          backdropFilter: "blur(12px) saturate(120%)",
          background: "rgba(10,15,24,0.72)",
        }}
      >
        <span className="text-2xl" role="img" aria-label="locked">
          🔒
        </span>
        <TierBadge tier={requiredTier} />
        <button
          className="mt-1 rounded-full border border-[color:color-mix(in_srgb,var(--brand)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--brand)_16%,transparent)] px-4 py-1.5 text-[length:var(--fs-sm)] font-semibold text-[color:var(--brand)] transition-colors hover:bg-[color:color-mix(in_srgb,var(--brand)_24%,transparent)]"
          type="button"
          onClick={onUnlock}
        >
          {unlockLabel}
        </button>
      </div>
    </div>
  );
};
