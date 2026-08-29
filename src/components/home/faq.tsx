import { FaqAccordion } from "@/components/landing/page-faq";
import { FAQ_ITEMS } from "@/lib/seo/content";

export function Faq() {
  return (
    <section id="faq" className="container-page scroll-mt-24 py-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <div>
          <p className="text-sm font-medium text-primary">FAQ</p>
          <h2 className="mt-3 text-display-sm text-foreground">Questions, answered</h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Still stuck? The{" "}
            <a href="/contact" className="text-primary underline-offset-4 hover:underline">
              contact page
            </a>{" "}
            has the details.
          </p>
        </div>

        <FaqAccordion items={FAQ_ITEMS} className="rounded-2xl border border-border/80 bg-card px-6" />
      </div>
    </section>
  );
}
