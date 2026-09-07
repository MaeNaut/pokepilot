import { useCallback, useState, type SetStateAction } from "react";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { createDefaultCalculatorField } from "../calculator/calculatorViewModel";
import { environmentSourceKey, resolveAutomaticEnvironment, type EnvironmentSources } from "../calculator/automaticEnvironment";
import type { CalculatorField } from "../calculator/damageCalculator";

export function useCalculatorField(format: BattleFormat, sources: EnvironmentSources) {
  const key = JSON.stringify([environmentSourceKey(sources.player), environmentSourceKey(sources.opponent)]);
  const [state, setState] = useState(() => ({
    key, sources, field: { ...createDefaultCalculatorField(format), ...resolveAutomaticEnvironment(sources) },
  }));
  let field = state.field;
  if (state.key !== key) {
    // Derive synchronously so damage and analysis never see a new Pokemon with stale weather.
    field = { ...field, ...resolveAutomaticEnvironment(sources, state.sources) };
    setState({ key, sources, field });
  }
  const setField = useCallback((update: SetStateAction<CalculatorField>) => {
    setState(current => ({ ...current, field: typeof update === "function" ? update(current.field) : update }));
  }, []);
  return [field, setField] as const;
}
