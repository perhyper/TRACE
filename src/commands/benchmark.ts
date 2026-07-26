import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";

import { z } from "zod";

import type { BenchmarkCommand } from "../cli/args.js";
import {
  benchmarkAggregateArtifactLayout,
  benchmarkCaseArtifactLayout
} from "../benchmark/artifacts.js";
import type {
  BenchmarkAggregateArtifactLayout,
  BenchmarkArtifactLayout
} from "../benchmark/artifacts.js";
import {
  aggregateBenchmarkScores,
  renderBenchmarkAggregateCsv,
  renderBenchmarkAggregateMarkdown
} from "../benchmark/aggregation.js";
import type {
  BenchmarkAggregateCaseResult
} from "../benchmark/aggregation.js";
import {
  benchmarkCaseInputForRunner,
  compileBenchmarkCases,
  createBenchmarkScorerInput
} from "../benchmark/compiler.js";
import {
  benchmarkRunnerOutputSchema
} from "../benchmark/contracts.js";
import type {
  BenchmarkCaseInput,
  BenchmarkCasePartition,
  BenchmarkCaseScoreOutput,
  BenchmarkCompiledCase,
  BenchmarkFailureRecord,
  BenchmarkRunnerName,
  BenchmarkRunnerOutput,
  BenchmarkTimingMetadata
} from "../benchmark/contracts.js";
import {
  validateBenchmarkFreezeForLockedTest
} from "../benchmark/freeze.js";
import type {
  BenchmarkFreezeValidationResult
} from "../benchmark/freeze.js";
import {
  allBenchmarkRunnerNames,
  runSelectedBenchmarkRunner
} from "../benchmark/runners.js";
import type {
  BenchmarkRunnerAdapter
} from "../benchmark/runners.js";
import {
  scoreBenchmarkCase
} from "../benchmark/scoring.js";

export interface BenchmarkRunOptions {
  readonly rootDir?: string;
  readonly compiledCases?: readonly BenchmarkCompiledCase[];
  readonly runner?: BenchmarkRunnerAdapter;
}

export interface BenchmarkRunResult {
  readonly command: "benchmark";
  readonly partition: BenchmarkCasePartition;
  readonly requestedRunner: BenchmarkRunnerSelection;
  readonly runners: readonly BenchmarkRunnerName[];
  readonly out: string;
  readonly runId: string;
  readonly runIdSource: "deterministic" | "supplied";
  readonly caseCount: number;
  readonly artifactCount: number;
  readonly status: "completed" | "completed-with-failures";
  readonly artifacts: readonly BenchmarkWrittenArtifact[];
  readonly aggregateArtifact: BenchmarkWrittenAggregateArtifact;
  readonly failures: readonly BenchmarkFailureRecord[];
  readonly freezeValidation?: BenchmarkFreezeValidationResult;
}

export interface BenchmarkWrittenArtifact {
  readonly runnerName: BenchmarkRunnerName;
  readonly caseId: string;
  readonly partition: BenchmarkCasePartition;
  readonly status: BenchmarkRunnerOutput["status"];
  readonly failureCount: number;
  readonly caseScore: BenchmarkCaseScoreOutput;
  readonly layout: BenchmarkArtifactLayout;
}

export interface BenchmarkWrittenAggregateArtifact {
  readonly groupCount: number;
  readonly layout: BenchmarkAggregateArtifactLayout;
}

export type BenchmarkRunnerSelection = BenchmarkRunnerName | "all";

export class BenchmarkCommandError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BenchmarkCommandError";
  }
}

