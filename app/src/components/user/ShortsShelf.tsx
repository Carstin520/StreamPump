import { PostRecord } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n";
import { ProgressiveImage } from "@/components/shared/ProgressiveImage";
import { StagePill } from "@/components/shared/StagePill";

export const ShortsShelf = ({
  shorts,
  onOpenShort,
}: {
  shorts: PostRecord[];
  onOpenShort: (postId: string) => void;
}) => {
  const { t } = useI18n();

  if (shorts.length === 0) {
    return null;
  }

  return (
    <section
      className="mb-5 rounded-[18px] border border-white/[0.08] p-3.5"
      style={{
        background:
          "linear-gradient(160deg, color-mix(in srgb, var(--brand) 8%, transparent), color-mix(in srgb, #ffffff 2%, transparent))",
      }}
    >
      {/* Header */}
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-[15px]">▶</span>
        <span className="text-[length:var(--fs-body)] font-extrabold text-white">
          {t("feed.shortsTitle")}
        </span>
        <span className="text-[length:var(--fs-caption)] text-[color:var(--text-faint)]">
          {t("feed.shortsHint")}
        </span>
      </div>

      {/* Horizontal scroll row */}
      <div className="flex gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shorts.map((short) => (
          <ShortCard key={short.id} short={short} onOpen={onOpenShort} />
        ))}
      </div>
    </section>
  );
};

const ShortCard = ({
  short,
  onOpen,
}: {
  short: PostRecord;
  onOpen: (postId: string) => void;
}) => (
  <button
    aria-label={short.title}
    className="group relative h-[208px] w-[132px] shrink-0 cursor-pointer overflow-hidden rounded-[14px] border border-white/10 text-left transition-transform duration-150 hover:-translate-y-1"
    onClick={() => onOpen(short.id)}
    type="button"
  >
    {/* Cover image */}
    <div className="absolute inset-0">
      <ProgressiveImage
        alt={short.title}
        className="object-cover"
        fill
        loadingEffect="feed"
        sizes="132px"
        src={short.coverSrc}
      />
    </div>

    {/* Play overlay hint */}
    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-lg text-white">
        ▶
      </div>
    </div>

    {/* Stage chip top-left */}
    {short.stage !== "NONE" && (
      <div className="absolute left-2 top-2">
        <StagePill compact stage={short.stage} />
      </div>
    )}

    {/* Duration top-right */}
    {short.durationLabel ? (
      <div className="absolute right-2 top-2 rounded-[5px] bg-black/60 px-1.5 py-0.5 font-mono text-[length:var(--fs-nano)] text-white">
        {short.durationLabel}
      </div>
    ) : null}

    {/* Caption overlay */}
    <div
      className="absolute inset-x-0 bottom-0 px-2.5 pb-2.5 pt-8"
      style={{
        background: "linear-gradient(180deg, transparent, rgba(0,0,0,0.82))",
      }}
    >
      <p className="line-clamp-2 text-[length:var(--fs-caption)] font-semibold leading-snug text-white">
        {short.title}
      </p>
      <p className="mt-1 truncate text-[length:var(--fs-nano)] text-[#cbd7e8]">
        {short.creatorName}
      </p>
    </div>
  </button>
);
