import type { BattleFormat } from "../../battleFormat/battleFormat";
import type {
  AiEvaluationRunResult,
  AiEvaluationUsage,
  AiTeamEvaluationCase,
} from "./aiModelEvaluation";

export type AiEvaluationReportCase = {
  fixtureId: string;
  title: string;
  battleFormat: BattleFormat;
  evaluatorContext: AiTeamEvaluationCase["evaluatorContext"];
  result: AiEvaluationRunResult;
  manualReview: {
    status: "pending";
    rubricScore: null;
    rubricMaximum: 12;
  };
};

export type AiEvaluationReport = {
  schemaVersion: 1;
  run: {
    startedAt: string;
    completedAt: string;
    modelId: string;
    caseCount: number;
  };
  summary: {
    completeCount: number;
    invalidOutputCount: number;
    requestErrorCount: number;
    singlesCount: number;
    doublesCount: number;
    averageLatencyMs: number;
    usage: AiEvaluationUsage;
  };
  cases: AiEvaluationReportCase[];
};

type CreateAiEvaluationReportOptions = {
  startedAt: string;
  completedAt: string;
  evaluationCases: AiTeamEvaluationCase[];
  results: AiEvaluationRunResult[];
};

function totalUsage(results: AiEvaluationRunResult[]): AiEvaluationUsage {
  return results.reduce<AiEvaluationUsage>(
    (total, result) => ({
      inputTokens: total.inputTokens + result.usage.inputTokens,
      cachedInputTokens:
        total.cachedInputTokens + result.usage.cachedInputTokens,
      cacheWriteTokens:
        total.cacheWriteTokens + result.usage.cacheWriteTokens,
      outputTokens: total.outputTokens + result.usage.outputTokens,
      reasoningTokens: total.reasoningTokens + result.usage.reasoningTokens,
      totalTokens: total.totalTokens + result.usage.totalTokens,
      costUsd: total.costUsd + result.usage.costUsd,
    }),
    {
      inputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      outputTokens: 0,
      reasoningTokens: 0,
      totalTokens: 0,
      costUsd: 0,
    },
  );
}

export function createAiEvaluationReport({
  startedAt,
  completedAt,
  evaluationCases,
  results,
}: CreateAiEvaluationReportOptions): AiEvaluationReport {
  const caseById = new Map(
    evaluationCases.map((evaluationCase) => [
      evaluationCase.fixtureId,
      evaluationCase,
    ]),
  );
  const cases = results.map((result) => {
    const evaluationCase = caseById.get(result.fixtureId);

    if (!evaluationCase) {
      throw new Error(`Missing evaluation case for ${result.fixtureId}.`);
    }

    return {
      fixtureId: evaluationCase.fixtureId,
      title: evaluationCase.title,
      battleFormat: evaluationCase.request.battleFormat,
      evaluatorContext: evaluationCase.evaluatorContext,
      result,
      manualReview: {
        status: "pending" as const,
        rubricScore: null,
        rubricMaximum: 12 as const,
      },
    };
  });
  const latencyTotal = results.reduce(
    (total, result) => total + result.latencyMs,
    0,
  );

  return {
    schemaVersion: 1,
    run: {
      startedAt,
      completedAt,
      modelId: results[0]?.modelId ?? "unknown",
      caseCount: cases.length,
    },
    summary: {
      completeCount: results.filter((result) => result.status === "complete")
        .length,
      invalidOutputCount: results.filter(
        (result) => result.status === "invalid-output",
      ).length,
      requestErrorCount: results.filter(
        (result) => result.status === "request-error",
      ).length,
      singlesCount: cases.filter(
        (evaluationCase) => evaluationCase.battleFormat === "singles",
      ).length,
      doublesCount: cases.filter(
        (evaluationCase) => evaluationCase.battleFormat === "doubles",
      ).length,
      averageLatencyMs: results.length ? latencyTotal / results.length : 0,
      usage: totalUsage(results),
    },
    cases,
  };
}

function formatUsd(value: number) {
  return `$${value.toFixed(6)}`;
}

function markdownList(values: string[]) {
  return values.length
    ? values.map((value) => `- ${value}`).join("\n")
    : "- None";
}

function formatModelOutput(evaluationCase: AiEvaluationReportCase) {
  const output = evaluationCase.result.output;

  if (!output) {
    return evaluationCase.result.error
      ? `Request error: ${evaluationCase.result.error}`
      : markdownList(evaluationCase.result.validationErrors);
  }

  return [
    `**Summary:** ${output.summary}`,
    `**Playstyle:** ${output.playstyle}`,
    "",
    "**Strengths**",
    markdownList(output.strengths),
    "",
    "**Weaknesses**",
    markdownList(output.weaknesses),
    "",
    "**Recommendations**",
    output.recommendations.length
      ? output.recommendations
          .map(
            (recommendation) =>
              `- **${recommendation.title}** (${recommendation.priority}): ${recommendation.reason}`,
          )
          .join("\n")
      : "- None",
  ].join("\n");
}

export function formatAiEvaluationReportMarkdown(report: AiEvaluationReport) {
  const { summary } = report;
  const lines = [
    "# PokePilot AI Evaluation Report",
    "",
    `- Model: \`${report.run.modelId}\``,
    `- Started: ${report.run.startedAt}`,
    `- Completed: ${report.run.completedAt}`,
    `- Cases: ${report.run.caseCount} (${summary.singlesCount} Singles, ${summary.doublesCount} Doubles)`,
    `- Complete: ${summary.completeCount}`,
    `- Invalid output: ${summary.invalidOutputCount}`,
    `- Request errors: ${summary.requestErrorCount}`,
    `- Average latency: ${Math.round(summary.averageLatencyMs)} ms`,
    `- Estimated Standard API cost: ${formatUsd(summary.usage.costUsd)}`,
    "",
    "## Usage",
    "",
    "| Input | Cached input | Cache writes | Output | Reasoning | Total |",
    "| ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${summary.usage.inputTokens} | ${summary.usage.cachedInputTokens} | ${summary.usage.cacheWriteTokens} | ${summary.usage.outputTokens} | ${summary.usage.reasoningTokens} | ${summary.usage.totalTokens} |`,
  ];

  for (const evaluationCase of report.cases) {
    const { result, evaluatorContext } = evaluationCase;

    lines.push(
      "",
      `## ${evaluationCase.title}`,
      "",
      `- Fixture: \`${evaluationCase.fixtureId}\``,
      `- Format: ${evaluationCase.battleFormat}`,
      `- Status: ${result.status}`,
      `- Service tier: ${result.responseMetadata.serviceTier ?? "unknown"}`,
      `- Reasoning effort: ${result.responseMetadata.reasoningEffort ?? "unknown"}`,
      `- Latency: ${Math.round(result.latencyMs)} ms`,
      `- Estimated cost: ${formatUsd(result.usage.costUsd)}`,
      `- Manual rubric: pending / ${evaluationCase.manualReview.rubricMaximum}`,
      "",
      "### Model Output",
      "",
      formatModelOutput(evaluationCase),
      "",
      "### Evaluator Expectations",
      "",
      "**Team identities**",
      markdownList(evaluatorContext.expectations.teamIdentities),
      "",
      "**Critical observations**",
      markdownList(evaluatorContext.expectations.criticalObservations),
      "",
      "**Forbidden conclusions**",
      markdownList(evaluatorContext.expectations.forbiddenConclusions),
    );
  }

  return `${lines.join("\n")}\n`;
}
