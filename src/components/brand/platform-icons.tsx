import * as React from "react";

/**
 * Simplified, original platform marks.
 *
 * These are geometric approximations drawn for this product rather than
 * reproductions of any platform's trademarked logo, and they are only used as
 * recognisable labels in the "Supported platforms" grid.
 */

interface IconProps extends React.SVGProps<SVGSVGElement> {
  size?: number;
}

function base({ size = 20, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function InstagramMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" />
      <circle cx="12" cy="12" r="4.1" />
      <circle cx="17.1" cy="6.9" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.4 3v10.9a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M14.4 3c.5 2.5 2.2 4.1 4.7 4.4" />
    </svg>
  );
}

export function FacebookMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3.2" y="3.2" width="17.6" height="17.6" rx="5.2" />
      <path d="M15.2 8.1h-1.4a2 2 0 0 0-2 2v10.7" />
      <path d="M9.4 13.2h4.6" />
    </svg>
  );
}

export function XMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4.6 4.6 19.4 19.4" />
      <path d="M19.4 4.6 4.6 19.4" />
    </svg>
  );
}

export function PinterestMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M10.1 18.6 12.4 9.9" />
      <path d="M9.3 13.1a2.9 2.9 0 1 1 4.9-2.7c.5 2.3-.7 4.6-2.7 4.6-.9 0-1.6-.5-1.9-1.1" />
    </svg>
  );
}

export function RedditMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="13.6" r="7" />
      <path d="M12 6.6 13.6 3.4l3 .7" />
      <circle cx="9.6" cy="12.9" r="0.95" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="12.9" r="0.95" fill="currentColor" stroke="none" />
      <path d="M9.6 16.3a3.6 3.6 0 0 0 4.8 0" />
    </svg>
  );
}

export function WebPageMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8.8" />
      <path d="M3.2 12h17.6" />
      <path d="M12 3.2c2.4 2.4 3.6 5.4 3.6 8.8s-1.2 6.4-3.6 8.8c-2.4-2.4-3.6-5.4-3.6-8.8S9.6 5.6 12 3.2Z" />
    </svg>
  );
}

export function FileLinkMark(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14 3.2H7.4A1.9 1.9 0 0 0 5.5 5.1v13.8a1.9 1.9 0 0 0 1.9 1.9h9.2a1.9 1.9 0 0 0 1.9-1.9V7.7L14 3.2Z" />
      <path d="M13.8 3.4v4.4h4.5" />
      <path d="m9.6 14.4 2.4 2.3 2.4-2.3" />
      <path d="M12 11v5.5" />
    </svg>
  );
}

export const PLATFORM_ICONS = {
  instagram: InstagramMark,
  "instagram-reels": InstagramMark,
  tiktok: TikTokMark,
  facebook: FacebookMark,
  x: XMark,
  pinterest: PinterestMark,
  reddit: RedditMark,
  web: WebPageMark,
  direct: FileLinkMark,
} as const;

export type PlatformIconKey = keyof typeof PLATFORM_ICONS;

export function PlatformIcon({ id, ...props }: { id: string } & IconProps) {
  const Icon = PLATFORM_ICONS[id as PlatformIconKey] ?? WebPageMark;
  return <Icon {...props} />;
}
