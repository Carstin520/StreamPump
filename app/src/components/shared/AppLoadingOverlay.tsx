import { useEffect, useState } from "react";

const INITIAL_HOLD_MS = 640;

export const AppLoadingOverlay = () => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setVisible(false);
    }, INITIAL_HOLD_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, []);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#020407] transition duration-500 ${
        visible ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/12 bg-[#de402a] text-xl font-semibold text-white shadow-[0_18px_44px_rgba(222,64,42,0.36)]">
          SP
        </div>
        <div className="text-center">
          <p className="text-lg font-semibold tracking-[-0.05em] text-white">StreamPump</p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.28em] text-[#8ea0ba]">Loading interface</p>
        </div>
      </div>
    </div>
  );
};
