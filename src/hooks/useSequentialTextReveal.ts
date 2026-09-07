import { useEffect, useMemo, useState } from "react";
import { useMediaQuery } from "./useMediaQuery";

const INITIAL_DELAY_MS = 180;
const BLOCK_PAUSE_MS = 220;
const MIN_TYPING_DURATION_MS = 2_600;
const MAX_TYPING_DURATION_MS = 6_500;
const TYPING_MS_PER_CHARACTER = 13;
const RENDER_INTERVAL_MS = 32;

type RevealBlock = {
  characters: string[];
  startTime: number;
  endTime: number;
};

export type SequentialTextRevealTimeline = {
  blocks: RevealBlock[];
  totalDuration: number;
};

export type SequentialTextRevealFrame = {
  visibleTexts: string[];
  activeIndex: number | null;
  isComplete: boolean;
};

export function createSequentialTextRevealTimeline(
  texts: string[],
): SequentialTextRevealTimeline {
  const characterBlocks = texts.map((text) => Array.from(text));
  const characterCount = characterBlocks.reduce(
    (total, characters) => total + characters.length,
    0,
  );
  const typingDuration = Math.min(
    MAX_TYPING_DURATION_MS,
    Math.max(
      MIN_TYPING_DURATION_MS,
      characterCount * TYPING_MS_PER_CHARACTER,
    ),
  );
  const millisecondsPerCharacter =
    characterCount > 0 ? typingDuration / characterCount : 0;
  let cursor = INITIAL_DELAY_MS;

  const blocks = characterBlocks.map((characters, index) => {
    const startTime = cursor;
    const endTime = startTime + characters.length * millisecondsPerCharacter;
    cursor = endTime + (index < characterBlocks.length - 1 ? BLOCK_PAUSE_MS : 0);
    return { characters, startTime, endTime };
  });

  return {
    blocks,
    totalDuration: blocks[blocks.length - 1]?.endTime ?? 0,
  };
}

export function getSequentialTextRevealFrame(
  timeline: SequentialTextRevealTimeline,
  elapsedTime: number,
): SequentialTextRevealFrame {
  const isComplete = elapsedTime >= timeline.totalDuration;
  let activeIndex: number | null = isComplete ? null : 0;

  const visibleTexts = timeline.blocks.map((block, index) => {
    if (elapsedTime < block.startTime) {
      return "";
    }

    if (elapsedTime >= block.endTime || block.startTime === block.endTime) {
      if (!isComplete) {
        activeIndex = index;
      }
      return block.characters.join("");
    }

    activeIndex = index;
    const progress =
      (elapsedTime - block.startTime) / (block.endTime - block.startTime);
    const visibleCharacterCount = Math.max(
      1,
      Math.floor(block.characters.length * progress),
    );
    return block.characters.slice(0, visibleCharacterCount).join("");
  });

  return { visibleTexts, activeIndex, isComplete };
}

export function useSequentialTextReveal(texts: string[], enabled: boolean) {
  const prefersReducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
  );
  const shouldAnimate = enabled && !prefersReducedMotion;
  const timeline = useMemo(
    () => createSequentialTextRevealTimeline(texts),
    [texts],
  );
  const [elapsedTime, setElapsedTime] = useState(() =>
    shouldAnimate ? 0 : timeline.totalDuration,
  );

  useEffect(() => {
    if (!shouldAnimate) {
      setElapsedTime(timeline.totalDuration);
      return undefined;
    }

    let animationFrameId = 0;
    let lastRenderTime = 0;
    const startTime = performance.now();

    const update = (currentTime: number) => {
      const nextElapsedTime = Math.min(
        currentTime - startTime,
        timeline.totalDuration,
      );

      if (
        nextElapsedTime >= timeline.totalDuration ||
        currentTime - lastRenderTime >= RENDER_INTERVAL_MS
      ) {
        lastRenderTime = currentTime;
        setElapsedTime(nextElapsedTime);
      }

      if (nextElapsedTime < timeline.totalDuration) {
        animationFrameId = window.requestAnimationFrame(update);
      }
    };

    setElapsedTime(0);
    animationFrameId = window.requestAnimationFrame(update);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [shouldAnimate, timeline]);

  const frame = useMemo(
    () =>
      shouldAnimate
        ? getSequentialTextRevealFrame(timeline, elapsedTime)
        : {
            visibleTexts: texts,
            activeIndex: null,
            isComplete: true,
          },
    [elapsedTime, shouldAnimate, texts, timeline],
  );

  return {
    ...frame,
    isAnimated: shouldAnimate,
  };
}
