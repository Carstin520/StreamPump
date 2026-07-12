/**
 * Central demo / preview feature gates for the StreamPump frontend.
 *
 * P0 production-truth rule: every demo fixture, seeded fallback, or local
 * simulator that could be mistaken for production behavior is gated through this
 * module so the decision is auditable in one place. Every flag DEFAULTS FALSE —
 * with no env override the app shows real data or an honest empty/error state,
 * never a fixture or a simulator, and never claims LIVE for seeded data.
 *
 * These are build-time NEXT_PUBLIC_* reads (statically inlined), so the gates
 * are safe to call from both server (getStaticProps) and client code.
 */

const isEnabled = (raw: string | undefined): boolean => {
  const value = raw?.trim().toLowerCase();
  return value === "1" || value === "true";
};

/**
 * Master switch for public-facing demo surfaces:
 *   - the `/try` scan-landing route (returns 404 when off)
 *   - seeded campaign-fixture fallback on campaign detail routes
 *   - the local Track 2 endorsement / Track 3 settlement simulators
 *   - the seeded "platform wallet" portfolio shortcut
 *
 * Enable ONLY for explicitly-labeled SEEDED_DEMO / preview builds. When enabled,
 * every gated surface must still render its SEEDED_DEMO / MOCK_PREVIEW notice.
 *
 * Env: NEXT_PUBLIC_ENABLE_PUBLIC_DEMO (default false)
 */
export const publicDemoEnabled = (): boolean =>
  isEnabled(process.env.NEXT_PUBLIC_ENABLE_PUBLIC_DEMO);

/**
 * Whether the preview provider-exchange identity path may run at all. This seats
 * a guest on a shared preview / platform-managed wallet, so it must only ever be
 * an explicit, flag-gated code path — never a silent fallback from a failed real
 * auth call.
 *
 * Env: NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH (default false)
 */
export const previewProviderExchangeEnabled = (): boolean =>
  isEnabled(process.env.NEXT_PUBLIC_ENABLE_PREVIEW_SOCIAL_AUTH);

/**
 * Dev/demo hint chrome (seeded test-wallet lists, copy buttons). Consolidated
 * here so the existing NEXT_PUBLIC_SHOW_DEMO_HINTS reads share one definition.
 *
 * Env: NEXT_PUBLIC_SHOW_DEMO_HINTS (default false) — also on in development.
 */
export const demoHintsEnabled = (): boolean =>
  isEnabled(process.env.NEXT_PUBLIC_SHOW_DEMO_HINTS) ||
  process.env.NODE_ENV === "development";
