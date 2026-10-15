// Published-team evaluations: .tmp/mc-final/v99-fresh-* (low) and
// .tmp/mc-medium/after-medium-* (medium), five independent teams per cell.
// Input is the median; output/time are observed p20-p80, not confidence bounds.
type Profile = {
  input: number;
  members: number;
  output: [number, number];
  seconds: [number, number];
};
type FormatProfiles = Record<"singles" | "doubles", Profile>;
type ScopeProfiles = Record<"team" | "pokemon" | "recommendation" | "optimization", FormatProfiles>;
export const copilotEstimateProfiles: Record<"low" | "medium", ScopeProfiles> = {
  low: {
    team: {
      singles: { input: 15275, members: 6, output: [1943, 2673], seconds: [13.952, 18.023] },
      doubles: { input: 18417, members: 6, output: [1756, 2216], seconds: [14.291, 16.728] },
    },
    pokemon: {
      singles: { input: 16631, members: 6, output: [1071, 1536], seconds: [9.345, 12.145] },
      doubles: { input: 16938, members: 6, output: [1036, 1458], seconds: [9.799, 12.028] },
    },
    recommendation: {
      singles: { input: 33985, members: 5, output: [1572, 1741], seconds: [12.45, 14.306] },
      doubles: { input: 36798, members: 5, output: [1575, 1807], seconds: [12.086, 14.251] },
    },
    optimization: {
      singles: { input: 20165, members: 6, output: [790, 889], seconds: [7.72, 8.518] },
      doubles: { input: 19178, members: 6, output: [587, 892], seconds: [5.816, 9.053] },
    },
  },
  medium: {
    team: {
      singles: { input: 12590, members: 6, output: [3686, 5786], seconds: [30.1, 42.478] },
      doubles: { input: 15161, members: 6, output: [4686, 10093], seconds: [40.467, 89.145] },
    },
    pokemon: {
      singles: { input: 13946, members: 6, output: [2260, 2775], seconds: [18.35, 25.018] },
      doubles: { input: 13682, members: 6, output: [2584, 4091], seconds: [24.044, 37.181] },
    },
    recommendation: {
      singles: { input: 27741, members: 5, output: [3926, 5247], seconds: [34.105, 49.879] },
      doubles: { input: 27130, members: 5, output: [4083, 7364], seconds: [35.516, 66.897] },
    },
    optimization: {
      singles: { input: 17612, members: 6, output: [1752, 2312], seconds: [17.755, 22.008] },
      doubles: { input: 16430, members: 6, output: [988, 2421], seconds: [10.688, 23.033] },
    },
  },
};
