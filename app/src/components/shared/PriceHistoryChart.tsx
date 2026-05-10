import { useId, useMemo, useState, type PointerEvent } from "react";

import type { PriceHistoryPoint, PriceHistoryRange } from "@/lib/price-history";

type PriceHistoryChartProps = {
  points: PriceHistoryPoint[];
  currencyLabel: string;
  defaultRange?: PriceHistoryRange;
  height?: number;
  className?: string;
};

type ChartPoint = PriceHistoryPoint & {
  time: number;
  x: number;
  y: number;
};

const RANGES: PriceHistoryRange[] = ["1D", "1W", "1M", "1Y", "ALL"];
const RANGE_MS: Record<Exclude<PriceHistoryRange, "ALL">, number> = {
  "1D": 24 * 60 * 60 * 1000,
  "1W": 7 * 24 * 60 * 60 * 1000,
  "1M": 30 * 24 * 60 * 60 * 1000,
  "1Y": 365 * 24 * 60 * 60 * 1000,
};
const WIDTH = 760;
const PAD = { top: 18, right: 58, bottom: 32, left: 18 } as const;

const formatPrice = (value: number, currencyLabel: string) => {
  const digits = value >= 100 ? 2 : value >= 10 ? 3 : 4;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
    minimumFractionDigits: value >= 100 ? 0 : 2,
  }).format(value)} ${currencyLabel}`;
};

const formatAxisPrice = (value: number) =>
  new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 100 ? 0 : value >= 10 ? 1 : 2,
  }).format(value);

const formatTime = (timestamp: string, range: PriceHistoryRange) => {
  const date = new Date(timestamp);
  if (range === "1D") {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(date);
  }
  if (range === "1W" || range === "1M") {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "2-digit" }).format(date);
};

const buildSmoothPath = (points: ChartPoint[]) => {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    }

    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) * 0.5;
    return `${path} C ${controlX.toFixed(2)} ${previous.y.toFixed(2)}, ${controlX.toFixed(2)} ${point.y.toFixed(2)}, ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }, "");
};

const getVisiblePoints = (points: PriceHistoryPoint[], range: PriceHistoryRange) => {
  const sorted = points
    .map((point) => ({ ...point, time: new Date(point.timestamp).getTime() }))
    .filter((point) => Number.isFinite(point.time) && Number.isFinite(point.price) && point.price > 0)
    .sort((a, b) => a.time - b.time);

  if (range === "ALL" || sorted.length < 2) {
    return sorted;
  }

  const end = sorted[sorted.length - 1].time;
  const start = end - RANGE_MS[range];
  const filtered = sorted.filter((point) => point.time >= start);
  return filtered.length >= 2 ? filtered : sorted.slice(-2);
};

const getAxisTicks = (min: number, max: number) => {
  if (min === max) {
    return [min];
  }
  return [max, min + (max - min) / 2, min];
};