const deterministicTimingBaseMs = Date.UTC(2026, 6, 26, 0, 0, 0, 0);
const pathSegmentSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export async function runBenchmark(
  command: BenchmarkCommand,
  options: BenchmarkRunOptions = {}
): Promise<BenchmarkRunResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const freezeValidation = await validateLockedTestFreeze(command, rootDir);
  const runnerNames = selectedRunnerNames(command.runner);
  const compiledCases = options.compiledCases ?? await compileBenchmarkCases({
    rootDir,
    ...(command.manifest !== undefined ? { manifestPath: command.manifest } : {}),
    partitions: [command.partition]
  });
  const selectedCases = selectCompiledCases(compiledCases, command.caseIds);
  const runId = command.runId ?? deterministicRunId(command, runnerNames, selectedCases);
  const parsedRunId = pathSegmentSchema.parse(runId);
  const runner = options.runner ?? runSelectedBenchmarkRunner;
  const artifacts: BenchmarkWrittenArtifact[] = [];
  const aggregateCaseResults: BenchmarkAggregateCaseResult[] = [];
  const failures: BenchmarkFailureRecord[] = [];

  for (const runnerName of runnerNames) {
    for (const compiledCase of selectedCases) {
      const input = benchmarkCaseInputForRunner(runnerName, compiledCase);
      const output = runCase({
        runner,
        runnerName,
        input,
        runId: parsedRunId
      });
      const artifact = await writeBenchmarkCaseArtifacts({
        rootDirectory: command.out,
        compiledCase,
        runnerOutput: output
      });

      artifacts.push(artifact);
      aggregateCaseResults.push({
        compiledCase,
        runnerOutput: output,
        caseScore: artifact.caseScore
      });
      failures.push(...output.failures);
    }
  }

  const aggregateScore = aggregateBenchmarkScores({
    runId: parsedRunId,
    partition: command.partition,
    caseResults: aggregateCaseResults
  });
  const aggregateArtifact = await writeBenchmarkAggregateArtifacts({
    rootDirectory: command.out,
    aggregateScore
  });

  return {
    command: "benchmark",
    partition: command.partition,
    requestedRunner: command.runner,
    runners: runnerNames,
    out: command.out,
    runId: parsedRunId,
    runIdSource: command.runId === undefined ? "deterministic" : "supplied",
    caseCount: selectedCases.length,
    artifactCount: artifacts.length,
    status: failures.length === 0 ? "completed" : "completed-with-failures",
    artifacts,
    aggregateArtifact,
    failures,
    ...(freezeValidation !== undefined ? { freezeValidation } : {})
  };
}

async function validateLockedTestFreeze(
  command: BenchmarkCommand,
  rootDir: string
): Promise<BenchmarkFreezeValidationResult | undefined> {
  if (command.partition !== "locked-test") {
    return undefined;
  }

  return validateBenchmarkFreezeForLockedTest({
    rootDir,
    ...(command.freeze !== undefined ? { freezePath: command.freeze } : {}),
    ...(command.manifest !== undefined ? { manifestPath: command.manifest } : {}),
    mode: command.exploratory === true ? "exploratory" : "authoritative"
  });
}

export async function writeBenchmarkCaseArtifacts(options: {
  readonly rootDirectory: string;
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerOutput: BenchmarkRunnerOutput;
}): Promise<BenchmarkWrittenArtifact> {
  const layout = benchmarkCaseArtifactLayout({
    rootDirectory: options.rootDirectory,
    partition: options.runnerOutput.partition,
    runId: options.runnerOutput.runId,
    runnerName: options.runnerOutput.runnerName,
    caseId: options.runnerOutput.caseId
  });
  const scorerInput = createBenchmarkScorerInput({
    compiledCase: options.compiledCase,
    runnerOutput: options.runnerOutput
  });
  const scoreOutput = scoreBenchmarkCase(scorerInput);

  await mkdir(layout.caseDirectory, { recursive: true });
  await writeJson(layout.rawRunnerOutputJson, rawRunnerOutputJson(options.runnerOutput));
  await writeFile(layout.rawRunnerOutputMarkdown, rawRunnerOutputMarkdown(options.runnerOutput), "utf8");
  await writeJson(layout.normalizedScorerInput, scorerInput);
  await writeJson(layout.perClaimScore, scoreOutput.perClaimScore);
  await writeJson(layout.caseScore, scoreOutput.caseScore);
  await writeJson(layout.failureRecord, options.runnerOutput.failures);
  await writeJson(layout.timingMetadata, options.runnerOutput.timing);

  return {
    runnerName: options.runnerOutput.runnerName,
    caseId: options.runnerOutput.caseId,
    partition: options.runnerOutput.partition,
    status: options.runnerOutput.status,
    failureCount: options.runnerOutput.failures.length,
    caseScore: scoreOutput.caseScore,
    layout
  };
}

