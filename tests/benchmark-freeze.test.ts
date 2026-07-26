import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  runBenchmark
} from "../src/commands/benchmark.js";
import {
  runValidateBenchmarkFreeze
} from "../src/commands/validate-benchmark-freeze.js";
import {
  BenchmarkFreezeValidationError,
  loadBenchmarkFreezeRecordFromJsonFile,
  validateBenchmarkFreezeForLockedTest
} from "../src/benchmark/freeze.js";
import type {
  BenchmarkFreezeRecord
} from "../src/benchmark/freeze.js";

const freezePath = join(process.cwd(), "eval", "benchmark", "freeze.json");

async function writeCorruptFreezeRecord(): Promise<string> {
  const record = await loadBenchmarkFreezeRecordFromJsonFile(freezePath);
  const corruptRecord: BenchmarkFreezeRecord = {
    ...record,
    frozenHashes: {
      ...record.frozenHashes,
      manifest: {
        ...record.frozenHashes.manifest,
        hash: "sha256:0000000000000000000000000000000000000000000000000000000000000000"
      }
    }
  };
  const directory = await mkdtemp(join(tmpdir(), "trace-freeze-"));
  const corruptPath = join(directory, "freeze.json");

  await writeFile(corruptPath, `${JSON.stringify(corruptRecord, null, 2)}\n`, "utf8");

  return corruptPath;
}

describe("benchmark freeze validation", () => {
  it("loads the freeze record and validates current locked-test boundary hashes", async () => {
    const record = await loadBenchmarkFreezeRecordFromJsonFile(freezePath);
    const result = await runValidateBenchmarkFreeze({
      command: "validate-benchmark-freeze",
      freeze: freezePath
    });

    expect(record).toMatchObject({
      schemaVersion: "trace.benchmark-freeze.v1",
      status: "frozen",
      manifestLockId: "trace-internal-benchmark-lock-2026-07-26-v1",
      developmentRunId: "run-dev-generalization-v1"
    });
    expect(record.commandTemplates.authoritativeLockedTest).toContain("--partition locked-test");
    expect(record.lockedTestPolicy.noTuningStatement).toContain(
      "may not drive source, fixture, scoring, config, or weight changes"
    );
    expect(result.status).toBe("valid");
    expect(result.authority).toBe("authoritative");
    expect(result.mismatches).toEqual([]);
    expect(result.comparisons).toHaveLength(7);
    expect(result.comparisons.every((comparison) => comparison.matches)).toBe(true);
  });

  it("refuses authoritative locked-test validation when frozen hashes differ", async () => {
    const corruptPath = await writeCorruptFreezeRecord();

    await expect(
      validateBenchmarkFreezeForLockedTest({ freezePath: corruptPath })
    ).rejects.toThrow(BenchmarkFreezeValidationError);
  });

  it("marks mismatched exploratory validation as non-authoritative", async () => {
    const corruptPath = await writeCorruptFreezeRecord();
    const result = await validateBenchmarkFreezeForLockedTest({
      freezePath: corruptPath,
      mode: "exploratory"
    });

    expect(result.status).toBe("exploratory-non-authoritative");
    expect(result.authority).toBe("non-authoritative-exploratory");
    expect(result.mismatches.map((mismatch) => mismatch.id)).toContain("manifest");
  });

  it("blocks authoritative locked-test benchmark runs before runner execution", async () => {
    const corruptPath = await writeCorruptFreezeRecord();
    const outputDirectory = await mkdtemp(join(tmpdir(), "trace-benchmark-blocked-"));
    const outputFilesBeforeRun = await readFile(corruptPath, "utf8");

    await expect(
      runBenchmark(
        {
          command: "benchmark",
          partition: "locked-test",
          runner: "baseline-a",
          out: outputDirectory,
          freeze: corruptPath,
          runId: "blocked-locked-test-run"
        },
        {
          runner: () => {
            throw new Error("Runner should not execute when freeze validation fails");
          }
        }
      )
    ).rejects.toThrow(BenchmarkFreezeValidationError);
    await expect(readFile(corruptPath, "utf8")).resolves.toBe(outputFilesBeforeRun);
  });
});
