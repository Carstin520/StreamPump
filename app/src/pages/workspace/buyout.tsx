import Head from "next/head";
import { useEffect, useState } from "react";

import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

type Offer = {
  sponsor: string;
  avatar: string;
  amount: number;
  time: string;
  lockHoursRemaining: number;
};

const OFFERS: Offer[] = [
  { sponsor: "Apex Motion", avatar: "AM", amount: 850_000, time: "2h ago", lockHoursRemaining: 22 },
  { sponsor: "Gridline Lab", avatar: "GL", amount: 720_000, time: "5h ago", lockHoursRemaining: 19 },
  { sponsor: "Velocity House", avatar: "VH", amount: 680_000, time: "1d ago", lockHoursRemaining: 1 },
];

const WALLET = "0x7A...2F";

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

const AVATAR_COLORS: Record<string, string> = {
  AM: "from-[#c0362a] to-[#a83020]",
  GL: "from-[#4a8dbf] to-[#3a7aaa]",
  VH: "from-[#c89630] to-[#b08228]",
};

function OfferLockCountdown({ initialHours }: { initialHours: number }) {
  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    const deadline = Date.now() + Math.max(0, initialHours) * 3_600_000;
    const update = () => setRemainingMs(Math.max(0, deadline - Date.now()));
    update();
    const id = window.setInterval(update, 60_000);
    return () => window.clearInterval(id);
  }, [initialHours]);

  if (remainingMs === null) {
    return <span>锁定期剩余 -- 小时</span>;
  }

  const hours = Math.floor(remainingMs / 3_600_000);
  const minutes = Math.floor((remainingMs % 3_600_000) / 60_000);

  return <span>锁定期剩余 {hours} 小时 {minutes} 分钟</span>;
}

