/**
 * Site copy and structured content.
 *
 * Kept free of server-only imports so both server components (metadata, landing
 * pages) and client components (accordions, cards) can read the same source of
 * truth instead of drifting apart.
 */

export const SITE_NAME = "Video Downloader";

export const HERO = {
  title: "Download Videos. Save Them Your Way.",
  subtitle:
    "Fast, simple and powerful video downloading with bulk links, quality options and ZIP downloads.",
  placeholder: "Paste video URL here...",
  bulkPlaceholder: "Paste multiple video links here, one per line...",
  hint: "Supports multiple links • Bulk download • ZIP export",
};

export interface FeatureCopy {
  id: string;
  title: string;
  description: string;
  icon: "layers" | "archive" | "gauge" | "list" | "user" | "phone";
}

export const FEATURES: FeatureCopy[] = [
  {
    id: "bulk",
    title: "Bulk download",
    description:
      "Paste as many links as you like — one per line. Duplicates and invalid links are flagged before anything is processed.",
    icon: "layers",
  },
  {
    id: "zip",
    title: "ZIP download",
    description:
      "Combine every processed file into a single archive with clean, de-duplicated filenames.",
    icon: "archive",
  },
  {
    id: "quality",
    title: "Quality options",
    description:
      "Pick from the renditions a source actually offers, with resolution, format and file size shown up front.",
    icon: "gauge",
  },
  {
    id: "sequential",
    title: "Sequential downloads",
    description:
      "Files are fetched one after another through a controlled queue, so your browser is never flooded.",
    icon: "list",
  },
  {
    id: "no-account",
    title: "No account required",
    description:
      "Paste a link and download. There is no sign-up, no email verification and no profile to manage.",
    icon: "user",
  },
  {
    id: "mobile",
    title: "Built for mobile",
    description:
      "A touch-first layout with sticky controls, so the full experience works properly on a phone.",
    icon: "phone",
  },
];

export const TRUST_STRIP = [
  { label: "Bulk links", description: "Process many URLs at once" },
  { label: "ZIP export", description: "One archive, clean filenames" },
  { label: "Quality choice", description: "Only real, available renditions" },
  { label: "Mobile ready", description: "Designed for phones first" },
];

export interface StepCopy {
  number: string;
  title: string;
  description: string;
}

export const HOW_IT_WORKS: StepCopy[] = [
  {
    number: "01",
    title: "Copy the link",
    description: "Copy the URL of the video you want to save from the platform you are using.",
  },
  {
    number: "02",
    title: "Paste & process",
    description:
      "Paste a single link, or add many at once with the bulk input. Each one is checked and resolved.",
  },
  {
    number: "03",
    title: "Download",
    description:
      "Save files individually, run them through the sequential queue, or export everything as a ZIP.",
  },
];

export interface FaqItem {
  question: string;
  answer: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What is Video Downloader?",
    answer:
      "Video Downloader is a web tool for saving videos you have the right to keep. You paste a link, it looks up the media the page publishes, and you choose how to save it — as a single file, as a sequence of files, or as one ZIP archive.",
  },
  {
    question: "How do I download a video?",
    answer:
      "Paste the page URL into the input and press Download. The tool resolves the link, shows the available renditions, and starts the save. If a source publishes more than one quality you can pick one from the dropdown first.",
  },
  {
    question: "Can I download multiple videos?",
    answer:
      "Yes. Choose “Add multiple links”, paste one URL per line, and press Add links. The queue processes them with a limited number of simultaneous requests, so large lists stay manageable.",
  },
  {
    question: "Can I download videos as a ZIP?",
    answer:
      "Yes. Once the items in your queue are ready, choose “Download as ZIP”. Files are packaged with safe, de-duplicated names such as video-01.mp4, and you can rename the archive before it is built.",
  },
  {
    question: "Can I download videos one by one?",
    answer:
      "Yes. Every card in the queue has its own Download button, and “Sequential download” runs through the queue in order with a progress indicator instead of opening every file at once.",
  },
  {
    question: "Do I need an account?",
    answer:
      "No. The tool works immediately without registration. We do not ask for your social media password and we never ask you to log in to a third-party service through this site.",
  },
  {
    question: "What platforms are supported?",
    answer:
      "Support depends on what a source publishes. Direct media links, Reddit posts and web pages that expose a video file work with no setup. Instagram, TikTok, Facebook, Pinterest and X are handled by a configurable resolver service, which the interface reports clearly when it is not set up.",
  },
  {
    question: "Why does a video fail to download?",
    answer:
      "The usual reasons are a link that is not public, a post that has been removed, a source that has rate limited us, or a stream that cannot be packaged into a single file. Each failure shows a plain-language reason on its card, and you can retry it without redoing the rest of the queue.",
  },
  {
    question: "Can I use the downloader on mobile?",
    answer:
      "Yes. The layout is mobile-first: the input is full width, the queue stacks vertically, and the download controls stay pinned to the bottom of the screen.",
  },
  {
    question: "Is downloading copyrighted content allowed?",
    answer:
      "No. This tool is for content you own or have explicit permission to save. Downloading someone else's work without permission may infringe copyright and may breach the terms of the platform it came from. Responsibility for how you use downloaded files stays with you.",
  },
];

export const PLATFORM_LINKS = [
  { label: "Video downloader", href: "/video-downloader" },
  { label: "Instagram video downloader", href: "/instagram-video-downloader" },
  { label: "Instagram Reels downloader", href: "/instagram-reels-downloader" },
  { label: "TikTok video downloader", href: "/tiktok-video-downloader" },
  { label: "Facebook video downloader", href: "/facebook-video-downloader" },
  { label: "Pinterest video downloader", href: "/pinterest-video-downloader" },
  { label: "Reddit video downloader", href: "/reddit-video-downloader" },
];

export const COPYRIGHT_NOTICE = {
  title: "Please download responsibly",
  body: [
    "Video Downloader is a tool for saving media you have the right to keep — your own uploads, content published under a licence that permits downloading, or material you have written permission to archive.",
    "It does not bypass logins, private accounts, age gates, digital rights management or any other access control, and it should not be used to redistribute work that belongs to somebody else.",
  ],
};

export const EMPTY_STATE = {
  title: "Your download queue is empty",
  description: "Paste a video link above to get started.",
  action: "Paste link",
};
