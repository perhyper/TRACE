import {
  isBenchmarkBaselineRunnerName,
  runBenchmarkBaseline
} from "./baselines.js";
import {
  benchmarkRunnerNameSchema
} from "./contracts.js";
import type {
  BenchmarkCaseInput,
  BenchmarkRunnerName,
  BenchmarkRunnerOutput
} from "./contracts.js";
import {
  runTraceFull
} from "./trace-full.js";

export interface BenchmarkRunnerRunOptions {
  readonly runnerName: BenchmarkRunnerName;
  readonly input: BenchmarkCaseInput;
  readonly runId: string;
}

export type BenchmarkRunnerAdapter = (
  options: BenchmarkRunnerRunOptions
) => BenchmarkRunnerOutput;

export const allBenchmarkRunnerNames = benchmarkRunnerNameSchema.options;

export function runSelectedBenchmarkRunner(
  options: BenchmarkRunnerRunOptions
): BenchmarkRunnerOutput {
  if (isBenchmarkBaselineRunnerName(options.runnerName)) {
    return runBenchmarkBaseline({
      runnerName: options.runnerName,
      input: options.input,
      runId: options.runId
    });
  }

  return runTraceFull({
    input: options.input,
    runId: options.runId
  });
}
