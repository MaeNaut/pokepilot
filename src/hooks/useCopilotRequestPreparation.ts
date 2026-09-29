import { useEffect, useMemo, useState } from "react";
import { loadShowdownData, type ShowdownDataSnapshot } from "../api/showdownData";
import type { ShowdownLegalitySnapshot } from "../api/showdownLegality";
import { normalizeShowdownId } from "../api/showdownIds";
import type { BattleFormat } from "../battleFormat/battleFormat";
import { defaultEvs } from "../data/natures";
import type { Locale } from "../i18n/gameTranslations";
import type { DataLoadStatus, ItemIndexEntry, PokemonAbility, PokemonIndexEntry, TeamSlot } from "../types";
import { createCopilotAnalysisRequest } from "../utils/copilotRequestBuilder";
import type { CopilotAnalysisScope } from "../utils/copilotContracts";
import type { TeamBuildState } from "../utils/teamBuildState";
import type { TeamDiagnosticsResult } from "../utils/teamDiagnostics";
import type { TeamValidityResult } from "../utils/teamValidity";
import { useCopilotRecommendationCandidates } from "./useCopilotRecommendationCandidates";
import { useSetOptimizationPlan } from "./useSetOptimizationPlan";
import { useMetaThreatAnalysisPlan } from "./useMetaThreatAnalysisPlan";

type Options = {
  scope: CopilotAnalysisScope;
  locale: Locale;
  battleFormat: BattleFormat;
  teamName: string;
  team: TeamSlot[];
  pokemonIndex: PokemonIndexEntry[];
  itemIndex: ItemIndexEntry[];
  abilityIndex: PokemonAbility[];
  abilityIndexStatus: DataLoadStatus;
  showdownLegality: ShowdownLegalitySnapshot | null;
  showdownLegalityStatus: DataLoadStatus;
  selectedSlot: number;
  buildState: TeamBuildState;
  diagnostics: TeamDiagnosticsResult;
  validity: TeamValidityResult;
};

export function useCopilotRequestPreparation({
  scope, locale, battleFormat, teamName, team, pokemonIndex, itemIndex,
  abilityIndex, abilityIndexStatus, showdownLegality, showdownLegalityStatus,
  selectedSlot, buildState, diagnostics, validity,
}: Options) {
  const [showdownData, setShowdownData] = useState<ShowdownDataSnapshot | null>(null);
  const [isShowdownDataLoading, setIsShowdownDataLoading] = useState(true);
  useEffect(() => {
    let isCurrent = true;

    void loadShowdownData()
      .then((data) => {
        if (isCurrent) setShowdownData(data);
      })
      .catch(() => {
        // Existing request data remains a best-effort fallback when the catalog is unavailable.
      })
      .finally(() => {
        if (isCurrent) setIsShowdownDataLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const recommendationState = useCopilotRecommendationCandidates({
    scope,
    selectedSlot,
    team,
    buildState,
    battleFormat,
    diagnostics,
    pokemonIndex,
    abilityIndex,
    abilityIndexStatus,
    showdownLegality,
    showdownLegalityStatus,
  });

  const optimizationInput = useMemo(() => {
    const member = team[selectedSlot];
    if (!member) return null;
    return {
      selectedSlot,
      member,
      build: {
        item: buildState.itemBySlot[selectedSlot] ?? null,
        ability:
          buildState.abilityBySlot[selectedSlot] ?? member.abilities?.[0] ?? "",
        natureId: buildState.natureBySlot[selectedSlot] ?? "hardy",
        evs: buildState.evsBySlot[selectedSlot] ?? { ...defaultEvs },
        moveIds: [
          ...(buildState.moveIdsBySlot[selectedSlot] ?? []),
          "",
          "",
          "",
          "",
        ].slice(0, 4),
      },
      reservedItemIds: team.flatMap((entry, slotIndex) => {
        if (!entry || slotIndex === selectedSlot) return [];
        const item = buildState.itemBySlot[slotIndex];
        const id = normalizeShowdownId(
          item?.showdownId ?? item?.id ?? item?.name ?? "",
        );
        return id ? [id] : [];
      }),
    };
  }, [buildState, selectedSlot, team]);
  const optimizationState = useSetOptimizationPlan(
    optimizationInput,
    battleFormat,
    itemIndex,
    scope === "optimization",
  );
  const matchupState = useMetaThreatAnalysisPlan({
    team,
    buildState,
    battleFormat,
    pokemonIndex,
    itemIndex,
    abilityIndex,
    diagnostics,
    showdownLegality,
    enabled: scope === "matchup",
  });
  const requestInput = useMemo(
    () => ({
      scope,
      locale,
      battleFormat,
      teamName,
      team,
      pokemonIndex,
      abilityIndex,
      showdownData,
      selectedSlot,
      buildState,
      diagnostics,
      validity,
      recommendationCandidates: recommendationState.candidates,
    }),
    [
      battleFormat,
      abilityIndex,
      buildState,
      diagnostics,
      locale,
      pokemonIndex,
      scope,
      selectedSlot,
      team,
      teamName,
      validity,
      recommendationState.candidates,
      showdownData,
    ],
  );
  const request = useMemo(() => createCopilotAnalysisRequest({
    ...requestInput,
    optimizationPlan:
      scope === "matchup" ? null : optimizationState.plan,
    threatPlan: matchupState.plan,
    threatReplacementCandidates: matchupState.replacementCandidates,
  }), [
    requestInput,
    scope,
    optimizationState.plan,
    matchupState.plan,
    matchupState.replacementCandidates,
  ]);
  const isAnalysisPreparing =
    recommendationState.status === "loading" ||
    optimizationState.loading ||
    matchupState.loading ||
    isShowdownDataLoading;

  async function prepareRequest() {
    if (scope === "recommendation") {
      const candidates = await recommendationState.run();
      return candidates?.length
        ? createCopilotAnalysisRequest({ ...requestInput, recommendationCandidates: candidates })
        : null;
    }
    if (scope === "optimization") {
      const plan = await optimizationState.run();
      return plan?.status === "ready" && plan.candidates.length > 0
        ? createCopilotAnalysisRequest({ ...requestInput, optimizationPlan: plan })
        : null;
    }
    if (scope === "matchup") {
      const result = await matchupState.run();
      return result?.plan.status === "ready"
        ? createCopilotAnalysisRequest({
            ...requestInput, optimizationPlan: null, threatPlan: result.plan,
            threatReplacementCandidates: result.replacementCandidates,
          })
        : null;
    }
    return request;
  }

  return { request, prepareRequest, isAnalysisPreparing, recommendationState, optimizationState, matchupState };
}
