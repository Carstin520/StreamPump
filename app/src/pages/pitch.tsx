import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  DEMO_PATH,
  DEMO_S1_BUYOUT_PATH,
  DEMO_S1_MARKET_PATH,
  DEMO_S2_SETTLEMENT_PATH,
  DEMO_S2_WORKSPACE_PATH,
} from "@/lib/routes";

type SlideTone = "hero" | "market" | "pain" | "product" | "solana" | "roadmap";

type StatCard = {
  label: string;
  value: string;
  note: string;
};

type PointCard = {
  title: string;
  body: string;
};

type ScreenshotCard = {
  alt: string;
  caption: string;
  src: string;
};

type Slide = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  tone: SlideTone;
  stats?: StatCard[];
  points?: PointCard[];
  screenshots?: ScreenshotCard[];
  quote?: string;
  footer?: string;
};

const screenshot = (fileName: string) => `/pitch-ui/${fileName}`;

const slides: Slide[] = [
  {
    id: "hero",
    eyebrow: "StreamPump",
    title: "Creator sponsorship markets settled on Solana.",
    body:
      "A Web2.5 content platform where early fans discover creators, sponsors buy measurable distribution, and Solana handles the financial truth.",
    tone: "hero",
    stats: [
      { label: "S1", value: "Discovery", note: "Fans back creator momentum with internal positions." },
      { label: "S2", value: "Campaigns", note: "Sponsors fund fixed, performance, and CPS budgets." },
      { label: "Rail", value: "USDC", note: "Settlement is on-chain, content stays fast off-chain." },
    ],
    screenshots: [
      {
        alt: "StreamPump Explore feed",
        caption: "Content-first discovery surface",
        src: screenshot("01-explore-feed-en.png"),
      },
    ],
  },
  {
    id: "pmf",
    eyebrow: "Product Market Fit",
    title: "Creator marketing is large, growing, and still operationally messy.",
    body:
      "Brands are moving from one-off influencer posts to measurable creator programs, but discovery, attribution, fraud prevention, and payout design remain fragmented.",
    tone: "market",
    stats: [
      { label: "Creator economy TAM", value: "$480B", note: "Goldman Sachs projection for 2027." },
      { label: "US creator ad spend", value: "$37B", note: "IAB 2025 projection." },
      { label: "Brand preference", value: "73%", note: "Later: micro and mid-tier creators favored." },
    ],
    points: [
      {
        title: "Demand is already here",
        body: "Creator campaigns are now a core media channel, not an experimental growth hack.",
      },
      {
        title: "The missing layer is trust",
        body: "Brands need campaign proof, creators need fair settlement, and fans need upside that is not just speculation.",
      },
    ],
    footer: "Sources: Goldman Sachs Research, IAB Creator Economy Ad Spend & Strategy Report, Later 2025 Influencer Marketing Report.",
  },
  {
    id: "creator-pain",
    eyebrow: "Creator Pain",
    title: "Creators have content demand, but weak sponsorship routing.",
    body:
      "Early creators hit cold-start walls. Mature creators lose margin to agencies and platforms. Everyone guesses which topic will work before spending time making it.",
    tone: "pain",
    points: [
      {
        title: "Cold start",
        body: "Small creators need early demand signals and distribution before sponsors care.",
      },
      {
        title: "Intermediary drag",
        body: "Creators over 100K followers can monetize, but often lose budget to MCNs, platforms, or brokers.",
      },
      {
        title: "Creative uncertainty",
        body: "Before publishing, there is no market signal for whether a topic deserves serious production.",
      },
      {
        title: "Bad settlement primitives",
        body: "Flat fees and click KPIs are easy; CPS-style micro payouts are still hard to run fairly.",
      },
    ],
  },
  {
    id: "socialfi-pain",
    eyebrow: "SocialFi Pain",
    title: "Most Web3 social apps start with tokens before they prove durable content demand.",
    body:
      "View-to-earn creates sell pressure. Creator coins invite speculation. Content ownership sounds noble, but creators care first about revenue and audience growth.",
    tone: "pain",
    points: [
      {
        title: "Token-first incentives",
        body: "If the main reason to join is to sell a platform token, the content loop is secondary.",
      },
      {
        title: "Weak content value",
        body: "Rewarding views does not automatically produce better posts, stronger fans, or sponsor proof.",
      },
      {
        title: "Storage realism",
        body: "Full video databases do not belong on-chain; high-quality playback still needs Web2-grade media infra.",
      },
    ],
    quote:
      "StreamPump uses Solana where it is strongest: settlement, vaults, utility tokens, and proof. The content experience stays fast.",
  },
  {
    id: "insight",
    eyebrow: "Core Insight",
    title: "Content is the real digital asset. Sponsor budgets are the sustainable funding source.",
    body:
      "Videos and posts retain users. Sponsor dollars fund marketing outcomes. Fans help discover momentum early, then share in USDC when that momentum becomes commercial demand.",
    tone: "product",
    points: [
      {
        title: "No exchange-first token thesis",
        body: "SPUMP is a platform utility and participation asset, not the product's exit strategy.",
      },
      {
        title: "Marketing spend, not Ponzi liquidity",
        body: "Sponsors pay for distribution, content placement, and measurable outcomes.",
      },
      {
        title: "Low operating overhead",
        body: "Automation, protocol fees, and settlement fees keep the platform lean.",
      },
    ],
    screenshots: [
      {
        alt: "StreamPump creator profile",
        caption: "Creators are evaluated through content and momentum, not ticker hype.",
        src: screenshot("03-creator-profile-en.png"),
      },
    ],
  },
  {
    id: "season-one",
    eyebrow: "Season 1",
    title: "Fans discover creator momentum before sponsorship demand confirms it.",
    body:
      "Fans spend non-transferable SPUMP into internal creator positions. A rating-adjusted bonding curve makes support legible while keeping the market inside the product.",
    tone: "product",
    stats: [
      { label: "Asset", value: "SPUMP", note: "Token-2022 non-transferable platform utility." },
      { label: "Position", value: "Virtual", note: "Recorded in S1UserPosition; no creator SPL token." },
      { label: "Signal", value: "Rating", note: "Oracle-updated momentum score with delayed effect." },
    ],
    screenshots: [
      {
        alt: "StreamPump S1 market",
        caption: "S1 market UI: price, supply, graduation progress, and wallet actions.",
        src: screenshot("04-s1-market-en.png"),
      },
    ],
  },
  {
    id: "buyout",
    eyebrow: "S1 Buyout",
    title: "When a creator graduates, sponsor demand converts fan conviction into USDC.",
    body:
      "Sponsors submit buyout offers. The creator accepts one. Fans get a 48-hour zero-tax rage quit window, then eligible backers claim capped discovery rewards after graduation.",
    tone: "product",
    points: [
      {
        title: "Sponsor offer",
        body: "USDC is escrowed into an offer vault with sponsor and creator PDAs.",
      },
      {
        title: "Creator choice",
        body: "The creator chooses a sponsor before moving from S1 into S2 campaign execution.",
      },
      {
        title: "Fan protection",
        body: "Disagree with the accepted deal? Rage quit back to SPUMP before the deadline.",
      },
    ],
    screenshots: [
      {
        alt: "StreamPump S1 buyout",
        caption: "Buyout room: offer status, rage quit, and claimable USDC.",
        src: screenshot("05-s1-buyout-en.png"),
      },
    ],
  },
  {
    id: "season-two",
    eyebrow: "Season 2",
    title: "Sponsored campaigns become programmable budget tracks.",
    body:
      "S2 turns creator sponsorship into a three-track budget model: guaranteed creator pay, metric-driven performance, and delayed CPS-style settlement.",
    tone: "product",
    points: [
      {
        title: "Track 1 · Fixed base",
        body: "A sponsor-funded creator guarantee, settled after content publication is verified.",
      },
      {
        title: "Track 2 · Performance",
        body: "Views, clicks, or saves are aggregated by the oracle; cliff logic splits achieved budget between creator and endorsers.",
      },
      {
        title: "Track 3 · CPS",
        body: "A prepaid CPS budget settles after the return window using approved order attribution.",
      },
    ],
    screenshots: [
      {
        alt: "StreamPump campaign detail",
        caption: "Campaign proof: proposal PDA, manifest hash, content anchor, and track state.",
        src: screenshot("09-campaign-detail-en.png"),
      },
      {
        alt: "StreamPump settlement dashboard",
        caption: "Settlement dashboard for track outcomes and money flow.",
        src: screenshot("10-campaign-settlement-en.png"),
      },
    ],
  },
  {
    id: "solana",
    eyebrow: "Why Solana",
    title: "Solana is the trust layer, not a decorative chain logo.",
    body:
      "The product needs low-cost USDC settlement, PDA-owned vaults, client wallet signatures, non-transferable utility tokens, and verifiable content anchors.",
    tone: "solana",
    stats: [
      { label: "USDC vaults", value: "PDA", note: "Sponsor budgets live in program-owned accounts." },
      { label: "SPUMP", value: "Token-2022", note: "Non-transferable utility with burn/mint flows." },
      { label: "Proof", value: "Hashes", note: "Content manifests are anchored without storing video on-chain." },
    ],
    points: [
      {
        title: "Fast enough for small payouts",
        body: "Low fees make fan rewards, refunds, and campaign settlements practical.",
      },
      {
        title: "Composability without speculation",
        body: "The protocol can use SPL Token, Token-2022, Anchor accounts, and USDC without listing SPUMP on a DEX.",
      },
    ],
  },
  {
    id: "demo",
    eyebrow: "What Works Today",
    title: "The current repo supports a controlled but credible hackathon demo.",
    body:
      "The strongest live paths are S1 buy/sell/portfolio/claim against seeded devnet state and S2 launch plus settlement smoke paths.",
    tone: "market",
    points: [
      {
        title: "Frontend",
        body: "Explore, Trending, Creator, Post, Portfolio, S1 market, S1 buyout, Workspace, Campaign, and Settlement surfaces exist.",
      },
      {
        title: "Backend",
        body: "Express v1 APIs support auth sessions, content manifests, proposal intents, S1 transaction builders, projections, R2, Mux, and oracle jobs.",
      },
      {
        title: "On-chain",
        body: "Anchor instructions cover S1 discovery, S1 buyout, S2 proposal funding, Track1/2/3 settlement, endorsements, and content anchors.",
      },
    ],
    screenshots: [
      {
        alt: "StreamPump workspace overview",
        caption: "Workspace path: content manifest to proposal intent.",
        src: screenshot("07-workspace-overview-en.png"),
      },
      {
        alt: "StreamPump proposal intent signing",
        caption: "Creator and sponsor sign the launch bundle before Solana submission.",
        src: screenshot("08-proposal-intent-signing-en.png"),
      },
    ],
  },
  {
    id: "roadmap",
    eyebrow: "Roadmap",
    title: "The next work is productization, reconciliation, and trust hardening.",
    body:
      "The pitch should be clear about what is real now and what becomes production-grade after the hackathon prototype.",
    tone: "roadmap",
    points: [
      {
        title: "Productize S1 buyout formation",
        body: "Build sponsor offer UI, creator acceptance UI, offer requirements, and contract/oracle verification state.",
      },
      {
        title: "Make S2 settlement live end-to-end",
        body: "Wire Track2 events into campaign progress, endorsement claims, and operator settlement visibility.",
      },
      {
        title: "Replace Track3 stubs",
        body: "Integrate merchant/order reconciliation and decide whether overflow invoices require protocol changes.",
      },
      {
        title: "Prepare for real funds",
        body: "Finish identity verification, deployment hardening, operator controls, and security review.",
      },
    ],
  },
];

