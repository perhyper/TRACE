import { z } from "zod";

export const usage = [
  "Usage:",
  "  trace analyze --input <evidence-bundle.json> --out <output-dir>",
  "  trace validate-benchmark-manifest --manifest <benchmark-manifest.json>"
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
export type TraceCommand = AnalyzeCommand | ValidateBenchmarkManifestCommand;

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

  throw new CliUsageError("Expected command: analyze or validate-benchmark-manifest");
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
