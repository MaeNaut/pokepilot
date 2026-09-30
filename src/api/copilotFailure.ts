const hostedAnalysisFailureReasons = [
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
