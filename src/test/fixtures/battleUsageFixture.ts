export function battleUsageFixture(date = "30_09_2026", season = "M6") {
  const rows = [
    { category: "move", rank: 1, name: "Earthquake", percentage_value: 80 },
    { category: "move", rank: 2, name: "Dragon Claw", percentage_value: 40 },
    { category: "held_item", rank: 1, name: "Focus Sash", percentage_value: 50 },
    { category: "ability", rank: 1, name: "Rough Skin", percentage_value: 95 },
    { category: "stat_alignment", rank: 1, name: "Jolly", percentage_value: 60 },
    { category: "stat_points", rank: 1, name: "", percentage_value: 25,
      hp_points: 2, attack_points: 32, defense_points: 0, sp_atk_points: 0, sp_def_points: 0, speed_points: 32 },
  ];
  const summary = {
    position: 1,
    top: Object.fromEntries(rows.filter((row) => row.rank === 1).map((row) => [row.category, row])),
    values: { move: ["Earthquake", "Dragon Claw"], held_item: ["Focus Sash"], ability: ["Rough Skin"] },
  };
  return {
    rows,
    index: {
      generatedAt: `${date.slice(6)}-${date.slice(3, 5)}-${date.slice(0, 2)}T03:00:00Z`,
      pokemon: [{
        showdownId: "garchomp", showdownName: "Garchomp",
        battleDataCsvs: ["Singles", "Doubles"].map((format) => ({ format, daily: true, date, season })),
        summary: { battleSummary: { Current: { Singles: summary, Doubles: { ...summary, position: 9 } } } },
      }],
    },
    detail: (format = "Singles") => ({ showdownId: "garchomp", format, daily: [{ date, season, rows }] }),
  };
}
