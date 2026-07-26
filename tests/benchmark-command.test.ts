import { mkdtemp, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import { runBenchmark } from "../src/commands/benchmark.js";
import {
  benchmarkAggregateScoreOutputSchema,
  benchmarkCaseScoreOutputSchema,
  benchmarkPerClaimScoreOutputSchema,
  benchmarkScorerInputSchema,
  benchmarkTimingMetadataSchema
} from "../src/benchmark/contracts.js";
import { runSelectedBenchmarkRunner } from "../src/benchmark/runners.js";

async function temporaryArtifactRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "trace-benchmark-"));
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

const expectedCaseMetricIds = [
  "evidence-supported-claim-precision",
  "citation-validity",
  "source-quality",
  "route-accuracy",
  "abstention-behavior",
  "valuation-separation",
  "historical-valuation-error",
  "completeness",
  "reproducibility",
  "completion-status",
  "duration",
  "failure-records"
] as const;

describe("benchmark command runner", () => {
  it("runs a fixture subset through all benchmark runners and writes artifacts", async () => {
    const out = await temporaryArtifactRoot();
    const result = await runBenchmark({
      command: "benchmark",
      partition: "development",
      runner: "all",
      out,
      runId: "integration-run",
      caseIds: ["dev-fintech-chime-2025"]
    });

    expect(result.status).toBe("completed");
    expect(result.runIdSource).toBe("supplied");
    expect(result.runners).toEqual(["baseline-a", "baseline-b", "trace-full"]);
    expect(result.caseCount).toBe(1);
    expect(result.artifactCount).toBe(3);
    expect(result.aggregateArtifact.groupCount).toBeGreaterThan(0);
    expect(result.failures).toEqual([]);

    for (const artifact of result.artifacts) {
      const rawJson = await readJson(artifact.layout.rawRunnerOutputJson);
      const rawMarkdown = await readFile(artifact.layout.rawRunnerOutputMarkdown, "utf8");
      const scorerInput = benchmarkScorerInputSchema.parse(
        await readJson(artifact.layout.normalizedScorerInput)
      );
      const perClaimScore = benchmarkPerClaimScoreOutputSchema.parse(
        await readJson(artifact.layout.perClaimScore)
      );
      const caseScore = benchmarkCaseScoreOutputSchema.parse(
        await readJson(artifact.layout.caseScore)
      );
      const failureRecords = await readJson(artifact.layout.failureRecord);
      const timing = benchmarkTimingMetadataSchema.parse(
        await readJson(artifact.layout.timingMetadata)
      );

      expect(artifact.layout.rootDirectory).toBe(out);
      expect(artifact.layout.runId).toBe("integration-run");
      expect(artifact.layout.caseId).toBe("dev-fintech-chime-2025");
      expect(artifact.status).toBe("completed");
      expect(rawJson).toEqual(expect.objectContaining({ runnerName: artifact.runnerName }));
      expect(rawMarkdown.length).toBeGreaterThan(0);
      expect(scorerInput.runnerName).toBe(artifact.runnerName);
      expect(scorerInput.caseId).toBe("dev-fintech-chime-2025");
      expect(scorerInput.runnerOutput.runId).toBe("integration-run");
      expect(perClaimScore.runnerName).toBe(artifact.runnerName);
      expect(perClaimScore.caseId).toBe("dev-fintech-chime-2025");
      expect(caseScore.runnerName).toBe(artifact.runnerName);
      expect(caseScore.caseId).toBe("dev-fintech-chime-2025");
      expect(caseScore.metrics.map((scoreMetric) => scoreMetric.metricId)).toEqual(
        expectedCaseMetricIds
      );
      expect(failureRecords).toEqual([]);
      expect(timing.schemaVersion).toBe("trace.benchmark-timing.v1");
    }

    const aggregateScore = benchmarkAggregateScoreOutputSchema.parse(
      await readJson(result.aggregateArtifact.layout.aggregateScoreJson)
    );
    const aggregateCsv = await readFile(result.aggregateArtifact.layout.aggregateScoreCsv, "utf8");
    const aggregateMarkdown = await readFile(
      result.aggregateArtifact.layout.aggregateScoreMarkdown,
      "utf8"
    );

    expect(aggregateScore.runId).toBe("integration-run");
    expect(aggregateScore.groups.map((group) => group.groupId)).toContain("overall");
    expect(aggregateCsv).toContain("group_id,group_kind,runner_name");
    expect(aggregateMarkdown).toContain("| Group | Kind | Runner |");
  });

  it("derives deterministic run ids when no run id is supplied", async () => {
    const firstOut = await temporaryArtifactRoot();
    const secondOut = await temporaryArtifactRoot();
    const first = await runBenchmark({
      command: "benchmark",
      partition: "development",
      runner: "baseline-a",
      out: firstOut,
      caseIds: ["dev-fintech-chime-2025"]
    });
    const second = await runBenchmark({
      command: "benchmark",
      partition: "development",
      runner: "baseline-a",
      out: secondOut,
      caseIds: ["dev-fintech-chime-2025"]
    });

    expect(first.runIdSource).toBe("deterministic");
    expect(second.runIdSource).toBe("deterministic");
    expect(first.runId).toBe(second.runId);
  });

  it("persists a failed case and continues to the remaining cases", async () => {
    const out = await temporaryArtifactRoot();
    const result = await runBenchmark(
      {
        command: "benchmark",
        partition: "development",
        runner: "trace-full",
        out,
        runId: "failure-continuation-run",
        caseIds: ["dev-fintech-chime-2025", "dev-fintech-monzo-2025"]
      },
      {
        runner: (options) => {
          if (options.input.caseId === "dev-fintech-chime-2025") {
            throw new Error("Injected benchmark runner failure");
          }

          return runSelectedBenchmarkRunner(options);
        }
      }
    );
    const failedArtifact = result.artifacts.find(
      (artifact) => artifact.caseId === "dev-fintech-chime-2025"
    );
    const completedArtifact = result.artifacts.find(
      (artifact) => artifact.caseId === "dev-fintech-monzo-2025"
    );

    expect(result.status).toBe("completed-with-failures");
    expect(result.artifactCount).toBe(2);
    expect(result.failures).toHaveLength(1);
    expect(failedArtifact?.status).toBe("failed");
    expect(completedArtifact?.status).toBe("completed");

    if (failedArtifact === undefined || completedArtifact === undefined) {
      throw new Error("Expected both failed and completed artifacts");
    }

    expect(await readJson(failedArtifact.layout.failureRecord)).toHaveLength(1);
    expect(await readJson(completedArtifact.layout.failureRecord)).toEqual([]);
  });
});
