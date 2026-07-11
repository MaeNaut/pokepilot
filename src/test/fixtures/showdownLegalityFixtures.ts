export const showdownPokedexFixture = {
  rotom: {
    abilities: { 0: "Levitate" },
  },
  rotomwash: {
    abilities: { 0: "Levitate" },
  },
  floetteeternal: {
    abilities: { 0: "Flower Veil", H: "Symbiosis" },
  },
  garchompmegaz: {
    abilities: { 0: "Sand Force" },
  },
};

export const showdownBaseLearnsetsFixture = {
  rotom: {
    learnset: {
      protect: ["9M"],
      shadowball: ["9M"],
    },
  },
  floetteeternal: {
    learnset: {
      protect: ["9M"],
    },
  },
};

export const championsFormatsDataFixture = `
export const FormatsData = {
  rotomwash: {
    tier: "M-B",
  },
  floetteeternal: {
    tier: "M-B",
  },
  garchompmegaz: {
    tier: "Illegal",
  },
};
`;

export const championsLearnsetsFixture = `
export const Learnsets = {
  rotomwash: {
    learnset: {
      hydropump: ["9M"],
      thunderbolt: ["9M"],
    },
  },
  floetteeternal: {
    learnset: {
      lightofruin: ["9M"],
      moonblast: ["9M"],
    },
  },
};
`;

export const championsItemsFixture = `
export const Items = {
  leftovers: {
    name: "Leftovers",
  },
  focussash: {
    name: "Focus Sash",
  },
  choiceband: {
    name: "Choice Band",
    isNonstandard: "Past",
  },
};
`;
