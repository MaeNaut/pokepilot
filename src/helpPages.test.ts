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
  it("documents personal-key analysis and account sync without legacy fallback claims", () => {
    expect(html).toContain(`/help/api-key-${locale}.html`);
    expect(html).toContain("Luna low");
    expect(html).toContain("Luna medium");
    expect(html).not.toContain("Sol low");
    if (locale === "ko") {
      expect(html).toContain("개인 OpenAI API 키 등록이 필요합니다");
      expect(html).toContain("계정에 동기화");
      expect(html).not.toContain("자동 동기화되지 않습니다");
      expect(html).not.toContain("규칙 기반 대체 분석 표시");
    } else {
      expect(html).toContain("AI analysis requires Google sign-in and a personal OpenAI API key");
      expect(html).toContain("across signed-in devices");
      expect(html).not.toContain("do not automatically sync");
    }
  });
});

describe("privacy notice", () => {
  it("documents rolling sessions, analysis preferences, and failed-call metrics in both languages", () => {
    const html = readFileSync(new URL("privacy.html", publicRoot), "utf8");
    expect(html).toContain("30-day idle window");
    expect(html).toContain("90 days from sign-in");
    expect(html).toContain("최근 선택한 분석 탭·모델·추론 강도");
    expect(html).toContain("최대 90일");
    expect(html).toContain("failed calls with known usage");
    expect(html).toContain("확인된 실패 호출");
    expect(html).not.toContain("may optionally register");
    expect(html).not.toContain("선택적으로 등록");
  });
});
