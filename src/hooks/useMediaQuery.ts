import { useEffect, useRef, useState } from "react";

interface MediaQueryOptions {
  falseDelayMs?: number;
}

function getMediaQueryMatch(query: string) {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(query).matches
  );
}

export function useMediaQuery(
  query: string,
  { falseDelayMs = 0 }: MediaQueryOptions = {},
) {
  const [matches, setMatches] = useState(() => getMediaQueryMatch(query));
  const falseTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return undefined;
    }

    const mediaQuery = window.matchMedia(query);

    function clearPendingFalseMatch() {
      if (falseTimeoutRef.current !== null) {
        window.clearTimeout(falseTimeoutRef.current);
        falseTimeoutRef.current = null;
      }
    }

    function updateMatch(nextMatch: boolean) {
      if (
        !nextMatch &&
        falseDelayMs > 0 &&
        falseTimeoutRef.current !== null
      ) {
        return;
      }

      if (nextMatch || falseDelayMs <= 0) {
        clearPendingFalseMatch();
        setMatches(nextMatch);
        return;
      }

      falseTimeoutRef.current = window.setTimeout(() => {
        setMatches(mediaQuery.matches);
        falseTimeoutRef.current = null;
      }, falseDelayMs);
    }

    function handleChange(event: MediaQueryListEvent) {
      updateMatch(event.matches);
    }

    function handleViewportChange() {
      updateMatch(mediaQuery.matches);
    }

    updateMatch(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    window.addEventListener("resize", handleViewportChange);
    window.visualViewport?.addEventListener("resize", handleViewportChange);

    return () => {
      clearPendingFalseMatch();
      mediaQuery.removeEventListener("change", handleChange);
      window.removeEventListener("resize", handleViewportChange);
      window.visualViewport?.removeEventListener("resize", handleViewportChange);
    };
  }, [falseDelayMs, query]);

  return matches;
}
