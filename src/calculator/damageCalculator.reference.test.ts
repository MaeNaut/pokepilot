import { describe, expect, it } from "vitest";
import {
  damageReferenceFixtures,
  damageReferenceSource,
} from "../test/fixtures/damageCalculatorFixtures";
import { calculateChampionsDamage } from "./damageCalculator";

describe(
  `Champions damage references (${damageReferenceSource.regulation})`,
  () => {
    it.each(damageReferenceFixtures)("$id", (fixture) => {
      const result = calculateChampionsDamage(
        fixture.attacker,
        fixture.defender,
        fixture.field,
      );

      expect(result.status).toBe("ready");
      if (result.status !== "ready") {
        return;
      }

      expect({
        minDamage: result.minDamage,
        maxDamage: result.maxDamage,
        defenderMaxHp: result.defenderMaxHp,
        effectiveness: result.effectiveness,
        attackStat: result.attackStat,
        defenseStat: result.defenseStat,
      }).toEqual(fixture.expected);
    });
  },
);
