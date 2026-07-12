export function normalizeShowdownId(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function formatIdLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
