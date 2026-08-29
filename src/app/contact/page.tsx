import Link from "next/link";
import { Mail, MessageSquareWarning, ShieldCheck } from "lucide-react";

import { LandingShell } from "@/components/landing/landing-shell";
import { getConfig } from "@/lib/config/env";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Contact",
  description: "Get in touch about Video Downloader — support questions, bug reports, takedown requests and abuse reports.",
  path: "/contact",
});

export default function ContactPage() {
  const config = getConfig();
  const mailto = `mailto:support@${new URL(config.site.url).hostname.replace(/^www\./, "")}`;

  return (
    <LandingShell
      eyebrow="Contact"
      title="Contact"
      lede="Support questions, bug reports, takedown requests and abuse reports are all welcome."
    >
      <div className="not-prose grid gap-3 sm:grid-cols-3">
        <a
          href={mailto}
          className="rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:border-border"
        >
          <Mail className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-[15px] font-semibold text-foreground">Support</h2>
          <p className="mt-1 text-sm text-muted-foreground">Questions about the tool</p>
        </a>
        <a
          href={mailto}
          className="rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:border-border"
        >
          <MessageSquareWarning className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-[15px] font-semibold text-foreground">Report a problem</h2>
          <p className="mt-1 text-sm text-muted-foreground">Bugs and broken links</p>
        </a>
        <a
          href={mailto}
          className="rounded-2xl border border-border/80 bg-card p-5 transition-colors hover:border-border"
        >
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
          <h2 className="mt-3 text-[15px] font-semibold text-foreground">Takedown &amp; abuse</h2>
          <p className="mt-1 text-sm text-muted-foreground">Copyright and safety reports</p>
        </a>
      </div>

      <h2>Before you write</h2>
      <p>
        Most questions are already answered in the <Link href="/#faq">FAQ</Link>. If a link failed, the error shown
        on its card usually explains why: the post may not be public, it may have been removed, or the source may
        have rate limited the request.
      </p>

      <h2>If you are the operator</h2>
      <p>
        Deployment, provider and storage configuration is documented in the project README. The{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[13px] text-foreground">/api/health</code>{" "}
        endpoint reports which optional subsystems are configured on a live deployment.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Contact", path: "/contact" }])),
        }}
      />
    </LandingShell>
  );
}
