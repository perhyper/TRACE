import { describe, expect, it } from "vitest";

import { compileBenchmarkCases } from "../src/benchmark/compiler.js";
import type {
  BenchmarkCaseInput,
  BenchmarkCompiledCase,
  BenchmarkRunnerOutput
} from "../src/benchmark/contracts.js";
import { runTraceFull } from "../src/benchmark/trace-full.js";

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

describe("TRACE Full benchmark runner", () => {
  it("runs the existing TRACE analyzer path over benchmark input", async () => {
    const compiledCase = requireFirstCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );
    const output = runTraceFull({
      input: compiledCase.runnerInput,
      runId: "trace-full-run"
    });
    const raw = rawJson(output);

    expect(output.status).toBe("completed");
    expect(output.runnerName).toBe("trace-full");
    expect(output.caseId).toBe(compiledCase.caseId);
    expect(output.rawOutput.markdown).toContain("# TRACE Report:");
    expect(output.normalized.claims.length).toBeGreaterThan(0);
    expect(output.normalized.route.status).not.toBe("omitted");
    expect(output.normalized.valuations).toHaveLength(4);
    expect(output.failures).toEqual([]);
    expect(raw.schemaVersion).toBe("trace.trace-full-runner-output.v1");
    expect(raw.analyzerPath).toEqual([
      "evidence-ledger",
      "sufficiency-gating",
      "route-selection",
      "valuation-engine",
      "adversarial-review",
      "report-composer"
    ]);
  });

  it("returns stable repeated output for the same run id and input", async () => {
    const compiledCase = requireFirstCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );

    expect(
      runTraceFull({
        input: compiledCase.runnerInput,
        runId: "stable-trace-full-run"
      })
    ).toEqual(
      runTraceFull({
        input: compiledCase.runnerInput,
        runId: "stable-trace-full-run"
      })
    );
  });

  it("captures TRACE Full runner failures in the benchmark output contract", async () => {
    const compiledCase = requireFirstCase(
      await compileBenchmarkCases({ partitions: ["development"] })
    );
    const output = runTraceFull({
      input: emptyEvidenceInput(compiledCase.runnerInput),
      runId: "trace-full-failure-run"
    });

    expect(output.status).toBe("failed");
    expect(output.failures).toHaveLength(1);
    expect(output.failures[0]).toMatchObject({
      stage: "runner",
      severity: "fatal",
      retryable: false,
      runId: "trace-full-failure-run",
      runnerName: "trace-full",
      caseId: compiledCase.caseId,
      partition: compiledCase.partition
    });
    expect(output.rawOutput.markdown).toContain("## Failure");
    expect(output.normalized.claims).toEqual([]);
  });
});
