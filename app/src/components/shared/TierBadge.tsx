type Tier = "starter" | "growth" | "studio";

const tierToken: Record<Tier, string> = {
  starter: "var(--tier-starter)",
  growth: "var(--tier-growth)",
  studio: "var(--tier-studio)",
};

export const TierBadge = ({
  tier,
  className = "",
}: {
  tier: Tier;
  className?: string;
}) => {
  const token = tierToken[tier];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] ${className}`}
      style={{
        color: token,
        borderColor: `color-mix(in srgb, ${token} 34%, transparent)`,
        background: `color-mix(in srgb, ${token} 14%, transparent)`,
      }}
    >
      {tier}
    </span>
  );
};
