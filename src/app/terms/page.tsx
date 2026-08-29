import { LandingShell } from "@/components/landing/landing-shell";
import { buildMetadata, breadcrumbSchema, jsonLd } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Terms of Service",
  description:
    "The terms for using Video Downloader, including the acceptable-use rules and the limits of what the tool will do.",
  path: "/terms",
});

export default function TermsPage() {
  return (
    <LandingShell
      eyebrow="Legal"
      title="Terms of service"
      lede="By using this service you agree to the terms below."
    >
      <h2>1. What this service is</h2>
      <p>
        Video Downloader is a tool that fetches media a source publishes publicly and lets you save it. It is
        provided as-is, without warranty of any kind, and availability is not guaranteed.
      </p>

      <h2>2. Your responsibility</h2>
      <p>
        You are responsible for the links you submit and for what you do with the files you download. You may only
        download content that you own, that is published under a licence permitting download, or that you have
        explicit permission to save. Downloading somebody else&apos;s work without permission may infringe
        copyright and may breach the terms of the platform it came from.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree not to use this service to:</p>
      <ul>
        <li>infringe copyright, trademark or any other right of a third party;</li>
        <li>access private accounts, private posts, or content behind a login, age gate or paywall;</li>
        <li>circumvent digital rights management, access controls or CAPTCHAs;</li>
        <li>harvest personal data about individuals;</li>
        <li>harass, threaten or harm anyone;</li>
        <li>probe, scan or attack the service or any third-party system;</li>
        <li>overload the service or bypass its rate limits.</li>
      </ul>

      <h2>4. What we will not do</h2>
      <p>
        This service does not and will not implement authentication bypasses, private-account access, DRM
        circumvention, CAPTCHA solving, or any other access-control bypass. Requests that require them fail, and
        that is intentional.
      </p>

      <h2>5. No affiliation</h2>
      <p>
        Platform names are used only to describe what a link points to. This service is not affiliated with,
        endorsed by, or sponsored by any platform it can resolve.
      </p>

      <h2>6. Rate limits and fair use</h2>
      <p>
        Requests are limited per address to keep the service available. Exceeding those limits results in a
        temporary refusal rather than an account action, because there are no accounts.
      </p>

      <h2>7. Third-party services</h2>
      <p>
        Fetching a link sends a request to the site that hosts it. Your use of that site remains subject to its own
        terms, and we are not responsible for the content it publishes or for changes it makes.
      </p>

      <h2>8. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, we are not liable for any indirect, incidental or consequential
        damage arising from your use of the service, including loss of data, loss of content, or the actions of
        third parties.
      </p>

      <h2>9. Changes</h2>
      <p>
        These terms may be updated. The current version is always published here, and continued use after a change
        means you accept it.
      </p>

      <h2>10. Contact</h2>
      <p>
        To report a problem or request removal of a link, see the <a href="/contact">contact page</a>.
      </p>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbSchema([{ name: "Home", path: "/" }, { name: "Terms", path: "/terms" }])),
        }}
      />
    </LandingShell>
  );
}
