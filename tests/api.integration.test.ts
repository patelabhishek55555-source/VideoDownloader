/**
 * End-to-end integration test for the download/ZIP pipeline.
 *
 * A real local HTTP server stands in for a media CDN. The only piece stubbed is
 * the SSRF *DNS policy* decision (`assertAllowedHost` / `assertPublicTarget`) so
 * the test can target 127.0.0.1 — everything else, including the token
 * verification, the route handlers, the streaming fetch and the ZIP writer, is
 * the production code path.
 */

import { createServer, type Server } from "node:http";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { AddressInfo } from "node:net";
import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Stub ONLY the network-policy decision so the local test server is reachable.
vi.mock("@/lib/security/ssrf", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/security/ssrf")>();
  const toUrl = (value: string | URL) => (value instanceof URL ? value : new URL(value));
  return {
    ...actual,
    assertAllowedHost: (url: string | URL) => toUrl(url),
    assertPublicTarget: async (url: string | URL) => ({
      url: toUrl(url),
      addresses: ["203.0.113.7"],
    }),
  };
});

import { NextRequest } from "next/server";

import { POST as resolvePost } from "@/app/api/resolve/route";
import { POST as jobsPost } from "@/app/api/jobs/route";
import { GET as jobGet, DELETE as jobDelete } from "@/app/api/jobs/[id]/route";
import { POST as zipPost } from "@/app/api/zip/route";
import { GET as downloadGet } from "@/app/api/download/route";
import { signUrl } from "@/lib/security/tokens";
import type { ResolvedMedia } from "@/lib/types";

const scratch: string[] = [];
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const FILE_ONE = "one".repeat(5_000);
const FILE_TWO = "two".repeat(9_000);

let server: Server;
let base: string;
const urlOne = () => `${base}/media/video-one.mp4`;
const urlTwo = () => `${base}/media/video-two.mp4`;

