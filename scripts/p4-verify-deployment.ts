import assert from "node:assert/strict";

const DEFAULT_OBSERVATION_SECONDS = 95;
const MINIMUM_DEPLOYMENT_OBSERVATION_SECONDS = 91;
const DEFAULT_POLL_INTERVAL_MS = 5_000;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_JSON_BYTES = 64 * 1024;
const FULL_GIT_SHA_PATTERN = /^[0-9a-f]{40}$/;

type JsonObject = Record<string, unknown>;

export type DeploymentVerificationConfig = {
  apiOrigin: string;
  expectedReleaseSha: string;
  deployedReleaseSha: string;
  allowedOrigin: string;
  disallowedOrigin: string;
  observationSeconds: number;
  pollIntervalMs: number;
};

type ProbeResult = {
  status: number;
  headers: Headers;
  json?: unknown;
};

type FetchLike = typeof fetch;

const fail = (message: string): never => {
  throw new Error(message);
};

const parsePositiveInteger = (value: string, name: string): number => {
  if (!/^\d+$/.test(value)) {
    return fail(`${name} must be a positive integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return fail(`${name} must be a positive integer`);
  }
  return parsed;
};

const normalizeOrigin = (value: string, name: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fail(`${name} must be an absolute URL origin`);
  }

  if (parsed.protocol !== "https:") {
    return fail(`${name} must use https`);
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return fail(`${name} must not contain credentials, query parameters, or fragments`);
  }
  if (parsed.pathname !== "/") {
    return fail(`${name} must be an origin without a path`);
  }
  return parsed.origin;
};

const normalizeGitSha = (value: string, name: string): string => {
  const normalized = value.trim().toLowerCase();
  if (!FULL_GIT_SHA_PATTERN.test(normalized)) {
    return fail(`${name} must be a full 40-character Git SHA`);
  }
  return normalized;
};

const parseFlagMap = (argv: string[]): Map<string, string> => {
  const result = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      return fail(`invalid argument near ${flag ?? "end of command"}`);
    }
    if (result.has(flag)) {
      return fail(`duplicate argument: ${flag}`);
    }
    result.set(flag, value);
  }
  return result;
};

export const parseDeploymentVerificationArgs = (
  argv: string[],
  options: { testOnlyAllowShortObservation?: boolean } = {}
): DeploymentVerificationConfig => {
  const flags = parseFlagMap(argv);
  const supported = new Set([
    "--api-origin",
    "--expected-release-sha",
    "--deployed-release-sha",
    "--allowed-origin",
    "--disallowed-origin",
    "--observation-seconds",
    "--poll-interval-ms",
  ]);
  for (const flag of flags.keys()) {
    if (!supported.has(flag)) {
      return fail(`unsupported argument: ${flag}`);
    }
  }

  const required = (flag: string): string => {
    const value = flags.get(flag)?.trim();
    return value || fail(`missing required argument: ${flag}`);
  };

  const apiOrigin = normalizeOrigin(required("--api-origin"), "--api-origin");
  const allowedOrigin = normalizeOrigin(required("--allowed-origin"), "--allowed-origin");
  const disallowedOrigin = normalizeOrigin(
    required("--disallowed-origin"),
    "--disallowed-origin"
  );
  if (allowedOrigin === disallowedOrigin) {
    return fail("--allowed-origin and --disallowed-origin must be different");
  }

  const expectedReleaseSha = normalizeGitSha(
    required("--expected-release-sha"),
    "--expected-release-sha"
  );
  const deployedReleaseSha = normalizeGitSha(
    required("--deployed-release-sha"),
    "--deployed-release-sha"
  );
  if (expectedReleaseSha !== deployedReleaseSha) {
    return fail("Render deployment metadata SHA does not match the expected release SHA");
  }

  const observationSeconds = flags.has("--observation-seconds")
    ? parsePositiveInteger(flags.get("--observation-seconds") as string, "--observation-seconds")
    : DEFAULT_OBSERVATION_SECONDS;
  if (
    observationSeconds < MINIMUM_DEPLOYMENT_OBSERVATION_SECONDS &&
    !options.testOnlyAllowShortObservation
  ) {
    return fail(
      `--observation-seconds must be at least ${MINIMUM_DEPLOYMENT_OBSERVATION_SECONDS} for a deployment verification`
    );
  }

  const pollIntervalMs = flags.has("--poll-interval-ms")
    ? parsePositiveInteger(flags.get("--poll-interval-ms") as string, "--poll-interval-ms")
    : DEFAULT_POLL_INTERVAL_MS;
  if (pollIntervalMs > observationSeconds * 1_000) {
    return fail("--poll-interval-ms must not exceed the observation window");
  }

  return {
    apiOrigin,
    expectedReleaseSha,
    deployedReleaseSha,
    allowedOrigin,
    disallowedOrigin,
    observationSeconds,
    pollIntervalMs,
  };
};

const isJsonObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requireObject = (value: unknown, name: string): JsonObject =>
  isJsonObject(value) ? value : fail(`${name} must be a JSON object`);

const requireExactValue = (actual: unknown, expected: unknown, name: string): void => {
  if (actual !== expected) {
    fail(`${name} did not match the closed Pilot contract`);
  }
};

export const assertHealthPayload = (payload: unknown, expectedReleaseSha: string): void => {
  const health = requireObject(payload, "health response");
  const accessPolicy = requireObject(health.accessPolicy, "health accessPolicy");

  requireExactValue(health.ok, true, "health.ok");
  requireExactValue(health.mode, "PUBLIC_SOCIAL_PILOT", "health.mode");
  requireExactValue(health.automatedSettlement, false, "health.automatedSettlement");
  requireExactValue(accessPolicy.configured, true, "health.accessPolicy.configured");
  requireExactValue(accessPolicy.type, "open", "health.accessPolicy.type");

  const releaseSha = health.releaseSha;
  if (typeof releaseSha !== "string" || releaseSha.trim() === "") {
    fail("health.releaseSha must be present as a full 40-character Git SHA");
  }
  requireExactValue(
    normalizeGitSha(releaseSha, "health.releaseSha"),
    expectedReleaseSha,
    "health.releaseSha"
  );
};

export const assertReadyPayload = (payload: unknown): void => {
  const ready = requireObject(payload, "ready response");
  const services = requireObject(ready.services, "ready services");

  requireExactValue(ready.ok, true, "ready.ok");
  requireExactValue(ready.status, "READY", "ready.status");
  requireExactValue(services.database, "READY", "ready.services.database");
  requireExactValue(services.indexer, "READY", "ready.services.indexer");
  requireExactValue(
    services.muxReconciliation,
    "READY",
    "ready.services.muxReconciliation"
  );
};

const readBoundedJson = async (response: Response, label: string): Promise<unknown> => {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_BYTES) {
    return fail(`${label} response exceeded the JSON size limit`);
  }

  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > MAX_JSON_BYTES) {
    return fail(`${label} response exceeded the JSON size limit`);
  }
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return fail(`${label} response was not valid JSON`);
  }
};

const request = async (
  fetchImpl: FetchLike,
  apiOrigin: string,
  path: string,
  init: RequestInit,
  options: { parseJson?: boolean } = {}
): Promise<ProbeResult> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${apiOrigin}${path}`, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    return {
      status: response.status,
      headers: response.headers,
      json: options.parseJson ? await readBoundedJson(response, path) : undefined,
    };
  } catch (error) {
    const reason = error instanceof Error && error.name === "AbortError" ? "timed out" : "failed";
    return fail(`${init.method ?? "GET"} ${path} ${reason}`);
  } finally {
    clearTimeout(timeout);
  }
};

const requireStatus = (probe: ProbeResult, expected: number, label: string): void => {
  if (probe.status !== expected) {
    fail(`${label} returned HTTP ${probe.status}; expected ${expected}`);
  }
};

export const assertControlPlaneHeaders = (probe: ProbeResult, label: string): void => {
  const cacheControl = probe.headers.get("cache-control") ?? "";
  const surrogateControl = probe.headers.get("surrogate-control") ?? "";
  if (!cacheControl.split(",").some((value) => value.trim().toLowerCase() === "no-store")) {
    fail(`${label} omitted Cache-Control: no-store`);
  }
  if (!surrogateControl.split(",").some((value) => value.trim().toLowerCase() === "no-store")) {
    fail(`${label} omitted Surrogate-Control: no-store`);
  }
  if (probe.headers.get("x-powered-by") !== null) {
    fail(`${label} exposed X-Powered-By`);
  }
};

export const assertClosedPostProbe = (probe: ProbeResult, label: string): void => {
  requireStatus(probe, 404, label);
};

const assertErrorCode = (probe: ProbeResult, expectedCode: string, label: string): void => {
  const envelope = requireObject(probe.json, `${label} response`);
  const error = requireObject(envelope.error, `${label} error`);
  requireExactValue(envelope.ok, false, `${label}.ok`);
  requireExactValue(error.code, expectedCode, `${label}.error.code`);
};

const verifyCors = async (fetchImpl: FetchLike, config: DeploymentVerificationConfig) => {
  const allowed = await request(
    fetchImpl,
    config.apiOrigin,
    "/health",
    { method: "GET", headers: { origin: config.allowedOrigin } },
    { parseJson: true }
  );
  requireStatus(allowed, 200, "allowed-origin health probe");
  assertControlPlaneHeaders(allowed, "allowed-origin health probe");
  requireExactValue(
    allowed.headers.get("access-control-allow-origin"),
    config.allowedOrigin,
    "allowed-origin CORS header"
  );
  requireExactValue(
    allowed.headers.get("access-control-allow-credentials"),
    "true",
    "allowed-origin credentials header"
  );
  assertHealthPayload(allowed.json, config.expectedReleaseSha);

  const denied = await request(fetchImpl, config.apiOrigin, "/health", {
    method: "GET",
    headers: { origin: config.disallowedOrigin },
  });
  if (denied.status < 400) {
    fail(`disallowed-origin health probe returned HTTP ${denied.status}`);
  }
  if (denied.headers.get("access-control-allow-origin") === config.disallowedOrigin) {
    fail("disallowed origin received an allow-origin CORS header");
  }
};

const verifyClosedSurfaces = async (
  fetchImpl: FetchLike,
  config: DeploymentVerificationConfig
): Promise<void> => {
  const providerExchange = await request(
    fetchImpl,
    config.apiOrigin,
    "/api/v1/auth/provider-exchange",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    },
    { parseJson: true }
  );
  requireStatus(providerExchange, 403, "provider-exchange probe");
  assertErrorCode(
    providerExchange,
    "PREVIEW_PROVIDER_EXCHANGE_DISABLED",
    "provider-exchange probe"
  );

  const operator = await request(
    fetchImpl,
    config.apiOrigin,
    "/api/v1/internal/content/publications",
    { method: "GET" },
    { parseJson: true }
  );
  requireStatus(operator, 403, "unauthenticated operator probe");
  assertControlPlaneHeaders(operator, "unauthenticated operator probe");
  assertErrorCode(operator, "OPERATOR_AUTH_REQUIRED", "unauthenticated operator probe");

  const s1MarketRead = await request(
    fetchImpl,
    config.apiOrigin,
    "/api/v1/market/overview",
    { method: "GET" }
  );
  requireStatus(s1MarketRead, 404, "S1 market read probe");

  const closedRoutes = [
    ["prototype write", "/api/prototype/videos/upload"],
    ["S1 write", "/api/v1/s1/buy/build"],
    ["S1 managed execution", "/api/v1/s1/managed/execute"],
    ["engagement reward", "/api/v1/s1/engagement-reward/build"],
    ["email auth", "/api/v1/auth/email/request-code"],
    ["ephemeral managed session", "/api/v1/auth/ephemeral-session"],
    ["Track2 endorsement", "/api/v1/proposals/p4-read-only-probe/endorse/build"],
    ["Track2 metric ingestion", "/api/webhooks/clicks"],
  ] as const;

  for (const [label, path] of closedRoutes) {
    // Each enabled implementation rejects this empty, unauthenticated payload
    // before any database, storage, managed-wallet, or chain mutation. A disabled
    // surface has no matching POST route and therefore must return exactly 404.
    const probe = await request(fetchImpl, config.apiOrigin, path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    assertClosedPostProbe(probe, label);
  }
};

const verifyHealthAndReadiness = async (
  fetchImpl: FetchLike,
  config: DeploymentVerificationConfig
): Promise<void> => {
  const health = await request(
    fetchImpl,
    config.apiOrigin,
    "/health",
    { method: "GET" },
    { parseJson: true }
  );
  requireStatus(health, 200, "health probe");
  assertControlPlaneHeaders(health, "health probe");
  assertHealthPayload(health.json, config.expectedReleaseSha);

  const healthAlias = await request(
    fetchImpl,
    config.apiOrigin,
    "/HEALTH",
    { method: "GET" },
    { parseJson: true }
  );
  requireStatus(healthAlias, 200, "health alias probe");
  assertControlPlaneHeaders(healthAlias, "health alias probe");
  assertHealthPayload(healthAlias.json, config.expectedReleaseSha);

  const ready = await request(
    fetchImpl,
    config.apiOrigin,
    "/ready",
    { method: "GET" },
    { parseJson: true }
  );
  requireStatus(ready, 200, "readiness probe");
  assertControlPlaneHeaders(ready, "readiness probe");
  assertReadyPayload(ready.json);

  const readyAlias = await request(
    fetchImpl,
    config.apiOrigin,
    "/ready/",
    { method: "GET" },
    { parseJson: true }
  );
  requireStatus(readyAlias, 200, "readiness alias probe");
  assertControlPlaneHeaders(readyAlias, "readiness alias probe");
  assertReadyPayload(readyAlias.json);
};

export const runDeploymentVerification = async (
  config: DeploymentVerificationConfig,
  dependencies: { fetchImpl?: FetchLike; now?: () => number; sleep?: (ms: number) => Promise<void> } = {}
): Promise<{ observations: number; elapsedSeconds: number; releaseEvidence: string }> => {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const now = dependencies.now ?? (() => performance.now());
  const sleep = dependencies.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  // Bind both Render deployment metadata and the live process health payload to
  // the exact fixed candidate before accepting any observation.
  requireExactValue(
    config.deployedReleaseSha,
    config.expectedReleaseSha,
    "Render deployment metadata SHA"
  );

  await verifyCors(fetchImpl, config);
  await verifyClosedSurfaces(fetchImpl, config);

  const startedAt = now();
  const deadline = startedAt + config.observationSeconds * 1_000;
  let observations = 0;
  while (true) {
    await verifyHealthAndReadiness(fetchImpl, config);
    observations += 1;

    const currentTime = now();
    if (currentTime >= deadline) {
      return {
        observations,
        elapsedSeconds: (currentTime - startedAt) / 1_000,
        releaseEvidence: "health_payload_and_render_deployment_metadata",
      };
    }
    await sleep(Math.min(config.pollIntervalMs, deadline - currentTime));
  }
};

const runSelfTest = async (): Promise<void> => {
  const sha = "a".repeat(40);
  const baseArgs = [
    "--api-origin",
    "https://api.example.test",
    "--expected-release-sha",
    sha,
    "--deployed-release-sha",
    sha,
    "--allowed-origin",
    "https://app.example.test",
    "--disallowed-origin",
    "https://blocked.example.test",
  ];

  const parsed = parseDeploymentVerificationArgs(baseArgs);
  assert.equal(parsed.observationSeconds, DEFAULT_OBSERVATION_SECONDS);
  assert.throws(
    () => parseDeploymentVerificationArgs([...baseArgs, "--observation-seconds", "90"]),
    /at least 91/
  );
  assert.throws(
    () =>
      parseDeploymentVerificationArgs([
        ...baseArgs.slice(0, 5),
        "b".repeat(40),
        ...baseArgs.slice(6),
      ]),
    /does not match/
  );
  assert.equal(
    parseDeploymentVerificationArgs(
      [...baseArgs, "--observation-seconds", "1", "--poll-interval-ms", "1000"],
      { testOnlyAllowShortObservation: true }
    ).observationSeconds,
    1
  );

  assertHealthPayload(
    {
      ok: true,
      mode: "PUBLIC_SOCIAL_PILOT",
      automatedSettlement: false,
      releaseSha: sha,
      accessPolicy: { configured: true, type: "open" },
    },
    sha
  );
  for (const releaseSha of [undefined, null, "b".repeat(40)]) {
    assert.throws(
      () =>
        assertHealthPayload(
          {
            ok: true,
            mode: "PUBLIC_SOCIAL_PILOT",
            automatedSettlement: false,
            releaseSha,
            accessPolicy: { configured: true, type: "open" },
          },
          sha
        ),
      /health\.releaseSha/
    );
  }
  assert.throws(
    () =>
      assertHealthPayload(
        {
          ok: true,
          mode: "PUBLIC_SOCIAL_PILOT",
          automatedSettlement: true,
          accessPolicy: { configured: true, type: "open" },
        },
        sha
      ),
    /automatedSettlement/
  );
  assertReadyPayload({
    ok: true,
    status: "READY",
    services: { database: "READY", indexer: "READY", muxReconciliation: "READY" },
  });
  assert.throws(
    () =>
      assertReadyPayload({
        ok: true,
        status: "READY",
        services: { database: "READY", indexer: "DISABLED", muxReconciliation: "READY" },
      }),
    /indexer/
  );
  assertClosedPostProbe({ status: 404, headers: new Headers() }, "closed route");
  assert.throws(
    () =>
      assertClosedPostProbe({ status: 401, headers: new Headers() }, "open route"),
    /expected 404/
  );
  assertControlPlaneHeaders(
    {
      status: 200,
      headers: new Headers({
        "cache-control": "private, no-store",
        "surrogate-control": "no-store",
      }),
    },
    "control-plane response"
  );
  assert.throws(
    () => assertControlPlaneHeaders({ status: 200, headers: new Headers() }, "stale response"),
    /Cache-Control/
  );
  assert.throws(
    () =>
      assertControlPlaneHeaders(
        {
          status: 200,
          headers: new Headers({ "cache-control": "no-store" }),
        },
        "edge-stale response"
      ),
    /Surrogate-Control/
  );
  assert.throws(
    () =>
      assertControlPlaneHeaders(
        {
          status: 200,
          headers: new Headers({
            "cache-control": "no-store",
            "surrogate-control": "no-store",
            "x-powered-by": "Express",
          }),
        },
        "disclosing response"
      ),
    /X-Powered-By/
  );

  const shortConfig = parseDeploymentVerificationArgs(
    [...baseArgs, "--observation-seconds", "1", "--poll-interval-ms", "1000"],
    { testOnlyAllowShortObservation: true }
  );
  let fakeNow = 0;
  const observedRequests: Array<{
    method: string;
    path: string;
    body: unknown;
    authorization: string | null;
    operatorKey: string | null;
  }> = [];
  const mockFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const normalizedPathname = url.pathname.toLowerCase().replace(/\/+$/, "");
    const method = init?.method ?? "GET";
    const requestHeaders = new Headers(init?.headers);
    observedRequests.push({
      method,
      path: url.pathname,
      body: init?.body,
      authorization: requestHeaders.get("authorization"),
      operatorKey: requestHeaders.get("x-internal-operator-key"),
    });

    if (url.pathname === "/health" && init?.headers) {
      const origin = requestHeaders.get("origin");
      if (origin === shortConfig.disallowedOrigin) {
        return new Response("suppressed", { status: 500 });
      }
      if (origin === shortConfig.allowedOrigin) {
        return Response.json(
          {
            ok: true,
            mode: "PUBLIC_SOCIAL_PILOT",
            automatedSettlement: false,
            releaseSha: sha,
            accessPolicy: { configured: true, type: "open" },
          },
          {
            status: 200,
            headers: {
              "access-control-allow-origin": origin,
              "access-control-allow-credentials": "true",
              "cache-control": "no-store",
              "surrogate-control": "no-store",
            },
          }
        );
      }
    }
    if (normalizedPathname === "/health") {
      return Response.json(
        {
          ok: true,
          mode: "PUBLIC_SOCIAL_PILOT",
          automatedSettlement: false,
          releaseSha: sha,
          accessPolicy: { configured: true, type: "open" },
        },
        { headers: { "cache-control": "no-store", "surrogate-control": "no-store" } }
      );
    }
    if (normalizedPathname === "/ready") {
      return Response.json(
        {
          ok: true,
          status: "READY",
          services: { database: "READY", indexer: "READY", muxReconciliation: "READY" },
        },
        { headers: { "cache-control": "no-store", "surrogate-control": "no-store" } }
      );
    }
    if (url.pathname === "/api/v1/auth/provider-exchange") {
      return Response.json(
        { ok: false, error: { code: "PREVIEW_PROVIDER_EXCHANGE_DISABLED" } },
        { status: 403 }
      );
    }
    if (url.pathname === "/api/v1/internal/content/publications") {
      return Response.json(
        { ok: false, error: { code: "OPERATOR_AUTH_REQUIRED" } },
        {
          status: 403,
          headers: { "cache-control": "no-store", "surrogate-control": "no-store" },
        }
      );
    }
    return new Response(undefined, { status: 404 });
  }) as FetchLike;

  const result = await runDeploymentVerification(shortConfig, {
    fetchImpl: mockFetch,
    now: () => fakeNow,
    sleep: async (ms) => {
      fakeNow += ms;
    },
  });
  assert.equal(result.observations, 2);
  assert.equal(result.elapsedSeconds, 1);
  assert.equal(result.releaseEvidence, "health_payload_and_render_deployment_metadata");
  for (const path of [
    "/HEALTH",
    "/ready/",
    "/api/v1/internal/content/publications",
  ]) {
    assert.ok(
      observedRequests.some(({ method, path: observedPath }) =>
        method === "GET" && observedPath === path
      ),
      `deployment verification did not request ${path}`
    );
  }
  const postRequests = observedRequests.filter(({ method }) => method === "POST");
  assert.equal(postRequests.length, 9);
  assert.ok(postRequests.every(({ body }) => body === "{}"));
  assert.deepEqual(
    observedRequests.filter(
      ({ method, path }) => method === "GET" && path === "/api/v1/market/overview"
    ),
    [
      {
        method: "GET",
        path: "/api/v1/market/overview",
        body: undefined,
        authorization: null,
        operatorKey: null,
      },
    ]
  );
  assert.ok(
    observedRequests.every(
      ({ authorization, operatorKey }) => authorization === null && operatorKey === null
    )
  );
  assert.equal(observedRequests.filter(({ method }) => method === "OPTIONS").length, 0);

  console.log("P4 deployment verifier self-test: PASS");
};

const main = async (): Promise<void> => {
  if (process.argv.slice(2).length === 1 && process.argv[2] === "--self-test") {
    await runSelfTest();
    return;
  }

  const config = parseDeploymentVerificationArgs(process.argv.slice(2));
  console.log("P4 deployment verification started (response bodies are suppressed)");
  const result = await runDeploymentVerification(config);
  console.log(
    `P4 deployment verification: PASS observations=${result.observations} elapsedSeconds=${result.elapsedSeconds.toFixed(1)} releaseEvidence=${result.releaseEvidence}`
  );
};

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "unknown verification failure";
    console.error(`P4 deployment verification: FAIL ${message}`);
    process.exitCode = 1;
  });
}
