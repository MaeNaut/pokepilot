const hostedAnalysisFailureReasons = [
  "cooldown",
  "connection",
  "not-configured",
  "invalid-response",
  "rate-limited",
  "service-unavailable",
  "unavailable",
] as const;

export type HostedAnalysisFailureReason =
  (typeof hostedAnalysisFailureReasons)[number];

const hostedAnalysisFailureReasonSet = new Set<string>(
  hostedAnalysisFailureReasons,
);

export function isHostedAnalysisFailureReason(
  value: unknown,
): value is HostedAnalysisFailureReason {
  return (
    typeof value === "string" && hostedAnalysisFailureReasonSet.has(value)
  );
}

function readErrorMetadata(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return { code: undefined, status: undefined };
  }

  return {
    code: typeof Reflect.get(error, "code") === "string"
      ? (Reflect.get(error, "code") as string)
      : undefined,
    status: typeof Reflect.get(error, "status") === "number"
      ? (Reflect.get(error, "status") as number)
      : undefined,
  };
}

export function classifyHostedAnalysisFailure(
  error: unknown,
): HostedAnalysisFailureReason {
  const { code, status } = readErrorMetadata(error);

  switch (code) {
    case "ANALYSIS_COOLDOWN":
      return "cooldown";
    case "NETWORK_ERROR":
      return "connection";
    case "AI_NOT_CONFIGURED":
      return "not-configured";
    case "AI_INVALID_RESPONSE":
    case "INVALID_RESPONSE":
      return "invalid-response";
    case "AI_RATE_LIMITED":
      return "rate-limited";
    case "AI_UPSTREAM_ERROR":
      return "service-unavailable";
    default:
      if (status === 0) {
        return "connection";
      }
      if (typeof status === "number" && status >= 500) {
        return "service-unavailable";
      }
      return "unavailable";
  }
}
