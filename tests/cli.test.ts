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

  it("rejects unsupported commands", () => {
    expect(() => parseTraceArgs(["review"])).toThrow(CliUsageError);
  });

  it("rejects missing flag values", () => {
    expect(() => parseTraceArgs(["analyze", "--input", "--out", "out"])).toThrow(
      CliUsageError
    );
  });
});
