import { startSocialLogin } from "./api/auth";
import type { AuthSessionRecord } from "./api/types";

type SocialAuthProvider = "GOOGLE" | "APPLE";

type SocialAuthMessage = {
  type?: unknown;
  ok?: unknown;
  session?: unknown;
  error?: unknown;
};

const isAuthSession = (value: unknown): value is AuthSessionRecord => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const session = value as Partial<AuthSessionRecord>;
  return (
    typeof session.wallet === "string" &&
    typeof session.accessToken === "string" &&
    typeof session.expiresAt === "string" &&
    session.tokenType === "Bearer"
  );
};

export const openSocialLogin = async (
  provider: SocialAuthProvider
): Promise<AuthSessionRecord> => {
  const popup = window.open(
    "about:blank",
    `streampump-${provider.toLowerCase()}-login`,
    "popup=yes,width=520,height=720,resizable=yes,scrollbars=yes"
  );
  if (!popup) {
    throw new Error("The sign-in popup was blocked. Allow popups for StreamPump and try again.");
  }

  try {
    popup.document.title = "StreamPump sign-in";
    popup.document.body.textContent = "Opening secure sign-in…";
  } catch (_error) {
    // The blank popup can still be navigated even if the browser blocks DOM access.
  }

  let authorization;
  try {
    authorization = await startSocialLogin(provider);
  } catch (error) {
    popup.close();
    throw error;
  }

  const expectedOrigin = new URL(authorization.popupOrigin).origin;

  return new Promise<AuthSessionRecord>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(closePoll);
      window.clearTimeout(timeout);
    };
    const finish = (callback: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback();
    };
    const onMessage = (event: MessageEvent<SocialAuthMessage>) => {
      if (event.origin !== expectedOrigin || event.source !== popup) {
        return;
      }
      if (!event.data || event.data.type !== "streampump-social-auth") {
        return;
      }
      if (event.data.ok === true && isAuthSession(event.data.session)) {
        finish(() => resolve(event.data.session as AuthSessionRecord));
        return;
      }
      const message = typeof event.data.error === "string"
        ? event.data.error
        : "Social sign-in could not be completed.";
      finish(() => reject(new Error(message)));
    };
    const closePoll = window.setInterval(() => {
      if (popup.closed) {
        finish(() => reject(new Error("Social sign-in was cancelled.")));
      }
    }, 400);
    const timeout = window.setTimeout(() => {
      popup.close();
      finish(() => reject(new Error("Social sign-in timed out. Please try again.")));
    }, 2 * 60 * 1000);

    window.addEventListener("message", onMessage);
    popup.location.assign(authorization.authorizationUrl);
  });
};
