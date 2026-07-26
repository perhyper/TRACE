import type { ValidateBenchmarkManifestCommand } from "../cli/args.js";
import {
  loadBenchmarkManifestFromJsonFile,
  summarizeBenchmarkManifest
} from "../benchmark/manifest.js";
import type { BenchmarkManifestSummary } from "../benchmark/manifest.js";

export interface ValidateBenchmarkManifestResult {
  readonly command: "validate-benchmark-manifest";
  readonly manifest: string;
  readonly status: "valid";
  readonly summary: BenchmarkManifestSummary;
}

export async function runValidateBenchmarkManifest(
  command: ValidateBenchmarkManifestCommand
): Promise<ValidateBenchmarkManifestResult> {
  const manifest = await loadBenchmarkManifestFromJsonFile(command.manifest);
  const summary = summarizeBenchmarkManifest(manifest);

  return {
    command: command.command,
    manifest: command.manifest,
    status: "valid",
    summary
  };
}
