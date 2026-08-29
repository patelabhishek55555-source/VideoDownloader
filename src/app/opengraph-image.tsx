import { ImageResponse } from "next/og";

export const alt = "Video Downloader — Download Videos Fast";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><rect width="64" height="64" rx="15" fill="#5b4bff"/><path d="M21 17h22L32 34 21 17Z" fill="#ffffff"/><path d="M17 45h30" stroke="#ffffff" stroke-width="6" stroke-linecap="round"/></svg>`;

const MARK_SRC = `data:image/svg+xml;base64,${Buffer.from(MARK_SVG).toString("base64")}`;

/**
 * Social preview.
 *
 * Generated from the brand mark and product name only — no stock imagery, so the
 * card is honest about what the product is.
 */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "#0b0b0e",
          color: "#f5f5f7",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 20,
          }}
        >
          <img src={MARK_SRC} width={72} height={72} alt="" />
          <span style={{ fontSize: 34, fontWeight: 600, letterSpacing: -1 }}>Video Downloader</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 76, fontWeight: 700, letterSpacing: -3, lineHeight: 1.05 }}>
            Download Videos Fast
          </span>
          <span style={{ fontSize: 30, color: "#9a9aa6", lineHeight: 1.35 }}>
            Bulk links · Quality options · Sequential queue · ZIP export
          </span>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Bulk download", "ZIP export", "No account needed"].map((tag) => (
            <span
              key={tag}
              style={{
                display: "flex",
                fontSize: 22,
                color: "#c9c4ff",
                border: "1px solid #3b3775",
                borderRadius: 999,
                padding: "8px 20px",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
