const BACKDROP_COLUMNS = [
  [240, 160, 220, 180],
  [180, 260, 150, 210],
  [220, 170, 240, 160],
];

export const AnimatedFeedBackdrop = ({
  className = "",
}: {
  className?: string;
}) => (
  <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(74,103,168,0.12),transparent_22%),radial-gradient(circle_at_82%_10%,rgba(222,64,42,0.08),transparent_16%),radial-gradient(circle_at_50%_100%,rgba(60,92,149,0.08),transparent_24%)]" />
    <div className="absolute inset-[6%] grid grid-cols-3 gap-5 opacity-[0.34]">
      {BACKDROP_COLUMNS.map((column, columnIndex) => (
        <div
          className={`feed-backdrop-column gap-5 ${columnIndex % 2 === 0 ? "feed-backdrop-column-a" : "feed-backdrop-column-b"}`}
          key={`column-${columnIndex}`}
        >
          {column.map((height, cardIndex) => (
            <div
              className="feed-backdrop-card rounded-[28px] border border-white/[0.05] bg-[linear-gradient(180deg,rgba(18,24,37,0.78)_0%,rgba(10,14,22,0.62)_100%)] px-5 py-5 shadow-[0_22px_64px_rgba(0,0,0,0.12)]"
              key={`card-${columnIndex}-${cardIndex}`}
              style={{ height }}
            >
              <div className="feed-backdrop-line w-20 rounded-full" />
              <div className="mt-6 space-y-3">
                <div className="feed-backdrop-line h-4 w-full rounded-full" />
                <div className="feed-backdrop-line h-4 w-[86%] rounded-full" />
                <div className="feed-backdrop-line h-4 w-[68%] rounded-full" />
              </div>
              <div className="mt-6 grid grid-cols-3 gap-3">
                <div className="feed-backdrop-pill h-8 rounded-full" />
                <div className="feed-backdrop-pill h-8 rounded-full" />
                <div className="feed-backdrop-pill h-8 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  </div>
);
