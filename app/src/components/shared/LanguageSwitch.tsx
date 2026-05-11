import { useI18n } from "@/lib/i18n";

export const LanguageSwitch = ({ compact = false }: { compact?: boolean }) => {
  const { locale, setLocale, t } = useI18n();

  return (
    <div
      aria-label={t("shell.language")}
      className={`flex items-center rounded-full border border-white/[0.07] bg-white/[0.035] p-1 ${
        compact ? "w-fit" : "w-full"
      }`}
      role="group"
    >
      {(["zh", "en"] as const).map((item) => {
        const active = locale === item;

        return (
          <button
            aria-pressed={active}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
              active
                ? "bg-white/[0.12] text-white shadow-[0_8px_22px_rgba(0,0,0,0.22)]"
                : "text-[#8fa1bd] hover:bg-white/[0.06] hover:text-white"
            } ${compact ? "min-w-[42px]" : "flex-1"}`}
            key={item}
            onClick={() => setLocale(item)}
            type="button"
          >
            {item === "zh" ? t("shell.languageZh") : t("shell.languageEn")}
          </button>
        );
      })}
    </div>
  );
};
