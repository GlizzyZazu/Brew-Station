type PlaceholderViewProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function PlaceholderView({ eyebrow, title, description }: PlaceholderViewProps) {
  return (
    <section className="placeholder">
      <p className="kicker">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="placeholderGrid">
        <div>Reusable UI primitives</div>
        <div>Feature-owned model logic</div>
        <div>Supabase-backed data</div>
      </div>
    </section>
  );
}
