import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

describe("AdSense verification without automatic ad requests", () => {
  it("keeps publisher ownership verification in the document head", () => {
    expect(html).toContain(
      '<meta name="google-adsense-account" content="ca-pub-3154319590159225" />',
    );
    expect(readFileSync(new URL("../public/ads.txt", import.meta.url), "utf8"))
      .toContain("google.com, pub-3154319590159225, DIRECT, f08c47fec0942fa0");
  });

  it("does not bootstrap ads before the workspace has content", () => {
    expect(html).not.toMatch(/<script\b[^>]*\bsrc=["'][^"']*(?:googlesyndication|doubleclick)/i);
    expect(html).not.toContain("adsbygoogle");
  });
});
