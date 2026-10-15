import type { CopilotAnalysisRequest } from "../src/utils/copilotContracts.js";
import { serializePokePilotModelRequest } from "./pokepilotModelInput.js";
import {
  getPokePilotLocaleInstructions,
  getPokePilotScopeInstructions,
  pokepilotCommonInstructions,
} from "./pokepilotPrompts.js";

// Shared by the provider request and the local, key-free estimate worker.
export function createPokePilotPromptParts(request: CopilotAnalysisRequest) {
  const modelRequest = {
    ...request,
    battleRules: {
      activePokemonPerSide: request.battleFormat === "singles" ? 1 : 2,
      activeAlliesPerPokemon: request.battleFormat === "singles" ? 0 : 1,
      selectedPokemonPerBattle: request.battleFormat === "singles" ? 3 : 4,
      maximumActivatedMegas: 1,
    },
  };
  const modelInput = serializePokePilotModelRequest(modelRequest);
  return {
    common: pokepilotCommonInstructions,
    scope: getPokePilotScopeInstructions(request.scope, request.battleFormat),
    locale: [modelInput.instructions, getPokePilotLocaleInstructions(request.locale)]
      .filter(Boolean).join("\n\n"),
    data: modelInput.text,
  };
}
