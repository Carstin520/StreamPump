import { ReactNode } from "react";

export const Panel = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={`app-shell-frame rounded-[28px] p-5 text-slate-100 ${className}`}
  >
    {children}
  </section>
);
