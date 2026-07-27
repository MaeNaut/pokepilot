import type {
  CalculatorBoosts,
  CalculatorPokemonStatus,
} from "./damageCalculator";
import type {
  PokemonCandidateFilterValue,
  PokemonIndexEntry,
  PokemonItem,
  StatBlock,
  TeamMember,
} from "../types";

export type CalculatorBuildValues = {
  item: PokemonItem | null;
  ability: string;
  natureId: string;
  evs: StatBlock;
  moveIds: string[];
};

export type CalculatorSideBattleState = {
  currentHp: number;
  status: CalculatorPokemonStatus;
  boosts: CalculatorBoosts;
};

export type CalculatorPokemonOption = {
  id: string;
  label: string;
  englishName: string;
  number: number;
  types: TeamMember["types"];
  entry: PokemonIndexEntry;
  abilityOptions: PokemonCandidateFilterValue[];
  moveIds: string[];
  usageRank?: number;
};

export type CalculatorPokemonSelectOptions = {
  applyUsageStats?: boolean;
  allowBattleForm?: boolean;
};
