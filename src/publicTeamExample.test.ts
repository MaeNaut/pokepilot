import { readFileSync, existsSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { getLegalAbilities, getLegalMoves, hydrateShowdownLegalitySnapshot, isItemLegal, isPokemonLegal } from "./api/showdownLegality";
import { normalizeShowdownId } from "./api/showdownIds";
import { publicExampleTeam } from "./test/fixtures/publicTeamExample";

const publicRoot = new URL("../public/", import.meta.url);
const rules = hydrateShowdownLegalitySnapshot(JSON.parse(readFileSync(new URL("data/showdown-regulation-mc.json", publicRoot), "utf8")));
const sitemap = new JSDOM(readFileSync(new URL("sitemap.xml", publicRoot), "utf8"), { contentType: "application/xml" });

it("provides six legal M-C builds with complete Champions investments and unique items", () => {
  expect(publicExampleTeam).toHaveLength(6);
  expect(new Set(publicExampleTeam.map((set) => set.itemName)).size).toBe(6);
  for (const set of publicExampleTeam) {
    expect(isPokemonLegal(rules, set.pokemonName), set.pokemonName).toBe(true);
    expect(isItemLegal(rules, set.itemName ?? ""), set.itemName).toBe(true);
    expect(getLegalAbilities(rules, set.pokemonName)?.has(normalizeShowdownId(set.ability ?? "")), set.ability).toBe(true);
    expect(set.moves).toHaveLength(4);
    for (const move of set.moves) {
      expect(getLegalMoves(rules, set.pokemonName)?.has(normalizeShowdownId(move)), move).toBe(true);
    }
    const points = Object.values(set.evs ?? {});
    expect(points.reduce((sum, value) => sum + value, 0)).toBe(66);
    expect(points.every((value) => value >= 0 && value <= 32)).toBe(true);
  }
});

describe.each(["ko", "en"])("public team example %s", (locale) => {
  const dom = new JSDOM(readFileSync(new URL(`help/kabamanda-${locale}.html`, publicRoot), "utf8"));
  const document = dom.window.document;

  it("contains an accessible static article, working anchors, assets, and alternate languages", () => {
    expect(document.documentElement.lang).toBe(locale);
    expect(document.querySelectorAll("main > section")).toHaveLength(7);
    expect(document.querySelector(".example-transcript, .example-review-note, #input")).toBeNull();
    expect(document.querySelector("main")?.textContent).not.toMatch(/결과 전문 읽기|Read the complete result/);
    const ids = Array.from(document.querySelectorAll("[id]"), (element) => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const link of document.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')) {
      expect(document.getElementById(link.hash.slice(1))).not.toBeNull();
    }
    for (const element of document.querySelectorAll("[src], [href]")) {
      const path = element.getAttribute("src") ?? element.getAttribute("href") ?? "";
      if (path.startsWith("/") && path !== "/") expect(existsSync(new URL(path.slice(1), publicRoot)), path).toBe(true);
    }
    for (const link of document.querySelectorAll('a[target="_blank"]')) {
      expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    }
    for (const language of ["ko", "en"]) {
      expect(document.querySelector(`link[hreflang="${language}"]`)?.getAttribute("href"))
        .toBe(`https://pokepilot.app/help/kabamanda-${language}.html`);
    }
    expect(document.querySelector('#overview a[download]')?.getAttribute("href")).toBe("/help/kabamanda-five-team.txt");
    expect(document.querySelector('#overview .example-team-source a')?.getAttribute("href")).toBe("https://game8.jp/pokemon-champions/779319");
    expect(document.querySelector('#overview .example-team-figure img')?.getAttribute("src")).toBe(`/help/analysis-examples/${locale}-team-input.png`);
    const fiveMemberText = readFileSync(new URL("help/kabamanda-five-team.txt", publicRoot), "utf8");
    expect(fiveMemberText.trim().split(/\n\s*\n/)).toHaveLength(5);
    expect(fiveMemberText).not.toContain("Primarina");
    expect(document.querySelector("input, .adsbygoogle")).toBeNull();
    expect(sitemap.window.document.documentElement.textContent).toContain(`https://pokepilot.app/help/kabamanda-${locale}.html`);
  });

  it("shows recorded images with concise descriptions and matched comparison inputs", () => {
    const readResult = (id: string) => JSON.parse(readFileSync(new URL(`help/analysis-examples/${locale}-${id}.json`, publicRoot), "utf8"));
    const low = readResult("team-low");
    const medium = readResult("team-medium");
    expect(low.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(medium.inputHash).toBe(low.inputHash);
    expect(medium.promptVersion).toBe(low.promptVersion);
    for (const scope of ["pokemon", "team", "recommendation", "optimization"]) {
      const result = readResult(`${scope}-low`);
      const section = document.getElementById(scope)!;
      if (scope === "recommendation") {
        expect(result.scenarioVersion).toBe(3);
        expect(result.response.recommendations.length).toBeGreaterThan(0);
        for (const recommendation of result.response.recommendations) {
          expect(result.response.recommendationCandidates.some((candidate: { pokemonId: string; target: { mode: string; slotIndex: number } }) => candidate.pokemonId === recommendation.id && candidate.target.mode === "addition" && candidate.target.slotIndex === 5)).toBe(true);
        }
        expect(section.textContent).toContain(locale === "ko" ? "누리레느" : "sixth member");
      }
      if (scope === "optimization") {
        expect(result.scenarioVersion).toBe(3);
        const current = result.response.optimizationCandidates.find((candidate: { id: string }) => candidate.id === "set-current");
        expect(current).toMatchObject({ slotIndex: 1, natureId: "adamant", itemId: "salamencite", evs: { attack: 32, specialAttack: 0, speed: 32 } });
      }
      expect(result.response.scope).toBe(scope);
      expect(result.promptVersion).toBe(93);
      expect(result.publicationRevision).toBe(locale === "en" && scope === "team" ? 5 : 4);
      expect(result.model).toBe("gpt-6-luna");
      expect(result.reasoningEffort).toBe("low");
      expect(result.execution.durationMs).toBeGreaterThan(0);
      expect(result.execution.totalTokens).toBeGreaterThan(0);
      expect(result.execution.estimatedCostUsd).toBeGreaterThan(0);
      expect(section.querySelector(".analysis-showcase-copy")?.textContent?.length).toBeGreaterThan(10);
      const img = section.querySelector(`.analysis-figure img[src="/help/analysis-examples/${locale}-${scope}-low.png"]`)!;
      expect(Number(img.getAttribute("width"))).toBe(1040);
      const png = readFileSync(new URL(`help/analysis-examples/${locale}-${scope}-low.png`, publicRoot));
      expect(Number(img.getAttribute("height"))).toBe(png.readUInt32BE(20));
      expect(img.getAttribute("src")).toBe(`/help/analysis-examples/${locale}-${scope}-low.png`);
      expect(section.querySelector(".analysis-showcase-copy + .analysis-figure")).not.toBeNull();
      expect(img.closest("a")?.hasAttribute("data-analysis-image")).toBe(true);
      expect(img.closest("a")?.getAttribute("href")).toBe(`/help/analysis-examples/${locale}-${scope}-low.png`);
      expect(img.getAttribute("alt")).toBeTruthy();
      expect(section.querySelector("details > summary")).toBeNull();
    }
    for (const id of ["pokemon-low", "team-low", "team-medium", "recommendation-low", "optimization-low", "optimization-change-low"]) {
      const result = readResult(id);
      expect(result.scenarioVersion).toBe(3);
      expect(result.teamSize).toBe(5);
      expect(result.inputSummary.sets.map((set: { pokemonId: string }) => set.pokemonId)).toEqual(["hippowdon", "salamence-mega", "lucario-mega-z", "archaludon", "meowscarada"]);
    }
    const change = readResult("optimization-change-low");
    const untrained = change.inputSummary.sets.find((set: { slotIndex: number }) => set.slotIndex === 1);
    expect(untrained.nature.toLowerCase()).toBe("hardy");
    expect(Object.values(untrained.evs).reduce<number>((total, value) => total + Number(value), 0)).toBe(0);
    expect(change.response.recommendations.some((rec: { id: string }) => rec.id !== "set-current")).toBe(true);
    const changeSection = document.getElementById("optimization-change")!;
    expect(changeSection.querySelector("img")).not.toBeNull();
    for (const rec of change.response.recommendations) {
      expect(change.response.optimizationCandidates.some((c: { id: string }) => c.id === rec.id)).toBe(true);
    }
    const comparison = document.getElementById("comparison")!;
    expect(comparison.querySelector("img")).toBeNull();
    const quotes = comparison.querySelectorAll<HTMLElement>(".example-output-quote");
    expect(quotes).toHaveLength(2);
    for (const quote of quotes) {
      const effort = quote.dataset.source?.endsWith("medium") ? "medium" : "low";
      const result = readResult(`team-${effort}`);
      expect(quote.textContent).toBe(result.response.recommendations[Number(quote.dataset.recommendation)].reason);
    }
    for (const result of [low, medium]) {
      expect(comparison.textContent).toContain(`$${result.execution.estimatedCostUsd.toFixed(5)}`);
      expect(comparison.textContent).toContain(`${(result.execution.durationMs / 1000).toFixed(1)}s`);
    }
  });

  it("is discoverable from the help page", () => {
    const help = new JSDOM(readFileSync(new URL(`help/${locale}.html`, publicRoot), "utf8"));
    expect(help.window.document.querySelector(`a[href="/help/kabamanda-${locale}.html"]`)).not.toBeNull();
    help.window.close();
  });

  it("keeps the team-report headings in sync with navigation and descriptions concise", () => {
    for (const section of document.querySelectorAll("main > section")) {
      const heading = section.querySelector("h2")!.textContent!.replace(/^\d+\.\s*/, "");
      expect(document.querySelector(`a[href="#${section.id}"]`)?.textContent).toBe(heading);
    }
    for (const copy of document.querySelectorAll(".analysis-showcase-copy")) {
      expect(copy.querySelectorAll("p").length).toBeGreaterThan(0);
      expect(copy.querySelectorAll("p").length).toBeLessThanOrEqual(2);
    }
  });

  it("provides recorded analysis text to assistive technology without visible transcript controls", () => {
    const texts = document.querySelectorAll<HTMLElement>(".analysis-accessible-text");
    expect(texts).toHaveLength(7);
    for (const text of texts) {
      const result = JSON.parse(readFileSync(new URL(`help/analysis-examples/${text.dataset.source}.json`, publicRoot), "utf8"));
      expect(text.hidden).toBe(false);
      expect(text.getAttribute("aria-hidden")).not.toBe("true");
      expect(document.querySelector(`[aria-details="${text.id}"]`)).not.toBeNull();
      for (const paragraph of result.response.paragraphs) {
        const displayed = locale === "ko" ? paragraph.replace(/\b(\d+)\s+Stat Points?\b/gi, "노력치 $1").replace(/\bStat Points?\b/gi, "노력치") : paragraph;
        expect(text.textContent).toContain(displayed);
      }
    }
    expect(document.querySelector(".example-transcript")).toBeNull();
    expect(document.querySelector('#pokemon img')?.getAttribute('alt')).not.toContain('pokemon-low');
  });

  it("ties each explanation to its own language's result, including the optional English spread", () => {
    for (const scope of ["pokemon", "team", "recommendation", "optimization", "optimization-change"]) {
      const copy = document.querySelector(`#${scope} > .analysis-showcase .analysis-showcase-copy`)!;
      expect(copy.getAttribute("data-source")).toBe(`${locale}-${scope}-low`);
      expect(document.querySelector(`#${scope} > .analysis-showcase img`)?.getAttribute("src"))
        .toBe(`/help/analysis-examples/${locale}-${scope}-low.png`);
    }
    const result = JSON.parse(readFileSync(new URL(`help/analysis-examples/${locale}-optimization-low.json`, publicRoot), "utf8"));
    const copy = document.querySelector('#optimization > .analysis-showcase .analysis-showcase-copy')!.textContent;
    if (locale === "en") {
      expect(result.response.recommendations.map((rec: { id: string }) => rec.id)).toEqual(["set-current", "usage-spread-2"]);
      const [current, alternative] = ["set-current", "usage-spread-2"].map(id =>
        result.response.optimizationCandidates.find((candidate: { id: string }) => candidate.id === id));
      expect(alternative.finalStats.hp - current.finalStats.hp).toBe(1);
      expect(alternative.finalStats.defense - current.finalStats.defense).toBe(-1);
      expect(copy).toContain("one more point of final HP for one less point of Defense");
    } else {
      expect(result.response.recommendations.map((rec: { id: string }) => rec.id)).toEqual(["set-current"]);
      expect(copy).toContain("현재 구성 유지만 추천");
    }
  });

  it("progressively adds localized inline expansion without modifying the image", () => {
    const page = new JSDOM(dom.serialize(), { runScripts: "outside-only" });
    page.window.eval(readFileSync(new URL("help/analysis-images.js", publicRoot), "utf8"));
    const figures = page.window.document.querySelectorAll(".analysis-figure");
    expect(figures).toHaveLength(5);
    for (const figure of figures) {
      const button = figure.querySelector<HTMLButtonElement>(".analysis-expand")!;
      const source = figure.querySelector("img")!.getAttribute("src");
      expect(button.textContent).toBe(locale === "ko" ? "분석 결과 전체 펼치기" : "Show full analysis");
      expect(button.getAttribute("aria-controls")).toBe(figure.querySelector("a")!.id);
      expect(button.getAttribute("aria-expanded")).toBe("false");
      button.click();
      expect(figure.classList.contains("is-expanded")).toBe(true);
      expect(button.getAttribute("aria-expanded")).toBe("true");
      button.click();
      expect(figure.classList.contains("is-expanded")).toBe(false);
      expect(figure.querySelector("img")!.getAttribute("src")).toBe(source);
    }
    page.window.close();
  });
});
