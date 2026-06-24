import { SparklineChart } from "@/components/shared/SparklineChart";

export const MomentumLine = ({
  points,
  height = 52,
  caption,
  className = "",
}: {
  points: number[];
  height?: number;
  caption?: string;
  className?: string;
}) => {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <SparklineChart
        color="var(--momentum-line)"
        fillColor="color-mix(in srgb, var(--momentum-line) 12%, transparent)"
        height={height}
        points={points}
      />
      {caption !== undefined && (
        <p className="text-[length:var(--fs-caption)] text-[color:var(--text-faint)]">{caption}</p>
      )}
    </div>
  );
};
