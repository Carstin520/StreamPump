export const Dashboard = () => {
  return (
    <section className="grid gap-3 rounded-xl bg-white/70 p-4 shadow-md backdrop-blur-sm md:grid-cols-3">
      <article>
        <p className="text-xs uppercase tracking-wide text-ink/60">Traffic Futures</p>
        <p className="text-xl font-semibold">0</p>
      </article>
      <article>
        <p className="text-xs uppercase tracking-wide text-ink/60">Escrowed USDC</p>
        <p className="text-xl font-semibold">0.00</p>
      </article>
      <article>
        <p className="text-xs uppercase tracking-wide text-ink/60">Oracle Status</p>
        <p className="text-xl font-semibold">-</p>
      </article>
    </section>
  );
};
