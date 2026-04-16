import { AuthSessionRecord } from "@/lib/api/types";

const AUTH_SESSION_STORAGE_KEY = "streampump.auth.session";

const isExpired = (expiresAt: string) => {
  const timestamp = Date.parse(expiresAt);
  return Number.isNaN(timestamp) || timestamp <= Date.now();
};

export const getStoredAuthSession = (): AuthSessionRecord | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as AuthSessionRecord;
    if (!session.accessToken || !session.expiresAt || isExpired(session.expiresAt)) {
      window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    return session;
  } catch (_error) {
    window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    return null;
  }
};

export const storeAuthSession = (session: AuthSessionRecord) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredAuthSession = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
};