function OfferCard({
  offer,
  isTop,
  onAccept,
  onDecline,
}: {
  offer: Offer;
  index: number;
  isTop: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="relative">
      {isTop && (
        <span className="absolute -top-2.5 right-5 z-10 rounded-full border border-[#f3b33e]/25 bg-[#1a1408] px-2.5 py-0.5 text-[length:var(--fs-nano)] font-semibold uppercase tracking-[0.12em] text-[#f3c66e]">
          Highest
        </span>
      )}
      <div
        className={`rounded-[20px] border bg-[linear-gradient(160deg,rgba(15,21,32,0.92)_0%,rgba(10,15,23,0.92)_100%)] p-5 transition ${
          isTop
            ? "border-[#f3b33e]/15 shadow-[0_0_28px_rgba(243,179,62,0.04)]"
            : "border-white/[0.06]"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-[length:var(--fs-micro)] font-bold text-white/80 ${AVATAR_COLORS[offer.avatar] ?? "from-[#5a6b82] to-[#4a5a70]"}`}
            >
              {offer.avatar}
            </span>
            <div>
              <p className="text-[length:var(--fs-caption)] font-semibold text-white">{offer.sponsor}</p>
              <p className="text-[length:var(--fs-micro)] text-[#6f8099]">{offer.time}</p>
              <p className="mt-1 text-[length:var(--fs-micro)] font-medium text-[#f3c66e]">
                <OfferLockCountdown initialHours={offer.lockHoursRemaining} />
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold tracking-[-0.04em] text-white">
              ${fmt(offer.amount)}
            </p>
            <p className="text-[length:var(--fs-micro)] text-[#7486a1]">USDC</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-[linear-gradient(180deg,rgba(222,64,42,0.85)_0%,rgba(190,52,34,0.85)_100%)] px-4 py-2 text-[length:var(--fs-overline)] font-semibold text-white/90 transition hover:brightness-110"
            onClick={onAccept}
            type="button"
          >
            Preview accept
          </button>
          <button
            className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2 text-[length:var(--fs-overline)] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
            onClick={onDecline}
            type="button"
          >
            Dismiss preview
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({
  offer,
  onClose,
  onConfirm,
}: {
  offer: Offer;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const STEPS = [
    { label: "Accept Offer", detail: `$${fmt(offer.amount)} from ${offer.sponsor}`, active: true },
    { label: "48h Rage Quit Window", detail: "Holders may exit position", active: false },
    { label: "Graduation", detail: "S1 to S2 transition", active: false },
    { label: "S2 Active", detail: "Sponsored creator status", active: false },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-[20px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(14,19,28,0.97)_0%,rgba(9,13,20,0.97)_100%)] p-5 shadow-[0_24px_56px_rgba(0,0,0,0.5)]">
        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-white">Preview buyout acceptance</h3>
        <p className="mt-0.5 text-[length:var(--fs-overline)] text-[#9aabc4]">
          Accept ${fmt(offer.amount)} USDC from {offer.sponsor}
        </p>
        <p className="mt-2 rounded-lg border border-[#f3b33e]/15 bg-[#1f1708]/55 px-3 py-2 text-[length:var(--fs-micro)] font-medium text-[#f3c66e]">
          <OfferLockCountdown initialHours={offer.lockHoursRemaining} />
        </p>

        <div className="mt-5 space-y-0">
          {STEPS.map((step, i) => (
            <div className="flex gap-3" key={step.label}>
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[length:var(--fs-micro)] font-bold ${
                    step.active
                      ? "border-[#de402a]/35 bg-[#1f120e]/80 text-[#ff8a78]"
                      : "border-white/[0.08] bg-white/[0.03] text-[#6f8099]"
                  }`}
                >
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="my-1 h-7 w-px bg-white/[0.06]" />
                )}
              </div>
              <div className="pb-3 pt-0.5">
                <p className={`text-[length:var(--fs-overline)] font-semibold ${step.active ? "text-white" : "text-[#9aabc4]"}`}>
                  {step.label}
                </p>
                <p className="text-[length:var(--fs-micro)] text-[#6f8099]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="flex-1 rounded-xl bg-[linear-gradient(180deg,rgba(222,64,42,0.85)_0%,rgba(190,52,34,0.85)_100%)] px-4 py-2.5 text-[length:var(--fs-overline)] font-semibold text-white/90 transition hover:brightness-110"
            onClick={onConfirm}
            type="button"
          >
            Confirm preview
          </button>
          <button
            className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-2.5 text-[length:var(--fs-overline)] font-medium text-[#cbd6e7] transition hover:border-white/[0.14] hover:text-white"
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BuyoutPage() {
  const [buyoutOpen, setBuyoutOpen] = useState(true);
  const [selectedOffer, setSelectedOffer] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const sortedOffers = [...OFFERS].sort((a, b) => b.amount - a.amount);

  return (
    <>
      <Head>
        <title>Buyout Management — StreamPump</title>
      </Head>

      <WorkspaceShell stage="S1_BUYOUT" wallet={WALLET}>
        <ProductReadinessBanner
          description="Offer comparison and accept/decline controls use static local offers. Real S1 buyout offer creation, acceptance, rage quit, graduation, and reclaim remain backend-ready or operator-driven."
          status="MOCK_PREVIEW"
          title="Buyout workspace is a static offer preview"
        />

        <section className="section-enter rounded-[16px] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(12,17,26,0.95)_0%,rgba(8,12,20,0.95)_100%)] px-4 py-3.5 md:px-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
                Workspace
              </p>
              <h1 className="mt-0.5 text-[18px] font-semibold tracking-[-0.03em] text-white md:text-[20px]">
                Buyout Auction
              </h1>
              <p className="mt-0.5 text-[length:var(--fs-overline)] text-[#9aabc4]">
                {buyoutOpen ? "Preview open: static sponsor offers are visible" : "S1 Discovery preview: no offer inbox shown"}
              </p>
            </div>

            <button
              className="relative flex h-7 w-12 shrink-0 items-center rounded-full transition-all duration-300"
              onClick={() => setBuyoutOpen(!buyoutOpen)}
              style={{
                background: buyoutOpen
                  ? "linear-gradient(180deg, rgba(222,64,42,0.75), rgba(190,52,34,0.75))"
                  : "rgba(255,255,255,0.06)",
                boxShadow: buyoutOpen
                  ? "0 6px 16px rgba(222,64,42,0.18)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
              type="button"
            >
              <span
                className="absolute h-5 w-5 rounded-full bg-white/90 shadow-sm transition-all duration-300"
                style={{
                  left: buyoutOpen ? "calc(100% - 24px)" : "3px",
                }}
              />
            </button>
          </div>
          {buyoutOpen && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-white/[0.04] pt-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#65ecaf]" />
              <span className="text-[length:var(--fs-micro)] text-[#8df0c4]">Static offers visible</span>
            </div>
          )}
        </section>

        {buyoutOpen && (
          <>
            {/* Terms comparison (if 2+ offers) */}
            {sortedOffers.length >= 2 && (
              <section className="section-enter">
                <h2 className="mb-3 text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">Static Offer Comparison</h2>
                <div className="grid grid-cols-3 gap-2">
                  {sortedOffers.map((o, i) => (
                    <div
                      className={`rounded-[16px] border bg-[linear-gradient(160deg,rgba(15,21,32,0.88)_0%,rgba(10,15,23,0.88)_100%)] p-3.5 text-center transition ${
                        i === 0 ? "border-[#f3b33e]/15" : "border-white/[0.06]"
                      }`}
                      key={o.sponsor}
                    >
                      <span
                        className={`mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br text-[length:var(--fs-nano)] font-bold text-white/80 ${AVATAR_COLORS[o.avatar] ?? "from-[#5a6b82] to-[#4a5a70]"}`}
                      >
                        {o.avatar}
                      </span>
                      <p className="mt-1.5 text-[length:var(--fs-micro)] text-[#9aabc4]">{o.sponsor}</p>
                      <p className="mt-0.5 text-[length:var(--fs-sm)] font-bold tracking-[-0.04em] text-white">
                        ${fmt(o.amount)}
                      </p>
                      {i === 0 && (
                        <span className="mt-1 inline-block rounded-md border border-[#f3b33e]/20 bg-[#1a1408]/70 px-1.5 py-0.5 text-[length:var(--fs-nano)] font-medium text-[#f3c66e]">
                          Best
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Offer inbox */}
            <section className="section-enter">
              <h2 className="mb-3 text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#6f8099]">
                Static Incoming Offers ({sortedOffers.length})
              </h2>
              <div className="space-y-4">
                {sortedOffers.map((offer, i) => (
                  <OfferCard
                    index={i}
                    isTop={i === 0}
                    key={offer.sponsor}
                    offer={offer}
                    onAccept={() => {
                      setSelectedOffer(i);
                      setShowConfirmModal(true);
                    }}
                    onDecline={() => {}}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {!buyoutOpen && (
          <section className="section-enter flex flex-col items-center py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.03] text-[#7e90aa]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24"><path d="M12 2C9.24 2 7 4.24 7 7v3H5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2V7c0-2.76-2.24-5-5-5Zm0 2c1.65 0 3 1.35 3 3v3H9V7c0-1.65 1.35-3 3-3Z" fill="currentColor"/></svg>
            </span>
            <h2 className="mt-4 text-[length:var(--fs-sm)] font-semibold text-white">Buyout preview hidden</h2>
            <p className="mt-1.5 max-w-xs text-[length:var(--fs-overline)] text-[#7e90aa]">
              Toggle the switch above to show the static S1 buyout offer preview. Real offer creation still requires backend or operator wiring.
            </p>
          </section>
        )}
      </WorkspaceShell>

      {showConfirmModal && selectedOffer !== null && (
        <ConfirmModal
          offer={sortedOffers[selectedOffer]}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={() => setShowConfirmModal(false)}
        />
      )}
    </>
  );
}
