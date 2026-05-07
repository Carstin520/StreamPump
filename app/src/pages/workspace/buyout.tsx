import Head from "next/head";
import { useState } from "react";

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

type Offer = {
  sponsor: string;
  avatar: string;
  amount: number;
  time: string;
};

const OFFERS: Offer[] = [
  { sponsor: "Apex Motion", avatar: "AM", amount: 850_000, time: "2h ago" },
  { sponsor: "Gridline Lab", avatar: "GL", amount: 720_000, time: "5h ago" },
  { sponsor: "Velocity House", avatar: "VH", amount: 680_000, time: "1d ago" },
];

const WALLET = "0x7A...2F";

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

const AVATAR_COLORS: Record<string, string> = {
  AM: "from-[#de402a] to-[#f05540]",
  GL: "from-[#67b8ff] to-[#4a9fe6]",
  VH: "from-[#f3b33e] to-[#e6a02e]",
};

function OfferCard({
  offer,
  index,
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
    <div
      className={`glass-card relative p-5 transition-all ${
        isTop ? "shadow-[0_0_40px_rgba(243,179,62,0.08)]" : ""
      }`}
    >
      {isTop && (
        <div className="pointer-events-none absolute inset-0 rounded-[28px] ring-1 ring-inset ring-[#f3b33e]/25" />
      )}
      {isTop && (
        <span className="absolute -top-2.5 right-5 z-10 rounded-full bg-gradient-to-r from-[#f3b33e] to-[#e6a02e] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#090d14] shadow-[0_4px_16px_rgba(243,179,62,0.3)]">
          Highest
        </span>
      )}

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br text-xs font-bold text-white ${AVATAR_COLORS[offer.avatar] ?? "from-[#5a6b82] to-[#4a5a70]"}`}
            >
              {offer.avatar}
            </span>
            <div>
              <p className="text-sm font-semibold text-white">{offer.sponsor}</p>
              <p className="text-xs text-[#5a6b82]">{offer.time}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xl font-bold tracking-[-0.05em] text-white">
              ${fmt(offer.amount)}
            </p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-[#8ea0ba]">USDC</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <button
            className="glass-button-primary flex-1 px-4 py-2.5 text-sm font-semibold"
            onClick={onAccept}
            type="button"
          >
            Accept
          </button>
          <button
            className="glass-button-ghost flex-1 px-4 py-2.5 text-sm font-medium"
            onClick={onDecline}
            type="button"
          >
            Decline
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
    { label: "Graduation", detail: "S1 → S2 transition", active: false },
    { label: "S2 Active", detail: "Sponsored creator status", active: false },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="liquid-glass-shell relative z-10 w-full max-w-md p-6">
        <h3 className="text-xl font-bold tracking-[-0.05em] text-white">Confirm Buyout</h3>
        <p className="mt-1 text-sm text-[#8ea0ba]">
          Accept ${fmt(offer.amount)} USDC from {offer.sponsor}
        </p>

        {/* Timeline */}
        <div className="mt-6 space-y-0">
          {STEPS.map((step, i) => (
            <div className="flex gap-3" key={step.label}>
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
                    step.active
                      ? "border-[#de402a]/50 bg-[#de402a]/15 text-[#de402a]"
                      : "border-white/10 bg-white/[0.04] text-[#5a6b82]"
                  }`}
                >
                  {i + 1}
                </span>
                {i < STEPS.length - 1 && (
                  <div className="my-1 h-8 w-px bg-white/[0.08]" />
                )}
              </div>
              <div className="pb-4 pt-1">
                <p className={`text-sm font-semibold ${step.active ? "text-white" : "text-[#8ea0ba]"}`}>
                  {step.label}
                </p>
                <p className="text-xs text-[#5a6b82]">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            className="glass-button-primary flex-1 px-4 py-3 text-sm font-semibold"
            onClick={onConfirm}
            type="button"
          >
            Confirm Accept
          </button>
          <button
            className="glass-button-ghost px-5 py-3 text-sm font-medium"
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
        {/* Buyout toggle */}
        <section className="liquid-glass-shell section-enter p-5 md:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-[-0.05em] text-white md:text-3xl">
                Buyout Auction
              </h1>
              <p className="mt-1 text-sm text-[#8ea0ba]">
                {buyoutOpen ? "Buyout Auction Active" : "S1 Discovery — not open for buyout"}
              </p>
            </div>

            {/* Toggle switch */}
            <button
              className="relative flex h-8 w-14 shrink-0 items-center rounded-full transition-all duration-300"
              onClick={() => setBuyoutOpen(!buyoutOpen)}
              style={{
                background: buyoutOpen
                  ? "linear-gradient(180deg, #f05540, #de402a)"
                  : "rgba(255,255,255,0.08)",
                boxShadow: buyoutOpen
                  ? "0 8px 24px rgba(222,64,42,0.3), inset 0 1px 0 rgba(255,255,255,0.12)"
                  : "inset 0 1px 0 rgba(255,255,255,0.04)",
              }}
              type="button"
            >
              <span
                className="absolute h-6 w-6 rounded-full bg-white shadow-md transition-all duration-300"
                style={{
                  left: buyoutOpen ? "calc(100% - 28px)" : "4px",
                }}
              />
            </button>
          </div>
          {buyoutOpen && (
            <div className="mt-3 flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#65ecaf]" />
              <span className="text-xs text-[#65ecaf]">Open for Buyout Offers</span>
            </div>
          )}
        </section>

        {buyoutOpen && (
          <>
            {/* Terms comparison (if 2+ offers) */}
            {sortedOffers.length >= 2 && (
              <section className="section-enter">
                <h2 className="mb-3 text-sm font-semibold text-[#8ea0ba]">Offer Comparison</h2>
                <div className="grid grid-cols-3 gap-3">
                  {sortedOffers.map((o, i) => (
                    <div
                      className={`surface-muted relative p-4 text-center transition-all ${
                        i === 0 ? "ring-1 ring-[#f3b33e]/20" : ""
                      }`}
                      key={o.sponsor}
                    >
                      <span
                        className={`flex h-8 w-8 mx-auto items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold text-white ${AVATAR_COLORS[o.avatar] ?? "from-[#5a6b82] to-[#4a5a70]"}`}
                      >
                        {o.avatar}
                      </span>
                      <p className="mt-2 text-[11px] text-[#8ea0ba]">{o.sponsor}</p>
                      <p className="mt-1 text-lg font-bold tracking-[-0.05em] text-white">
                        ${fmt(o.amount)}
                      </p>
                      {i === 0 && (
                        <span className="mt-1.5 inline-block rounded-full bg-[#f3b33e]/12 px-2 py-0.5 text-[9px] font-bold text-[#f3b33e]">
                          BEST
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Offer inbox */}
            <section className="section-enter">
              <h2 className="mb-3 text-sm font-semibold text-[#8ea0ba]">
                Incoming Offers ({sortedOffers.length})
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
            <span className="text-4xl">🔒</span>
            <h2 className="mt-4 text-xl font-bold tracking-[-0.05em] text-white">Buyout Disabled</h2>
            <p className="mt-2 max-w-xs text-sm text-[#8ea0ba]">
              Toggle the switch above to open your S1 for buyout offers from sponsors.
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
