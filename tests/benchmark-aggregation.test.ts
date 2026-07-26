import { describe, expect, it } from "vitest";

import {
  aggregateBenchmarkScores,
  renderBenchmarkAggregateCsv,
  renderBenchmarkAggregateMarkdown
} from "../src/benchmark/aggregation.js";
import type { BenchmarkAggregateCaseResult } from "../src/benchmark/aggregation.js";
import { compileBenchmarkCases } from "../src/benchmark/compiler.js";
import {
  benchmarkCaseScoreOutputSchema,
  benchmarkFailureRecordSchema,
  benchmarkRunnerOutputSchema
} from "../src/benchmark/contracts.js";
import type {
  BenchmarkAggregateScoreOutput,
  BenchmarkCaseScoreOutput,
  BenchmarkCompiledCase,
  BenchmarkFailureRecord,
  BenchmarkMetricScore,
  BenchmarkRunnerName,
  BenchmarkRunnerOutput
} from "../src/benchmark/contracts.js";

async function developmentCase(caseId: string): Promise<BenchmarkCompiledCase> {
  const compiledCases = await compileBenchmarkCases({ partitions: ["development"] });
  const compiledCase = compiledCases.find((candidate) => candidate.caseId === caseId);

  if (compiledCase === undefined) {
    throw new Error(`Missing compiled case ${caseId}`);
  }

  return compiledCase;
}

function runnerOutput(options: {
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerName: BenchmarkRunnerName;
  readonly runId: string;
  readonly status?: "completed" | "failed";
  readonly normalizedStatement?: string;
  readonly failures?: readonly BenchmarkFailureRecord[];
}): BenchmarkRunnerOutput {
  const status = options.status ?? "completed";

  return benchmarkRunnerOutputSchema.parse({
    schemaVersion: "trace.benchmark-runner-output.v1",
    runnerName: options.runnerName,
    runId: options.runId,
    caseId: options.compiledCase.caseId,
    partition: options.compiledCase.partition,
    status,
    timing: {
      schemaVersion: "trace.benchmark-timing.v1",
      startedAt: "2026-07-26T00:00:00.000Z",
      completedAt: "2026-07-26T00:00:01.000Z",
      durationMs: 1000
    },
    rawOutput: {
      markdown: "# Aggregate fixture\n"
    },
    normalized: {
      claims: [
        {
          id: "aggregate-claim",
          kind: "other",
          statement: options.normalizedStatement ?? "stable normalized statement",
          citations: []
        }
      ],
      route: {
        status: "omitted"
      },
      abstentions: [],
      valuations: []
    },
    failures: options.failures ?? []
  });
}

function caseScore(options: {
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerName: BenchmarkRunnerName;
  readonly runId: string;
  readonly metrics: readonly BenchmarkMetricScore[];
  readonly status?: "scored" | "failed";
  readonly failures?: readonly BenchmarkFailureRecord[];
}): BenchmarkCaseScoreOutput {
  return benchmarkCaseScoreOutputSchema.parse({
    schemaVersion: "trace.benchmark-case-score.v1",
    runId: options.runId,
    runnerName: options.runnerName,
    caseId: options.compiledCase.caseId,
    partition: options.compiledCase.partition,
    status: options.status ?? "scored",
    metrics: options.metrics,
    failures: options.failures ?? []
  });
}

function failure(options: {
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerName: BenchmarkRunnerName;
  readonly runId: string;
}): BenchmarkFailureRecord {
  return benchmarkFailureRecordSchema.parse({
    schemaVersion: "trace.benchmark-failure.v1",
    failureId: `${options.runnerName}-${options.compiledCase.caseId}-failure`,
    stage: "runner",
    severity: "fatal",
    message: "Synthetic aggregate failure.",
    retryable: false,
    runId: options.runId,
    runnerName: options.runnerName,
    caseId: options.compiledCase.caseId,
    partition: options.compiledCase.partition
  });
}

function aggregateCaseResult(options: {
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerName: BenchmarkRunnerName;
  readonly runId: string;
  readonly metrics: readonly BenchmarkMetricScore[];
  readonly status?: "scored" | "failed";
  readonly normalizedStatement?: string;
  readonly failures?: readonly BenchmarkFailureRecord[];
}): BenchmarkAggregateCaseResult {
  const outputStatus = options.status === "failed" ? "failed" : "completed";
  const runnerFailures = options.failures ?? [];

  return {
    compiledCase: options.compiledCase,
    runnerOutput: runnerOutput({
      compiledCase: options.compiledCase,
      runnerName: options.runnerName,
      runId: options.runId,
      status: outputStatus,
      ...(options.normalizedStatement !== undefined
        ? { normalizedStatement: options.normalizedStatement }
        : {}),
      failures: runnerFailures
    }),
    caseScore: caseScore({
      compiledCase: options.compiledCase,
      runnerName: options.runnerName,
      runId: options.runId,
      metrics: options.metrics,
      ...(options.status !== undefined ? { status: options.status } : {}),
      failures: runnerFailures
    })
  };
}

function scoredMetric(
  metricId: string,
  numerator: number,
  denominator: number
): BenchmarkMetricScore {
  return {
    metricId,
    status: "scored",
    value: denominator === 0 ? 0 : Math.round((numerator / denominator) * 1_000_000) / 1_000_000,
    numerator,
    denominator,
    notes: []
  };
}

