import { z } from "zod";

import {
  benchmarkRunnerNameSchema
} from "../benchmark/contracts.js";

export const usage = [
  "Usage:",
  "  trace analyze --input <evidence-bundle.json> --out <output-dir>",
  "  trace validate-benchmark-manifest --manifest <benchmark-manifest.json>",
  "  trace validate-benchmark-freeze --freeze <freeze.json> [--mode <authoritative|exploratory>] [--manifest <benchmark-manifest.json>]",
  "  trace benchmark --partition <development|locked-test> --runner <baseline-a|baseline-b|trace-full|all> --out <artifact-root> [--case-id <case-id>] [--run-id <run-id>] [--freeze <freeze.json>] [--exploratory]"
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

const validateBenchmarkFreezeCommandSchema = z
  .object({
    command: z.literal("validate-benchmark-freeze"),
    freeze: z.string().min(1),
    mode: z.enum(["authoritative", "exploratory"]).optional(),
    manifest: z.string().min(1).optional()
  })
  .strict();

export type ValidateBenchmarkFreezeCommand = z.infer<
  typeof validateBenchmarkFreezeCommandSchema
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
    freeze: z.string().min(1).optional(),
    exploratory: z.boolean().optional(),
    runId: benchmarkRunIdSchema.optional(),
    caseIds: z.array(z.string().min(1)).min(1).optional()
  })
  .strict();

export type BenchmarkCommand = z.infer<typeof benchmarkCommandSchema>;
export type TraceCommand =
  | AnalyzeCommand
  | ValidateBenchmarkManifestCommand
  | ValidateBenchmarkFreezeCommand
  | BenchmarkCommand;

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

  if (command === "validate-benchmark-freeze") {
    return parseValidateBenchmarkFreezeArgs(argv);
  }

  if (command === "benchmark") {
    return parseBenchmarkArgs(argv);
  }

  throw new CliUsageError(
    "Expected command: analyze, validate-benchmark-manifest, validate-benchmark-freeze, or benchmark"
  );
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
    freeze: string;
    exploratory: boolean;
    runId: string;
    caseIds: string[];
  }> = {
    caseIds: [],
    exploratory: false
  };
  const rest = argv.slice(1);
  const valueFlags = new Set([
    "--partition",
    "--runner",
    "--out",
    "--manifest",
    "--freeze",
    "--run-id",
    "--case-id"
  ]);
  const booleanFlags = new Set(["--exploratory"]);

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (token === undefined || (!valueFlags.has(token) && !booleanFlags.has(token))) {
      throw new CliUsageError(`Unknown argument: ${token ?? "<empty>"}`);
    }

    if (booleanFlags.has(token)) {
      values.exploratory = true;
      continue;
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
      case "--freeze":
        values.freeze = value;
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
    ...(values.freeze !== undefined ? { freeze: values.freeze } : {}),
    ...(values.exploratory === true ? { exploratory: true } : {}),
    ...(values.runId !== undefined ? { runId: values.runId } : {}),
    ...(values.caseIds !== undefined && values.caseIds.length > 0 ? { caseIds: values.caseIds } : {})
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new CliUsageError(`Invalid benchmark arguments: ${details}`);
  }

  return parsed.data;
}

function parseValidateBenchmarkFreezeArgs(
  argv: readonly string[]
): ValidateBenchmarkFreezeCommand {
  const command = argv[0];
  const values: Partial<Record<"freeze" | "mode" | "manifest", string>> = {};
  const rest = argv.slice(1);
  const valueFlags = new Set(["--freeze", "--mode", "--manifest"]);

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
      case "--freeze":
        values.freeze = value;
        break;
      case "--mode":
        values.mode = value;
        break;
      case "--manifest":
        values.manifest = value;
        break;
    }

    index += 1;
  }

  const parsed = validateBenchmarkFreezeCommandSchema.safeParse({
    command,
    freeze: values.freeze,
    ...(values.mode !== undefined ? { mode: values.mode } : {}),
    ...(values.manifest !== undefined ? { manifest: values.manifest } : {})
  });

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new CliUsageError(`Invalid validate-benchmark-freeze arguments: ${details}`);
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