export async function writeBenchmarkAggregateArtifacts(options: {
  readonly rootDirectory: string;
  readonly aggregateScore: ReturnType<typeof aggregateBenchmarkScores>;
}): Promise<BenchmarkWrittenAggregateArtifact> {
  const layout = benchmarkAggregateArtifactLayout({
    rootDirectory: options.rootDirectory,
    partition: options.aggregateScore.partition,
    runId: options.aggregateScore.runId
  });

  await mkdir(layout.aggregateDirectory, { recursive: true });
  await writeJson(layout.aggregateScoreJson, options.aggregateScore);
  await writeFile(
    layout.aggregateScoreCsv,
    renderBenchmarkAggregateCsv(options.aggregateScore),
    "utf8"
  );
  await writeFile(
    layout.aggregateScoreMarkdown,
    renderBenchmarkAggregateMarkdown(options.aggregateScore),
    "utf8"
  );

  return {
    groupCount: options.aggregateScore.groups.length,
    layout
  };
}

function runCase(options: {
  readonly runner: BenchmarkRunnerAdapter;
  readonly runnerName: BenchmarkRunnerName;
  readonly input: BenchmarkCaseInput;
  readonly runId: string;
}): BenchmarkRunnerOutput {
  try {
    return options.runner({
      runnerName: options.runnerName,
      input: options.input,
      runId: options.runId
    });
  } catch (error) {
    return buildUnexpectedRunnerFailure({
      runnerName: options.runnerName,
      input: options.input,
      runId: options.runId,
      message: truncateFailureMessage(errorMessage(error))
    });
  }
}

function selectedRunnerNames(selection: BenchmarkRunnerSelection): readonly BenchmarkRunnerName[] {
  return selection === "all" ? allBenchmarkRunnerNames : [selection];
}

function selectCompiledCases(
  compiledCases: readonly BenchmarkCompiledCase[],
  caseIds: readonly string[] | undefined
): BenchmarkCompiledCase[] {
  const selectedCaseIds = caseIds === undefined ? undefined : new Set(caseIds);
  const selectedCases = compiledCases
    .filter((compiledCase) => selectedCaseIds === undefined || selectedCaseIds.has(compiledCase.caseId))
    .sort(compareCompiledCases);

  if (selectedCases.length === 0) {
    throw new BenchmarkCommandError("No benchmark cases matched the requested partition and case filters.");
  }

  if (selectedCaseIds !== undefined) {
    const foundCaseIds = new Set(selectedCases.map((compiledCase) => compiledCase.caseId));
    const requestedCaseIds = caseIds ?? [];
    const missingCaseIds = requestedCaseIds
      .filter((caseId) => !foundCaseIds.has(caseId))
      .sort(compareStrings);

    if (missingCaseIds.length > 0) {
      throw new BenchmarkCommandError(`Unknown benchmark case id(s): ${missingCaseIds.join(", ")}`);
    }
  }

  return selectedCases;
}

function deterministicRunId(
  command: BenchmarkCommand,
  runnerNames: readonly BenchmarkRunnerName[],
  compiledCases: readonly BenchmarkCompiledCase[]
): string {
  return `run-${shortHash(stableStringify({
    schemaVersion: "trace.benchmark-command-run.v1",
    partition: command.partition,
    requestedRunner: command.runner,
    runnerNames,
    caseIds: compiledCases.map((compiledCase) => compiledCase.caseId),
    manifestLockIds: uniqueSorted(compiledCases.map((compiledCase) => compiledCase.manifestLockId))
  })).slice(0, 16)}`;
}

