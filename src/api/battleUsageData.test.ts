import { describe, expect, it } from "vitest";
import { isBattleUsageSet, parseBattleUsageIndex, parseBattleUsageDetail } from "./battleUsageData";
import { battleUsageFixture } from "../test/fixtures/battleUsageFixture";

const now = Date.parse("2026-09-30T12:00:00Z");
describe("Champions battle statistics conversion", () => {
  it("keeps format ranks and independent nature/point distributions", () => {
    const fixture = battleUsageFixture();
    const snapshot = parseBattleUsageIndex(fixture.index, "singles", now);
    expect(snapshot).toMatchObject({ season: "M6", sourceDate: "2026-09-30", provider: "champions-battle-data" });
    expect(snapshot.sets[0]).toMatchObject({ pokemonId: "garchomp", usageRank: 1, nature: "jolly", cutoff: 0, evs: { attack: 32 } });
    expect(snapshot.sets[0].spreads).toBeUndefined();
    expect(snapshot.sets[0].moveOptions).toBeUndefined();
    expect(parseBattleUsageIndex(fixture.index, "doubles", now).sets[0].usageRank).toBe(9);
    const detail = parseBattleUsageDetail(fixture.detail(), snapshot.sets[0], "singles");
    expect(detail.moveOptions).toEqual([{ id: "earthquake", usagePercent: 80 }, { id: "dragonclaw", usagePercent: 40 }]);
    expect(detail.statPointSpreads?.[0].usagePercent).toBe(25);
    expect(detail.spreads).toBeUndefined();
  });
  it("discovers a new season/date without a hardcoded month", () => {
    expect(parseBattleUsageIndex(battleUsageFixture("01_10_2026", "M7").index, "singles", Date.parse("2026-10-01T12:00:00Z")))
      .toMatchObject({ season: "M7", sourceDate: "2026-10-01" });
  });
  it("rejects malformed cached options and distributions", () => {
    const snapshot = parseBattleUsageIndex(battleUsageFixture().index, "singles", now);
    const set = snapshot.sets[0];
    expect(isBattleUsageSet(set, snapshot.sourceDate, snapshot.season)).toBe(true);
    for (const patch of [{ evs: {} }, { evs: { ...set.evs, hp: 32 } }, { nature: "unknown" },
      { itemOptions: [{ id: "focussash", usagePercent: 101 }] }, { moveIds: [null] }]) {
      expect(isBattleUsageSet({ ...set, ...patch }, snapshot.sourceDate, snapshot.season)).toBe(false);
    }
  });
  it("rejects old, future, empty, and invalid data", () => {
    for (const index of [{}, battleUsageFixture("01_09_2026").index, battleUsageFixture("01_10_2026").index]) {
      expect(() => parseBattleUsageIndex(index, "singles", now)).toThrow();
    }
    const fixture = battleUsageFixture();
    fixture.index.pokemon[0].summary.battleSummary.Current.Singles.top.stat_points.attack_points = 252;
    expect(() => parseBattleUsageIndex(fixture.index, "singles", now)).toThrow();
  });
  it("does not mix dates, formats or species when loading detail", () => {
    const fixture = battleUsageFixture();
    const base = parseBattleUsageIndex(fixture.index, "singles", now).sets[0];
    expect(() => parseBattleUsageDetail(fixture.detail("Doubles"), base, "singles")).toThrow();
    expect(() => parseBattleUsageDetail(battleUsageFixture("29_09_2026").detail(), base, "singles")).toThrow();
    expect(() => parseBattleUsageDetail({ ...fixture.detail(), showdownId: "indeedeef" }, base, "singles")).toThrow();
  });
  it("rejects a partially updated date or season", () => {
    const fixture = battleUsageFixture();
    const older = battleUsageFixture("29_09_2026").index.pokemon[0];
    fixture.index.pokemon.push({ ...older, showdownName: "Salamence" });
    expect(() => parseBattleUsageIndex(fixture.index, "singles", now)).toThrow("Incomplete");
    const differentSeason = battleUsageFixture("30_09_2026", "M7").index.pokemon[0];
    fixture.index.pokemon[1] = { ...differentSeason, showdownName: "Salamence" };
    expect(() => parseBattleUsageIndex(fixture.index, "singles", now)).toThrow("Incomplete");
  });
  it("does not hide a broken update by dropping malformed ranked entries", () => {
    const fixture = battleUsageFixture();
    const malformed = battleUsageFixture().index.pokemon[0];
    malformed.summary.battleSummary.Current.Singles.top.stat_points.attack_points = 252;
    fixture.index.pokemon.push({ ...malformed, showdownName: "Salamence" });
    expect(() => parseBattleUsageIndex(fixture.index, "singles", now)).toThrow("Incomplete");
  });
  it("does not accept booleans as measured percentages or points", () => {
    const fixture = battleUsageFixture();
    const base = parseBattleUsageIndex(fixture.index, "singles", now).sets[0];
    const detail = fixture.detail();
    Object.assign(detail.daily[0].rows.find((row) => row.category === "stat_points")!, { attack_points: true });
    expect(() => parseBattleUsageDetail(detail, base, "singles")).toThrow();
    expect(isBattleUsageSet({ ...base, moveOptions: [{ id: "earthquake", usagePercent: true }] }, base.sourceDate!, base.season!)).toBe(false);
  });
  it("rejects duplicate species or ranks instead of publishing ambiguous order", () => {
    const fixture = battleUsageFixture();
    fixture.index.pokemon.push(structuredClone(fixture.index.pokemon[0]));
    expect(() => parseBattleUsageIndex(fixture.index, "singles", now)).toThrow();
    fixture.index.pokemon[1].showdownName = "Salamence";
    expect(() => parseBattleUsageIndex(fixture.index, "singles", now)).toThrow();
  });
  it("requires positive detail ranks and ignores rows with invalid measurements", () => {
    const fixture = battleUsageFixture();
    const base = parseBattleUsageIndex(fixture.index, "singles", now).sets[0];
    fixture.rows.unshift({ category: "move", rank: -1, name: "Not a Move", percentage_value: 99 });
    expect(parseBattleUsageDetail(fixture.detail(), base, "singles").moveIds).not.toContain("notamove");
  });
});
