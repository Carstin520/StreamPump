import Link from "next/link";

export const AsyncStateCard = ({
  actionHref,
  actionLabel,
  body,
  title,
}: {
  actionHref?: string;
  actionLabel?: string;
  body: string;
  title: string;
}) => (
  <section className="glass-card p-5">
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Data state</p>
        <h2 className="mt-2 text-2xl font-semibold text-white">{title}</h2>
      </div>
      <p className="text-sm leading-7 text-slate-300">{body}</p>
      {actionHref && actionLabel ? (
        <Link className="inline-flex rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-950" href={actionHref}>
          {actionLabel}
        </Link>
      ) : null}
    </div>
  </section>
);
