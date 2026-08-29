import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #7c6cff 0%, #5b4bff 100%)",
          borderRadius: 40,
        }}
      >
        <svg width="104" height="104" viewBox="0 0 64 64">
          <path d="M21 17h22L32 34 21 17Z" fill="#ffffff" />
          <path d="M17 45h30" stroke="#ffffff" strokeWidth="6" strokeLinecap="round" />
        </svg>
      </div>
    ),
    { ...size },
  );
}
