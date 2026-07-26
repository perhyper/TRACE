import { join } from "node:path";

import { z } from "zod";

import {
  benchmarkCasePartitionSchema,
  benchmarkScoredOrAllPartitionSchema,
  benchmarkRunnerNameSchema
} from "./contracts.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const caseIdSchema = nonEmptyStringSchema
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}$/u);
const pathSegmentSchema = nonEmptyStringSchema
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const benchmarkArtifactFileNames = {
  rawRunnerOutputJson: "raw-runner-output.json",
  rawRunnerOutputMarkdown: "raw-runner-output.md",
  normalizedScorerInput: "normalized-scorer-input.json",
  perClaimScore: "per-claim-score.json",
  caseScore: "case-score.json",
  failureRecord: "failure-record.json",
  timingMetadata: "timing-metadata.json",
  aggregateScoreJson: "aggregate-score.json",
  aggregateScoreCsv: "aggregate-score.csv",
  aggregateScoreMarkdown: "aggregate-score.md"
} as const;

export const benchmarkArtifactLayoutSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-artifact-layout.v1"),
    rootDirectory: nonEmptyStringSchema,
    partition: benchmarkCasePartitionSchema,
    runId: pathSegmentSchema,
    runnerName: benchmarkRunnerNameSchema,
    caseId: caseIdSchema,
    caseDirectory: nonEmptyStringSchema,
    rawRunnerOutputJson: nonEmptyStringSchema,
    rawRunnerOutputMarkdown: nonEmptyStringSchema,
    normalizedScorerInput: nonEmptyStringSchema,
    perClaimScore: nonEmptyStringSchema,
    caseScore: nonEmptyStringSchema,
    failureRecord: nonEmptyStringSchema,
    timingMetadata: nonEmptyStringSchema
  })
  .strict();

export type BenchmarkArtifactLayout = z.infer<typeof benchmarkArtifactLayoutSchema>;

export const benchmarkAggregateArtifactLayoutSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-aggregate-artifact-layout.v1"),
    rootDirectory: nonEmptyStringSchema,
    partition: benchmarkScoredOrAllPartitionSchema,
    runId: pathSegmentSchema,
    aggregateDirectory: nonEmptyStringSchema,
    aggregateScoreJson: nonEmptyStringSchema,
    aggregateScoreCsv: nonEmptyStringSchema,
    aggregateScoreMarkdown: nonEmptyStringSchema
  })
  .strict();

export type BenchmarkAggregateArtifactLayout = z.infer<
  typeof benchmarkAggregateArtifactLayoutSchema
>;

export interface BenchmarkArtifactLayoutOptions {
  readonly rootDirectory?: string;
  readonly partition: z.infer<typeof benchmarkCasePartitionSchema>;
  readonly runId: string;
  readonly runnerName: z.infer<typeof benchmarkRunnerNameSchema>;
  readonly caseId: string;
}

export function benchmarkCaseArtifactLayout(
  options: BenchmarkArtifactLayoutOptions
): BenchmarkArtifactLayout {
  const rootDirectory = options.rootDirectory ?? join("eval", "benchmark", "runs");
  const partition = benchmarkCasePartitionSchema.parse(options.partition);
  const runnerName = benchmarkRunnerNameSchema.parse(options.runnerName);
  const runId = pathSegmentSchema.parse(options.runId);
  const caseId = caseIdSchema.parse(options.caseId);
  const caseDirectory = join(rootDirectory, partition, runId, runnerName, caseId);

  return benchmarkArtifactLayoutSchema.parse({
    schemaVersion: "trace.benchmark-artifact-layout.v1",
    rootDirectory,
    partition,
    runId,
    runnerName,
    caseId,
    caseDirectory,
    rawRunnerOutputJson: join(caseDirectory, benchmarkArtifactFileNames.rawRunnerOutputJson),
    rawRunnerOutputMarkdown: join(
      caseDirectory,
      benchmarkArtifactFileNames.rawRunnerOutputMarkdown
    ),
    normalizedScorerInput: join(
      caseDirectory,
      benchmarkArtifactFileNames.normalizedScorerInput
    ),
    perClaimScore: join(caseDirectory, benchmarkArtifactFileNames.perClaimScore),
    caseScore: join(caseDirectory, benchmarkArtifactFileNames.caseScore),
    failureRecord: join(caseDirectory, benchmarkArtifactFileNames.failureRecord),
    timingMetadata: join(caseDirectory, benchmarkArtifactFileNames.timingMetadata)
  });
}

export interface BenchmarkAggregateArtifactLayoutOptions {
  readonly rootDirectory?: string;
  readonly partition: z.infer<typeof benchmarkScoredOrAllPartitionSchema>;
  readonly runId: string;
}

export function benchmarkAggregateArtifactLayout(
  options: BenchmarkAggregateArtifactLayoutOptions
): BenchmarkAggregateArtifactLayout {
  const rootDirectory = options.rootDirectory ?? join("eval", "benchmark", "runs");
  const partition = benchmarkScoredOrAllPartitionSchema.parse(options.partition);
  const runId = pathSegmentSchema.parse(options.runId);
  const aggregateDirectory = join(rootDirectory, partition, runId);

  return benchmarkAggregateArtifactLayoutSchema.parse({
    schemaVersion: "trace.benchmark-aggregate-artifact-layout.v1",
    rootDirectory,
    partition,
    runId,
    aggregateDirectory,
    aggregateScoreJson: join(aggregateDirectory, benchmarkArtifactFileNames.aggregateScoreJson),
    aggregateScoreCsv: join(aggregateDirectory, benchmarkArtifactFileNames.aggregateScoreCsv),
    aggregateScoreMarkdown: join(
      aggregateDirectory,
      benchmarkArtifactFileNames.aggregateScoreMarkdown
    )
  });
}
