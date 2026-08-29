// Demo-only resolver implementing the documented provider contract.
// Used to prove the Instagram provider + resolver wiring end-to-end.
// NOT shipped as production behaviour; the real service is external.
import { createServer } from "node:http";

const PORT = Number(process.env.PORT || 3210);
const MEDIA = Buffer.alloc(24_000, 7); // fake reel bytes

const server = createServer((req, res) => {
  if (req.url?.startsWith("/media/reel.mp4")) {
    res.writeHead(200, { "content-type": "video/mp4", "content-length": String(MEDIA.length) });
    res.end(MEDIA);
    return;
  }

  // Resolver contract: POST {url} or GET ?url=
  let url = "";
  const finish = () => {
    const isIg = /instagram\.com/.test(url);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      title: "Instagram Reel DRZtQxSD9d0",
      author: "demo.user",
      duration: 27,
      thumbnail: "",
      formats: isIg
        ? [
            { quality: "1080p", ext: "mp4", url: "https://scontent.cdninstagram.com/v/t50.2886-16/demo-1080p.mp4", size: MEDIA.length },
            { quality: "720p", ext: "mp4", url: "https://scontent.cdninstagram.com/v/t50.2886-16/demo-720p.mp4", size: MEDIA.length },
          ]
        : [],
    }));
  };

  if (req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { url = JSON.parse(body).url || ""; } catch { url = ""; }
      finish();
    });
  } else {
    url = new URL(req.url, `http://x`).searchParams.get("url") || "";
    finish();
  }
});

server.listen(PORT, "127.0.0.1", () => console.log(`demo resolver on ${PORT}`));
