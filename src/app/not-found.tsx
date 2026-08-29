import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { buildMetadata } from "@/lib/seo/metadata";

export const metadata = buildMetadata({
  title: "Page not found",
  description: "That page doesn't exist. Head back to the video downloader.",
  path: "/404",
  noIndex: true,
});

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-24 text-center">
      <span className="text-sm font-medium text-primary">404</span>
      <h1 className="mt-3 text-display-sm text-foreground">This page doesn&apos;t exist</h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">
        The link may be old or mistyped. The downloader is one click away.
      </p>
      <Button asChild className="mt-8">
        <Link href="/">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the downloader
        </Link>
      </Button>
    </div>
  );
}
