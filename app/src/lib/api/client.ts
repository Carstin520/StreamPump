const normalizeOrigin = (value?: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
  (() => {
    const backendOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_BACKEND_BASE_URL);
    return backendOrigin ? `${backendOrigin}/api/v1` : "http://localhost:4000/api/v1";
  })();

type QueryValue = string | number | boolean | undefined | null;

type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: BodyInit | Record<string, unknown> | null;
  query?: Record<string, QueryValue>;
  token?: string;
};

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
  };
};

const buildUrl = (path: string, query?: Record<string, QueryValue>) => {
  if (path.startsWith("http")) {
    const url = new URL(path);

    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === "") {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }

    return url.toString();
  }

  const absoluteBase = /^https?:\/\//.test(API_BASE_URL);
  const normalizedBase = API_BASE_URL.endsWith("/") ? API_BASE_URL : `${API_BASE_URL}/`;
  const resolvedBase = absoluteBase
    ? normalizedBase
    : `http://local${normalizedBase.startsWith("/") ? normalizedBase : `/${normalizedBase}`}`;
  const url = new URL(path.replace(/^\//, ""), resolvedBase);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return absoluteBase ? url.toString() : `${url.pathname}${url.search}`;
};

const normalizeBody = (body: ApiRequestOptions["body"], headers: Headers) => {
  if (!body || typeof body !== "object" || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
    return body ?? undefined;
  }

  headers.set("Content-Type", "application/json");
  return JSON.stringify(body);
};

const request = async <T>(path: string, options: ApiRequestOptions = {}): Promise<T> => {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");

  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(buildUrl(path, options.query), {
    ...options,
    headers,
    body: normalizeBody(options.body, headers),
  });

  if (!response.ok) {
    const payload = await response.text();
    let message = payload;

    try {
      const parsed = JSON.parse(payload) as ApiEnvelope<unknown>;
      message = parsed.error?.message ?? parsed.error?.code ?? payload;
    } catch (_parseError) {
      message = payload;
    }

    throw new Error(message || `API request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T | ApiEnvelope<T>;
  if (
    payload &&
    typeof payload === "object" &&
    "ok" in payload &&
    typeof payload.ok === "boolean"
  ) {
    const envelope = payload as ApiEnvelope<T>;
    return envelope.data as T;
  }

  return payload as T;
};

export const apiClient = {
  delete: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options, method: "DELETE" }),
  get: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options, method: "GET" }),
  patch: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options, method: "PATCH" }),
  post: <T>(path: string, options?: ApiRequestOptions) => request<T>(path, { ...options, method: "POST" }),
};
