import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicRoot = new URL("../public/", import.meta.url);
const sitemap = readFileSync(new URL("sitemap.xml", publicRoot), "utf8");

describe.each(["ko", "en"])("static %s help", (locale) => {
  const html = readFileSync(new URL(`help/${locale}.html`, publicRoot), "utf8");
  it("provides the complete article without JavaScript", () => {
    expect(html).toContain(`<html lang="${locale}">`);
    expect([...html.matchAll(/<section id=/g)]).toHaveLength(8);
    expect(html).toContain('<main id="content">');
    expect(html).not.toContain("adsbygoogle");
    expect(sitemap).toContain(`https://pokepilot.app/help/${locale}.html`);
  });
  it("has valid unique section anchors and local assets", () => {
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    expect(new Set(ids).size).toBe(ids.length);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) {
      expect(ids).toContain(match[1]);
    }
    for (const match of html.matchAll(/(?:src|href)="(\/(?:help\/|favicon)[^"]+)"/g)) {
      expect(existsSync(new URL(match[1].slice(1), publicRoot))).toBe(true);
    }
  });
});
