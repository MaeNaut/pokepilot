export type OptionNavigationDirection = 1 | -1;

export function getNextCircularIndex(
  currentIndex: number,
  optionCount: number,
  direction: OptionNavigationDirection,
) {
  if (optionCount <= 0) {
    return -1;
  }

  if (currentIndex < 0) {
    return direction > 0 ? 0 : optionCount - 1;
  }

  return (currentIndex + direction + optionCount) % optionCount;
}
