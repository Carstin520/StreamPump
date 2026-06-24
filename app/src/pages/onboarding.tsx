import Head from "next/head";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { AnimatedFeedBackdrop } from "@/components/shared/AnimatedFeedBackdrop";
import { ProductReadinessBanner } from "@/components/shared/ProductReadinessBanner";
import { getAccountMe, updateAccountMe } from "@/lib/api/account";
import { AccountMeRecord, AccountRole } from "@/lib/api/types";
import { getStoredAuthSession } from "@/lib/auth-session";
import { buildLoginHref } from "@/lib/routes";

const TOTAL_SPUMP = 1_250_000;
const XP_REWARD = 20;
const STEPS = 4;

type AccountLoadState =
  | { kind: "checking" }
  | { kind: "signed-out" }
  | { kind: "ready"; token: string; account: AccountMeRecord }
  | { kind: "error"; message: string };

const ROLE_OPTIONS: Array<{
  role: AccountRole;
  label: string;
  description: string;
  badge: string;
}> = [
  {
    role: "FAN",
    label: "Fan",
    description: "Back creators with non-transferable utility SPUMP",
    badge: "S1",
  },
  {
    role: "CREATOR",
    label: "Creator",
    description: "Publish content and open sponsorship proposals",
    badge: "CR",
  },
  {
    role: "SPONSOR",
    label: "Sponsor",
    description: "Fund campaigns and verify performance proof",
    badge: "USDC",
  },
];

const roleDisplay = (role: AccountRole) =>
  ROLE_OPTIONS.find((option) => option.role === role)?.label ?? "Fan";

const defaultHandle = (account: AccountMeRecord | null) =>
  account?.profile?.handle ??
  account?.identity?.email?.split("@")[0]?.replace(/[^a-z0-9_.-]/gi, "-").toLowerCase() ??
  "";

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);

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
      rafRef.current = null;
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

