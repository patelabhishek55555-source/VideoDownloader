import type { FaqItem } from "./content";

/**
 * Copy for the platform landing pages.
 *
 * Each page targets one search intent with its own title, description, H1,
 * how-to and FAQ set. Pages whose platform needs the external resolver say so
 * plainly (`requiresService`) rather than implying a download that cannot
 * happen on a bare deployment.
 */

export interface LandingPage {
  slug: string;
  platformId: string;
  requiresService: boolean;
  title: string;
  description: string;
  h1: string;
  lede: string;
  sections: Array<{ heading: string; body: string[] }>;
  howTo: Array<{ title: string; description: string }>;
  faqs: FaqItem[];
}

const RESPONSIBLE: FaqItem = {
  question: "Is it legal to download these videos?",
  answer:
    "Only when you have the right to. Downloading your own content, material published under a licence that permits it, or files you have written permission to archive is fine. Saving somebody else's work without permission can infringe copyright and can breach the platform's terms.",
};

export const LANDING_PAGES: LandingPage[] = [
  {
    slug: "video-downloader",
    platformId: "web",
    requiresService: false,
    title: "Video Downloader – Save Online Videos in Bulk or as a ZIP",
    description:
      "An online video downloader that takes one link or many at once. Choose a quality, download files one at a time, run a sequential queue, or export everything as a single ZIP.",
    h1: "Online video downloader",
    lede:
      "One input for a single link or a whole list of them. Pick a rendition, then save the files individually, in sequence, or as a ZIP archive.",
    sections: [
      {
        heading: "Built around bulk work",
        body: [
          "Most downloaders stop at one link. This one is designed for the opposite case: you have a list, and you want it all saved without opening twenty tabs. Paste the list, review the queue, and choose how the files come back.",
          "Every item is resolved independently, so a single broken link never blocks the rest of the batch. Failures are reported on their own card with a reason you can act on, and the successful files stay ready to download or archive.",
        ],
      },
      {
        heading: "Quality you can actually choose",
        body: [
          "The quality menu is built from what the source publishes. If a page offers one file, you see one option; if it offers several, each entry shows its resolution, container and file size where the source reports it. Nothing is invented and nothing is upscaled.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the video link", description: "Copy the address of the page that hosts the video." },
      { title: "Paste one or many", description: "Use the single input, or add multiple links one per line." },
      {
        title: "Save it your way",
        description: "Download one file, run the sequential queue, or export the batch as a ZIP.",
      },
    ],
    faqs: [
      {
        question: "How many links can I paste at once?",
        answer:
          "The bulk input accepts up to 25 links per batch by default. The limit exists to keep processing predictable; you can run another batch straight after the first one finishes.",
      },
      {
        question: "What happens to duplicate links?",
        answer:
          "They are detected before processing. Tracking parameters are ignored when comparing, so the same video shared with different query strings counts once.",
      },
      {
        question: "Do I need to install anything?",
        answer:
          "No. It runs in the browser, including on phones and tablets. The site is installable as an app if you prefer a standalone window.",
      },
      RESPONSIBLE,
    ],
  },
  {
    slug: "instagram-video-downloader",
    platformId: "instagram",
    requiresService: true,
    title: "Instagram Video Downloader – Save Public Posts, Reels & Carousels",
    description:
      "Save videos from public Instagram posts, Reels and carousels. Paste one link or a whole batch, choose a quality, and download individually, sequentially or as a ZIP.",
    h1: "Instagram video downloader",
    lede:
      "Paste a public Instagram post, Reel or carousel link to see the video files it publishes, then save them one at a time or as a batch.",
    sections: [
      {
        heading: "Posts, Reels and carousels",
        body: [
          "Instagram publishes several different link shapes: feed posts, Reels, and multi-item carousels. Each is handled as its own item in the queue, and a carousel exposes every media entry it contains so you can pick the ones you want.",
          "Only public content can be resolved. Private accounts, close-friends stories and anything behind a login are out of scope, and the tool will say so rather than attempt to get around it.",
        ],
      },
      {
        heading: "Batch saving from a profile",
        body: [
          "If you are archiving your own grid, paste several post links at once instead of working through them individually. The queue resolves them with a limited number of simultaneous requests, which is both faster and kinder to the source.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the post link", description: "Use the share menu on the post and choose Copy link." },
      { title: "Paste it into the input", description: "Add one link, or several if you are archiving a set." },
      { title: "Choose quality and download", description: "Pick a rendition, then save the file or export a ZIP." },
    ],
    faqs: [
      {
        question: "Can I download from a private Instagram account?",
        answer:
          "No. Private accounts, close-friends content and anything requiring a login are not supported, and the tool makes no attempt to bypass those restrictions.",
      },
      {
        question: "Why does an Instagram link say the downloader service is not configured?",
        answer:
          "Instagram media addresses are signed and rotate quickly, so they are resolved through an external resolver service. When that service has not been configured on this deployment, the interface reports it directly instead of showing a button that cannot work.",
      },
      {
        question: "Are carousel images supported?",
        answer:
          "Where the post publishes them as separate media entries, yes — each one appears as its own item in the queue with an image rendition.",
      },
      RESPONSIBLE,
    ],
  },
  {
    slug: "instagram-reels-downloader",
    platformId: "instagram-reels",
    requiresService: true,
    title: "Instagram Reels Downloader – Save Reels in Bulk",
    description:
      "Save Instagram Reels from public accounts. Paste a single Reel link or a batch of them, pick the quality available, and download one by one or as a ZIP.",
    h1: "Instagram Reels downloader",
    lede:
      "Reels links resolve to the video file behind the player. Save one, or paste a batch and export the lot as a ZIP.",
    sections: [
      {
        heading: "Short-form, handled in bulk",
        body: [
          "Reels are the most common thing people want to archive, and they are usually collected in sets rather than saved one at a time. The bulk input is built for that: paste the links, let the queue resolve them, and take the whole set as a single archive.",
          "Each Reel is a separate queue card with its own quality menu, so a mixed batch of resolutions still exports with sensible filenames rather than a pile of identically named files.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the Reel link", description: "Open the Reel, tap share, then Copy link." },
      { title: "Paste one or many", description: "Use “Add multiple links” for a batch of Reels." },
      { title: "Download or ZIP", description: "Save individually, sequentially, or as one archive." },
    ],
    faqs: [
      {
        question: "What quality do Reels download in?",
        answer:
          "Whatever the source publishes, typically an MP4 at the Reel's native resolution. The quality menu lists only the renditions that are actually available for that link.",
      },
      {
        question: "Can I download audio only from a Reel?",
        answer:
          "Only if the source publishes a separate audio rendition. Most Reels publish a single muxed video file, so the audio comes with it.",
      },
      RESPONSIBLE,
    ],
  },
  {
    slug: "tiktok-video-downloader",
    platformId: "tiktok",
    requiresService: true,
    title: "TikTok Video Downloader – Save Public TikToks in Bulk",
    description:
      "Save videos from public TikTok posts. Paste one link or a batch, see the available qualities, and download individually, sequentially or as a ZIP archive.",
    h1: "TikTok video downloader",
    lede: "Paste a public TikTok link to see the video file behind it, then save it on its own or as part of a batch.",
    sections: [
      {
        heading: "Short links work too",
        body: [
          "TikTok share links are usually shortened addresses. Both the short form and the full web address resolve to the same item, and shortened links are expanded before processing so duplicates are still detected correctly.",
          "Videos from private accounts or removed posts cannot be resolved, and the tool reports that plainly instead of returning an empty file.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the TikTok link", description: "Use the share sheet and choose Copy link." },
      { title: "Paste into the queue", description: "One link, or a whole list of them." },
      { title: "Pick a quality and save", description: "Download the file or add it to a ZIP export." },
    ],
    faqs: [
      {
        question: "Does it download with or without the watermark?",
        answer:
          "It downloads the file the source publishes. We do not modify, re-encode or remove anything from the video.",
      },
      {
        question: "Can I download a whole TikTok profile?",
        answer:
          "There is no bulk profile scraping. You paste the individual video links you want, which keeps the tool inside what a public link actually gives access to.",
      },
      RESPONSIBLE,
    ],
  },
  {
    slug: "facebook-video-downloader",
    platformId: "facebook",
    requiresService: true,
    title: "Facebook Video Downloader – Save Public Videos & Watch Links",
    description:
      "Save videos from public Facebook posts and fb.watch links. Paste one or many, choose the quality offered, and download individually or as a ZIP.",
    h1: "Facebook video downloader",
    lede: "Public Facebook video posts and short watch links resolve to their video file, ready to save individually or in bulk.",
    sections: [
      {
        heading: "Public posts only",
        body: [
          "Only content published publicly can be resolved. Anything on a private profile, in a closed group, or shared with a restricted audience is not accessible and will be reported as such.",
          "Short fb.watch addresses are expanded to the underlying post before resolution, so the same video reached two different ways is still recognised as a duplicate.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the post link", description: "Use the post menu and choose Copy link." },
      { title: "Paste the link", description: "Add one, or several if you are archiving a set." },
      { title: "Save it", description: "Download the file, or include it in a ZIP export." },
    ],
    faqs: [
      {
        question: "Can I download from a private group?",
        answer: "No. Group content and private profiles are not supported and no login is ever requested.",
      },
      {
        question: "Which qualities are available?",
        answer:
          "Whatever the post publishes. The menu lists each rendition with its resolution and file size where that information is reported.",
      },
      RESPONSIBLE,
    ],
  },
  {
    slug: "pinterest-video-downloader",
    platformId: "pinterest",
    requiresService: true,
    title: "Pinterest Video Downloader – Save Pins & Idea Videos",
    description:
      "Save videos from public Pinterest pins. Paste a pin link or a batch of them, choose the available quality, and download individually or as a ZIP.",
    h1: "Pinterest video downloader",
    lede: "Paste a public pin link to save the video it contains, on its own or together with the rest of your batch.",
    sections: [
      {
        heading: "Pins and idea pins",
        body: [
          "Standard video pins and idea pins both publish a video file that can be resolved from the public pin page. Static image pins resolve to their image instead, which is useful when you are collecting references rather than video.",
          "As with every other source here, only public pins are reachable. Pins on secret boards are not accessible.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the pin link", description: "Open the pin and copy its address." },
      { title: "Paste it in", description: "Add one pin or a list of them." },
      { title: "Download or ZIP", description: "Save the file, or archive the batch." },
    ],
    faqs: [
      {
        question: "Can I download an entire board?",
        answer: "No. You paste the individual pin links you want, rather than scraping a whole board.",
      },
      {
        question: "Do image pins work?",
        answer: "Yes — an image pin resolves to its image file and appears in the queue like any other item.",
      },
      RESPONSIBLE,
    ],
  },
  {
    slug: "reddit-video-downloader",
    platformId: "reddit",
    requiresService: false,
    title: "Reddit Video Downloader – Save Hosted Videos, Images & Galleries",
    description:
      "Save videos, images and galleries from public Reddit posts. Paste one link or a batch, and download individually, sequentially or as a ZIP.",
    h1: "Reddit video downloader",
    lede:
      "Public Reddit posts resolve through Reddit's own public data. Hosted video, images and multi-image galleries all appear as items in the queue.",
    sections: [
      {
        heading: "Video, images and galleries",
        body: [
          "Reddit hosts video directly for many posts, and publishes a plain file address for it. Image posts and galleries resolve the same way, with each gallery entry becoming its own queue item.",
          "Posts that link out to another site rather than hosting the media themselves are not resolvable here — for those, paste the link to the site that actually hosts the file.",
        ],
      },
      {
        heading: "No configuration needed",
        body: [
          "Reddit's public data is available without credentials, so this provider works on a fresh deployment with nothing set up. Posts that are private, quarantined or removed are reported as inaccessible.",
        ],
      },
    ],
    howTo: [
      { title: "Copy the post link", description: "Use the share button on the post." },
      { title: "Paste one or many", description: "Bulk input takes a whole list of post links." },
      { title: "Download or ZIP", description: "Save files individually or as a single archive." },
    ],
    faqs: [
      {
        question: "Does it work without any setup?",
        answer:
          "Yes. Reddit's public data needs no credentials, so this provider works on a default deployment.",
      },
      {
        question: "Why does a post report as not publicly accessible?",
        answer:
          "The post is private, quarantined, removed, or gated. Nothing is fetched in those cases and no workaround is attempted.",
      },
      {
        question: "Can I download a whole subreddit?",
        answer: "No. Paste the individual post links you want to save.",
      },
      RESPONSIBLE,
    ],
  },
];

export function landingPage(slug: string): LandingPage | undefined {
  return LANDING_PAGES.find((page) => page.slug === slug);
}

export const LANDING_PAGE_SLUGS = LANDING_PAGES.map((page) => page.slug);
