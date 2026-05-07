import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";

type Role = "fan" | "creator";

const TOTAL_SPUMP = 1_250_000;
const XP_REWARD = 20;
const STEPS = 4;

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, active]);

  return value;
}

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className="h-2 rounded-full transition-all duration-300"
          style={{
            width: i === current ? 24 : 8,
            background:
              i === current
                ? "#de402a"
                : i < current
                  ? "rgba(222, 64, 42, 0.4)"
                  : "rgba(255, 255, 255, 0.12)",
          }}
        />
      ))}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="glass-button-ghost flex h-10 w-10 items-center justify-center"
      onClick={onClick}
      type="button"
    >
      <svg
        className="h-5 w-5 text-white"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d="M15 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function WalletIcon() {
  return (
    <svg className="h-8 w-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path
        d="M21 12V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2v-1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M16 12a1 1 0 100-2 1 1 0 000 2z" fill="currentColor" />
    </svg>
  );
}

function CheckCircle({ animated }: { animated: boolean }) {
  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle, rgba(101, 236, 175, 0.2) 0%, transparent 70%)",
          animation: animated ? "pulse-glow 2s ease-in-out infinite" : undefined,
        }}
      />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-[#65ecaf]/30 bg-[#65ecaf]/10">
        <svg
          className="h-10 w-10 text-[#65ecaf]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          viewBox="0 0 24 24"
          style={{
            strokeDasharray: animated ? 30 : undefined,
            strokeDashoffset: animated ? 0 : undefined,
            animation: animated ? "draw-check 600ms ease-out forwards" : undefined,
          }}
        >
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

function TokenRain({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          className="absolute h-1.5 w-1.5 rounded-full bg-[#de402a]"
          style={{
            left: `${8 + (i * 7.5) % 84}%`,
            top: "-4px",
            opacity: 0.6 + Math.random() * 0.4,
            animation: `token-fall ${1200 + i * 150}ms ${i * 100}ms ease-in forwards`,
          }}
        />
      ))}
    </div>
  );
}

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [role, setRole] = useState<Role>("fan");
  const [stepKey, setStepKey] = useState(0);

  const xpCount = useCountUp(XP_REWARD, 800, currentStep === 2);
  const spumpCount = useCountUp(TOTAL_SPUMP, 1600, currentStep === 3);

  const goNext = useCallback(() => {
    if (currentStep < STEPS - 1) {
      setCurrentStep((s) => s + 1);
      setStepKey((k) => k + 1);
    }
  }, [currentStep]);

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      setStepKey((k) => k + 1);
    }
  }, [currentStep]);

  return (
    <>
      <Head>
        <title>StreamPump | Get Started</title>
        <style>{`
          @keyframes draw-check {
            from { stroke-dashoffset: 30; }
            to { stroke-dashoffset: 0; }
          }
          @keyframes pulse-glow {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.15); opacity: 1; }
          }
          @keyframes token-fall {
            0% { transform: translateY(0) scale(1); opacity: 0.8; }
            70% { opacity: 0.6; }
            100% { transform: translateY(280px) scale(0.5); opacity: 0; }
          }
          @keyframes count-pop {
            0% { transform: scale(0.8); opacity: 0; }
            60% { transform: scale(1.06); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
      </Head>

      <main className="relative min-h-screen bg-[#090d14] text-white">
        <AnimatedFeedBackdrop className="opacity-[0.85]" />
        <div className="pointer-events-none fixed inset-[8%] z-0 rounded-[54px] border border-white/[0.03] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_36%)] backdrop-blur-[2px]" />

        <div className="relative z-[1] flex min-h-screen flex-col px-5 py-5 lg:px-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {currentStep > 0 && <BackButton onClick={goBack} />}
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#de402a] text-sm font-semibold shadow-[0_12px_30px_rgba(222,64,42,0.32)]">
                SP
              </span>
              <span className="text-lg font-semibold tracking-[-0.04em] text-white">StreamPump</span>
            </div>

            <div className="rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-[#8ea0ba]">
              Step {currentStep + 1} of {STEPS}
            </div>
          </div>

          {/* Card area */}
          <div className="flex flex-1 items-center justify-center py-10">
            <div key={stepKey} className="section-enter w-full max-w-[440px]">
              {currentStep === 0 && (
                <div className="liquid-glass-shell p-8 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#de402a] text-2xl font-bold shadow-[0_20px_50px_rgba(222,64,42,0.36)]">
                    SP
                  </div>
                  <h1 className="text-[28px] font-semibold tracking-[-0.05em]">
                    Welcome to StreamPump
                  </h1>
                  <p className="mt-2 text-[15px] text-[#8ea0ba]">
                    Connect your wallet to enter StreamPump
                  </p>
                  <button
                    className="glass-button-primary mt-8 flex w-full items-center justify-center gap-2.5 px-6 py-3.5 text-[15px] font-semibold"
                    onClick={goNext}
                    type="button"
                  >
                    <WalletIcon />
                    Connect Wallet
                  </button>
                </div>
              )}

              {currentStep === 1 && (
                <div className="liquid-glass-shell p-8 text-center">
                  <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/[0.06]">
                    <svg className="h-8 w-8 text-[#8ea0ba]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M23 21v-2a4 4 0 00-3-3.87" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M16 3.13a4 4 0 010 7.75" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <h1 className="text-[28px] font-semibold tracking-[-0.05em]">
                    Choose Your Role
                  </h1>
                  <p className="mt-2 text-[15px] text-[#8ea0ba]">
                    How will you use StreamPump?
                  </p>

                  <div className="mt-8 grid gap-3">
                    <button
                      className={`relative cursor-pointer rounded-[20px] border p-5 text-left transition-all duration-200 ${
                        role === "fan"
                          ? "border-[#de402a]/40 bg-[#de402a]/[0.08] shadow-[0_0_24px_rgba(222,64,42,0.12)]"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05]"
                      }`}
                      onClick={() => setRole("fan")}
                      type="button"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#de402a]/10 text-lg">
                          🎧
                        </div>
                        <div>
                          <div className="text-[16px] font-semibold">Fan</div>
                          <div className="mt-0.5 text-[13px] text-[#8ea0ba]">Invest in creators, earn SPUMP</div>
                        </div>
                      </div>
                      {role === "fan" && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#de402a]">
                            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>

                    <button
                      className={`relative cursor-pointer rounded-[20px] border p-5 text-left transition-all duration-200 ${
                        role === "creator"
                          ? "border-[#de402a]/40 bg-[#de402a]/[0.08] shadow-[0_0_24px_rgba(222,64,42,0.12)]"
                          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05]"
                      }`}
                      onClick={() => setRole("creator")}
                      type="button"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#67b8ff]/10 text-lg">
                          🎬
                        </div>
                        <div>
                          <div className="text-[16px] font-semibold">Creator</div>
                          <div className="mt-0.5 text-[13px] text-[#8ea0ba]">Publish content, get sponsored</div>
                        </div>
                      </div>
                      {role === "creator" && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#de402a]">
                            <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </div>
                      )}
                    </button>
                  </div>

                  <button
                    className="glass-button-primary mt-8 w-full px-6 py-3.5 text-[15px] font-semibold"
                    onClick={goNext}
                    type="button"
                  >
                    Continue as {role === "fan" ? "Fan" : "Creator"}
                  </button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="liquid-glass-shell p-8 text-center">
                  <CheckCircle animated />
                  <h1 className="mt-4 text-[28px] font-semibold tracking-[-0.05em]">
                    Profile Registered
                  </h1>
                  <p className="mt-2 text-[15px] text-[#8ea0ba]">
                    Mission complete — you earned engagement XP
                  </p>

                  <div
                    className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-[#65ecaf]/20 bg-[#65ecaf]/[0.08] px-5 py-2.5"
                    style={{ animation: "count-pop 500ms ease-out" }}
                  >
                    <span className="text-[13px] font-medium text-[#65ecaf]">XP Earned</span>
                    <span className="text-xl font-bold tabular-nums text-[#65ecaf]">+{xpCount}</span>
                  </div>

                  <button
                    className="glass-button-primary mt-8 w-full px-6 py-3.5 text-[15px] font-semibold"
                    onClick={goNext}
                    type="button"
                  >
                    Claim Reward
                  </button>
                </div>
              )}

              {currentStep === 3 && (
                <div className="liquid-glass-shell relative overflow-hidden p-8 text-center">
                  <TokenRain active />

                  <div className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-[#de402a]/20 bg-[#de402a]/10">
                    <svg className="h-10 w-10 text-[#de402a]" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                      <path
                        d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>

                  <h1 className="text-[28px] font-semibold tracking-[-0.05em]">
                    SPUMP Claimed
                  </h1>
                  <p className="mt-2 text-[15px] text-[#8ea0ba]">
                    Your initial tokens are ready to use
                  </p>

                  <div
                    className="mt-6"
                    style={{ animation: "count-pop 600ms ease-out" }}
                  >
                    <div className="text-[48px] font-bold tabular-nums tracking-[-0.04em] text-white">
                      {spumpCount.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm font-medium text-[#8ea0ba]">SPUMP tokens</div>
                  </div>

                  <Link
                    className="glass-button-primary mt-8 flex w-full items-center justify-center px-6 py-3.5 text-[15px] font-semibold"
                    href="/explore"
                  >
                    Start Exploring
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Bottom dots */}
          <div className="flex justify-center pb-4">
            <StepDots current={currentStep} total={STEPS} />
          </div>
        </div>
      </main>
    </>
  );
}
