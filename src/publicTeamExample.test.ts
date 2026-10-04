import { readFileSync, existsSync } from "node:fs";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { getLegalAbilities, getLegalMoves, hydrateShowdownLegalitySnapshot, isItemLegal, isPokemonLegal } from "./api/showdownLegality";
import { normalizeShowdownId } from "./api/showdownIds";
import { publicExampleCalculations, publicExampleTeam } from "./test/fixtures/publicTeamExample";

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
    expect(document.querySelectorAll("main > section")).toHaveLength(8);
    expect(document.querySelectorAll(".team-member")).toHaveLength(6);
    expect(document.querySelector("main")?.textContent?.length).toBeGreaterThan(3000);
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

  it("shows recorded results in accessible text with high-resolution images and matched comparison inputs", () => {
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
        expect(section.textContent).toContain(locale === "ko" ? "빈 슬롯" : "sixth member");
      }
      if (scope === "optimization") {
        expect(result.scenarioVersion).toBe(3);
        const current = result.response.optimizationCandidates.find((candidate: { id: string }) => candidate.id === "set-current");
        expect(current).toMatchObject({ slotIndex: 1, natureId: "adamant", itemId: "salamencite", evs: { attack: 32, specialAttack: 0, speed: 32 } });
      }
      expect(result.response.scope).toBe(scope);
      expect(result.model).toBe("gpt-6-luna");
      expect(result.reasoningEffort).toBe("low");
      expect(result.execution.durationMs).toBeGreaterThan(0);
      expect(result.execution.totalTokens).toBeGreaterThan(0);
      expect(result.execution.estimatedCostUsd).toBeGreaterThan(0);
      for (const paragraph of result.response.paragraphs) expect(section.textContent).toContain(paragraph);
      for (const recommendation of result.response.recommendations) {
        expect(section.textContent).toContain(recommendation.title);
        expect(section.textContent).toContain(recommendation.reason);
      }
      const img = section.querySelector(`.analysis-figure img[src="/help/analysis-examples/${locale}-${scope}-low.png"]`)!;
      expect(Number(img.getAttribute("width"))).toBe(1040);
      expect(img.getAttribute("src")).toBe(`/help/analysis-examples/${locale}-${scope}-low.png`);
      expect(section.querySelector(".analysis-showcase-copy + .analysis-figure")).not.toBeNull();
      expect(img.closest("a")?.hasAttribute("data-analysis-image")).toBe(true);
      expect(img.closest("a")?.getAttribute("href")).toBe(`/help/analysis-examples/${locale}-${scope}-low.png`);
      expect(img.getAttribute("alt")).toBeTruthy();
      expect(section.querySelector("details > summary")).not.toBeNull();
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
    for (const paragraph of change.response.paragraphs) expect(changeSection.textContent).toContain(paragraph);
    for (const rec of change.response.recommendations) {
      expect(changeSection.textContent).toContain(rec.reason);
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
      for (const paragraph of result.response.paragraphs) expect(comparison.textContent).toContain(paragraph);
    }
  });

  it("keeps published numbers aligned with the actual Champions calculator", () => {
    expect(document.querySelectorAll("[data-calculation]")).toHaveLength(publicExampleCalculations.length);
    for (const { id, result } of publicExampleCalculations) {
      expect(result.status).toBe("ready");
      if (result.status !== "ready") throw new Error(`Example calculation unavailable: ${id}`);
      const element = document.querySelector<HTMLElement>(`[data-calculation="${id}"]`)!;
      expect(Number(element.dataset.minDamage), id).toBe(result.minDamage);
      expect(Number(element.dataset.maxDamage), id).toBe(result.maxDamage);
      expect(Number(element.dataset.targetHp), id).toBe(result.defenderMaxHp);
      const text = element.querySelector(".damage-value")?.textContent;
      expect(text).toContain(`${result.minDamage}–${result.maxDamage}`);
      expect(text).toContain(`${result.minPercent.toFixed(1)}–${result.maxPercent.toFixed(1)}%`);
    }
  });

  it("is discoverable from the help page", () => {
    const help = new JSDOM(readFileSync(new URL(`help/${locale}.html`, publicRoot), "utf8"));
    expect(help.window.document.querySelector(`a[href="/help/kabamanda-${locale}.html"]`)).not.toBeNull();
    help.window.close();
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