export const PriceHistoryChart = ({
  points,
  currencyLabel,
  defaultRange = "1M",
  height = 260,
  className = "",
}: PriceHistoryChartProps) => {
  const gradientId = useId().replace(/:/g, "");
  const [range, setRange] = useState<PriceHistoryRange>(defaultRange);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const chart = useMemo(() => {
    const visible = getVisiblePoints(points, range);
    const safeVisible = visible.length
      ? visible
      : [
          {
            timestamp: new Date(0).toISOString(),
            price: 1,
            time: 0,
          },
        ];
    const minTime = safeVisible[0].time;
    const maxTime = safeVisible[safeVisible.length - 1].time;
    const prices = safeVisible.map((point) => point.price);
    const rawMin = Math.min(...prices);
    const rawMax = Math.max(...prices);
    const priceSpan = rawMax - rawMin || Math.max(rawMax * 0.08, 1);
    const minPrice = Math.max(0, rawMin - priceSpan * 0.1);
    const maxPrice = rawMax + priceSpan * 0.1;
    const chartWidth = WIDTH - PAD.left - PAD.right;
    const chartHeight = height - PAD.top - PAD.bottom;
    const timeSpan = maxTime - minTime || 1;
    const valueSpan = maxPrice - minPrice || 1;
    const coordinates: ChartPoint[] = safeVisible.map((point, index) => ({
      ...point,
      x: safeVisible.length === 1 ? PAD.left + chartWidth / 2 : PAD.left + ((point.time - minTime) / timeSpan) * chartWidth,
      y: PAD.top + ((maxPrice - point.price) / valueSpan) * chartHeight,
      timestamp: point.timestamp || new Date(point.time || index).toISOString(),
    }));
    const path = buildSmoothPath(coordinates);
    const areaPath = coordinates.length
      ? `${path} L ${coordinates[coordinates.length - 1].x.toFixed(2)} ${height - PAD.bottom} L ${coordinates[0].x.toFixed(2)} ${height - PAD.bottom} Z`
      : "";
    const trendUp = coordinates[coordinates.length - 1]?.price >= coordinates[0]?.price;

    return {
      areaPath,
      coordinates,
      linePath: path,
      maxPrice,
      minPrice,
      trendUp,
      xTicks: [coordinates[0], coordinates[Math.floor(coordinates.length / 2)], coordinates[coordinates.length - 1]].filter(Boolean),
      yTicks: getAxisTicks(minPrice, maxPrice),
    };
  }, [height, points, range]);

  const activePoint = hoverIndex === null ? chart.coordinates[chart.coordinates.length - 1] : chart.coordinates[hoverIndex];

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeX = ((event.clientX - rect.left) / rect.width) * WIDTH;
    let nearest = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    chart.coordinates.forEach((point, index) => {
      const distance = Math.abs(point.x - relativeX);
      if (distance < nearestDistance) {
        nearest = index;
        nearestDistance = distance;
      }
    });
    setHoverIndex(nearest);
  };

  const resetHover = () => setHoverIndex(null);

  const tooltipStyle = activePoint
    ? {
        left: `${(activePoint.x / WIDTH) * 100}%`,
        top: `${Math.max(0, Math.min(78, (activePoint.y / height) * 100 - 18))}%`,
        transform: activePoint.x > WIDTH * 0.72 ? "translate(-100%, -10px)" : "translate(10px, -10px)",
      }
    : undefined;

  return (
    <div className={`select-none ${className}`}>
      <div
        aria-label={`Price history chart, ${range}`}
        className="relative overflow-hidden rounded-[14px] border border-white/[0.05] bg-[radial-gradient(circle_at_28%_24%,rgba(222,64,42,0.08),transparent_54%),linear-gradient(180deg,#0d1320_0%,#090e17_100%)]"
        onPointerLeave={resetHover}
        onPointerMove={handlePointerMove}
        role="img"
      >
        <svg className="block w-full" fill="none" preserveAspectRatio="none" viewBox={`0 0 ${WIDTH} ${height}`}>
          <defs>
            <linearGradient id={`${gradientId}-priceHistoryLine`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor={chart.trendUp ? "#79b9ff" : "#f67263"} stopOpacity="0.72" />
              <stop offset="58%" stopColor="#ffb38a" stopOpacity="0.95" />
              <stop offset="100%" stopColor={chart.trendUp ? "#65ecaf" : "#de402a"} />
            </linearGradient>
            <linearGradient id={`${gradientId}-priceHistoryFill`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#de402a" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#de402a" stopOpacity="0" />
            </linearGradient>
          </defs>

          {chart.yTicks.map((tick) => {
            const y = PAD.top + ((chart.maxPrice - tick) / (chart.maxPrice - chart.minPrice || 1)) * (height - PAD.top - PAD.bottom);
            return (
              <g key={tick}>
                <line stroke="rgba(255,255,255,0.045)" strokeDasharray="4 7" x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} />
                <text fill="#5f7088" fontSize="10" textAnchor="start" x={WIDTH - PAD.right + 12} y={y + 3}>
                  {formatAxisPrice(tick)}
                </text>
              </g>
            );
          })}

          <path d={chart.areaPath} fill={`url(#${gradientId}-priceHistoryFill)`} />
          <path d={chart.linePath} stroke={`url(#${gradientId}-priceHistoryLine)`} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />

          {chart.xTicks.map((tick, index) => (
            <text
              fill="#5f7088"
              fontSize="10"
              key={`${tick.timestamp}-${index}`}
              textAnchor={index === 0 ? "start" : index === chart.xTicks.length - 1 ? "end" : "middle"}
              x={tick.x}
              y={height - 7}
            >
              {formatTime(tick.timestamp, range)}
            </text>
          ))}

          {activePoint ? (
            <g>
              <line stroke="rgba(255,255,255,0.18)" strokeDasharray="3 5" x1={activePoint.x} x2={activePoint.x} y1={PAD.top} y2={height - PAD.bottom} />
              <circle cx={activePoint.x} cy={activePoint.y} fill="#de402a" opacity="0.18" r="16" />
              <circle cx={activePoint.x} cy={activePoint.y} fill="#f7d2bf" r="5.5" />
              <circle cx={activePoint.x} cy={activePoint.y} fill="#de402a" r="3" />
            </g>
          ) : null}
        </svg>

        {activePoint ? (
          <div
            className="pointer-events-none absolute z-10 rounded-xl border border-white/10 bg-[#080d15]/90 px-3 py-2 shadow-[0_16px_36px_rgba(0,0,0,0.38)] backdrop-blur-md"
            style={tooltipStyle}
          >
            <p className="whitespace-nowrap text-xs font-semibold text-white">{formatPrice(activePoint.price, currencyLabel)}</p>
            <p className="mt-0.5 whitespace-nowrap text-[10px] text-[#8ea0ba]">{formatTime(activePoint.timestamp, range)}</p>
          </div>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
        {RANGES.map((option) => (
          <button
            aria-pressed={range === option}
            className={`h-8 min-w-12 rounded-full px-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
              range === option
                ? "bg-white text-[#090d14] shadow-[0_10px_24px_rgba(255,255,255,0.12)]"
                : "border border-white/[0.06] bg-white/[0.03] text-[#8ea0ba] hover:bg-white/[0.07] hover:text-white"
            }`}
            key={option}
            onClick={() => {
              setRange(option);
              setHoverIndex(null);
            }}
            type="button"
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
};
