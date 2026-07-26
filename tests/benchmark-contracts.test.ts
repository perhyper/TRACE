import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  benchmarkArtifactLayoutSchema,
  benchmarkCaseArtifactLayout,
  benchmarkArtifactFileNames
} from "../src/benchmark/artifacts.js";
import {
  benchmarkCaseInputForRunner,
  compileBenchmarkCases,
  createBenchmarkScorerInput
} from "../src/benchmark/compiler.js";
import {
  benchmarkAggregateScoreOutputSchema,
  benchmarkCaseInputSchema,
  benchmarkCaseScoreOutputSchema,
  benchmarkFailureRecordSchema,
  benchmarkRunnerNameSchema,
  benchmarkRunnerOutputSchema,
  type BenchmarkCaseInput,
  type BenchmarkCompiledCase,
  type BenchmarkRunnerName,
  type BenchmarkRunnerOutput
} from "../src/benchmark/contracts.js";

function requireFirstScoredCase(compiledCases: readonly BenchmarkCompiledCase[]): BenchmarkCompiledCase {
  const compiledCase = compiledCases.find((candidate) => candidate.scorerReference.kind === "scored");

  if (compiledCase === undefined) {
    throw new Error("Expected at least one scored compiled benchmark case");
  }

  return compiledCase;
}

function firstEvidenceId(caseInput: BenchmarkCaseInput): string {
  const firstEvidenceRecord = caseInput.evidenceLedger.evidence[0];

  if (firstEvidenceRecord === undefined) {
    throw new Error(`Expected ${caseInput.caseId} to include cutoff-visible evidence`);
  }

  return firstEvidenceRecord.id;
}

