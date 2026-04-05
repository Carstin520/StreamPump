import { ReactNode } from "react";

export const Panel = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={`rounded-[28px] border border-white/12 bg-[#0f1726]/88 p-5 text-slate-100 shadow-[0_24px_80px_rgba(3,7,18,0.35)] backdrop-blur-xl ${className}`}
  >
    {children}
  </section>
);
