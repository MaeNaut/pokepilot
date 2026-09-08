import type { CopilotAnalysisRequest } from "../src/utils/copilotContracts.js";

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
  const originalText = JSON.stringify(request);
  const records = new Map<string, SharedRecord>();
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
    for (const move of candidate.commonSet?.moves ?? []) collect("move", move);
    for (const ability of candidate.abilities) collect("ability", ability);
  }
  for (const move of request.mechanics.moves) collect("move", move);
  for (const ability of request.mechanics.abilities) collect("ability", ability);
  for (const item of request.mechanics.items) collect("item", item);
  for (const move of request.optimization?.moveMechanics ?? []) collect("move", move);
  for (const candidate of request.optimization?.candidates ?? []) {
    for (const benchmark of [...candidate.offenseBenchmarks, ...candidate.defenseBenchmarks]) {
      collect("damage", benchmark.current);
      collect("damage", benchmark.optimized);
    }
    collect("speed", candidate.speedBenchmark.current);
    collect("speed", candidate.speedBenchmark.optimized);
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
    if (savedCharacters < 48) continue;
    sharedData[dataRef] = value;
    for (const occurrence of occurrences) references.set(occurrence, reference);
  }

  if (Object.keys(sharedData).length === 0) {
    return { text: originalText, instructions: "" };
  }

  const compactRequest = JSON.parse(JSON.stringify(request, (_key, value: unknown) =>
    value !== null && typeof value === "object"
      ? references.get(value) ?? value
      : value,
  )) as Record<string, unknown>;
  // Serialize the table separately so its records remain complete, never references.
  const text = JSON.stringify({ sharedData, ...compactRequest });
  if (text.length + sharedDataInstructions.length + 64 >= originalText.length) {
    return { text: originalText, instructions: "" };
  }
  return { text, instructions: sharedDataInstructions };
}
