import { describe, expect, it } from "vitest";
import legality from "../../public/data/showdown-regulation-mc.json";
import battle from "../../public/data/showdown-battle-mc.json";

describe("M-C data contract", () => {
  it("includes the new Pokemon and Mega forms", () => {
    for (const id of ["rillaboom", "indeedeef", "baxcaliburmega", "golisopodmega", "salamencemega", "absolmegaz", "garchompmegaz", "lucariomegaz"]) {
      expect(legality.pokemonIds).toContain(id);
    }
    expect(battle.species.golisopodmega.abilities[0]).toBe("Tough Claws");
  });
  it("uses Champions move overrides in calculation input", () => {
    expect(battle.moves.slash.basePower).toBe(80);
    expect(battle.moves.meteorassault.basePower).toBe(170);
    expect(battle.moves.wish.pp).toBe(5);
    expect(battle.moves.strengthsap.pp).toBe(5);
    expect(battle.moves.doubleshock.flags.punch).toBe(1);
  });
});
