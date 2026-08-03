import type { AiTeamFixtureExpectations } from "./aiTeamFixtureTypes";

export type AiPokemonRecommendationFixture = {
  schemaVersion: 1;
  id: string;
  teamFixtureId: string;
  removedSlot: number;
  expectedRemovedPokemonName: string;
  expectedCandidateIds: string[];
  requiredRecommendationIds?: string[];
  expectations: AiTeamFixtureExpectations;
};

/**
 * Empty-slot recommendation regressions. The removed set is evaluator-only
 * context; the model sees only the five remaining sets and the production
 * candidate shortlist.
 */
export const aiPokemonRecommendationFixtures = [
  {
    schemaVersion: 1,
    id: "recommendation-swampert-rain-setter",
    teamFixtureId: "doubles-pokefeed-swampert-rain",
    removedSlot: 0,
    expectedRemovedPokemonName: "Pelipper",
    expectedCandidateIds: ["pelipper"],
    requiredRecommendationIds: ["pelipper"],
    expectations: {
      teamIdentities: [
        "restore a rain enabler for Mega Swampert and Electro Shot Archaludon",
        "preserve doubles speed control or board protection",
      ],
      criticalObservations: [
        "Pelipper is a strong reference candidate because Drizzle, Tailwind, and Wide Guard serve distinct needs of the remaining rain core.",
        "Sableye already carries manual Rain Dance, so a candidate should be evaluated as complementary weather reliability rather than the team's only possible rain source.",
        "Every recommendation should name both a concrete fit and a real defensive, role, speed, item, or opportunity-cost tradeoff from the supplied candidate snapshot.",
      ],
      forbiddenConclusions: [
        "Claiming any Water-type Pokemon automatically sets or supports rain without supplied ability, move, or concept evidence.",
        "Treating sun or another weather ability as support for the active rain plan.",
        "Claiming a candidate fixes Electric pressure merely because it is Water type.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "recommendation-protect-ace-support",
    teamFixtureId: "doubles-strategy-floette-delphox-protect-ace",
    removedSlot: 2,
    expectedRemovedPokemonName: "Maushold",
    expectedCandidateIds: ["maushold-family-of-four"],
    requiredRecommendationIds: ["maushold-family-of-four"],
    expectations: {
      teamIdentities: [
        "support one matchup-selected Mega setup ace",
        "add a distinct protection or disruption responsibility",
      ],
      criticalObservations: [
        "Maushold is a strong reference candidate because Friend Guard, Follow Me, Feint, and Super Fang add support that is not identical to Vivillon or Sinistcha.",
        "The remaining roster already contains Mega Floette and Mega Delphox as alternative branches, so a third Mega candidate carries a meaningful opportunity cost.",
        "Recommendations should distinguish role overlap from useful redundancy instead of rejecting every additional support Pokemon automatically.",
      ],
      forbiddenConclusions: [
        "Recommending a third Mega as though all three Mega Evolutions can activate together.",
        "Judging support candidates only by direct attacking power.",
        "Claiming redirection, Friend Guard, healing, sleep, and pivoting are interchangeable responsibilities.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "recommendation-round-chain-control",
    teamFixtureId: "doubles-strategy-zoroark-round-chain",
    removedSlot: 1,
    expectedRemovedPokemonName: "Farigiraf",
    expectedCandidateIds: ["farigiraf"],
    requiredRecommendationIds: ["farigiraf"],
    expectations: {
      teamIdentities: [
        "preserve the Hisuian Zoroark and Mega Gardevoir Round chain",
        "add matchup control without forcing a friendly Trick Room mode",
      ],
      criticalObservations: [
        "Farigiraf is a strong reference candidate because Armor Tail, Helping Hand, and Imprison plus Trick Room protect or complement the Round plan without turning it into dedicated Trick Room offense.",
        "A recommendation may offer another form of priority denial, disruption, or board support, but must ground the exact responsibility in supplied candidate facts.",
        "The candidate should be judged against the existing fast Choice Scarf Zoroark trigger and Mega Gardevoir responder rather than replacing their core interaction by default.",
      ],
      forbiddenConclusions: [
        "Calling the remaining roster a conventional Trick Room team or recommending a slow ace solely because Trick Room appears in the reference slot.",
        "Breaking the Round users into unrelated turns.",
        "Inventing an ability or common move that is absent from the candidate snapshot.",
      ],
    },
  },
  {
    schemaVersion: 1,
    id: "recommendation-singles-dual-mega-balance",
    teamFixtureId: "singles-m3-02-sand-dual-mega",
    removedSlot: 5,
    expectedRemovedPokemonName: "Primarina",
    expectedCandidateIds: ["primarina"],
    requiredRecommendationIds: undefined,
    expectations: {
      teamIdentities: [
        "complete a Singles bulky-offense roster",
        "complement two matchup-dependent Mega branches",
      ],
      criticalObservations: [
        "Primarina is a useful reference candidate because its Water and Fairy profile, special pressure, and utility differ from the remaining physical setup and Steel-heavy pieces.",
        "Hippowdon's sand is self-contained support, so candidates do not need Sand Rush or another explicit sand dependency.",
        "The remaining team already has Mega Dragonite and Mega Metagross options, making a third Mega branch a concrete tradeoff rather than an automatic rejection.",
      ],
      forbiddenConclusions: [
        "Applying doubles partner, spread-move, lead-pair, or four-Pokemon selection logic.",
        "Forcing a Sand Rush sweeper because Hippowdon has Sand Stream.",
        "Claiming a third Mega can activate alongside either existing Mega in the same battle.",
      ],
    },
  },
] as const satisfies readonly AiPokemonRecommendationFixture[];