beforeAll(async () => {
  server = createServer((req, res) => {
    if (req.method === "HEAD" && req.url?.startsWith("/media/")) {
      const body = req.url.endsWith("one.mp4") ? FILE_ONE : FILE_TWO;
      res.writeHead(200, {
        "content-type": "video/mp4",
        "content-length": String(Buffer.byteLength(body)),
      });
      res.end();
      return;
    }
    if (req.url?.endsWith("/media/video-one.mp4")) {
      res.writeHead(200, { "content-type": "video/mp4" });
      res.end(FILE_ONE);
      return;
    }
    if (req.url?.endsWith("/media/video-two.mp4")) {
      res.writeHead(200, { "content-type": "video/mp4" });
      res.end(FILE_TWO);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  base = `http://127.0.0.1:${port}`;
});

afterAll(() => {
  server.close();
});

function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("resolve → sign", () => {
  it("resolves a direct media URL and signs its formats", async () => {
    const response = await resolvePost(jsonRequest("http://localhost/api/resolve", { url: urlOne() }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { ok: true; media: ResolvedMedia };
    expect(payload.ok).toBe(true);
    expect(payload.media.platform).toBe("direct");
    expect(payload.media.formats).toHaveLength(1);
    const format = payload.media.formats[0]!;
    expect(format.token).not.toBe("");
    expect(format.ext).toBe("mp4");
  });
});

describe("download proxy", () => {
  it("streams a signed file with an attachment filename", async () => {
    const { token } = signUrl(urlOne());
    const request = new NextRequest(`${base}/api/download?url=${encodeURIComponent(urlOne())}&token=${token}&name=my-video`);
    const response = await downloadGet(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-disposition")).toContain("my-video.mp4");
    const body = await response.text();
    expect(body).toBe(FILE_ONE);
  });

  it("rejects an unsigned URL", async () => {
    const request = new NextRequest(`${base}/api/download?url=${encodeURIComponent(urlOne())}&token=1.invalid&name=x`);
    const response = await downloadGet(request);
    expect(response.status).toBe(403);
  });
});

describe("bulk jobs", () => {
  it("creates a job and resolves both URLs to ready", async () => {
    const created = (await (
      await jobsPost(jsonRequest("http://localhost/api/jobs", { input: `${urlOne()}\n${urlTwo()}` }))
    ).json()) as { jobId: string; job: { items: Array<{ status: string }> }; storeKind: string };

    expect(created.storeKind).toBe("memory");

    let items = created.job.items;
    let attempts = 0;
    while (items.some((item) => item.status === "queued" || item.status === "processing") && attempts < 6) {
      attempts += 1;
      const request = new NextRequest(`${base}/api/jobs/${created.jobId}/continue`, { method: "POST" });
      const { POST: continuePost } = await import("@/app/api/jobs/[id]/continue/route");
      const next = (await (await continuePost(request, {
        params: Promise.resolve({ id: created.jobId }),
      })).json()) as { job: { items: Array<{ status: string }> } };
      items = next.job.items;
    }

    expect(items).toHaveLength(2);
    expect(items.every((item) => item.status === "ready")).toBe(true);

    const snapshot = (await (
      await jobGet(new NextRequest(`${base}/api/jobs/${created.jobId}`), {
        params: Promise.resolve({ id: created.jobId }),
      })
    ).json()) as { job: { completed: number; status: string } };
    expect(snapshot.job.completed).toBe(2);
    expect(snapshot.job.status).toBe("completed");

    await jobDelete(new NextRequest(`${base}/api/jobs/${created.jobId}`, { method: "DELETE" }), {
      params: Promise.resolve({ id: created.jobId }),
    });
    const afterDelete = await jobGet(new NextRequest(`${base}/api/jobs/${created.jobId}`), {
      params: Promise.resolve({ id: created.jobId }),
    });
    expect(afterDelete.status).toBe(404);
  });
});

describe("zip pipeline", () => {
  it("builds a valid archive from two signed streams with clean filenames", async () => {
    const one = signUrl(urlOne());
    const two = signUrl(urlTwo());

    const response = await zipPost(
      jsonRequest("http://localhost/api/zip", {
        archiveName: "My Trip! 2026",
        items: [
          { url: one.url, token: one.token, filename: "my awesome video.mp4", fileSize: Buffer.byteLength(FILE_ONE) },
          { url: two.url, token: two.token, filename: "my awesome video.mp4", fileSize: Buffer.byteLength(FILE_TWO) },
        ],
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/zip");
    expect(response.headers.get("content-disposition")).toContain("my-trip-2026.zip");

    const dir = mkdtempSync(join(tmpdir(), "zip-int-"));
    scratch.push(dir);
    const zipPath = join(dir, "out.zip");
    const blob = await response.blob();
    writeFileSync(zipPath, Buffer.from(await blob.arrayBuffer()));

    const testOutput = execFileSync("unzip", ["-t", zipPath], { encoding: "utf8" });
    expect(testOutput).toContain("No errors detected");

    const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf8" });
    // duplicate names get a suffix; extension preserved
    expect(listing).toContain("my-awesome-video.mp4");
    expect(listing).toContain("my-awesome-video-2.mp4");

    execFileSync("unzip", ["-o", zipPath, "-d", join(dir, "out")]);
    expect(readFileSync(join(dir, "out/my-awesome-video.mp4"), "utf8")).toBe(FILE_ONE);
    expect(readFileSync(join(dir, "out/my-awesome-video-2.mp4"), "utf8")).toBe(FILE_TWO);
  });

  it("rejects an archive containing an unsigned URL", async () => {
    const good = signUrl(urlOne());
    const response = await zipPost(
      jsonRequest("http://localhost/api/zip", {
        items: [
          { url: good.url, token: good.token, filename: "ok.mp4" },
          { url: `${base}/media/video-two.mp4`, token: "1.forged", filename: "evil.mp4" },
        ],
      }),
    );
    expect(response.status).toBe(403);
  });
});
