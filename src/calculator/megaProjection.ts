import { getCalculatorMaxHp } from "./calculatorViewModel";
import type { CalculatorAnalysisSide } from "./setOptimizer/types";

export function projectCalculatorSideToMega(
  side: CalculatorAnalysisSide,
): CalculatorAnalysisSide | null {
  const projection = side.megaEvolution;
  if (!projection) return null;

  const build = {
    ...side.build,
    ability: projection.ability,
  };
  const maxHp = getCalculatorMaxHp(projection.member, build);
  const currentHp = Math.max(
    1,
    Math.min(
      maxHp,
      Math.round((side.battle.currentHp / Math.max(1, side.maxHp)) * maxHp),
    ),
  );

  return {
    ...side,
    member: projection.member,
    build,
    battle: { ...side.battle, currentHp },
    maxHp,
    megaEvolution: undefined,
  };
}
