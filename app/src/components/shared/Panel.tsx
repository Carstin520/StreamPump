import { CSSProperties, ReactNode } from "react";

export const Panel = ({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <section
    className={`app-shell-frame p-5 text-slate-100 ${className}`}
    style={style}
  >
    {children}
  </section>
);
