export function normalizeSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function matchesSearchText(query: string, ...values: string[]) {
  const normalizedQuery = normalizeSearchText(query);

  return (
    normalizedQuery.length === 0 ||
    values.some((value) => normalizeSearchText(value).includes(normalizedQuery))
  );
}
