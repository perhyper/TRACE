import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  runBaselineA,
  runBaselineB,
  runBenchmarkBaseline
} from "../src/benchmark/baselines.js";
import { compileBenchmarkCases } from "../src/benchmark/compiler.js";
import type {
  BenchmarkCaseInput,
  BenchmarkCompiledCase,
  BenchmarkRunnerOutput
} from "../src/benchmark/contracts.js";

function requireFirstCase(compiledCases: readonly BenchmarkCompiledCase[]): BenchmarkCompiledCase {
  const compiledCase = compiledCases[0];

  if (compiledCase === undefined) {
    throw new Error("Expected at least one compiled benchmark case");
  }

  return compiledCase;
}

function rawJson(output: BenchmarkRunnerOutput): Record<string, unknown> {
  const json = output.rawOutput.json;

  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    throw new Error("Expected raw JSON output to be an object");
  }

  return json as Record<string, unknown>;
}

function emptyEvidenceInput(input: BenchmarkCaseInput): BenchmarkCaseInput {
  return {
    ...input,
    evidenceLedger: {
      ...input.evidenceLedger,
      evidence: []
    }
  };
}

describe("deterministic benchmark baselines", () => {
  it("runs Baseline A and Baseline B over identical benchmark input", async () => {
    const compiledCase = requireFirstCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );
    const baselineA = runBaselineA({
      input: compiledCase.runnerInput,
      runId: "run-001"
    });
    const baselineB = runBaselineB({
      input: compiledCase.runnerInput,
      runId: "run-001"
    });
    const rawA = rawJson(baselineA);
    const rawB = rawJson(baselineB);

    expect(rawA.inputFingerprint).toBe(rawB.inputFingerprint);
    expect(rawA.case).toEqual(rawB.case);
    expect(rawA.sourcePolicy).toEqual(rawB.sourcePolicy);
    expect(rawA.authorityBoundary).toEqual(rawB.authorityBoundary);
    expect(baselineA.caseId).toBe(compiledCase.runnerInput.caseId);
    expect(baselineB.caseId).toBe(compiledCase.runnerInput.caseId);
    expect(baselineA.normalized.claims).toEqual(baselineB.normalized.claims);
    expect(baselineA.normalized.route.status).toBe("omitted");
    expect(baselineB.normalized.route.status).toBe("omitted");
  });

  it("returns stable repeated output for each baseline", async () => {
    const compiledCase = requireFirstCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );

    expect(
      runBenchmarkBaseline({
        runnerName: "baseline-a",
        input: compiledCase.runnerInput,
        runId: "stable-run"
      })
    ).toEqual(
      runBenchmarkBaseline({
        runnerName: "baseline-a",
        input: compiledCase.runnerInput,
        runId: "stable-run"
      })
    );
    expect(
      runBenchmarkBaseline({
        runnerName: "baseline-b",
        input: compiledCase.runnerInput,
        runId: "stable-run"
      })
    ).toEqual(
      runBenchmarkBaseline({
        runnerName: "baseline-b",
        input: compiledCase.runnerInput,
        runId: "stable-run"
      })
    );
  });

  it("captures runner failures in the benchmark output contract", async () => {
    const compiledCase = requireFirstCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );
    const output = runBaselineA({
      input: emptyEvidenceInput(compiledCase.runnerInput),
      runId: "failure-run"
    });

    expect(output.status).toBe("failed");
    expect(output.failures).toHaveLength(1);
    expect(output.failures[0]).toMatchObject({
      stage: "runner",
      severity: "fatal",
      retryable: false,
      runId: "failure-run",
      runnerName: "baseline-a",
      caseId: compiledCase.caseId,
      partition: compiledCase.partition
    });
    expect(output.rawOutput.markdown).toContain("## Failure");
    expect(output.normalized.claims).toEqual([]);
  });

  it("does not include hidden annotation or result access in the baseline runner", async () => {
    const source = await readFile(
      new URL("../src/benchmark/baselines.ts", import.meta.url),
      "utf8"
    );

    expect(source).not.toContain("scorerReference");
    expect(source).not.toContain("annotation");
    expect(source).not.toContain("eval/benchmark/annotations");
    expect(source).not.toContain("eval/benchmark/runs");
    expect(source).not.toContain("compileBenchmarkCases");
  });
});
