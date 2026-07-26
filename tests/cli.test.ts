import { describe, expect, it } from "vitest";

import { CliUsageError, parseTraceArgs } from "../src/cli/args.js";

describe("parseTraceArgs", () => {
  it("parses the analyze command with required paths", () => {
    const command = parseTraceArgs([
      "analyze",
      "--input",
      "fixtures/evidence-bundle.json",
      "--out",
      "examples/output/revolut"
    ]);

    expect(command).toEqual({
      command: "analyze",
      input: "fixtures/evidence-bundle.json",
      out: "examples/output/revolut"
    });
  });

  it("parses the benchmark manifest validation command", () => {
    const command = parseTraceArgs([
      "validate-benchmark-manifest",
      "--manifest",
      "eval/benchmark-manifest.json"
    ]);

    expect(command).toEqual({
      command: "validate-benchmark-manifest",
      manifest: "eval/benchmark-manifest.json"
    });
  });

  it("parses the benchmark command with runner selection and case filters", () => {
    const command = parseTraceArgs([
      "benchmark",
      "--partition",
      "development",
      "--runner",
      "all",
      "--out",
      "tmp/benchmark-runs",
      "--run-id",
      "local-run-001",
      "--case-id",
      "dev-fintech-chime-2025",
      "--case-id",
      "dev-fintech-monzo-2025"
    ]);

    expect(command).toEqual({
      command: "benchmark",
      partition: "development",
      runner: "all",
      out: "tmp/benchmark-runs",
      runId: "local-run-001",
      caseIds: ["dev-fintech-chime-2025", "dev-fintech-monzo-2025"]
    });
  });

  it("rejects unsupported commands", () => {
    expect(() => parseTraceArgs(["review"])).toThrow(CliUsageError);
  });

  it("rejects missing flag values", () => {
    expect(() => parseTraceArgs(["analyze", "--input", "--out", "out"])).toThrow(
      CliUsageError
    );
  });
});