function buildUnexpectedRunnerFailure(options: {
  readonly runnerName: BenchmarkRunnerName;
  readonly input: BenchmarkCaseInput;
  readonly runId: string;
  readonly message: string;
}): BenchmarkRunnerOutput {
  const timing = deterministicFailureTiming(options.runnerName, options.input);
  const failure = failureRecord({
    runnerName: options.runnerName,
    input: options.input,
    runId: options.runId,
    message: options.message,
    ...(timing.completedAt !== undefined ? { occurredAt: timing.completedAt } : {})
  });

  return benchmarkRunnerOutputSchema.parse({
    schemaVersion: "trace.benchmark-runner-output.v1",
    runnerName: options.runnerName,
    runId: options.runId,
    caseId: options.input.caseId,
    partition: options.input.partition,
    status: "failed",
    timing,
    rawOutput: {
      markdown: renderUnexpectedFailureMarkdown(options.input, options.message),
      json: {
        schemaVersion: "trace.benchmark-runner-wrapper-failure.v1",
        runnerName: options.runnerName,
        caseId: options.input.caseId,
        failure
      }
    },
    normalized: {
      claims: [],
      route: {
        status: "omitted"
      },
      abstentions: [],
      valuations: []
    },
    failures: [failure]
  });
}

function failureRecord(options: {
  readonly runnerName: BenchmarkRunnerName;
  readonly input: BenchmarkCaseInput;
  readonly runId: string;
  readonly message: string;
  readonly occurredAt?: string;
}): BenchmarkFailureRecord {
  return {
    schemaVersion: "trace.benchmark-failure.v1",
    failureId: `${options.runnerName}-runner-${shortHash(options.message)}`,
    stage: "runner",
    severity: "fatal",
    message: options.message,
    retryable: false,
    runId: options.runId,
    runnerName: options.runnerName,
    caseId: options.input.caseId,
    partition: options.input.partition,
    ...(options.occurredAt !== undefined ? { occurredAt: options.occurredAt } : {})
  };
}

function deterministicFailureTiming(
  runnerName: BenchmarkRunnerName,
  input: BenchmarkCaseInput
): BenchmarkTimingMetadata {
  const durationMs = 120 + Number.parseInt(shortHash(`${runnerName}\n${input.caseId}`).slice(0, 4), 16) % 90;

  return {
    schemaVersion: "trace.benchmark-timing.v1",
    startedAt: new Date(deterministicTimingBaseMs).toISOString(),
    completedAt: new Date(deterministicTimingBaseMs + durationMs).toISOString(),
    durationMs
  };
}

function renderUnexpectedFailureMarkdown(input: BenchmarkCaseInput, message: string): string {
  return [
    `# Benchmark Runner Failure: ${input.companyLegalName}`,
    "",
    `Case: ${input.caseId}`,
    `Partition: ${input.partition}`,
    "",
    "## Failure",
    message
  ].join("\n").concat("\n");
}

function rawRunnerOutputJson(output: BenchmarkRunnerOutput): unknown {
  return output.rawOutput.json ?? {
    schemaVersion: "trace.raw-runner-output-wrapper.v1",
    runnerName: output.runnerName,
    caseId: output.caseId,
    rawOutput: output.rawOutput
  };
}

function rawRunnerOutputMarkdown(output: BenchmarkRunnerOutput): string {
  return output.rawOutput.markdown ?? output.rawOutput.text ?? "";
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown benchmark runner failure";
}

function truncateFailureMessage(message: string): string {
  const maxFailureMessageLength = 2_000;

  if (message.length <= maxFailureMessageLength) {
    return message;
  }

  return `${message.slice(0, maxFailureMessageLength - 14)} [truncated]`;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 20);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => compareStrings(leftKey, rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function compareCompiledCases(
  left: BenchmarkCompiledCase,
  right: BenchmarkCompiledCase
): number {
  return compareStrings(left.caseId, right.caseId);
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort(compareStrings);
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
