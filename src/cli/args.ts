import { z } from "zod";

import {
  benchmarkRunnerNameSchema
} from "../benchmark/contracts.js";

export const usage = [
  "Usage:",
  "  trace analyze --input <evidence-bundle.json> --out <output-dir>",
  "  trace validate-benchmark-manifest --manifest <benchmark-manifest.json>",
  "  trace benchmark --partition <development|locked-test> --runner <baseline-a|baseline-b|trace-full|all> --out <artifact-root> [--case-id <case-id>] [--run-id <run-id>]"
].join("\n");

const analyzeCommandSchema = z
  .object({
    command: z.literal("analyze"),
    input: z.string().min(1),
    out: z.string().min(1)
  })
  .strict();

export type AnalyzeCommand = z.infer<typeof analyzeCommandSchema>;

const validateBenchmarkManifestCommandSchema = z
  .object({
    command: z.literal("validate-benchmark-manifest"),
    manifest: z.string().min(1)
  })
  .strict();

export type ValidateBenchmarkManifestCommand = z.infer<
  typeof validateBenchmarkManifestCommandSchema
>;

const benchmarkPartitionArgSchema = z.enum(["development", "locked-test"]);
const benchmarkRunnerSelectionSchema = z.union([
  benchmarkRunnerNameSchema,
  z.literal("all")
]);
const benchmarkRunIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);
const benchmarkCommandSchema = z
  .object({
    command: z.literal("benchmark"),
    partition: benchmarkPartitionArgSchema,
    runner: benchmarkRunnerSelectionSchema,
    out: z.string().min(1),
    manifest: z.string().min(1).optional(),
    runId: benchmarkRunIdSchema.optional(),
    caseIds: z.array(z.string().min(1)).min(1).optional()
  })
  .strict();

export type BenchmarkCommand = z.infer<typeof benchmarkCommandSchema>;
export type TraceCommand = AnalyzeCommand | ValidateBenchmarkManifestCommand | BenchmarkCommand;

export class CliUsageError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export function parseTraceArgs(argv: readonly string[]): TraceCommand {
  const command = argv[0];

  if (command === "analyze") {
    return parseAnalyzeArgs(argv);
  }

  if (command === "validate-benchmark-manifest") {
    return parseValidateBenchmarkManifestArgs(argv);
  }

  if (command === "benchmark") {
    return parseBenchmarkArgs(argv);
  }

  throw new CliUsageError("Expected command: analyze, validate-benchmark-manifest, or benchmark");
}

function parseAnalyzeArgs(argv: readonly string[]): AnalyzeCommand {
  const command = argv[0];
  const values: Partial<Record<"input" | "out", string>> = {};
  const rest = argv.slice(1);

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token !== "--input" && token !== "--out") {
      throw new CliUsageError(`Unknown argument: ${token ?? "<empty>"}`);
    }

    const value = rest[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new CliUsageError(`Missing value for ${token}`);
    }

    const key = token === "--input" ? "input" : "out";
    values[key] = value;
    index += 1;
  }

  const parsed = analyzeCommandSchema.safeParse({
    command,
    ...values
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new CliUsageError(`Invalid analyze arguments: ${details}`);
  }

  return parsed.data;
}

function parseBenchmarkArgs(argv: readonly string[]): BenchmarkCommand {
  const command = argv[0];
  const values: Partial<{
    partition: string;
    runner: string;
    out: string;
    manifest: string;
    runId: string;
    caseIds: string[];
  }> = {
    caseIds: []
  };
  const rest = argv.slice(1);
  const valueFlags = new Set([
    "--partition",
    "--runner",
    "--out",
    "--manifest",
    "--run-id",
    "--case-id"
  ]);

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === undefined || !valueFlags.has(token)) {
      throw new CliUsageError(`Unknown argument: ${token ?? "<empty>"}`);
    }

    const value = rest[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new CliUsageError(`Missing value for ${token}`);
    }

    switch (token) {
      case "--partition":
        values.partition = value;
        break;
      case "--runner":
        values.runner = value;
        break;
      case "--out":
        values.out = value;
        break;
      case "--manifest":
        values.manifest = value;
        break;
      case "--run-id":
        values.runId = value;
        break;
      case "--case-id":
        values.caseIds?.push(value);
        break;
    }

    index += 1;
  }

  const parsed = benchmarkCommandSchema.safeParse({
    command,
    partition: values.partition,
    runner: values.runner,
    out: values.out,
    ...(values.manifest !== undefined ? { manifest: values.manifest } : {}),
    ...(values.runId !== undefined ? { runId: values.runId } : {}),
    ...(values.caseIds !== undefined && values.caseIds.length > 0 ? { caseIds: values.caseIds } : {})
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new CliUsageError(`Invalid benchmark arguments: ${details}`);
  }

  return parsed.data;
}

function parseValidateBenchmarkManifestArgs(
  argv: readonly string[]
): ValidateBenchmarkManifestCommand {
  const command = argv[0];
  const values: Partial<Record<"manifest", string>> = {};
  const rest = argv.slice(1);

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token !== "--manifest") {
      throw new CliUsageError(`Unknown argument: ${token ?? "<empty>"}`);
    }

    const value = rest[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new CliUsageError(`Missing value for ${token}`);
    }

    values.manifest = value;
    index += 1;
  }

  const parsed = validateBenchmarkManifestCommandSchema.safeParse({
    command,
    ...values
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new CliUsageError(`Invalid validate-benchmark-manifest arguments: ${details}`);
  }

  return parsed.data;
}
