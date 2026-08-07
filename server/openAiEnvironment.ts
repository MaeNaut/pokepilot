import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function isUsableOpenAiApiKey(value: string | undefined): value is string {
  if (!value) {
    return false;
  }

  const normalizedValue = value.trim().toLowerCase();
  return (
    normalizedValue.length >= 20 &&
    !normalizedValue.includes("your-key") &&
    !normalizedValue.includes("replace-me")
  );
}

export function parseOpenAiApiKeyFromEnvSource(source: string) {
  for (const line of source.split(/\r?\n/)) {
    const trimmedLine = line.trim();

    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmedLine.indexOf("=");
    if (
      separatorIndex < 0 ||
      trimmedLine.slice(0, separatorIndex).trim() !== "OPENAI_API_KEY"
    ) {
      continue;
    }

    const value = trimmedLine.slice(separatorIndex + 1).trim();
    const hasMatchingQuotes =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")));

    return hasMatchingQuotes ? value.slice(1, -1) : value;
  }

  return undefined;
}

export function selectUsableOpenAiApiKey(
  candidates: Array<string | undefined>,
) {
  for (const candidate of candidates) {
    const trimmedCandidate = candidate?.trim();
    if (isUsableOpenAiApiKey(trimmedCandidate)) {
      return trimmedCandidate;
    }
  }

  return undefined;
}

function readEnvironmentFile(path: string) {
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? error.code
        : undefined;

    if (errorCode === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export function resolveOpenAiApiKey(
  projectRoot: string,
  mode?: string,
  processValue = process.env.OPENAI_API_KEY,
) {
  const environmentFileNames = [
    ...(mode ? [`.env.${mode}.local`] : []),
    ".env.local",
    ...(mode ? [`.env.${mode}`] : []),
    ".env",
  ];
  const fileCandidates = environmentFileNames.map((fileName) => {
    const source = readEnvironmentFile(resolve(projectRoot, fileName));
    return source ? parseOpenAiApiKeyFromEnvSource(source) : undefined;
  });

  return selectUsableOpenAiApiKey([processValue, ...fileCandidates]);
}
