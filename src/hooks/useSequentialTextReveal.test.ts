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
    expect(timeline.totalDuration).toBeLessThanOrEqual(6_680);
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
