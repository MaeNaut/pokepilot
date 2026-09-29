export function swapArrayItems<T>(
  items: T[],
  sourceIndex: number,
  targetIndex: number,
) {
  const nextItems = [...items];
  if (!Number.isInteger(sourceIndex) || !Number.isInteger(targetIndex) ||
      sourceIndex < 0 || targetIndex < 0 ||
      sourceIndex >= items.length || targetIndex >= items.length) return nextItems;

  [nextItems[sourceIndex], nextItems[targetIndex]] = [
    nextItems[targetIndex],
    nextItems[sourceIndex],
  ];

  return nextItems;
}

export function getIndexAfterSwap(
  index: number,
  sourceIndex: number,
  targetIndex: number,
) {
  if (index === sourceIndex) {
    return targetIndex;
  }

  if (index === targetIndex) {
    return sourceIndex;
  }

  return index;
}