const OnboardingReadinessNotice = ({
  accountState,
}: {
  accountState: AccountLoadState;
}) => {
  const signedIn = accountState.kind === "ready";
  const storageStatus = signedIn ? accountState.account.storageStatus : null;

  return (
  <section className="rounded-[14px] border tone-state-warning px-4 py-3">
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <p className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] opacity-80">Onboarding data source</p>
        <p className="mt-1 text-sm font-semibold text-white">
          {signedIn && storageStatus === "LIVE"
            ? "Session-backed account profile"
            : signedIn
              ? "Account profile migration required"
              : "Sign-in required before profile creation"}
        </p>
        <p className="mt-1 text-xs leading-5 text-[#9aabc4]">
          {signedIn && storageStatus === "LIVE"
            ? "This flow reads and writes the current session's account profile. SPUMP rewards remain preview-only until the reward ledger is productized."
            : signedIn
              ? "The backend session is valid, but AccountProfile storage has not been migrated in this environment. Apply the Prisma migration before production onboarding writes are available."
              : "Use email OTP or wallet signature login first. Local preview rewards are still shown only after a real session-backed profile can be saved."}
        </p>
      </div>
      <span className="w-fit shrink-0 rounded-full border border-current/25 bg-black/10 px-2.5 py-1 font-mono text-[length:var(--fs-micro)] font-semibold">
        {signedIn && storageStatus === "LIVE" ? "SEEDED_DEMO" : signedIn ? "BACKEND_READY_UI_GAP" : "MOCK_PREVIEW"}
      </span>
    </div>
  </section>
  );
};

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [role, setRole] = useState<AccountRole>("FAN");
  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [stepKey, setStepKey] = useState(0);
  const [accountState, setAccountState] = useState<AccountLoadState>({ kind: "checking" });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const xpCount = useCountUp(XP_REWARD, 800, currentStep === 2);
  const spumpCount = useCountUp(TOTAL_SPUMP, 1600, currentStep === 3);
  const account = accountState.kind === "ready" ? accountState.account : null;
  const canWriteProfile = accountState.kind === "ready" && accountState.account.storageStatus === "LIVE";

  useEffect(() => {
    let cancelled = false;
    const session = getStoredAuthSession();
    if (!session?.accessToken) {
      setAccountState({ kind: "signed-out" });
      return;
    }

    setDisplayName(session.identity?.displayName ?? "");
    void getAccountMe(session.accessToken)
      .then((record) => {
        if (cancelled) return;
        setAccountState({ kind: "ready", token: session.accessToken, account: record });
        setRole(record.profile?.role ?? "FAN");
        setDisplayName(record.profile?.displayName ?? record.identity?.displayName ?? record.identity?.email?.split("@")[0] ?? "");
        setHandle(defaultHandle(record));
      })
      .catch((error) => {
        if (cancelled) return;
        setAccountState({
          kind: "error",
          message: error instanceof Error ? error.message : "Unable to load account session",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  const completeProfile = useCallback(async () => {
    if (accountState.kind !== "ready") {
      setSaveMessage("Sign in before creating an account profile.");
      return;
    }
    if (accountState.account.storageStatus !== "LIVE") {
      setSaveMessage("AccountProfile migration is required before this environment can save onboarding.");
      return;
    }

    setSaving(true);
    setSaveMessage(null);
    try {
      const updated = await updateAccountMe(accountState.token, {
        role,
        displayName: displayName.trim() || null,
        handle: handle.trim() || null,
        completeOnboarding: true,
      });
      setAccountState({ kind: "ready", token: accountState.token, account: updated });
      setCurrentStep(2);
      setStepKey((k) => k + 1);
    } catch (error) {
      setSaveMessage(error instanceof Error ? error.message : "Profile save failed");
    } finally {
      setSaving(false);
    }
  }, [accountState, displayName, handle, role]);

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

          <div className="mx-auto mt-4 w-full max-w-[720px] space-y-2">
            <ProductReadinessBanner
              description="Onboarding now reads the stored auth session and writes AccountProfile when the migration is applied. Reward animation remains preview-only until real SPUMP issuance and anti-abuse gates are live."
              status={canWriteProfile ? "SEEDED_DEMO" : "BACKEND_READY_UI_GAP"}
              title="Onboarding is session-backed; rewards are still preview-only"
            />
            <OnboardingReadinessNotice accountState={accountState} />
          </div>

          {/* Card area */}
          <div className="flex flex-1 items-center justify-center py-10">
            <div key={stepKey} className="section-enter w-full max-w-[440px]">
              {currentStep === 0 && (
                <div className="liquid-glass-shell p-8 text-center">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#de402a] text-2xl font-bold shadow-[0_20px_50px_rgba(222,64,42,0.36)]">
                    SP
                  </div>
                  <h1 className="type-h2 font-semibold">
                    Welcome to StreamPump
                  </h1>
                  <p className="mt-2 text-[length:var(--fs-sm)] text-[#8ea0ba]">
                    Complete the account profile for your current session
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-4 py-3 text-left text-xs text-[#9aabc4]">
                    {accountState.kind === "checking"
                      ? "Checking stored auth session..."
                      : accountState.kind === "signed-out"
                        ? "No auth session found. Sign in with email OTP or wallet signature before onboarding."
                        : accountState.kind === "error"
                          ? accountState.message
                          : accountState.account.storageStatus === "LIVE"
                            ? `Session wallet ${accountState.account.wallet.slice(0, 4)}...${accountState.account.wallet.slice(-4)} is ready for profile setup.`
                            : "Session is valid, but AccountProfile storage needs the Prisma migration before writes are enabled."}
                  </div>
                  {accountState.kind === "signed-out" ? (
                    <Link
                      className="glass-button-primary mt-8 flex w-full items-center justify-center gap-2.5 px-6 py-3.5 text-[length:var(--fs-sm)] font-semibold"
                      href={buildLoginHref({ nextPath: "/onboarding" })}
                    >
                      <WalletIcon />
                      Sign in to continue
                    </Link>
                  ) : (
                    <button
                      className="glass-button-primary mt-8 flex w-full items-center justify-center gap-2.5 px-6 py-3.5 text-[length:var(--fs-sm)] font-semibold disabled:opacity-45"
                      disabled={!canWriteProfile}
                      onClick={goNext}
                      type="button"
                    >
                      <WalletIcon />
                      Continue with session
                    </button>
                  )}
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
                  <h1 className="type-h2 font-semibold">
                    Choose Your Role
                  </h1>
                  <p className="mt-2 text-[length:var(--fs-sm)] text-[#8ea0ba]">
                    How will you use StreamPump?
                  </p>

                  <div className="mt-6 grid gap-3">
                    {ROLE_OPTIONS.map((option) => (
                      <button
                        className={`relative cursor-pointer rounded-[20px] border p-5 text-left transition-all duration-200 ${
                          role === option.role
                            ? "border-[#de402a]/40 bg-[#de402a]/[0.08] shadow-[0_0_24px_rgba(222,64,42,0.12)]"
                            : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.14] hover:bg-white/[0.05]"
                        }`}
                        key={option.role}
                        onClick={() => setRole(option.role)}
                        type="button"
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#de402a]/10 text-[length:var(--fs-micro)] font-bold text-[#ffb2a6]">
                            {option.badge}
                          </div>
                          <div className="pr-8">
                            <div className="text-[16px] font-semibold">{option.label}</div>
                            <div className="mt-0.5 text-[length:var(--fs-caption)] text-[#8ea0ba]">{option.description}</div>
                          </div>
                        </div>
                        {role === option.role && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#de402a]">
                              <svg className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 text-left">
                    <label className="block space-y-1.5">
                      <span className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">Display name</span>
                      <input
                        className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none"
                        maxLength={80}
                        onChange={(event) => setDisplayName(event.target.value)}
                        placeholder="Alex Chen"
                        value={displayName}
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <span className="text-[length:var(--fs-micro)] font-semibold uppercase tracking-[0.18em] text-[#7486a1]">Handle</span>
                      <input
                        className="input-glass w-full rounded-2xl px-4 py-2.5 text-sm text-white outline-none"
                        maxLength={30}
                        onChange={(event) => setHandle(event.target.value.replace(/^@+/, ""))}
                        placeholder="alexchen"
                        value={handle}
                      />
                    </label>
                  </div>

                  {saveMessage ? (
                    <div className="mt-4 rounded-2xl border tone-state-warning px-4 py-3 text-left text-xs">
                      {saveMessage}
                    </div>
                  ) : null}

                  <button
                    className="glass-button-primary mt-8 w-full px-6 py-3.5 text-[length:var(--fs-sm)] font-semibold disabled:opacity-45"
                    disabled={!canWriteProfile || saving}
                    onClick={() => void completeProfile()}
                    type="button"
                  >
                    {saving ? "Saving profile..." : `Continue as ${roleDisplay(role)}`}
                  </button>
                </div>
              )}

              {currentStep === 2 && (
                <div className="liquid-glass-shell p-8 text-center">
                  <CheckCircle animated />
                  <h1 className="type-h2 mt-4 font-semibold">
                    Profile Saved
                  </h1>
                  <p className="mt-2 text-[length:var(--fs-sm)] text-[#8ea0ba]">
                    {account?.profile?.handle
                      ? `@${account.profile.handle} is now stored for this session.`
                      : "Your account profile is now stored for this session."}
                  </p>

                  <div
                    className="mx-auto mt-6 flex w-fit items-center gap-2 rounded-full border border-[#65ecaf]/20 bg-[#65ecaf]/[0.08] px-5 py-2.5"
                    style={{ animation: "count-pop 500ms ease-out" }}
                  >
                    <span className="text-[length:var(--fs-caption)] font-medium text-[#65ecaf]">Preview XP</span>
                    <span className="text-xl font-bold tabular-nums text-[#65ecaf]">+{xpCount}</span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-[#6f8099]">
                    XP is still a preview animation. No SPUMP mint, reward ledger entry, or balance update happens here.
                  </p>

                  <button
                    className="glass-button-primary mt-8 w-full px-6 py-3.5 text-[length:var(--fs-sm)] font-semibold"
                    onClick={goNext}
                    type="button"
                  >
                    Preview Reward
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

                  <h1 className="type-h2 font-semibold">
                    Preview SPUMP Ready
                  </h1>
                  <p className="mt-2 text-[length:var(--fs-sm)] text-[#8ea0ba]">
                    Reward issuance is not live yet. This allocation remains a local onboarding preview.
                  </p>

                  <div
                    className="mt-6"
                    style={{ animation: "count-pop 600ms ease-out" }}
                  >
                    <div className="text-[48px] font-bold tabular-nums tracking-[-0.04em] text-white">
                      {spumpCount.toLocaleString()}
                    </div>
                    <div className="mt-1 text-sm font-medium text-[#8ea0ba]">preview SPUMP</div>
                  </div>

                  <Link
                    className="glass-button-primary mt-8 flex w-full items-center justify-center px-6 py-3.5 text-[length:var(--fs-sm)] font-semibold"
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
