// Restrained ambient field: 3 orbs (was 6) for a calmer, more focused backdrop.
type OrbConfig = {
  className: string;
  size: number;
  top: string;
  left?: string;
  right?: string;
};

const ORB_CONFIG: readonly OrbConfig[] = [
  { className: "backdrop-orb-1", size: 700, left: "5%", top: "-5%" },
  { className: "backdrop-orb-3", size: 800, left: "30%", top: "35%" },
  { className: "backdrop-orb-5", size: 650, left: "8%", top: "72%" },
];

export const AnimatedFeedBackdrop = ({
  className = "",
}: {
  className?: string;
}) => (
  <div className={`pointer-events-none fixed inset-0 z-0 ${className}`}>
    <div className="backdrop-base absolute inset-0" />

    {ORB_CONFIG.map((orb, index) => (
      <div
        className={`backdrop-orb ${orb.className} absolute rounded-full`}
        key={`${orb.className}-${index}`}
        style={{
          width: orb.size,
          height: orb.size,
          left: orb.left,
          right: orb.right,
          top: orb.top,
        }}
      />
    ))}

    <div className="backdrop-mesh absolute inset-0" />
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_10%,rgba(255,255,255,0.03),transparent)]" />
  </div>
);
