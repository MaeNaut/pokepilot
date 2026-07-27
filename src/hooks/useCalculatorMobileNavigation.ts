import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  calculatorMobilePageOrder,
  type CalculatorMobilePage,
} from "../calculator/calculatorUi";

export function useCalculatorMobileNavigation(isVisible: boolean) {
  const [mobilePage, setMobilePage] =
    useState<CalculatorMobilePage>("player");
  const layoutRef = useRef<HTMLDivElement | null>(null);
  const mobilePageRef = useRef<CalculatorMobilePage>("player");
  const scrollTargetRef = useRef<CalculatorMobilePage | null>(null);
  const scrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    mobilePageRef.current = mobilePage;
  }, [mobilePage]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let resizeFrame: number | null = null;

    const alignMobilePage = () => {
      if (!window.matchMedia("(max-width: 760px)").matches) {
        return;
      }

      const layout = layoutRef.current;
      if (!layout) {
        return;
      }

      const pageIndex = calculatorMobilePageOrder.indexOf(
        mobilePageRef.current,
      );
      layout.scrollLeft = pageIndex * layout.clientWidth;
    };

    const scheduleAlignment = () => {
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }

      resizeFrame = window.requestAnimationFrame(alignMobilePage);
    };

    scheduleAlignment();
    window.addEventListener("resize", scheduleAlignment);

    return () => {
      window.removeEventListener("resize", scheduleAlignment);
      if (resizeFrame !== null) {
        window.cancelAnimationFrame(resizeFrame);
      }
    };
  }, [isVisible]);

  useEffect(
    () => () => {
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
      }
    },
    [],
  );

  function showMobilePage(nextPage: CalculatorMobilePage) {
    const layout = layoutRef.current;
    mobilePageRef.current = nextPage;
    scrollTargetRef.current = nextPage;
    setMobilePage(nextPage);

    if (!layout) {
      return;
    }

    const pageIndex = calculatorMobilePageOrder.indexOf(nextPage);
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    layout.scrollTo({
      left: pageIndex * layout.clientWidth,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  }

  function handleLayoutScroll() {
    if (scrollFrameRef.current !== null) {
      return;
    }

    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;

      const layout = layoutRef.current;
      if (!layout || layout.clientWidth === 0) {
        return;
      }

      const nextIndex = Math.max(
        0,
        Math.min(
          calculatorMobilePageOrder.length - 1,
          Math.round(layout.scrollLeft / layout.clientWidth),
        ),
      );
      const nextPage = calculatorMobilePageOrder[nextIndex];
      const targetPage = scrollTargetRef.current;

      if (targetPage) {
        const targetIndex = calculatorMobilePageOrder.indexOf(targetPage);
        const reachedTarget =
          Math.abs(layout.scrollLeft - targetIndex * layout.clientWidth) <= 2;

        if (!reachedTarget) {
          return;
        }

        scrollTargetRef.current = null;
      }

      if (mobilePageRef.current !== nextPage) {
        mobilePageRef.current = nextPage;
        setMobilePage(nextPage);
      }
    });
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    currentPage: CalculatorMobilePage,
  ) {
    const currentIndex = calculatorMobilePageOrder.indexOf(currentPage);
    let nextIndex = currentIndex;

    if (event.key === "ArrowLeft") {
      nextIndex =
        (currentIndex - 1 + calculatorMobilePageOrder.length) %
        calculatorMobilePageOrder.length;
    } else if (event.key === "ArrowRight") {
      nextIndex = (currentIndex + 1) % calculatorMobilePageOrder.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = calculatorMobilePageOrder.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    const nextPage = calculatorMobilePageOrder[nextIndex];
    showMobilePage(nextPage);
    window.requestAnimationFrame(() => {
      document
        .getElementById(`calculator-mobile-tab-${nextPage}`)
        ?.focus();
    });
  }

  return {
    layoutRef,
    mobilePage,
    cancelScrollTarget: () => {
      scrollTargetRef.current = null;
    },
    handleLayoutScroll,
    handleTabKeyDown,
    showMobilePage,
  };
}
