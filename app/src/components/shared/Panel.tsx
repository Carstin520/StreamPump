import { ReactNode } from "react";

export const Panel = ({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) => (
  <section
    className={`app-shell-frame p-5 text-slate-100 ${className}`}
  >
    {children}
  </section>
);
