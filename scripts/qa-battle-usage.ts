import { createBattleUsageApi } from "../server/battleUsageApi";
import { isBattleUsageSet, parseBattleUsageIndex, type BattleUsageSnapshot } from "../src/api/battleUsageData";
import { normalizeShowdownId } from "../src/api/showdownIds";
import { getPokemonLookupAliases } from "../src/utils/pokemonAliases";
import { normalizeShowdownSnapshot } from "../src/api/showdownData";
import { getLegalAbilities, getLegalMoves, hydrateShowdownLegalitySnapshot, isItemLegal, isPokemonLegal } from "../src/api/showdownLegality";
import { normalizeShowdownItemCatalog } from "../src/api/showdownCatalog";
import { createMetaThreatUsageSide } from "../src/calculator/metaThreatAnalysis";
import { readFile } from "node:fs/promises";

const baseArgument = process.argv.find((argument) => argument.startsWith("--base-url="))?.slice("--base-url=".length);
const deploymentBase = baseArgument ? new URL(baseArgument) : null;
if (deploymentBase && (deploymentBase.username || deploymentBase.password ||
  (deploymentBase.protocol !== "https:" && !(deploymentBase.protocol === "http:" && ["127.0.0.1", "localhost"].includes(deploymentBase.hostname))))) {
  throw new Error("QA base URL must use HTTPS or local HTTP, without credentials.");
}
const raw = deploymentBase ? null : await fetch("https://championsbattledata.com/api").then((response) => {
  if (!response.ok) throw new Error(`Index HTTP ${response.status}`);
  return response.json();
});
const legality = JSON.parse(await readFile(new URL("../public/data/showdown-regulation-mc.json", import.meta.url), "utf8"));
const legal = new Set<string>(legality.pokemonIds.map(normalizeShowdownId));
const rules = hydrateShowdownLegalitySnapshot(legality);
const battle = JSON.parse(await readFile(new URL("../public/data/showdown-battle-mc.json", import.meta.url), "utf8"));
const showdown = normalizeShowdownSnapshot(battle.species, battle.moves);
const items = normalizeShowdownItemCatalog(JSON.parse(await readFile(new URL("../public/data/showdown-items.json", import.meta.url), "utf8"))).index;
const problems: unknown[] = [];
const localHandler = createBattleUsageApi();
const handler = (request: Request) => deploymentBase
  ? fetch(new Request(new URL(new URL(request.url).pathname, deploymentBase), { redirect: "manual", signal: AbortSignal.timeout(15_000) }))
  : localHandler(request);
for (const format of ["singles", "doubles"] as const) {
  let snapshot: BattleUsageSnapshot;
  if (deploymentBase) {
    const response = await handler(new Request(`https://pokepilot.app/api/battle-usage/${format}`));
    if (!response.ok) throw new Error(`${format} index: HTTP ${response.status}`);
    snapshot = await response.json() as BattleUsageSnapshot;
    if (snapshot.battleFormat !== format || !Array.isArray(snapshot.sets)) throw new Error("Invalid deployed usage snapshot");
  } else snapshot = parseBattleUsageIndex(raw, format);
  const missing = snapshot.sets.filter((set) => !getPokemonLookupAliases(set.pokemonId)
    .some((alias) => legal.has(normalizeShowdownId(alias))));
  console.log(JSON.stringify({ format, date: snapshot.sourceDate, season: snapshot.season, sets: snapshot.sets.length,
    bytes: JSON.stringify(snapshot).length, top: snapshot.sets.slice(0, 5).map((set) => set.pokemonName),
    needsAliasReview: missing.map((set) => set.pokemonId) }));
  for (const set of snapshot.sets) {
    const keys = getPokemonLookupAliases(set.pokemonId).map(normalizeShowdownId);
    const species = keys.map((key) => showdown.speciesById[key]).find(Boolean);
    const moves = getLegalMoves(rules, set.pokemonId);
    const abilities = getLegalAbilities(rules, set.pokemonId);
    const side = createMetaThreatUsageSide(set, showdown, items);
    const invalid = {
      contract: !isBattleUsageSet(set, snapshot.sourceDate, snapshot.season),
      species: !species,
      legal: !isPokemonLegal(rules, set.pokemonId),
      ability: !abilities?.has(normalizeShowdownId(set.ability ?? "")),
      moves: set.moveIds.filter((id) => !showdown.movesById[id] || !moves?.has(id)),
      items: (set.itemNames ?? []).filter((id) => !isItemLegal(rules, id)),
      side: !side,
    };
    if (invalid.contract || invalid.species || invalid.legal || invalid.ability || invalid.moves.length || invalid.items.length || invalid.side) {
      problems.push({ format, id: set.pokemonId, ...invalid });
    }
  }
  for (const id of ["garchomp", "indeedeef", "meowsticf", "pyroar", "furfrou"]) {
    const response = await handler(new Request(`https://pokepilot.app/api/battle-usage/${format}/${id}`));
    if (!response.ok) throw new Error(`${format}/${id}: HTTP ${response.status}`);
    const set = await response.json();
    if (!isBattleUsageSet(set, snapshot.sourceDate, snapshot.season) ||
      normalizeShowdownId(set.pokemonId) !== id) throw new Error(`${format}/${id}: Invalid detail contract`);
    if (!set.itemOptions?.length || !set.statPointSpreads?.length) {
      throw new Error(`${format}/${id}: Missing detailed item or stat-point distribution`);
    }
    console.log(JSON.stringify({ format, id, date: set.sourceDate, nature: set.nature, ability: set.ability,
      evTotal: Object.values(set.evs as Record<string, number>).reduce((sum, point) => sum + point, 0),
      moves: set.moveIds.length, items: set.itemOptions.length, spreads: set.statPointSpreads.length }));
  }
}
if (deploymentBase) {
  for (const [path, method, expected] of [
    ["singles", "HEAD", 200], ["invalid", "HEAD", 400], ["singles/missing-pokemon", "GET", 404], ["singles", "POST", 405],
  ] as const) {
    const response = await fetch(new URL(`/api/battle-usage/${path}`, deploymentBase), { method, redirect: "manual" });
    if (response.status !== expected || (method === "HEAD" && await response.text() !== "")) {
      throw new Error(`${method} ${path}: Invalid deployed HTTP behavior (${response.status})`);
    }
  }
}
console.log(JSON.stringify({ catalogIssues: problems }));
if (problems.length) process.exitCode = 1;