const toneStyles: Record<SlideTone, string> = {
  hero: "from-[#de402a]/20 via-[#67b8ff]/10 to-transparent",
  market: "from-[#67b8ff]/18 via-[#65ecaf]/10 to-transparent",
  pain: "from-[#f3b33e]/16 via-[#de402a]/12 to-transparent",
  product: "from-[#65ecaf]/14 via-[#67b8ff]/10 to-transparent",
  roadmap: "from-[#f3b33e]/14 via-white/[0.04] to-transparent",
  solana: "from-[#7a5cff]/18 via-[#65ecaf]/10 to-transparent",
};

const sourceLinks = [
  {
    href: "https://www.goldmansachs.com/insights/articles/the-creator-economy-could-approach-half-a-trillion-dollars-by-2027",
    label: "Goldman Sachs",
  },
  {
    href: "https://www.tvtechnology.com/news/iab-creator-economy-ad-spend-now-dwarfs-ad-spend-for-total-media-industry",
    label: "IAB 2025",
  },
  {
    href: "https://www.prnewswire.com/news-releases/influencer-marketing-in-2025-new-data-reveals-what-works-what-costs-and-whats-next-302490369.html",
    label: "Later 2025",
  },
  {
    href: "https://solana.com/developers/payments",
    label: "Solana payments",
  },
  {
    href: "https://solana.com/docs/tokens/extensions/non-transferrable-tokens",
    label: "Token-2022",
  },
];

