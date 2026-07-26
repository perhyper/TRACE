import type { ValidateBenchmarkFreezeCommand } from "../cli/args.js";
import {
  validateBenchmarkFreezeForLockedTest
} from "../benchmark/freeze.js";
import type {
  BenchmarkFreezeValidationResult
} from "../benchmark/freeze.js";

export async function runValidateBenchmarkFreeze(
  command: ValidateBenchmarkFreezeCommand
): Promise<BenchmarkFreezeValidationResult> {
  return validateBenchmarkFreezeForLockedTest({
    freezePath: command.freeze,
    ...(command.manifest !== undefined ? { manifestPath: command.manifest } : {}),
    ...(command.mode !== undefined ? { mode: command.mode } : {})
  });
}
