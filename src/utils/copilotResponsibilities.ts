import { normalizeShowdownId as normalizeId } from "../api/showdownIds";

export const copilotResponsibilityIds = [
  "attack-redirection",
  "ally-damage-reduction",
  "priority-denial",
  "ally-damage-amplification",
  "spread-protection",
  "speed-control",
  "turn-order-control",
  "immediate-disruption",
  "opponent-offense-control",
  "action-denial",
  "pivoting",
  "ally-recovery",
] as const;

export type CopilotResponsibilityId =
  (typeof copilotResponsibilityIds)[number];

export type CopilotResponsibilityElement = {
  id: string;
  effect?: string;
  tags?: string[];
};

type InferCopilotResponsibilitiesInput = {
  abilities?: CopilotResponsibilityElement[];
  moves?: CopilotResponsibilityElement[];
};

const abilityResponsibilities: Record<
  string,
  readonly CopilotResponsibilityId[]
> = {
  armortail: ["priority-denial"],
  battery: ["ally-damage-amplification"],
  dazzling: ["priority-denial"],
  friendguard: ["ally-damage-reduction"],
  hospitality: ["ally-recovery"],
  intimidate: ["opponent-offense-control"],
  lightningrod: ["attack-redirection"],
  powerspot: ["ally-damage-amplification"],
  queenlymajesty: ["priority-denial"],
  stormdrain: ["attack-redirection"],
};

const moveResponsibilities: Record<
  string,
  readonly CopilotResponsibilityId[]
> = {
  afteryou: ["turn-order-control"],
  batonpass: ["pivoting"],
  charm: ["opponent-offense-control"],
  chillyreception: ["pivoting"],
  coaching: ["ally-damage-amplification"],
  electroweb: ["speed-control"],
  encore: ["action-denial"],
  fakeout: ["immediate-disruption"],
  flipturn: ["pivoting"],
  floralhealing: ["ally-recovery"],
  followme: ["attack-redirection"],
  helpinghand: ["ally-damage-amplification"],
  healpulse: ["ally-recovery"],
  icywind: ["speed-control"],
  imprison: ["action-denial"],
  lifedew: ["ally-recovery"],
  partingshot: ["opponent-offense-control", "pivoting"],
  pollenpuff: ["ally-recovery"],
  quash: ["turn-order-control"],
  ragepowder: ["attack-redirection"],
  scaryface: ["speed-control"],
  snarl: ["opponent-offense-control"],
  strengthsap: ["opponent-offense-control"],
  tailwind: ["speed-control"],
  taunt: ["action-denial"],
  thunderwave: ["speed-control"],
  trickroom: ["turn-order-control"],
  uturn: ["pivoting"],
  voltswitch: ["pivoting"],
  wideguard: ["spread-protection"],
};

function normalizeEffect(value: string | undefined) {
  return value?.replace(/\s+/g, " ").trim().toLowerCase() ?? "";
}

function inferEffectResponsibilities(
  effect: string,
  responsibilities: Set<CopilotResponsibilityId>,
) {
  if (!effect) return;

  if (
    effect.includes("center of attention") ||
    effect.includes("redirects that move to itself") ||
    effect.includes("draws electric moves to itself") ||
    effect.includes("draws water moves to itself")
  ) {
    responsibilities.add("attack-redirection");
  }
  if (
    (effect.includes("allies receive") && effect.includes("damage")) ||
    (effect.includes("damage") && effect.includes("this pokemon's allies"))
  ) {
    responsibilities.add("ally-damage-reduction");
  }
  if (
    effect.includes("priority moves") &&
    effect.includes("allies") &&
    (effect.includes("prevented") || effect.includes("cannot"))
  ) {
    responsibilities.add("priority-denial");
  }
  if (
    (effect.includes("allies have the power") ||
      effect.includes("target's attacks have") ||
      effect.includes("target's next attack")) &&
    (effect.includes("multiplied") || effect.includes("power"))
  ) {
    responsibilities.add("ally-damage-amplification");
  }
  if (
    effect.includes("multi-target attacks") ||
    effect.includes("spread moves")
  ) {
    responsibilities.add("spread-protection");
  }
  if (
    effect.includes("speed of all pokemon on the user's side") ||
    effect.includes("lowers the target's speed") ||
    effect.includes("lowers the speed of opposing")
  ) {
    responsibilities.add("speed-control");
  }
  if (
    effect.includes("slower pokemon move first") ||
    effect.includes("moves immediately after") ||
    effect.includes("moves last in its priority bracket")
  ) {
    responsibilities.add("turn-order-control");
  }
  if (
    effect.includes("makes the target flinch") &&
    effect.includes("first turn")
  ) {
    responsibilities.add("immediate-disruption");
  }
  if (
    effect.includes("lowers the attack of opposing") ||
    effect.includes("lowers the target's attack") ||
    effect.includes("lowers the target's special attack")
  ) {
    responsibilities.add("opponent-offense-control");
  }
  if (
    effect.includes("prevents the target from using status moves") ||
    effect.includes("must use the same move") ||
    effect.includes("prevents any pokemon from using")
  ) {
    responsibilities.add("action-denial");
  }
  if (
    effect.includes("switches out after") ||
    effect.includes("switches out, even if it is trapped")
  ) {
    responsibilities.add("pivoting");
  }
  if (
    effect.includes("restores 1/4 of the target's maximum hp") ||
    effect.includes("restores 1/4 of the hp of this pokemon's allies") ||
    effect.includes("can be used to heal an ally")
  ) {
    responsibilities.add("ally-recovery");
  }
}

function addElementResponsibilities(
  element: CopilotResponsibilityElement,
  explicitResponsibilities: Record<
    string,
    readonly CopilotResponsibilityId[]
  >,
  responsibilities: Set<CopilotResponsibilityId>,
) {
  const elementId = normalizeId(element.id);
  explicitResponsibilities[elementId]?.forEach((responsibility) =>
    responsibilities.add(responsibility),
  );
  inferEffectResponsibilities(normalizeEffect(element.effect), responsibilities);

  if (element.tags?.some((tag) => normalizeId(tag) === "protect")) {
    if (elementId === "wideguard") {
      responsibilities.add("spread-protection");
    }
  }
}

/**
 * Converts canonical mechanics into broad, species-agnostic team jobs. The
 * exact move and Ability effects remain the source of truth sent to the model.
 */
export function inferCopilotResponsibilities({
  abilities = [],
  moves = [],
}: InferCopilotResponsibilitiesInput): CopilotResponsibilityId[] {
  const responsibilities = new Set<CopilotResponsibilityId>();

  abilities.forEach((ability) =>
    addElementResponsibilities(
      ability,
      abilityResponsibilities,
      responsibilities,
    ),
  );
  moves.forEach((move) =>
    addElementResponsibilities(move, moveResponsibilities, responsibilities),
  );

  return copilotResponsibilityIds.filter((responsibility) =>
    responsibilities.has(responsibility),
  );
}

export function createCopilotResponsibilityCounts(
  responsibilityGroups: readonly (readonly CopilotResponsibilityId[])[],
) {
  const counts = Object.fromEntries(
    copilotResponsibilityIds.map((responsibility) => [responsibility, 0]),
  ) as Record<CopilotResponsibilityId, number>;

  responsibilityGroups.forEach((group) => {
    new Set(group).forEach((responsibility) => {
      counts[responsibility] += 1;
    });
  });

  return counts;
}
