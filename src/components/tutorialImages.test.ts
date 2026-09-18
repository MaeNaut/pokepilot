import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const directory = new URL("../../public/tutorial/", import.meta.url);
const expected = ["builder", "calculator", "copilot", "help"].map((step) => `${step}.jpg`);

describe("tutorial screenshots", () => {
  it("includes only the four shared English light desktop screenshots", () => {
    expect(readdirSync(directory).filter((name) => name.endsWith(".jpg")).sort()).toEqual([...expected].sort());
  });

  it.each(expected)("contains a nonempty JPEG for %s", (name) => {
    const image = readFileSync(new URL(name, directory));
    expect([...image.subarray(0, 3)]).toEqual([255, 216, 255]);
    expect([...image.subarray(-2)]).toEqual([255, 217]);
    expect(image.byteLength).toBeGreaterThan(1000);
  });
});
