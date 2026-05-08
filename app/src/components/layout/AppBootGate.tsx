import { ReactNode, useEffect, useState } from "react";

const BOOT_SEEN_KEY = "streampump.boot.seen";
const MIN_BOOT_MS = 1900;
const MAX_BOOT_MS = 2600;

const waitForNextPaint = () =>
  new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });

const waitForFonts = () => {
  if (!("fonts" in document)) {
    return Promise.resolve();
  }

  return document.fonts.ready.then(() => undefined).catch(() => undefined);
};

export const AppBootGate = ({ children }: { children: ReactNode }) => {
  const [showBoot, setShowBoot] = useState(true);

  useEffect(() => {
    const hasSeenBoot = window.sessionStorage.getItem(BOOT_SEEN_KEY) === "true";
    if (hasSeenBoot) {
      setShowBoot(false);
      return;
    }

    let cancelled = false;
    document.body.classList.add("app-booting");

    const minDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MIN_BOOT_MS);
    });
    const maxDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, MAX_BOOT_MS);
    });
    const ready = Promise.all([waitForFonts(), waitForNextPaint(), minDelay]);

    void Promise.race([ready, maxDelay]).then(() => {
      if (cancelled) {
        return;
      }

      window.sessionStorage.setItem(BOOT_SEEN_KEY, "true");
      document.body.classList.remove("app-booting");
      setShowBoot(false);
    });

    return () => {
      cancelled = true;
      document.body.classList.remove("app-booting");
    };
  }, []);

  return (
    <>
      {children}
      {showBoot ? (
        <div className="app-boot-overlay" aria-label="Loading StreamPump" role="status">
          <div className="app-boot-mark">SP</div>
          <div className="app-boot-name">StreamPump</div>
          <div className="app-boot-progress" />
        </div>
      ) : null}
    </>
  );
};
