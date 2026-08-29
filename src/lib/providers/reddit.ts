/**
 * Reddit — public posts via Reddit's own JSON API.
 *
 * No credentials and no scraping: `https://www.reddit.com/comments/<id>.json`
 * returns the post payload, including `reddit_video.fallback_url` for hosted
 * video and `media_metadata` for galleries. Only public posts are reachable; a
 * private, quarantined or removed post produces a clear "not publicly
 * accessible" result rather than any attempt to work around it.
 */

import { AppError } from "@/lib/errors";
import { BROWSER_HEADERS, readTextCapped, safeFetch } from "@/lib/security/http";
import type { ResolvedMedia } from "@/lib/types";
import { cleanFormats } from "./format";
import type { MediaProvider, ResolveContext } from "./types";
import { hostMatches } from "./types";

const REDDIT_HOSTS = ["reddit.com", "redd.it", "np.reddit.com"];

interface RedditVideo {
  fallback_url?: string;
  height?: number;
  width?: number;
  duration?: number;
}

interface RedditPostData {
  id?: string;
  title?: string;
  author?: string;
  thumbnail?: string;
  preview?: { images?: Array<{ source?: { url?: string } }> };
  is_video?: boolean;
  post_hint?: string;
  url?: string;
  url_overridden_by_dest?: string;
  media?: { reddit_video?: RedditVideo; type?: string };
  secure_media?: { reddit_video?: RedditVideo; type?: string };
  gallery_data?: { items?: Array<{ media_id?: string }> };
  media_metadata?: Record<string, { s?: { u?: string }; m?: string; status?: string }>;
  crosspost_parent_list?: RedditPostData[];
  over_18?: boolean;
  banned_by?: unknown;
}

type RedditListing = Array<{ data?: { children?: Array<{ data?: RedditPostData }> } }>;

function unescapeRedditUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = value.replace(/&amp;/g, "&");
  return /^https?:\/\//i.test(cleaned) ? cleaned : undefined;
}

function postIdFromUrl(url: URL): string | undefined {
  if (url.hostname.replace(/^www\./, "") === "redd.it") {
    const short = url.pathname.split("/").filter(Boolean)[0];
    return short && /^[a-z0-9]+$/i.test(short) ? short : undefined;
  }
  const segments = url.pathname.split("/").filter(Boolean);
  const commentsIndex = segments.findIndex((segment) => segment === "comments");
  if (commentsIndex >= 0) {
    const id = segments[commentsIndex + 1];
    return id && /^[a-z0-9]+$/i.test(id) ? id : undefined;
  }
  // /r/<sub>/<id> short form
  if (segments.length >= 2 && /^[a-z0-9]{6,10}$/i.test(segments[segments.length - 1]!)) {
    return segments[segments.length - 1];
  }
  return undefined;
}

function firstPost(payload: RedditListing): RedditPostData | undefined {
  const post = payload?.[0]?.data?.children?.[0]?.data;
  if (!post) return undefined;
  if (post.crosspost_parent_list?.length) return post.crosspost_parent_list[0] ?? post;
  return post;
}

