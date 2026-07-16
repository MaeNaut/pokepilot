import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction, UIEvent } from "react";

export const OPTION_PAGE_SIZE = 20;
const optionScrollThreshold = 32;

export function getExpandedOptionLimit(
  current: number,
  total: number,
  pageSize = OPTION_PAGE_SIZE,
) {
  return Math.min(total, current + pageSize);
}

export function getOptionLimitForIndex(
  index: number,
  pageSize = OPTION_PAGE_SIZE,
) {
  return index < 0
    ? pageSize
    : Math.max(pageSize, Math.ceil((index + 1) / pageSize) * pageSize);
}

export function isNearOptionListEnd(
  metrics: Pick<HTMLDivElement, "scrollHeight" | "scrollTop" | "clientHeight">,
) {
  return (
    metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <=
    optionScrollThreshold
  );
}

export type IncrementalOptionsController = {
  limit: number;
  setLimit: Dispatch<SetStateAction<number>>;
  reset: () => void;
  ensureIndexVisible: (index: number) => void;
  handleScroll: (event: UIEvent<HTMLDivElement>) => void;
};

export function useIncrementalOptions(
  totalCount: number,
  pageSize = OPTION_PAGE_SIZE,
): IncrementalOptionsController {
  const [limit, setLimit] = useState(pageSize);

  const reset = useCallback(() => setLimit(pageSize), [pageSize]);
  const ensureIndexVisible = useCallback(
    (index: number) => {
      setLimit((current) =>
        index >= current
          ? Math.max(current, getOptionLimitForIndex(index, pageSize))
          : current,
      );
    },
    [pageSize],
  );
  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      if (limit >= totalCount || !isNearOptionListEnd(event.currentTarget)) {
        return;
      }

      setLimit((current) =>
        getExpandedOptionLimit(current, totalCount, pageSize),
      );
    },
    [limit, pageSize, totalCount],
  );

  return {
    limit,
    setLimit,
    reset,
    ensureIndexVisible,
    handleScroll,
  };
}
