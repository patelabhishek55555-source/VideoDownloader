import { Gauge, Layers, FileArchive, ListOrdered, UserRound, Smartphone } from "lucide-react";

import { FEATURES } from "@/lib/seo/content";

const ICONS = {
  layers: Layers,
  archive: FileArchive,
  gauge: Gauge,
  list: ListOrdered,
  user: UserRound,
  phone: Smartphone,
} as const;

export function Features() {
  return (
    <section id="features" className="container-page scroll-mt-24 py-20">
      <div className="max-w-2xl">
        <p className="text-sm font-medium text-primary">Features</p>
        <h2 className="mt-3 text-display-sm text-foreground">
          Everything a downloader should do, and the things it usually forgets
        </h2>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Single-link saving is table stakes. This is built for the case where you have a list of links and want
          the whole set on your device without babysitting twenty browser tabs.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => {
          const Icon = ICONS[feature.icon];
          return (
            <article
              key={feature.id}
              className="group rounded-2xl border border-border/80 bg-card p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:shadow-card"
            >
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border/70 bg-muted text-primary transition-colors group-hover:bg-primary/12">
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
