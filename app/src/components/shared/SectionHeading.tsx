export const SectionHeading = ({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) => (
  <div className="space-y-2">
    <p className="text-[11px] uppercase tracking-[0.32em] text-sky-200/70">{eyebrow}</p>
    <h2 className="text-2xl font-semibold tracking-tight text-white">{title}</h2>
    {description ? <p className="max-w-2xl text-sm text-slate-300">{description}</p> : null}
  </div>
);