function buildResolved(post: RedditPostData, pageUrl: string): ResolvedMedia {
  const id = post.id ?? String(Math.abs(hashCode(pageUrl)));
  const title = post.title?.slice(0, 180) || "Reddit media";
  const thumbnail =
    unescapeRedditUrl(post.preview?.images?.[0]?.source?.url) ??
    (post.thumbnail && /^https?:\/\//i.test(post.thumbnail) ? post.thumbnail : undefined);

  const redditVideo = post.secure_media?.reddit_video ?? post.media?.reddit_video;

  if (redditVideo?.fallback_url) {
    const videoUrl = unescapeRedditUrl(redditVideo.fallback_url);
    if (videoUrl) {
      return {
        id,
        providerId: redditProvider.id,
        providerName: redditProvider.name,
        platform: "reddit",
        kind: "video",
        title,
        thumbnail,
        duration: redditVideo.duration,
        author: post.author,
        pageUrl,
        formats: cleanFormats([
          {
            url: videoUrl,
            ext: "mp4",
            kind: "video",
            height: redditVideo.height,
            width: redditVideo.width,
            quality: redditVideo.height ? `${redditVideo.height}p` : "Original",
          },
        ]),
        singleFormat: true,
      };
    }
  }

  if (post.gallery_data?.items?.length && post.media_metadata) {
    const entries: ResolvedMedia[] = [];
    const items = post.gallery_data.items.slice(0, 20);
    items.forEach((item, index) => {
      const meta = item.media_id ? post.media_metadata?.[item.media_id] : undefined;
      const url = unescapeRedditUrl(meta?.s?.u);
      if (!url) return;
      const ext = meta?.m?.includes("png") ? "png" : "jpg";
      entries.push({
        id: `${id}-${index}`,
        providerId: redditProvider.id,
        providerName: redditProvider.name,
        platform: "reddit",
        kind: "image",
        title: `${title} (${index + 1})`,
        thumbnail: url,
        author: post.author,
        pageUrl,
        formats: cleanFormats([{ url, ext, kind: "image" }]),
        singleFormat: true,
      });
    });

    if (entries.length > 0) {
      return {
        ...entries[0]!,
        id,
        kind: "gallery",
        title,
        formats: entries[0]!.formats,
        entries,
      };
    }
  }

  if (post.post_hint === "image" || /\.(png|jpe?g|webp|gif)$/i.test(post.url_overridden_by_dest ?? "")) {
    const url = unescapeRedditUrl(post.url_overridden_by_dest ?? post.url);
    if (url) {
      const ext = url.match(/\.(png|jpe?g|webp|gif)$/i)?.[1]?.toLowerCase() ?? "jpg";
      return {
        id,
        providerId: redditProvider.id,
        providerName: redditProvider.name,
        platform: "reddit",
        kind: "image",
        title,
        thumbnail: url,
        author: post.author,
        pageUrl,
        formats: cleanFormats([{ url, ext: ext === "jpeg" ? "jpg" : ext, kind: "image" }]),
        singleFormat: true,
      };
    }
  }

  throw new AppError("unsupported", {
    message:
      "That Reddit post doesn't contain a directly downloadable file. Hosted videos, images and galleries are supported.",
  });
}

function hashCode(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  return hash;
}

export const redditProvider: MediaProvider = {
  id: "reddit",
  name: "Reddit",
  platform: "reddit",
  hosts: REDDIT_HOSTS,
  tagline: "Video & image posts",
  requiresConfiguration: false,

  match(url) {
    return hostMatches(url.hostname, REDDIT_HOSTS);
  },

  async resolve(url: string, context?: ResolveContext): Promise<ResolvedMedia> {
    const parsed = new URL(url);
    const postId = postIdFromUrl(parsed);
    if (!postId) {
      throw new AppError("invalid_url", {
        message: "That doesn't look like a Reddit post link. Paste the full post URL.",
      });
    }

    const api = `https://www.reddit.com/comments/${postId}.json?raw_json=1&limit=1`;
    let response: Response;
    try {
      response = await safeFetch(api, {
        timeoutMs: context?.timeoutMs ?? 12000,
        signal: context?.signal,
        headers: { ...BROWSER_HEADERS, accept: "application/json" },
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError("provider_error");
    }

    if (response.status === 403 || response.status === 401) {
      throw new AppError("private_content", {
        message: "This Reddit post isn't publicly accessible.",
      });
    }
    if (response.status === 404) {
      throw new AppError("not_found", { message: "We couldn't find that Reddit post." });
    }
    if (response.status === 429) {
      throw new AppError("rate_limited", {
        message: "Reddit is rate limiting us right now. Please try again in a moment.",
        retryAfterSeconds: 30,
      });
    }
    if (!response.ok) {
      throw new AppError("provider_error", { detail: `reddit responded ${response.status}` });
    }

    let payload: RedditListing;
    try {
      payload = JSON.parse(await readTextCapped(response, 1024 * 1024)) as RedditListing;
    } catch {
      throw new AppError("provider_error", { detail: "reddit returned invalid JSON" });
    }

    const post = firstPost(payload);
    if (!post) throw new AppError("not_found", { message: "We couldn't find that Reddit post." });
    if (post.banned_by || post.over_18 === true) {
      throw new AppError("private_content", {
        message: "This Reddit post is restricted, so it can't be downloaded.",
      });
    }

    return buildResolved(post, parsed.toString());
  },
};
