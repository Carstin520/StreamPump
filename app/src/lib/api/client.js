"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.apiClient = void 0;
const normalizeOrigin = (value) => {
    const trimmed = value?.trim();
    if (!trimmed) {
        return null;
    }
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
};
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    (() => {
        const backendOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_BACKEND_BASE_URL);
        return backendOrigin ? `${backendOrigin}/api/v1` : "http://localhost:4000/api/v1";
    })();
const buildUrl = (path, query) => {
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
const normalizeBody = (body, headers) => {
    if (!body || typeof body !== "object" || body instanceof FormData || body instanceof URLSearchParams || body instanceof Blob) {
        return body ?? undefined;
    }
    headers.set("Content-Type", "application/json");
    return JSON.stringify(body);
};
const request = async (path, options = {}) => {
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
            const parsed = JSON.parse(payload);
            message = parsed.error?.message ?? parsed.error?.code ?? payload;
        }
        catch (_parseError) {
            message = payload;
        }
        throw new Error(message || `API request failed with ${response.status}`);
    }
    if (response.status === 204) {
        return undefined;
    }
    const payload = (await response.json());
    if (payload &&
        typeof payload === "object" &&
        "ok" in payload &&
        typeof payload.ok === "boolean") {
        const envelope = payload;
        return envelope.data;
    }
    return payload;
};
exports.apiClient = {
    delete: (path, options) => request(path, { ...options, method: "DELETE" }),
    get: (path, options) => request(path, { ...options, method: "GET" }),
    patch: (path, options) => request(path, { ...options, method: "PATCH" }),
    post: (path, options) => request(path, { ...options, method: "POST" }),
};
