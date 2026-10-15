import type { CopilotAnalysisRequest, CopilotMegaEvolutionSnapshot, CopilotSetSnapshot } from "../src/utils/copilotContracts.js";
import { normalizeShowdownId } from "../src/api/showdownIds.js";
import type { CopilotMechanicEntry } from "../src/utils/copilotMechanics.js";

const ownerMechanicsInstructions =
  "Each set.mechanics links effects to that current set's selected moves, " +
  "active ability and held item. megaEvolution.mechanics applies only after " +
  "Mega activation. These links are not extra selected options or simultaneous " +
  "abilities. An unlinked element's effect remains unknown, not absent.";

type OwnerBoundSet = Omit<CopilotSetSnapshot, "megaEvolution"> & {
  mechanics?: { moves: CopilotMechanicEntry[]; ability?: CopilotMechanicEntry; item?: CopilotMechanicEntry };
  megaEvolution: (CopilotMegaEvolutionSnapshot & { mechanics?: { ability: CopilotMechanicEntry } }) | null;
};
type OwnerBoundRequest = Omit<CopilotAnalysisRequest, "sets"> & { sets: OwnerBoundSet[] };

function indexMechanics(entries: CopilotMechanicEntry[]) {
  const index = new Map<string, CopilotMechanicEntry | null>();
  for (const entry of entries) {
    const id = normalizeShowdownId(entry.id);
    if (!id) continue;
    // A conflicting reference cannot safely be assigned to an owner.
    index.set(id, index.has(id) ? null : entry);
  }
  return (value: string | null) => value
    ? index.get(normalizeShowdownId(value)) ?? null
    : null;
}

function bindOwnerMechanics(request: CopilotAnalysisRequest): { request: OwnerBoundRequest; linked: boolean } {
  const move = indexMechanics(request.mechanics.moves);
  const ability = indexMechanics(request.mechanics.abilities);
  const item = indexMechanics(request.mechanics.items);
  let linked = false;
  const sets = request.sets.map((set): OwnerBoundSet => {
    const moves = set.moves.flatMap(selected => {
      const mechanic = move(selected.id);
      return mechanic ? [mechanic] : [];
    });
    const currentAbility = ability(set.ability);
    const heldItem = item(set.item);
    const megaAbility = ability(set.megaEvolution?.ability ?? null);
    if (!moves.length && !currentAbility && !heldItem && !megaAbility) return set;
    linked = true;
    return {
      ...set,
      mechanics: {
        moves,
        ...(currentAbility ? { ability: currentAbility } : {}),
        ...(heldItem ? { item: heldItem } : {}),
      },
      megaEvolution: set.megaEvolution && megaAbility
        ? { ...set.megaEvolution, mechanics: { ability: megaAbility } }
        : set.megaEvolution,
    };
  });
  const modelRequest: OwnerBoundRequest = linked ? { ...request, sets } : request;
  return { request: modelRequest, linked };
}

const sharedDataInstructions =
  "Input encoding: request.sharedData holds exact shared records. An object " +
  "with dataRef stands for the complete record at sharedData[dataRef], including " +
  "all its fields. Resolve references before applying the analysis and audit " +
  "rules; each occurrence retains its surrounding owner, candidate, and " +
  "offense/defense/current/optimized context. References indicate equal data, " +
  "not equal strategic roles. Never print dataRef or sharedData identifiers.";

type SharedRecord = {
  kind: string;
  value: object;
  occurrences: object[];
};