function makeRunnerOutput(
  runnerName: BenchmarkRunnerName,
  caseInput: BenchmarkCaseInput
): BenchmarkRunnerOutput {
  const evidenceId = firstEvidenceId(caseInput);

  return benchmarkRunnerOutputSchema.parse({
    schemaVersion: "trace.benchmark-runner-output.v1",
    runnerName,
    runId: "run-001",
    caseId: caseInput.caseId,
    partition: caseInput.partition,
    status: "completed",
    timing: {
      schemaVersion: "trace.benchmark-timing.v1",
      startedAt: "2026-07-26T00:00:00.000Z",
      completedAt: "2026-07-26T00:00:01.000Z",
      durationMs: 1000
    },
    rawOutput: {
      markdown: `# ${caseInput.companyLegalName}\n\nDeterministic benchmark fixture output.`
    },
    normalized: {
      claims: [
        {
          id: "claim-001",
          kind: "observable",
          statement: "The runner emitted one normalized observable claim.",
          value: true,
          citations: [
            {
              evidenceId
            }
          ]
        }
      ],
      route: {
        status: "omitted"
      },
      abstentions: [],
      valuations: []
    },
    failures: []
  });
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

describe("benchmark shared contracts", () => {
  it("compiles scored benchmark inputs in deterministic case-id order", async () => {
    const compiledCases = await compileBenchmarkCases();
    const caseIds = compiledCases.map((compiledCase) => compiledCase.caseId);

    expect(compiledCases).toHaveLength(12);
    expect(caseIds).not.toContain("demo-fintech-revolut-2025");
    expect(caseIds).toEqual([...caseIds].sort(compareStrings));
    expect(compiledCases.every((compiledCase) => compiledCase.scorerReference.kind === "scored")).toBe(
      true
    );
    expect(
      compiledCases.find((compiledCase) => compiledCase.caseId === "dev-fintech-chime-2025")
        ?.runnerInput.sourceRecordIds
    ).not.toContain("chime-2025-06-11-ipo-pricing-post-cutoff");
  });

  it("excludes demo cases unless demo mode is explicitly requested", async () => {
    const defaultCases = await compileBenchmarkCases();
    const withDemoCases = await compileBenchmarkCases({ includeDemo: true });
    const demoCase = withDemoCases.find(
      (compiledCase) => compiledCase.caseId === "demo-fintech-revolut-2025"
    );

    expect(defaultCases.map((compiledCase) => compiledCase.caseId)).not.toContain(
      "demo-fintech-revolut-2025"
    );
    expect(withDemoCases).toHaveLength(13);
    expect(demoCase).toBeDefined();
    expect(demoCase?.partition).toBe("demo");
    expect(demoCase?.runnerInput.countedInScoring).toBe(false);
    expect(demoCase?.scorerReference).toMatchObject({
      kind: "demo",
      annotation: null
    });
  });

  it("lets all benchmark runner names consume the same compiled input shape", async () => {
    const compiledCase = requireFirstScoredCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );
    const runnerInputs = benchmarkRunnerNameSchema.options.map((runnerName) =>
      benchmarkCaseInputForRunner(runnerName, compiledCase)
    );
    const runnerInputKeys = runnerInputs.map((input) => Object.keys(input).sort(compareStrings));

    expect(runnerInputs).toHaveLength(3);
    expect(runnerInputKeys).toEqual(runnerInputKeys.map(() => runnerInputKeys[0]));

    for (const input of runnerInputs) {
      expect(benchmarkCaseInputSchema.parse(input)).toEqual(runnerInputs[0]);
    }
  });

  it("validates runner output, scorer input, score output, and failure records", async () => {
    const compiledCase = requireFirstScoredCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );
    const runnerOutput = makeRunnerOutput("baseline-a", compiledCase.runnerInput);
    const scorerInput = createBenchmarkScorerInput({
      compiledCase,
      runnerOutput
    });
    const failureRecord = benchmarkFailureRecordSchema.parse({
      schemaVersion: "trace.benchmark-failure.v1",
      failureId: "score-warning-001",
      stage: "scoring",
      severity: "warning",
      message: "Synthetic warning used to validate the failure-record contract.",
      retryable: false,
      runId: runnerOutput.runId,
      runnerName: runnerOutput.runnerName,
      caseId: runnerOutput.caseId,
      partition: runnerOutput.partition,
      occurredAt: "2026-07-26T00:00:01.000Z"
    });

    expect(scorerInput.schemaVersion).toBe("trace.benchmark-scorer-input.v1");
    expect(scorerInput.caseId).toBe(compiledCase.caseId);

    expect(
      benchmarkCaseScoreOutputSchema.parse({
        schemaVersion: "trace.benchmark-case-score.v1",
        runId: runnerOutput.runId,
        runnerName: runnerOutput.runnerName,
        caseId: runnerOutput.caseId,
        partition: scorerInput.partition,
        status: "scored",
        metrics: [
          {
            metricId: "evidence-supported-claim-precision",
            status: "scored",
            value: 1,
            numerator: 1,
            denominator: 1,
            notes: []
          }
        ],
        failures: [failureRecord]
      }).schemaVersion
    ).toBe("trace.benchmark-case-score.v1");

    expect(
      benchmarkAggregateScoreOutputSchema.parse({
        schemaVersion: "trace.benchmark-aggregate-score.v1",
        runId: runnerOutput.runId,
        partition: "development",
        generatedAt: "2026-07-26T00:00:02.000Z",
        groups: [
          {
            groupId: "development-baseline-a",
            groupKind: "partition",
            runnerName: "baseline-a",
            partition: "development",
            caseCount: 1,
            scoredCaseCount: 1,
            failedCaseCount: 0,
            metrics: [
              {
                metricId: "evidence-supported-claim-precision",
                status: "scored",
                value: 1,
                numerator: 1,
                denominator: 1,
                notes: []
              }
            ]
          }
        ],
        failures: []
      }).schemaVersion
    ).toBe("trace.benchmark-aggregate-score.v1");
  });

  it("defines the stable per-case artifact layout", () => {
    const layout = benchmarkCaseArtifactLayout({
      partition: "development",
      runId: "run-001",
      runnerName: "baseline-a",
      caseId: "dev-fintech-chime-2025"
    });
    const expectedCaseDirectory = join(
      "eval",
      "benchmark",
      "runs",
      "development",
      "run-001",
      "baseline-a",
      "dev-fintech-chime-2025"
    );

    expect(benchmarkArtifactLayoutSchema.parse(layout)).toEqual(layout);
    expect(layout.caseDirectory).toBe(expectedCaseDirectory);
    expect(layout.rawRunnerOutputJson).toBe(
      join(expectedCaseDirectory, benchmarkArtifactFileNames.rawRunnerOutputJson)
    );
    expect(layout.normalizedScorerInput).toBe(
      join(expectedCaseDirectory, benchmarkArtifactFileNames.normalizedScorerInput)
    );
    expect(layout.failureRecord).toBe(
      join(expectedCaseDirectory, benchmarkArtifactFileNames.failureRecord)
    );
    expect(layout.timingMetadata).toBe(
      join(expectedCaseDirectory, benchmarkArtifactFileNames.timingMetadata)
    );
  });
});
