import { LandingShell } from "@/components/landing/landing-shell";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Privacy Policy",
  description:
    "How Video Downloader handles links, temporary files and analytics. No accounts, no stored download history, no social media credentials.",
  path: "/privacy",
});

export default function PrivacyPage() {
  return (
    <LandingShell
      eyebrow="Legal"
      title="Privacy policy"
      lede="The short version: we do not build a profile of you, and we do not keep your links."
    >
      <p>
        Video Downloader is a tool, not an account-based service. This policy explains what is processed while you
        use it, what is kept, and for how long.
      </p>

      <h2>What we process</h2>
      <ul>
        <li>
          <strong>The links you paste.</strong> They are used to resolve the media you asked for. They are not
          written to a database and are not used for anything else.
        </li>
        <li>
          <strong>Your IP address.</strong> Used only to apply request rate limits so the service stays available.
          Rate-limit counters are short-lived and expire automatically.
        </li>
        <li>
          <strong>Basic request diagnostics.</strong> Error types and status codes may be logged to keep the
          service working. Logs do not contain file contents.
        </li>
      </ul>

      <h2>What we never ask for</h2>
      <ul>
        <li>Social media passwords or session cookies. Never, for any platform.</li>
        <li>An account, an email address, or a phone number.</li>
        <li>Permission to log in to a third-party service on your behalf.</li>
      </ul>

      <h2>Temporary data</h2>
      <p>
        Bulk downloads create a short-lived job record so progress can be tracked between requests. Job records
        expire on their own (by default within 30 minutes) and are never used for anything other than completing
        your request. Downloaded media is not retained: files are streamed to you, and when optional temporary
        object storage is used for very large archives, the objects are written under a timestamped prefix and the
        download link expires within minutes.
      </p>

      <h2>Cookies and local storage</h2>
      <p>
        The only thing stored in your browser is your light/dark theme preference. There are no advertising
        cookies, no cross-site tracking pixels, and no fingerprinting.
      </p>

      <h2>Analytics</h2>
      <p>
        Analytics are optional and disabled by default. When an operator enables them, they are limited to
        aggregate, privacy-preserving page metrics — no personal information, no persistent identifiers.
      </p>

      <h2>Third parties</h2>
      <p>
        Resolving a link means fetching that page and its media from the site that hosts it, which is visible to
        that site as an ordinary request. We do not sell, rent or share any information with advertisers or data
        brokers.
      </p>

      <h2>Children</h2>
      <p>
        This service is not directed at children, and we do not knowingly collect information from anyone under 16.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes materially, the updated version will be published here with a revised date. Continued
        use after a change means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy? See the <a href="/contact">contact page</a>.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Privacy", path: "/privacy" }])),
        }}
      />
    </LandingShell>
  );
}
