function sortObjectKeys(_key: string, value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0));
}

export function jsonValueEqual(left: unknown, right: unknown) {
  return JSON.stringify(left, sortObjectKeys) === JSON.stringify(right, sortObjectKeys);
}
