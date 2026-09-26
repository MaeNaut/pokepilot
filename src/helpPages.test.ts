import { readFileSync, existsSync } from "node:fs";
import { describe, expect, it } from "vitest";

const publicRoot = new URL("../public/", import.meta.url);
const sitemap = readFileSync(new URL("sitemap.xml", publicRoot), "utf8");

describe.each(["ko", "en"])("API key guide %s", (locale) => {
  it("provides setup steps, safe external links, and no credential inputs", () => {
    const html = readFileSync(new URL(`help/api-key-${locale}.html`, publicRoot), "utf8");
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain('data-help-page="api-key"');
    expect(html).toContain("/v1/responses");
    expect(html).not.toContain("<input");
    expect([...html.matchAll(/<section id=/g)]).toHaveLength(5);
    for (const match of html.matchAll(/href="#([^"]+)"/g)) {
      expect(html).toContain(`id="${match[1]}"`);
    }
    for (const match of html.matchAll(/<a[^>]*target="_blank"[^>]*>/g)) {
      expect(match[0]).toContain('rel="noopener noreferrer"');
    }
  });
});

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
