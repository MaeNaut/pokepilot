// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { PokemonIcon } from "./PokemonIcon";

const base = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon";
const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0)) await cleanup(); });

async function mount(pokemon: Parameters<typeof PokemonIcon>[0]["pokemon"]) {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<PokemonIcon pokemon={pokemon} />));
  cleanups.push(async () => { await act(async () => root.unmount()); container.remove(); });
  return container.querySelector("img")!;
}

it("repairs persisted PNG icons and tries another generation-nine sprite before pixel/artwork fallbacks", async () => {
  const image = await mount({ id: "garchomp", name: "Garchomp",
    iconSpriteUrl: `${base}/versions/generation-ix/champions/445.png`,
    iconFallbackSpriteUrls: [`${base}/445.png`], spriteUrl: `${base}/other/home/445.png` });
  expect(image.src).toBe(`${base}/versions/generation-ix/champions/icons/445.png`);
  await act(async () => image.dispatchEvent(new Event("error")));
  expect(image.src).toBe(`${base}/versions/generation-ix/scarlet-violet/icons/445.png`);
  await act(async () => image.dispatchEvent(new Event("error")));
  expect(image.src).toBe(`${base}/445.png`);
});

it("retains female-specific generation-nine paths instead of replacing them with male sprites", async () => {
  const image = await mount({ id: "pyroar-female", name: "Pyroar", showdownGender: "F",
    iconSpriteUrl: `${base}/versions/generation-ix/scarlet-violet/female/668.png` });
  expect(image.src).toBe(`${base}/versions/generation-ix/scarlet-violet/icons/668-female.png`);
});

it("uses the exact new Mega form menu icon", async () => {
  const image = await mount({ id: "lucario-mega-z", name: "Mega Lucario Z" });
  expect(image.src).toBe(`${base}/versions/generation-ix/champions/icons/10310.png`);
});
