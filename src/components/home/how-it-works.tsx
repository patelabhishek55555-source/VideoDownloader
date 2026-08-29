import { HOW_IT_WORKS } from "@/lib/seo/content";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container-page scroll-mt-24 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">How it works</p>
        <h2 className="mt-3 text-display-sm text-foreground">Three steps, no account</h2>
      </div>

      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {HOW_IT_WORKS.map((step) => (
          <li
            key={step.number}
            className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-6 transition-colors hover:border-border"
          >
            <span className="text-5xl font-semibold tracking-tighter text-foreground/12">{step.number}</span>
            <h3 className="mt-4 text-[15px] font-semibold text-foreground">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
