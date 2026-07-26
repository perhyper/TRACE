import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  loadBenchmarkManifestFromJsonFile,
  type BenchmarkManifest,
  type ScoredBenchmarkCase
} from "../src/benchmark/manifest.js";
import type { EvidenceRecord } from "../src/domain/schemas.js";
import {
  normalizeEvidenceBundle,
  parseEvidenceBundleJson,
  type EvidenceBundle
} from "../src/providers/evidence-bundle.js";

const manifestPath = join(process.cwd(), "eval", "benchmark-manifest.json");
const evidenceDirectory = join(process.cwd(), "fixtures", "evidence", "benchmark", "locked-test");
const annotationDirectory = join(process.cwd(), "eval", "benchmark", "annotations", "locked-test");
const rawSourceExtensions = new Set([
  ".csv",
  ".doc",
  ".docx",
  ".htm",
  ".html",
  ".jpeg",
  ".jpg",
  ".pdf",
  ".png",
  ".rtf",
  ".xls",
  ".xlsx"
]);

const nonEmptyStringSchema = z.string().trim().min(1);
const evidenceIdsSchema = z.array(nonEmptyStringSchema).min(1);
const sourceAvailabilitySchema = z.enum([
  "cutoff-input-visible",
  "post-cutoff-excluded",
  "post-cutoff-gold-only"
]);

const claimEvidenceUseSchema = z
  .object({
    id: nonEmptyStringSchema,
    statement: nonEmptyStringSchema,
    evidenceIds: evidenceIdsSchema,
    sourceAvailability: sourceAvailabilitySchema.optional()
  })
  .loose();

const describedEvidenceUseSchema = z
  .object({
    id: nonEmptyStringSchema,
    description: nonEmptyStringSchema,
    evidenceIds: evidenceIdsSchema,
    sourceAvailability: sourceAvailabilitySchema.optional()
  })
  .loose();

const lockedTestAnnotationSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-annotation.v1"),
    caseId: nonEmptyStringSchema,
    partition: z.literal("locked-test"),
    measurementDate: nonEmptyStringSchema,
    expectedRoute: z
      .object({
        route: nonEmptyStringSchema,
        acceptableAlternativeRoutes: z.array(nonEmptyStringSchema),
        evidenceIds: evidenceIdsSchema,
        rationale: nonEmptyStringSchema
      })
      .strict(),
    binaryClaims: z.array(claimEvidenceUseSchema).min(1),
    observableClaims: z.array(claimEvidenceUseSchema).min(1),
    expectedAbstentions: z.array(describedEvidenceUseSchema).min(1),
    valuationSeparationExpectations: z
      .object({
        allowedValuationFields: z.array(nonEmptyStringSchema),
        mustNotConflate: z.array(nonEmptyStringSchema).min(1),
        notes: nonEmptyStringSchema
      })
      .strict(),
    completenessExpectations: z
      .array(
        describedEvidenceUseSchema.and(
          z
            .object({
              requiredEvidenceClasses: z.array(nonEmptyStringSchema).min(1),
              requiredTopics: z.array(nonEmptyStringSchema).min(1)
            })
            .loose()
        )
      )
      .min(1),
    historicalValuationTargets: z.discriminatedUnion("eligible", [
      z
        .object({
          eligible: z.literal(true),
          reason: nonEmptyStringSchema,
          targets: z
            .array(
              z
                .object({
                  id: nonEmptyStringSchema,
                  eligibleField: nonEmptyStringSchema,
                  targetDate: nonEmptyStringSchema,
                  targetKind: nonEmptyStringSchema,
                  expectedValue: z.unknown(),
                  unit: nonEmptyStringSchema,
                  sourceEvidenceIds: evidenceIdsSchema,
                  sourceAvailability: sourceAvailabilitySchema,
                  scoringNotes: nonEmptyStringSchema
                })
                .strict()
            )
            .min(1)
        })
        .strict(),
      z
        .object({
          eligible: z.literal(false),
          reason: nonEmptyStringSchema,
          targets: z.array(z.unknown()).length(0)
        })
        .strict()
    ])
  })
  .strict();

type LockedTestAnnotation = z.infer<typeof lockedTestAnnotationSchema>;
type SourceAvailability = z.infer<typeof sourceAvailabilitySchema>;

interface EvidenceUseForAlignment {
  readonly evidenceIds: readonly string[];
  readonly sourceAvailability?: SourceAvailability | undefined;
}

async function loadManifest(): Promise<BenchmarkManifest> {
  return loadBenchmarkManifestFromJsonFile(manifestPath);
}

function lockedTestCases(manifest: BenchmarkManifest): ScoredBenchmarkCase[] {
  return manifest.scoredCases
    .filter((caseEntry) => caseEntry.partition === "locked-test")
    .sort((left, right) => compareStrings(left.caseId, right.caseId));
}

