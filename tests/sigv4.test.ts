import { describe, expect, it } from "vitest";

import {
  canonicalRequest,
  presignUrl,
  sha256Hex,
  signRequest,
  uriEncode,
  UNSIGNED_PAYLOAD,
} from "@/lib/storage/sigv4";

const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const CREDS = {
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY",
};
const DATE = new Date("2015-08-30T12:36:00.000Z");

describe("sigv4", () => {
  it("hashes the empty payload the way AWS does", () => {
    expect(sha256Hex("")).toBe(EMPTY_SHA256);
  });

  it("encodes URIs per RFC 3986", () => {
    expect(uriEncode("a b")).toBe("a%20b");
    expect(uriEncode("~user/file.txt")).toBe("~user%2Ffile.txt");
    expect(uriEncode("/photos/2026/héllo.mp4", false)).toBe("/photos/2026/h%C3%A9llo.mp4");
  });

  it("reproduces the official get-vanilla test vector signature", () => {
    const signed = signRequest({
      ...CREDS,
      region: "us-east-1",
      service: "service",
      method: "GET",
      path: "/",
      headers: { host: "example.amazonaws.com" },
      payloadHash: EMPTY_SHA256,
      date: DATE,
      includeContentShaHeader: false,
    });

    expect(signed.signedHeaders).toBe("host;x-amz-date");
    expect(signed.signature).toBe("5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31");
    expect(signed.authorization).toBe(
      "AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, " +
        "SignedHeaders=host;x-amz-date, " +
        "Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31",
    );
  });

  it("reproduces the get-vanilla-query-order test vector", () => {
    const signed = signRequest({
      ...CREDS,
      region: "us-east-1",
      service: "service",
      method: "GET",
      path: "/",
      query: { Param2: "value2", Param1: "value1" },
      headers: { host: "example.amazonaws.com" },
      payloadHash: EMPTY_SHA256,
      date: DATE,
      includeContentShaHeader: false,
    });
    expect(signed.signature).toBe("b97d918cfa904a5beff61c982a1b6f458b799221646efd99d3219ec94cdf2500");
  });

  it("sorts and lower-cases canonical headers", () => {
    const { canonicalRequest: request, signedHeaders } = canonicalRequest({
      method: "PUT",
      path: "/bucket/key.mp4",
      headers: {
        Host: "bucket.s3.amazonaws.com",
        "X-Amz-Date": "20150830T123600Z",
        "Content-Type": "  application/zip  ",
      },
      payloadHash: UNSIGNED_PAYLOAD,
    });
    expect(signedHeaders).toBe("content-type;host;x-amz-date");
    expect(request).toContain("content-type:application/zip\n");
    expect(request.startsWith("PUT\n/bucket/key.mp4\n")).toBe(true);
  });

  it("adds the S3 content-sha header when signing object uploads", () => {
    const signed = signRequest({
      ...CREDS,
      region: "us-east-1",
      service: "s3",
      method: "PUT",
      path: "/tmp/archive.zip",
      headers: {
        host: "bucket.s3.amazonaws.com",
        "content-length": "1024",
        "content-type": "application/zip",
      },
      payloadHash: UNSIGNED_PAYLOAD,
      date: DATE,
    });
    expect(signed.headers["x-amz-content-sha256"]).toBe(UNSIGNED_PAYLOAD);
    expect(signed.signedHeaders).toContain("x-amz-content-sha256");
    expect(signed.headers["x-amz-date"]).toBe("20150830T123600Z");
  });

  it("builds presigned URLs with signature and expiry", () => {
    const url = presignUrl({
      ...CREDS,
      region: "us-east-1",
      service: "s3",
      host: "bucket.s3.amazonaws.com",
      path: "/tmp/video-downloads.zip",
      expiresInSeconds: 900,
      date: DATE,
    });
    const parsed = new URL(url);
    expect(parsed.host).toBe("bucket.s3.amazonaws.com");
    expect(parsed.pathname).toBe("/tmp/video-downloads.zip");
    expect(parsed.searchParams.get("X-Amz-Algorithm")).toBe("AWS4-HMAC-SHA256");
    expect(parsed.searchParams.get("X-Amz-Expires")).toBe("900");
    expect(parsed.searchParams.get("X-Amz-Date")).toBe("20150830T123600Z");
    expect(parsed.searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    expect(parsed.searchParams.get("X-Amz-Credential")).toBe(
      "AKIDEXAMPLE/20150830/us-east-1/s3/aws4_request",
    );
  });
});