/** Keep the validated request intact; share exact records only at the model boundary. */
export function serializePokePilotModelRequest(request: CopilotAnalysisRequest) {
  const bound = bindOwnerMechanics(request);
  const originalText = JSON.stringify(bound.request);
  const ownerInstructions = bound.linked ? ownerMechanicsInstructions : "";
  const records = new Map<string, SharedRecord>();
  const ownerRecords = new Set<object>();
  const collect = (kind: string, value: object) => {
    const key = `${kind}:${JSON.stringify(value)}`;
    const record = records.get(key);
    if (record) {
      record.occurrences.push(value);
    } else {
      records.set(key, { kind, value, occurrences: [value] });
    }
  };

  for (const set of request.sets) {
    for (const move of set.moves) collect("move", move);
    collect("defense", set.defensiveProfile);
    if (set.megaEvolution) collect("defense", set.megaEvolution.defensiveProfile);
  }
  for (const candidate of request.recommendationCandidates) {
    collect("recommendation-target", candidate.target);
    for (const move of candidate.commonSet?.moves ?? []) collect("move", move);
    for (const ability of candidate.abilities) collect("ability", ability);
    if (candidate.megaEvolution?.ability) collect("ability", candidate.megaEvolution.ability);
    for (const move of candidate.usageOptions?.alternativeMoves ?? []) collect("usage-move", move);
    for (const item of candidate.usageOptions?.items ?? []) collect("usage-item", item);
    for (const spread of candidate.usageOptions?.statPointSpreads ?? []) collect("usage-spread", spread);
  }
  for (const move of request.mechanics.moves) collect("move", move);
  for (const ability of request.mechanics.abilities) collect("ability", ability);
  for (const item of request.mechanics.items) collect("item", item);
  for (const set of bound.request.sets) {
    if (!set.mechanics) continue;
    for (const move of set.mechanics.moves) {
      collect("move", move);
      ownerRecords.add(move);
    }
    if (set.mechanics.ability) {
      collect("ability", set.mechanics.ability);
      ownerRecords.add(set.mechanics.ability);
    }
    if (set.mechanics.item) {
      collect("item", set.mechanics.item);
      ownerRecords.add(set.mechanics.item);
    }
    if (set.megaEvolution?.mechanics) {
      const ability = set.megaEvolution.mechanics.ability;
      collect("ability", ability);
      ownerRecords.add(ability);
    }
  }
  for (const move of request.optimization?.moveMechanics ?? []) collect("move", move);
  for (const item of request.optimization?.itemMechanics ?? []) collect("item", item);
  for (const candidate of request.optimization?.candidates ?? []) {
    for (const benchmark of [...candidate.offenseBenchmarks, ...candidate.defenseBenchmarks]) {
      collect("damage", benchmark.current);
      collect("damage", benchmark.optimized);
    }
    if (candidate.speedBenchmark) {
      collect("speed", candidate.speedBenchmark.current);
      collect("speed", candidate.speedBenchmark.optimized);
    }
  }
  if (request.matchup?.mode === "meta") {
    for (const threat of request.matchup.threats) {
      for (const move of threat.opponent.moves) collect("move", move);
      for (const member of threat.members) {
        for (const benchmark of [
          ...member.offenseBenchmarks,
          ...member.defenseBenchmarks,
        ]) {
          collect("damage", benchmark.outcome);
        }
        collect("speed", member.speed);
      }
    }
    for (const evidence of request.matchup.replacementEvidence) {
      for (const benchmark of [
        ...evidence.member.offenseBenchmarks,
        ...evidence.member.defenseBenchmarks,
      ]) {
        collect("damage", benchmark.outcome);
      }
      collect("speed", evidence.member.speed);
    }
  } else if (request.matchup?.mode === "exact") {
    for (const move of request.matchup.opponent.moves) collect("move", move);
    for (const member of request.matchup.members) {
      for (const benchmark of [
        ...member.offenseBenchmarks,
        ...member.defenseBenchmarks,
      ]) {
        collect("damage", benchmark.result);
      }
      collect("speed", member.speed);
    }
  }

  const references = new WeakMap<object, { dataRef: string }>();
  const sharedData: Record<string, object> = {};
  for (const { kind, value, occurrences } of records.values()) {
    if (occurrences.length < 2) continue;
    const dataRef = `${kind}${Object.keys(sharedData).length + 1}`;
    const reference = { dataRef };
    const recordLength = JSON.stringify(value).length;
    const referenceLength = JSON.stringify(reference).length;
    const savedCharacters = occurrences.length * (recordLength - referenceLength)
      - recordLength - dataRef.length - 4;
    if (savedCharacters < 48 && !occurrences.some(occurrence => ownerRecords.has(occurrence))) continue;
    sharedData[dataRef] = value;
    for (const occurrence of occurrences) references.set(occurrence, reference);
  }

  if (Object.keys(sharedData).length === 0) {
    return { text: originalText, instructions: ownerInstructions };
  }

  const compactRequest = JSON.parse(JSON.stringify(bound.request, (_key, value: unknown) =>
    value !== null && typeof value === "object"
      ? references.get(value) ?? value
      : value,
  )) as Record<string, unknown>;
  // Serialize the table separately so its records remain complete, never references.
  const text = JSON.stringify({ sharedData, ...compactRequest });
  if (!bound.linked && text.length + sharedDataInstructions.length + 64 >= originalText.length) {
    return { text: originalText, instructions: ownerInstructions };
  }
  return { text, instructions: [sharedDataInstructions, ownerInstructions].filter(Boolean).join("\n\n") };
}
