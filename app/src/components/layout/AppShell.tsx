import { ReactNode } from "react";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export const AppShell = ({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) => (
  <main className="mx-auto min-h-screen max-w-[1480px] px-4 py-5 lg:px-6">
    <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
      <Sidebar />
      <div className="space-y-5">
        <Topbar action={action} subtitle={subtitle} title={title} />
        {children}
      </div>
    </div>
  </main>
);
