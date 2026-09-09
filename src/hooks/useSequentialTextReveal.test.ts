import { describe, expect, it } from "vitest";
import {
  createSequentialTextRevealTimeline,
  getSequentialTextRevealFrame,
} from "./useSequentialTextReveal";

describe("sequential text reveal", () => {
  it("reveals text blocks in order and pauses between them", () => {
    const timeline = createSequentialTextRevealTimeline(["Title", "Paragraph"]);
    const title = timeline.blocks[0];
    const paragraph = timeline.blocks[1];

    expect(getSequentialTextRevealFrame(timeline, 0)).toMatchObject({
      visibleTexts: ["", ""],
      activeIndex: 0,
      isComplete: false,
    });
    expect(
      getSequentialTextRevealFrame(timeline, title.endTime + 1),
    ).toMatchObject({
      visibleTexts: ["Title", ""],
      activeIndex: 0,
      isComplete: false,
    });
    expect(
      getSequentialTextRevealFrame(timeline, paragraph.startTime + 1),
    ).toMatchObject({
      visibleTexts: ["Title", "P"],
      activeIndex: 1,
      isComplete: false,
    });
    expect(
      getSequentialTextRevealFrame(timeline, timeline.totalDuration),
    ).toEqual({
      visibleTexts: ["Title", "Paragraph"],
      activeIndex: null,
      isComplete: true,
    });
  });

  it("keeps long responses within the maximum typing window", () => {
    const timeline = createSequentialTextRevealTimeline(["A".repeat(2_000)]);
    expect(timeline.totalDuration).toBeLessThanOrEqual(4_300);
  });

  it("keeps ordinary response lengths at a consistent, faster character pace", () => {
    const short = createSequentialTextRevealTimeline(["A".repeat(50)]);
    const medium = createSequentialTextRevealTimeline(["A".repeat(200)]);
    const shortTypingDuration =
      short.blocks[0].endTime - short.blocks[0].startTime;
    const mediumTypingDuration =
      medium.blocks[0].endTime - medium.blocks[0].startTime;

    expect(shortTypingDuration / 50).toBe(7);
    expect(mediumTypingDuration / 200).toBe(7);
    expect(short.totalDuration).toBeLessThan(500);
    expect(medium.totalDuration).toBeLessThan(1_600);
  });

  it("finishes a short multi-block fallback without the old minimum delay", () => {
    const timeline = createSequentialTextRevealTimeline([
      "Fallback",
      "A short rules-based response.",
    ]);

    expect(timeline.totalDuration).toBeLessThan(600);
  });

  it("counts Unicode code points without splitting surrogate pairs", () => {
    const timeline = createSequentialTextRevealTimeline(["A😀B"]);
    const block = timeline.blocks[0];
    const middle = getSequentialTextRevealFrame(
      timeline,
      block.startTime + (block.endTime - block.startTime) * 0.7,
    );
    expect(middle.visibleTexts[0]).toBe("A😀");
  });
});
