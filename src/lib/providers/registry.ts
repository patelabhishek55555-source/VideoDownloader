/**
 * Provider registry.
 *
 * Order matters: specific providers are tried first and generic fallbacks last.
 * Adding a platform means adding a provider here — the API, queue, ZIP pipeline
 * and UI all read from this list, so nothing else needs to change.
 */

import type { PlatformInfo } from "@/lib/types";
import { DEFAULT_ALLOWED_MEDIA_SUFFIXES } from "@/lib/security/ssrf";
import { directMediaProvider } from "./direct-media";
import { createRemoteApiProvider } from "./remote-api";
import { redditProvider } from "./reddit";
import type { MediaProvider } from "./types";
import { hostMatches } from "./types";
import { webPageProvider } from "./web-page";

export const instagramProvider = createRemoteApiProvider({
  id: "instagram",
  name: "Instagram",
  platform: "instagram",
  hosts: ["instagram.com", "instagr.am"],
  tagline: "Reels, posts and carousels",
  setupHint:
    "Instagram downloads need the downloader service to be configured. Add DOWNLOAD_PROVIDER_BASE_URL to enable them.",
});

export const tiktokProvider = createRemoteApiProvider({
  id: "tiktok",
  name: "TikTok",
  platform: "tiktok",
  hosts: ["tiktok.com", "vm.tiktok.com", "tiktokcdn.com"],
  tagline: "Videos without the watermark prompt",
  setupHint:
    "TikTok downloads need the downloader service to be configured. Add DOWNLOAD_PROVIDER_BASE_URL to enable them.",
});

export const facebookProvider = createRemoteApiProvider({
  id: "facebook",
  name: "Facebook",
  platform: "facebook",
  hosts: ["facebook.com", "fb.watch", "fb.com", "m.facebook.com"],
  tagline: "Public videos and watch links",
  setupHint:
    "Facebook downloads need the downloader service to be configured. Add DOWNLOAD_PROVIDER_BASE_URL to enable them.",
});

export const pinterestProvider = createRemoteApiProvider({
  id: "pinterest",
  name: "Pinterest",
  platform: "pinterest",
  hosts: ["pinterest.com", "pin.it", "pinterest.co.uk"],
  tagline: "Pins and idea videos",
  setupHint:
    "Pinterest downloads need the downloader service to be configured. Add DOWNLOAD_PROVIDER_BASE_URL to enable them.",
});

export const xProvider = createRemoteApiProvider({
  id: "x",
  name: "X",
  platform: "x",
  hosts: ["x.com", "twitter.com", "t.co"],
  tagline: "Videos from public posts",
  setupHint:
    "X downloads need the downloader service to be configured. Add DOWNLOAD_PROVIDER_BASE_URL to enable them.",
});

/** Registered in priority order; fallbacks are always last. */
export const providers: MediaProvider[] = [
  instagramProvider,
  tiktokProvider,
  facebookProvider,
  pinterestProvider,
  xProvider,
  redditProvider,
  directMediaProvider,
  webPageProvider,
];

export function findProvider(url: URL): MediaProvider | null {
  const specific = providers.filter((provider) => !provider.isFallback);
  for (const provider of specific) {
    if (provider.match(url)) return provider;
  }
  for (const provider of providers) {
    if (provider.isFallback && provider.match(url)) return provider;
  }
  return null;
}

/** Provider by id, used to explain capability for a landing page. */
export function providerById(id: string): MediaProvider | undefined {
  return providers.find((provider) => provider.id === id);
}

/**
 * Host suffixes media may be served from. Combines every provider host with the
 * CDN suffixes resolvers normally return, and feeds the SSRF allowlist used by
 * the download and ZIP endpoints.
 */
export const MEDIA_HOST_ALLOWLIST: readonly string[] = Array.from(
  new Set([
    ...providers.flatMap((provider) => [...provider.hosts]),
    ...DEFAULT_ALLOWED_MEDIA_SUFFIXES,
  ]),
);

export interface PlatformEntry extends PlatformInfo {
  hosts: string[];
}

/** Every platform surfaced in the UI, in display order. */
export const PLATFORMS: PlatformEntry[] = [
  {
    id: "instagram",
    name: "Instagram",
    slug: "instagram-video-downloader",
    tagline: "Reels, video posts and public carousels",
    status: "requires-service",
    hosts: [...instagramProvider.hosts],
    landingPath: "/instagram-video-downloader",
  },
  {
    id: "instagram-reels",
    name: "Instagram Reels",
    slug: "instagram-reels-downloader",
    tagline: "Save short-form Reels in the best quality",
    status: "requires-service",
    hosts: [...instagramProvider.hosts],
    landingPath: "/instagram-reels-downloader",
  },
  {
    id: "tiktok",
    name: "TikTok",
    slug: "tiktok-video-downloader",
    tagline: "Public TikTok videos",
    status: "requires-service",
    hosts: [...tiktokProvider.hosts],
    landingPath: "/tiktok-video-downloader",
  },
  {
    id: "facebook",
    name: "Facebook",
    slug: "facebook-video-downloader",
    tagline: "Public videos and fb.watch links",
    status: "requires-service",
    hosts: [...facebookProvider.hosts],
    landingPath: "/facebook-video-downloader",
  },
  {
    id: "pinterest",
    name: "Pinterest",
    slug: "pinterest-video-downloader",
    tagline: "Pins and idea videos",
    status: "requires-service",
    hosts: [...pinterestProvider.hosts],
    landingPath: "/pinterest-video-downloader",
  },
  {
    id: "reddit",
    name: "Reddit",
    slug: "reddit-video-downloader",
    tagline: "Hosted video, images and galleries",
    status: "ready",
    hosts: [...redditProvider.hosts],
    landingPath: "/reddit-video-downloader",
  },
  {
    id: "direct",
    name: "Direct links",
    slug: "direct-link-downloader",
    tagline: "Any URL that points at a media file",
    status: "ready",
    hosts: [],
    landingPath: null,
  },
  {
    id: "web",
    name: "Web pages",
    slug: "web-page-downloader",
    tagline: "Pages that publish a direct video file",
    status: "ready",
    hosts: [],
    landingPath: null,
  },
];

export function platformById(id: string): PlatformEntry | undefined {
  return PLATFORMS.find((platform) => platform.id === id);
}

export { hostMatches };
