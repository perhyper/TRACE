import { join } from "node:path";

import { ZodError } from "zod";
import { describe, expect, it } from "vitest";

import {
  loadBenchmarkManifestFromJsonFile,
  summarizeBenchmarkManifest,
  validateBenchmarkManifest
} from "../src/benchmark/manifest.js";
import type { BenchmarkManifest, ScoredBenchmarkCase } from "../src/benchmark/manifest.js";
import { runValidateBenchmarkManifest } from "../src/commands/validate-benchmark-manifest.js";

const manifestPath = join(process.cwd(), "eval", "benchmark-manifest.json");
const stableCaseIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}$/u;

async function loadLockedManifest(): Promise<BenchmarkManifest> {
  return loadBenchmarkManifestFromJsonFile(manifestPath);
}

function firstLockedTestCase(manifest: BenchmarkManifest): ScoredBenchmarkCase {
  const caseEntry = manifest.scoredCases.find(
    (candidate) => candidate.partition === "locked-test"
  );

  if (caseEntry === undefined) {
    throw new Error("Expected at least one locked-test case");
  }

  return caseEntry;
}

function firstTwoScoredCases(
  manifest: BenchmarkManifest
): readonly [ScoredBenchmarkCase, ScoredBenchmarkCase] {
  const firstCase = manifest.scoredCases[0];
  const secondCase = manifest.scoredCases[1];

  if (firstCase === undefined || secondCase === undefined) {
    throw new Error("Expected at least two scored cases");
  }

  return [firstCase, secondCase];
}

function replaceScoredCase(
  manifest: BenchmarkManifest,
  caseId: string,
  replacement: unknown
): unknown {
  return {
    ...manifest,
    scoredCases: manifest.scoredCases.map((caseEntry) =>
      caseEntry.caseId === caseId ? replacement : caseEntry
    )
  };
}