async function loadEvidenceBundle(caseId: string): Promise<EvidenceBundle> {
  const jsonText = await readFile(evidenceBundlePath(caseId), "utf8");

  return parseEvidenceBundleJson(jsonText);
}

async function loadAnnotation(caseId: string): Promise<LockedTestAnnotation> {
  const jsonText = await readFile(annotationPath(caseId), "utf8");
  const parsed: unknown = JSON.parse(jsonText);

  return lockedTestAnnotationSchema.parse(parsed);
}

function evidenceBundlePath(caseId: string): string {
  return join(evidenceDirectory, `${caseId}-evidence-bundle.json`);
}

function annotationPath(caseId: string): string {
  return join(annotationDirectory, `${caseId}-annotation.json`);
}

function expectedEvidenceFileNames(cases: readonly ScoredBenchmarkCase[]): string[] {
  return cases.map((caseEntry) => `${caseEntry.caseId}-evidence-bundle.json`).sort(compareStrings);
}

function expectedAnnotationFileNames(cases: readonly ScoredBenchmarkCase[]): string[] {
  return cases.map((caseEntry) => `${caseEntry.caseId}-annotation.json`).sort(compareStrings);
}

function eligibleSourceRecordIds(bundle: EvidenceBundle): Set<string> {
  return new Set(
    bundle.sourceRecords
      .filter((record) => record.publishedDate === undefined || record.publishedDate <= bundle.measurementDate)
      .map((record) => record.id)
  );
}

function allSourceRecordIds(bundle: EvidenceBundle): Set<string> {
  return new Set(bundle.sourceRecords.map((record) => record.id));
}

function evidenceUses(annotation: LockedTestAnnotation): EvidenceUseForAlignment[] {
  return [
    ...annotation.binaryClaims,
    ...annotation.observableClaims,
    ...annotation.expectedAbstentions,
    ...annotation.completenessExpectations
  ];
}

function historicalTargetEvidenceUses(
  annotation: LockedTestAnnotation
): EvidenceUseForAlignment[] {
  if (!annotation.historicalValuationTargets.eligible) {
    return [];
  }

  return annotation.historicalValuationTargets.targets.map((target) => ({
    evidenceIds: target.sourceEvidenceIds,
    sourceAvailability: target.sourceAvailability
  }));
}

function expectCutoffCompliantEvidenceRecord(
  record: EvidenceRecord,
  measurementDate: string
): void {
  if (record.publishedDate !== undefined) {
    expect(record.publishedDate <= measurementDate).toBe(true);
  }

  if (record.effectiveDate !== undefined) {
    expect(record.effectiveDate <= measurementDate).toBe(true);
  }
}

function expectUnique(values: readonly string[], label: string): void {
  expect(values, label).toHaveLength(new Set(values).size);
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = join(root, entry.name);

      if (entry.isDirectory()) {
        return listFiles(entryPath);
      }

      return [entryPath];
    })
  );

  return nestedFiles.flat().sort(compareStrings);
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

