type SparklineChartProps = {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  className?: string;
};

const getExtents = (points: number[]) => {
  const min = Math.min(...points);
  const max = Math.max(...points);

  if (min === max) {
    return { min: min - 1, max: max + 1 };
  }

  return { min, max };
};

export const SparklineChart = ({
  points,
  width = 140,
  height = 52,
  color = "#65ecaf",
  fillColor = "rgba(101,236,175,0.12)",
  strokeWidth = 2,
  className = "",
}: SparklineChartProps) => {
  if (!points.length) {
    return null;
  }

  const { min, max } = getExtents(points);
  const step = points.length > 1 ? width / (points.length - 1) : width;

  const coordinates = points.map((point, index) => {
    const x = index * step;
    const normalized = (point - min) / (max - min);
    const y = height - normalized * height;
    return { x, y };
  });

  const linePath = coordinates
    .map((coordinate, index) => `${index === 0 ? "M" : "L"} ${coordinate.x.toFixed(2)} ${coordinate.y.toFixed(2)}`)
    .join(" ");
  const areaPath = `${linePath} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg
      className={className}
      fill="none"
      height={height}
      role="presentation"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
    >
      <path d={areaPath} fill={fillColor} />
      <path d={linePath} stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} />
    </svg>
  );
};
