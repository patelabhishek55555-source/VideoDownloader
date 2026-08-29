import { Layers, Gauge, FileArchive, Smartphone } from "lucide-react";

import { TRUST_STRIP } from "@/lib/seo/content";

const ICONS = [Layers, FileArchive, Gauge, Smartphone];

export function TrustStrip() {
  return (
    <section aria-label="Highlights" className="container-page py-12">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 lg:grid-cols-4">
        {TRUST_STRIP.map((item, index) => {
          const Icon = ICONS[index % ICONS.length]!;
          return (
            <div key={item.label} className="bg-card px-5 py-6">
              <Icon className="h-4 w-4 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-semibold text-foreground">{item.label}</p>
              <p className="mt-1 text-[13px] leading-snug text-muted-foreground">{item.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