describe("benchmark manifest validation", () => {
  it("loads the frozen manifest through the reusable helper", async () => {
    const manifest = await loadLockedManifest();
    const summary = summarizeBenchmarkManifest(manifest);

    expect(summary).toMatchObject({
      lockId: "trace-internal-benchmark-lock-2026-07-26-v1",
      schemaVersion: "trace.benchmark-manifest.v1",
      status: "frozen",
      demoCaseCount: 1,
      scoredCaseCount: 12,
      partitionCounts: {
        development: 6,
        "locked-test": 6
      },
      dataTierCounts: {
        rich: 4,
        medium: 4,
        sparse: 4
      }
    });
  });

  it("keeps Revolut as a non-scored demo case", async () => {
    const manifest = await loadLockedManifest();
    const demoCase = manifest.demoCases[0];

    expect(manifest.demoCases).toHaveLength(1);
    expect(demoCase).toBeDefined();
    expect(demoCase?.companyLegalName).toBe("Revolut Group Holdings Ltd");
    expect(demoCase?.scoringRole).toBe("demo");
    expect(demoCase?.countedInScoring).toBe(false);
    expect(demoCase?.partition).toBe("demo");
    expect(
      manifest.scoredCases.some(
        (caseEntry) => caseEntry.companyLegalName === "Revolut Group Holdings Ltd"
      )
    ).toBe(false);
  });

  it("enforces scored count, tier balance, sectors, stable ids, and source audits", async () => {
    const manifest = await loadLockedManifest();
    const summary = summarizeBenchmarkManifest(manifest);

    expect(summary.scoredCaseCount).toBe(12);
    expect(summary.dataTierCounts).toEqual({
      rich: 4,
      medium: 4,
      sparse: 4
    });
    expect(summary.sectorRoutes).toEqual(
      expect.arrayContaining(["biotech-rnpv", "financial-services", "software-saas"])
    );
    expect(summary.caseIds).toHaveLength(new Set(summary.caseIds).size);

    for (const caseId of summary.caseIds) {
      expect(caseId).toMatch(stableCaseIdPattern);
    }

    for (const caseEntry of [...manifest.demoCases, ...manifest.scoredCases]) {
      expect(caseEntry.measurementDate).toMatch(/^\d{4}-\d{2}-\d{2}$/u);
      expect(caseEntry.sourceAudit.cutoffDate).toBe(caseEntry.measurementDate);
      expect(caseEntry.sourceAudit.approvedPublicSourceCategories.length).toBeGreaterThan(0);
      expect(caseEntry.sourceAudit.knownPostCutoffLeakageRisks.length).toBeGreaterThan(0);
      expect(caseEntry.sourceAudit.redistributionStatus).toBe(
        "public-urls-redistribution-not-established"
      );
      expect(caseEntry.sourceAudit.onlyUrlsAndShortExcerptsMayBeCommitted).toBe(true);
    }
  });

  it("rejects duplicate case ids", async () => {
    const manifest = await loadLockedManifest();
    const [firstCase, secondCase] = firstTwoScoredCases(manifest);
    const invalidManifest = {
      ...manifest,
      scoredCases: [
        firstCase,
        {
          ...secondCase,
          caseId: firstCase.caseId
        },
        ...manifest.scoredCases.slice(2)
      ]
    };

    expect(() => validateBenchmarkManifest(invalidManifest)).toThrow(ZodError);
  });

  it("rejects invalid manifest and cutoff dates", async () => {
    const manifest = await loadLockedManifest();
    const [firstCase] = firstTwoScoredCases(manifest);

    expect(() =>
      validateBenchmarkManifest({
        ...manifest,
        lockDate: "2026-02-30"
      })
    ).toThrow(ZodError);

    expect(() =>
      validateBenchmarkManifest(
        replaceScoredCase(manifest, firstCase.caseId, {
          ...firstCase,
          sourceAudit: {
            ...firstCase.sourceAudit,
            cutoffDate: "2025-02-30"
          }
        })
      )
    ).toThrow(ZodError);
  });

  it("rejects locked-test cases missing outcome context", async () => {
    const manifest = await loadLockedManifest();
    const lockedCase = firstLockedTestCase(manifest);
    const { outcomeContext, ...lockedCaseWithoutOutcomeContext } = lockedCase;

    expect(outcomeContext).toBeDefined();
    expect(() =>
      validateBenchmarkManifest(
        replaceScoredCase(manifest, lockedCase.caseId, lockedCaseWithoutOutcomeContext)
      )
    ).toThrow(ZodError);
  });

  it("rejects locked-test cases missing valuation eligibility", async () => {
    const manifest = await loadLockedManifest();
    const lockedCase = firstLockedTestCase(manifest);
    const { valuationErrorEligibility, ...lockedCaseWithoutValuationEligibility } = lockedCase;

    expect(valuationErrorEligibility).toBeDefined();
    expect(() =>
      validateBenchmarkManifest(
        replaceScoredCase(manifest, lockedCase.caseId, lockedCaseWithoutValuationEligibility)
      )
    ).toThrow(ZodError);
  });

  it("rejects locked-test cases missing redistribution status", async () => {
    const manifest = await loadLockedManifest();
    const lockedCase = firstLockedTestCase(manifest);
    const { redistributionStatus, ...sourceAuditWithoutRedistributionStatus } =
      lockedCase.sourceAudit;

    expect(redistributionStatus).toBeDefined();
    expect(() =>
      validateBenchmarkManifest(
        replaceScoredCase(manifest, lockedCase.caseId, {
          ...lockedCase,
          sourceAudit: sourceAuditWithoutRedistributionStatus
        })
      )
    ).toThrow(ZodError);
  });

  it("exposes a lightweight manifest validation command", async () => {
    const result = await runValidateBenchmarkManifest({
      command: "validate-benchmark-manifest",
      manifest: manifestPath
    });

    expect(result.status).toBe("valid");
    expect(result.summary.scoredCaseCount).toBe(12);
    expect(result.summary.demoCaseCount).toBe(1);
  });
});