function group(
  aggregate: BenchmarkAggregateScoreOutput,
  groupId: string
): BenchmarkAggregateScoreOutput["groups"][number] {
  const foundGroup = aggregate.groups.find((candidate) => candidate.groupId === groupId);

  if (foundGroup === undefined) {
    throw new Error(`Missing aggregate group ${groupId}`);
  }

  return foundGroup;
}

function metric(
  aggregateGroup: BenchmarkAggregateScoreOutput["groups"][number],
  metricId: string
): BenchmarkMetricScore {
  const foundMetric = aggregateGroup.metrics.find((candidate) => candidate.metricId === metricId);

  if (foundMetric === undefined) {
    throw new Error(`Missing aggregate metric ${metricId}`);
  }

  return foundMetric;
}

describe("benchmark aggregate scoring", () => {
  it("aggregates metric numerators and denominators deterministically", async () => {
    const chime = await developmentCase("dev-fintech-chime-2025");
    const figma = await developmentCase("dev-saas-figma-2022");
    const aggregate = aggregateBenchmarkScores({
      runId: "aggregate-math-run",
      partition: "development",
      caseResults: [
        aggregateCaseResult({
          compiledCase: figma,
          runnerName: "baseline-a",
          runId: "aggregate-math-run",
          metrics: [scoredMetric("route-accuracy", 2, 3)]
        }),
        aggregateCaseResult({
          compiledCase: chime,
          runnerName: "baseline-a",
          runId: "aggregate-math-run",
          metrics: [scoredMetric("route-accuracy", 3, 3)]
        })
      ]
    });
    const runnerGroup = group(aggregate, "runner:baseline-a");

    expect(metric(runnerGroup, "route-accuracy")).toMatchObject({
      status: "scored",
      value: 0.833333,
      numerator: 5,
      denominator: 6
    });
    expect(renderBenchmarkAggregateCsv(aggregate)).toContain(
      "runner:baseline-a,runner,baseline-a"
    );
    expect(renderBenchmarkAggregateMarkdown(aggregate)).toContain("| runner:baseline-a |");
  });

  it("scores reproducibility across repeated runner/case outputs", async () => {
    const chime = await developmentCase("dev-fintech-chime-2025");
    const aggregate = aggregateBenchmarkScores({
      runId: "repeat-run",
      partition: "development",
      caseResults: [
        aggregateCaseResult({
          compiledCase: chime,
          runnerName: "baseline-a",
          runId: "repeat-a",
          metrics: []
        }),
        aggregateCaseResult({
          compiledCase: chime,
          runnerName: "baseline-a",
          runId: "repeat-b",
          metrics: []
        })
      ]
    });

    expect(metric(group(aggregate, "runner:baseline-a"), "reproducibility")).toMatchObject({
      status: "scored",
      value: 1,
      numerator: 1,
      denominator: 1
    });
  });

  it("accounts for failed cases and failure records", async () => {
    const chime = await developmentCase("dev-fintech-chime-2025");
    const monzo = await developmentCase("dev-fintech-monzo-2025");
    const failedRecord = failure({
      compiledCase: monzo,
      runnerName: "trace-full",
      runId: "failed-accounting-run"
    });
    const aggregate = aggregateBenchmarkScores({
      runId: "failed-accounting-run",
      partition: "development",
      caseResults: [
        aggregateCaseResult({
          compiledCase: chime,
          runnerName: "trace-full",
          runId: "failed-accounting-run",
          metrics: [scoredMetric("failure-records", 1, 1)]
        }),
        aggregateCaseResult({
          compiledCase: monzo,
          runnerName: "trace-full",
          runId: "failed-accounting-run",
          metrics: [scoredMetric("failure-records", 0, 1)],
          status: "failed",
          failures: [failedRecord]
        })
      ]
    });
    const runnerGroup = group(aggregate, "runner:trace-full");

    expect(runnerGroup).toMatchObject({
      caseCount: 2,
      scoredCaseCount: 1,
      failedCaseCount: 1
    });
    expect(metric(runnerGroup, "failure-records")).toMatchObject({
      value: 0.5,
      numerator: 1,
      denominator: 2
    });
    expect(aggregate.failures).toHaveLength(1);
  });

  it("keeps aggregate group ordering stable regardless of input order", async () => {
    const chime = await developmentCase("dev-fintech-chime-2025");
    const figma = await developmentCase("dev-saas-figma-2022");
    const records = [
      aggregateCaseResult({
        compiledCase: figma,
        runnerName: "baseline-b",
        runId: "stable-order-run",
        metrics: [scoredMetric("completion-status", 1, 1)]
      }),
      aggregateCaseResult({
        compiledCase: chime,
        runnerName: "baseline-a",
        runId: "stable-order-run",
        metrics: [scoredMetric("completion-status", 1, 1)]
      })
    ];
    const first = aggregateBenchmarkScores({
      runId: "stable-order-run",
      partition: "development",
      caseResults: records
    });
    const second = aggregateBenchmarkScores({
      runId: "stable-order-run",
      partition: "development",
      caseResults: [...records].reverse()
    });

    expect(first).toEqual(second);
    expect(first.groups.map((aggregateGroup) => aggregateGroup.groupId)).toEqual([
      "overall",
      "runner:baseline-a",
      "runner:baseline-b",
      "partition:development",
      "partition:development:runner:baseline-a",
      "partition:development:runner:baseline-b",
      "data-tier:medium",
      "data-tier:medium:runner:baseline-a",
      "data-tier:medium:runner:baseline-b",
      "sector-route:financial-services",
      "sector-route:financial-services:runner:baseline-a",
      "sector-route:software-saas",
      "sector-route:software-saas:runner:baseline-b"
    ]);
  });
});