const demoLinks = [
  { href: DEMO_PATH, label: "Demo hub" },
  { href: DEMO_S1_MARKET_PATH, label: "S1 market" },
  { href: DEMO_S1_BUYOUT_PATH, label: "Buyout" },
  { href: DEMO_S2_WORKSPACE_PATH, label: "Workspace" },
  { href: DEMO_S2_SETTLEMENT_PATH, label: "Settlement" },
];

const useActiveSlide = () => {
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    const sections = Array.from(document.querySelectorAll<HTMLElement>("[data-pitch-slide]"));

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) {
          return;
        }

        const index = Number(visible.target.getAttribute("data-slide-index") ?? "0");
        setActiveSlide(index);
      },
      { threshold: [0.45, 0.6, 0.75] },
    );

    sections.forEach((section) => observer.observe(section));
    observers.push(observer);

    return () => {
      observers.forEach((item) => item.disconnect());
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowDown" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowLeft") {
        return;
      }

      const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = Math.max(0, Math.min(slides.length - 1, activeSlide + direction));
      const next = document.querySelector<HTMLElement>(`[data-slide-index="${nextIndex}"]`);
      if (!next || nextIndex === activeSlide) {
        return;
      }

      event.preventDefault();
      next.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeSlide]);

  return activeSlide;
};

