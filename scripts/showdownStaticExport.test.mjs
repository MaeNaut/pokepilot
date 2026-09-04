import { describe, expect, it } from "vitest";
import { parseShowdownStaticExport } from "./lib/showdownStaticExport.mjs";

const options = {
  presenceFields: ["megaStone"],
  scalarFields: ["name", "num", "desc", "shortDesc"],
};

describe("Showdown static export parser", () => {
  it("extracts only the catalog fields without running handlers", () => {
    globalThis.__showdownHandlerRan = false;
    const records = parseShowdownStaticExport(
      `exports.BattleItems = {
        testitem: {
          name: "Test Item",
          num: 12,
          desc: "Description",
          megaStone: {Species: "Species-Mega"},
          onTakeItem() { globalThis.__showdownHandlerRan = true; }
        }
      };`,
      "BattleItems",
      options,
    );

    expect(records.testitem).toEqual({
      name: "Test Item",
      num: 12,
      desc: "Description",
      megaStone: true,
    });
    expect(globalThis.__showdownHandlerRan).toBe(false);
    delete globalThis.__showdownHandlerRan;
  });

  it("rejects additional top-level executable statements", () => {
    expect(() =>
      parseShowdownStaticExport(
        `globalThis.compromised = true;
         exports.BattleAbilities = {safe: {name: "Safe"}};`,
        "BattleAbilities",
        options,
      ),
    ).toThrow("one export assignment");
  });

  it("rejects executable expressions in extracted fields", () => {
    expect(() =>
      parseShowdownStaticExport(
        `exports.BattleAbilities = {unsafe: {name: stealSecrets()}};`,
        "BattleAbilities",
        options,
      ),
    ).toThrow("must be a static scalar value");
  });
});