describe("locked-test benchmark fixtures", () => {
  it("adds one evidence bundle and one annotation for every locked-test case", async () => {
    const manifest = await loadManifest();
    const cases = lockedTestCases(manifest);
    const evidenceFiles = (await readdir(evidenceDirectory)).sort(compareStrings);
    const annotationFiles = (await readdir(annotationDirectory)).sort(compareStrings);

    expect(cases).toHaveLength(6);
    expect(evidenceFiles).toEqual(expectedEvidenceFileNames(cases));
    expect(annotationFiles).toEqual(expectedAnnotationFileNames(cases));
  });

  it("keeps required outcome contexts covered across the full scored set", async () => {
    const manifest = await loadManifest();
    const outcomeContexts = new Set(
      manifest.scoredCases.map((caseEntry) => caseEntry.outcomeContext.label)
    );

    for (const requiredOutcomeContext of manifest.coverageRequirements.requiredOutcomeContexts) {
      expect(outcomeContexts.has(requiredOutcomeContext)).toBe(true);
    }
  });

  it("keeps locked-test evidence cutoff-audited, source-class approved, and dedupe annotated", async () => {
    const manifest = await loadManifest();

    for (const caseEntry of lockedTestCases(manifest)) {
      const bundle = await loadEvidenceBundle(caseEntry.caseId);
      const ledger = normalizeEvidenceBundle(bundle);
      const approvedSourceClasses = new Set(caseEntry.sourceAudit.approvedPublicSourceCategories);
      const hasPostCutoffRecord = bundle.sourceRecords.some(
        (record) => record.publishedDate !== undefined && record.publishedDate > bundle.measurementDate
      );

      expect(bundle.target.legalName).toBe(caseEntry.companyLegalName);
      expect(bundle.measurementDate).toBe(caseEntry.measurementDate);
      expect(bundle.sourceRecords.length).toBeGreaterThanOrEqual(2);
      expectUnique(
        bundle.sourceRecords.map((record) => record.id),
        `${caseEntry.caseId} source record ids`
      );

      for (const sourceRecord of bundle.sourceRecords) {
        expect(approvedSourceClasses.has(sourceRecord.sourceClass)).toBe(true);
        expect(sourceRecord.shortExcerpt.length).toBeGreaterThan(20);
        expect(sourceRecord.originatingSource).toBeDefined();
        expect(sourceRecord.originatingSource?.sourceUrl).toBeTruthy();
        expect(sourceRecord.observedFacts.length).toBeGreaterThan(0);
        expectUnique(
          sourceRecord.observedFacts.map((fact) => fact.id),
          `${sourceRecord.id} observed fact ids`
        );

        for (const fact of sourceRecord.observedFacts) {
          expect(fact.id).toMatch(/^[a-z0-9-]+$/u);
          expect(fact.epistemicClass).toBeDefined();
        }
      }

      for (const evidenceRecord of ledger.evidence) {
        expectCutoffCompliantEvidenceRecord(evidenceRecord, bundle.measurementDate);
      }

      for (const excludedRecord of ledger.excludedRecords) {
        expect(excludedRecord.publishedDate > bundle.measurementDate).toBe(true);
      }

      if (hasPostCutoffRecord) {
        expect(ledger.excludedRecords.length).toBeGreaterThan(0);
        expect(
          ledger.warnings.some((warning) => warning.code === "published-after-measurement-date")
        ).toBe(true);
      }
    }
  });

  it("keeps locked-test annotations aligned with manifest cases and evidence ids", async () => {
    const manifest = await loadManifest();

    for (const caseEntry of lockedTestCases(manifest)) {
      const bundle = await loadEvidenceBundle(caseEntry.caseId);
      const annotation = await loadAnnotation(caseEntry.caseId);
      const allRecordIds = allSourceRecordIds(bundle);
      const eligibleRecordIds = eligibleSourceRecordIds(bundle);

      expect(annotation.caseId).toBe(caseEntry.caseId);
      expect(annotation.measurementDate).toBe(caseEntry.measurementDate);
      expect(annotation.expectedRoute.route).toBe(caseEntry.sectorRoute);
      expect(annotation.historicalValuationTargets.eligible).toBe(
        caseEntry.valuationErrorEligibility.eligible
      );

      for (const evidenceId of annotation.expectedRoute.evidenceIds) {
        expect(eligibleRecordIds.has(evidenceId)).toBe(true);
      }

      for (const use of evidenceUses(annotation)) {
        for (const evidenceId of use.evidenceIds) {
          expect(allRecordIds.has(evidenceId)).toBe(true);

          if (use.sourceAvailability !== "post-cutoff-excluded") {
            expect(eligibleRecordIds.has(evidenceId)).toBe(true);
          }
        }
      }

      const historicalValuationTargets = annotation.historicalValuationTargets;

      if (caseEntry.valuationErrorEligibility.eligible) {
        if (!historicalValuationTargets.eligible) {
          throw new Error(`Expected ${caseEntry.caseId} to include historical targets`);
        }

        expect(historicalValuationTargets.eligible).toBe(true);
        const eligibleFields = new Set(caseEntry.valuationErrorEligibility.eligibleFields);

        for (const target of historicalValuationTargets.targets) {
          expect(eligibleFields.has(target.eligibleField)).toBe(true);
        }
      } else {
        if (historicalValuationTargets.eligible) {
          throw new Error(`Expected ${caseEntry.caseId} to be historical-target ineligible`);
        }

        expect(historicalValuationTargets.eligible).toBe(false);
        expect(historicalValuationTargets.reason.length).toBeGreaterThan(20);
        expect(historicalValuationTargets.targets).toHaveLength(0);
      }

      for (const targetUse of historicalTargetEvidenceUses(annotation)) {
        for (const evidenceId of targetUse.evidenceIds) {
          expect(allRecordIds.has(evidenceId)).toBe(true);

          if (targetUse.sourceAvailability === "cutoff-input-visible") {
            expect(eligibleRecordIds.has(evidenceId)).toBe(true);
          }
        }
      }
    }
  });

  it("commits locked-test sources only as JSON metadata and short excerpts", async () => {
    const lockedFixtureFiles = await listFiles(evidenceDirectory);
    const lockedAnnotationFiles = await listFiles(annotationDirectory);

    for (const filePath of [...lockedFixtureFiles, ...lockedAnnotationFiles]) {
      expect(filePath.endsWith(".json")).toBe(true);
      expect(rawSourceExtensions.has(extname(filePath))).toBe(false);
    }
  });
});
