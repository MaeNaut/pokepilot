import {
  normalizeConceptLookup,
  teamConceptDefinitions,
  type TeamConceptId,
} from "../data/teamConcepts";
import type { PokemonMove } from "../types";
import type { TeamRoleId } from "./teamDiagnostics";

export type TeamConceptStatus = "complete" | "setup-only" | "beneficiary-only";

export type TeamConceptSummary = {
  id: TeamConceptId;
  label: string;
  status: TeamConceptStatus;
  setterSlots: number[];
  aceSlots: number[];
  dependentAceSlots: number[];
  independentAttackerSlots: number[];
  hasIndependentAttacker: boolean;
};

export type TeamConceptSetProfile = {
  slotIndex: number;
  ability: string;
  moves: PokemonMove[];
  roleIds: TeamRoleId[];
  speed: number | null;
  speedEv: number;
  speedNature: "up" | "down" | "neutral";
};

function isAttacker(profile: TeamConceptSetProfile) {
  return (
    profile.roleIds.includes("physical-attacker") ||
    profile.roleIds.includes("special-attacker")
  );
}

function isDamagingMove(move: PokemonMove) {
  return move.category?.toLowerCase() !== "status" && move.power !== null;
}

function getMedianSpeed(profiles: TeamConceptSetProfile[]) {
  const speeds = profiles
    .flatMap((profile) => (profile.speed === null ? [] : [profile.speed]))
    .sort((first, second) => first - second);

  if (speeds.length === 0) {
    return 0;
  }

  const middle = Math.floor(speeds.length / 2);
  return speeds.length % 2 === 0
    ? (speeds[middle - 1] + speeds[middle]) / 2
    : speeds[middle];
}

function hasMove(profile: TeamConceptSetProfile, moveIds: Set<string>) {
  return profile.moves.some(
    (move) =>
      moveIds.has(normalizeConceptLookup(move.id)) ||
      moveIds.has(normalizeConceptLookup(move.name)),
  );
}

function isTrickRoomAce(profile: TeamConceptSetProfile, medianSpeed: number) {
  return Boolean(
    isAttacker(profile) &&
      profile.speed !== null &&
      profile.speed <= medianSpeed &&
      profile.speedEv <= 8 &&
      profile.speedNature !== "up",
  );
}

function isTailwindAce(profile: TeamConceptSetProfile) {
  return isAttacker(profile);
}

function isTailwindDependent(
  profile: TeamConceptSetProfile,
  medianSpeed: number,
) {
  return Boolean(
    isTailwindAce(profile) &&
      profile.speed !== null &&
      profile.speed < medianSpeed &&
      profile.speedEv < 16 &&
      profile.speedNature !== "up",
  );
}

function isGravityAce(profile: TeamConceptSetProfile) {
  return Boolean(
    isAttacker(profile) &&
      profile.moves.some(
        (move) =>
          isDamagingMove(move) &&
          ((move.accuracy !== null && move.accuracy < 90) ||
            move.type === "ground"),
      ),
  );
}

export function analyzeTeamConcepts(profiles: TeamConceptSetProfile[]) {
  const medianSpeed = getMedianSpeed(profiles);
  const attackerSlots = profiles.filter(isAttacker).map((profile) => profile.slotIndex);

  return teamConceptDefinitions.flatMap((definition): TeamConceptSummary[] => {
    const setterSlots = profiles
      .filter(
        (profile) =>
          definition.setterAbilityIds.has(
            normalizeConceptLookup(profile.ability),
          ) || hasMove(profile, definition.setterMoveIds),
      )
      .map((profile) => profile.slotIndex);
    const strongAbilityAceSlots = profiles
      .filter(
        (profile) =>
          isAttacker(profile) &&
          definition.aceAbilityIds.has(normalizeConceptLookup(profile.ability)),
      )
      .map((profile) => profile.slotIndex);
    let aceSlots: number[];
    let dependentAceSlots: number[];

    if (definition.id === "trick-room") {
      aceSlots = profiles
        .filter((profile) => isTrickRoomAce(profile, medianSpeed))
        .map((profile) => profile.slotIndex);
      dependentAceSlots = aceSlots;
    } else if (definition.id === "tailwind") {
      aceSlots = profiles.filter(isTailwindAce).map((profile) => profile.slotIndex);
      dependentAceSlots = profiles
        .filter((profile) => isTailwindDependent(profile, medianSpeed))
        .map((profile) => profile.slotIndex);
    } else if (definition.id === "gravity") {
      aceSlots = profiles.filter(isGravityAce).map((profile) => profile.slotIndex);
      dependentAceSlots = aceSlots;
    } else {
      const moveAceSlots = profiles
        .filter(
          (profile) =>
            isAttacker(profile) &&
            (hasMove(profile, definition.aceMoveIds) ||
              (definition.boostedMoveType
                ? profile.moves.some(
                    (move) =>
                      isDamagingMove(move) &&
                      move.type === definition.boostedMoveType,
                  )
                : false)),
        )
        .map((profile) => profile.slotIndex);

      aceSlots = [...new Set([...strongAbilityAceSlots, ...moveAceSlots])];
      dependentAceSlots = strongAbilityAceSlots;
    }

    if (setterSlots.length === 0 && strongAbilityAceSlots.length === 0) {
      return [];
    }

    const independentAttackerSlots = attackerSlots.filter(
      (slotIndex) => !dependentAceSlots.includes(slotIndex),
    );
    const status: TeamConceptStatus =
      setterSlots.length === 0
        ? "beneficiary-only"
        : aceSlots.length === 0
          ? "setup-only"
          : "complete";

    return [
      {
        id: definition.id,
        label: definition.label,
        status,
        setterSlots,
        aceSlots,
        dependentAceSlots,
        independentAttackerSlots,
        hasIndependentAttacker: independentAttackerSlots.length > 0,
      },
    ];
  });
}