function SlideStats({ stats }: { stats: StatCard[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          className="rounded-[18px] border border-white/[0.07] bg-white/[0.035] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
          key={`${stat.label}-${stat.value}`}
        >
          <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">{stat.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white md:text-3xl">{stat.value}</p>
          <p className="mt-2 text-xs leading-5 text-[#93a2bb]">{stat.note}</p>
        </div>
      ))}
    </div>
  );
}

function SlidePoints({ points }: { points: PointCard[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {points.map((point) => (
        <div
          className="rounded-[18px] border border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.055)_0%,rgba(255,255,255,0.026)_100%)] p-4"
          key={point.title}
        >
          <h3 className="text-sm font-semibold tracking-[-0.02em] text-white">{point.title}</h3>
          <p className="mt-2 text-sm leading-6 text-[#9aabc4]">{point.body}</p>
        </div>
      ))}
    </div>
  );
}

function SlideScreenshots({ screenshots }: { screenshots: ScreenshotCard[] }) {
  const single = screenshots.length === 1;

  return (
    <div className={single ? "grid gap-3" : "grid gap-3 lg:grid-cols-2"}>
      {screenshots.map((item) => (
        <figure
          className="overflow-hidden rounded-[22px] border border-white/[0.08] bg-[#0c121d] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
          key={item.src}
        >
          <div className="aspect-[16/9] overflow-hidden bg-[#090d14]">
            <img alt={item.alt} className="h-full w-full object-cover" src={item.src} />
          </div>
          <figcaption className="border-t border-white/[0.05] px-4 py-3 text-xs leading-5 text-[#8ea0ba]">
            {item.caption}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function PitchSlide({ index, slide }: { index: number; slide: Slide }) {
  return (
    <section
      className="relative flex min-h-[100svh] snap-start items-center overflow-hidden px-4 py-10 md:px-8 lg:px-12"
      data-pitch-slide
      data-slide-index={index}
      id={slide.id}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${toneStyles[slide.tone]} opacity-100`} />
      <div className="pointer-events-none absolute inset-x-[8%] top-[10%] h-44 rounded-full bg-white/[0.035] blur-3xl" />

      <div className="relative mx-auto grid w-full max-w-7xl gap-7 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)] lg:items-center">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-white/[0.1] bg-white/[0.055] px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.22em] text-[#cbd6e7]">
              {String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}
            </span>
            <span className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.22em] text-[#67b8ff]">
              {slide.eyebrow}
            </span>
          </div>

          <div>
            <h1 className="max-w-4xl text-[42px] font-semibold leading-[0.96] tracking-[-0.06em] text-white md:text-[66px] lg:text-[78px]">
              {slide.title}
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-[#a6b5cb] md:text-lg">
              {slide.body}
            </p>
          </div>

          {slide.quote ? (
            <blockquote className="rounded-[20px] border-l-2 border-[#de402a] bg-white/[0.035] px-5 py-4 text-sm leading-7 text-[#d7e1ef]">
              {slide.quote}
            </blockquote>
          ) : null}

          {slide.footer ? <p className="max-w-3xl text-xs leading-5 text-[#7486a1]">{slide.footer}</p> : null}
        </div>

        <div className="space-y-4">
          {slide.stats ? <SlideStats stats={slide.stats} /> : null}
          {slide.points ? <SlidePoints points={slide.points} /> : null}
          {slide.screenshots ? <SlideScreenshots screenshots={slide.screenshots} /> : null}
        </div>
      </div>
    </section>
  );
}

export default function PitchPage() {
  const activeSlide = useActiveSlide();
  const activeLabel = useMemo(() => slides[activeSlide]?.eyebrow ?? "StreamPump", [activeSlide]);

  return (
    <>
      <Head>
        <title>StreamPump | Hackathon Pitch</title>
        <meta
          content="StreamPump is a Web2.5 creator sponsorship market where content discovery, sponsor budgets, fan participation, and Solana settlement live in one product loop."
          name="description"
        />
      </Head>

      <main className="h-screen overflow-hidden bg-[#090d14] text-white">
        <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_15%_8%,rgba(103,184,255,0.14),transparent_24%),radial-gradient(circle_at_88%_16%,rgba(222,64,42,0.12),transparent_24%),linear-gradient(180deg,#090d14_0%,#0a1018_100%)]" />

        <header className="fixed left-4 right-4 top-4 z-40 flex items-center justify-between gap-3 rounded-full border border-white/[0.08] bg-[#0b111c]/78 px-3 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.32)] backdrop-blur-2xl md:left-6 md:right-6 md:px-4">
          <Link className="flex items-center gap-3" href="/explore">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-bold text-white shadow-[0_12px_32px_rgba(222,64,42,0.32)]">
              SP
            </span>
            <span className="hidden text-sm font-semibold tracking-[-0.02em] text-white sm:inline">StreamPump</span>
          </Link>

          <div className="hidden min-w-0 flex-1 justify-center md:flex">
            <div className="truncate rounded-full border border-white/[0.06] bg-white/[0.035] px-3 py-1 text-[length:var(--fs-micro)] font-medium uppercase tracking-[0.18em] text-[#8ea0ba]">
              {activeLabel}
            </div>
          </div>

          <nav className="flex items-center gap-2">
            {demoLinks.map((link) => (
              <Link
                className="hidden rounded-full px-3 py-1.5 text-[length:var(--fs-micro)] font-semibold text-[#b6c4d8] transition hover:bg-white/[0.06] hover:text-white lg:inline-flex"
                href={link.href}
                key={link.href}
              >
                {link.label}
              </Link>
            ))}
            <a
              className="rounded-full bg-[linear-gradient(180deg,#f05540_0%,#de402a_100%)] px-4 py-2 text-[length:var(--fs-overline)] font-bold text-white shadow-[0_14px_32px_rgba(222,64,42,0.28)] transition hover:brightness-110"
              href="#hero"
            >
              Pitch
            </a>
          </nav>
        </header>

        <div className="fixed bottom-5 right-5 z-40 hidden flex-col gap-2 md:flex">
          {slides.map((slide, index) => (
            <a
              aria-label={`Go to ${slide.eyebrow}`}
              className={`h-2.5 rounded-full transition-all ${
                index === activeSlide ? "w-9 bg-[#de402a]" : "w-2.5 bg-white/25 hover:bg-white/55"
              }`}
              href={`#${slide.id}`}
              key={slide.id}
            />
          ))}
        </div>

        <div className="relative z-10 h-full snap-y snap-mandatory overflow-y-auto scroll-smooth">
          {slides.map((slide, index) => (
            <PitchSlide index={index} key={slide.id} slide={slide} />
          ))}

          <footer className="relative snap-start border-t border-white/[0.06] bg-[#080c13] px-5 py-8 md:px-10">
            <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Sources and demo entry points</p>
                <p className="mt-1 text-xs text-[#7486a1]">
                  Research links are external. Demo links open the current local StreamPump product surfaces.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {[...sourceLinks, ...demoLinks].map((link) => (
                  <Link
                    className="rounded-full border border-white/[0.08] bg-white/[0.035] px-3 py-1.5 text-[length:var(--fs-micro)] font-medium text-[#cbd6e7] transition hover:border-white/[0.16] hover:text-white"
                    href={link.href}
                    key={`${link.href}-${link.label}`}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </footer>
        </div>
      </main>
    </>
  );
}
