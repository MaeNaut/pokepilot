import { useEffect, useRef, useState } from "react";
import type { CopilotAnalysisRequest, CopilotAnalysisScope, CopilotSetOptimizationCandidateSnapshot } from "../utils/copilotContracts";
import type { RecommendedPokemonApplyResult, RecommendedPokemonSaveResult } from "../utils/recommendedPokemonApplication";

export type CopilotCandidateCallbacks = {
  onSelectRecommendedPokemon: (
    slotIndex: number,
    pokemonId: string,
    expectedCurrentPokemonId: string | null,
  ) => Promise<RecommendedPokemonApplyResult>;
  onSaveRecommendedPokemon: (
    slotIndex: number,
    pokemonId: string,
  ) => Promise<RecommendedPokemonSaveResult>;
  onApplyOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => void;
  onSaveOptimizationCandidate: (
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) => boolean;
};

type Options = CopilotCandidateCallbacks & {
  scope: CopilotAnalysisScope;
  request: CopilotAnalysisRequest;
  requestFingerprint: string;
  isStale: boolean;
  setScope: (scope: CopilotAnalysisScope) => void;
};

export function useCopilotCandidateActions({
  scope, request, requestFingerprint, isStale, setScope,
  onSelectRecommendedPokemon, onSaveRecommendedPokemon,
  onApplyOptimizationCandidate, onSaveOptimizationCandidate,
}: Options) {
  const scopeVersion = useRef(0);
  useEffect(() => {
    scopeVersion.current += 1;
    return () => { scopeVersion.current += 1; };
  }, [scope]);
  const [selectingCandidateId, setSelectingCandidateId] = useState<string | null>(
    null,
  );
  const [candidateApplyFailure, setCandidateApplyFailure] = useState<
    Extract<RecommendedPokemonApplyResult, { status: "blocked" }>["reason"] | null
  >(null);
  const [savingCandidateId, setSavingCandidateId] = useState<string | null>(null);
  const [candidateSaveStatus, setCandidateSaveStatus] = useState<
    "saved" | "bench-full" | null
  >(null);
  const [optimizationActionStatus, setOptimizationActionStatus] = useState<
    "applied" | "saved" | "bench-full" | "stale" | null
  >(null);

  useEffect(() => {
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
  }, [requestFingerprint, scope]);

  useEffect(() => {
    setOptimizationActionStatus(null);
  }, [scope]);


  async function handleSelectCandidate(pokemonId: string) {
    if (selectingCandidateId || savingCandidateId) {
      return;
    }

    if (isStale) {
      setCandidateApplyFailure("stale");
      return;
    }

    setSelectingCandidateId(pokemonId);
    const initialScopeVersion = scopeVersion.current;
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
    try {
      const candidate = request.recommendationCandidates.find(
        (entry) => entry.pokemonId === pokemonId,
      );
      if (!candidate) {
        setCandidateApplyFailure("stale");
        return;
      }
      const result = await onSelectRecommendedPokemon(
        candidate.target.slotIndex,
        pokemonId,
        candidate.target.currentPokemonId,
      );

      if (result.status === "blocked") {
        setCandidateApplyFailure(result.reason);
        return;
      }

      if (scopeVersion.current === initialScopeVersion) setScope("pokemon");
    } catch {
      setCandidateApplyFailure("load-failed");
    } finally {
      setSelectingCandidateId(null);
    }
  }

  async function handleSaveCandidate(pokemonId: string) {
    if (selectingCandidateId || savingCandidateId) {
      return;
    }

    if (isStale) {
      setCandidateApplyFailure("stale");
      return;
    }

    setSavingCandidateId(pokemonId);
    setCandidateApplyFailure(null);
    setCandidateSaveStatus(null);
    try {
      const candidate = request.recommendationCandidates.find(
        (entry) => entry.pokemonId === pokemonId,
      );
      if (!candidate) {
        setCandidateApplyFailure("stale");
        return;
      }
      const result = await onSaveRecommendedPokemon(
        candidate.target.slotIndex,
        pokemonId,
      );

      if (result.status === "blocked") {
        if (result.reason === "bench-full") {
          setCandidateSaveStatus("bench-full");
        } else {
          setCandidateApplyFailure(result.reason);
        }
        return;
      }

      setCandidateSaveStatus("saved");
    } catch {
      setCandidateApplyFailure("load-failed");
    } finally {
      setSavingCandidateId(null);
    }
  }

  function handleApplyOptimizationCandidate(
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) {
    if (isStale) {
      setOptimizationActionStatus("stale");
      return;
    }

    onApplyOptimizationCandidate(candidate);
    setOptimizationActionStatus("applied");
  }

  function handleSaveOptimizationCandidate(
    candidate: CopilotSetOptimizationCandidateSnapshot,
  ) {
    if (isStale) {
      setOptimizationActionStatus("stale");
      return;
    }

    setOptimizationActionStatus(
      onSaveOptimizationCandidate(candidate) ? "saved" : "bench-full",
    );
  }


  return {
    selectingCandidateId, savingCandidateId, candidateApplyFailure, candidateSaveStatus,
    optimizationActionStatus, setOptimizationActionStatus,
    handleSelectCandidate, handleSaveCandidate,
    handleApplyOptimizationCandidate, handleSaveOptimizationCandidate,
  };
}
