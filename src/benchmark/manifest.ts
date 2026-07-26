import { readFile } from "node:fs/promises";

import { z } from "zod";

import {
  analysisRouteSchema,
  isoDateSchema,
  sourceClassSchema
} from "../domain/schemas.js";
import type { AnalysisRoute } from "../domain/schemas.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const stableCaseIdSchema = z
  .string()
  .max(120)
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}$/u,
    "Expected a stable lowercase hyphenated case id ending in a four-digit year"
  );
const benchmarkVersionPattern = /^trace-internal-benchmark-lock-\d{4}-\d{2}-\d{2}-v\d+$/u;

const requiredScoredCaseCount = 12;
const requiredDemoCaseCount = 1;
const requiredPartitionCounts = {
  development: 6,
  "locked-test": 6
} as const;
const requiredDataTierCounts = {
  rich: 4,
  medium: 4,
  sparse: 4
} as const;
const requiredSectorRoutes = [
  "financial-services",
  "software-saas",
  "biotech-rnpv"
] as const;
const requiredOutcomeContexts = ["success", "failure", "stagnant", "ongoing"] as const;

export const benchmarkPartitionSchema = z.enum(["development", "locked-test"]);
export const benchmarkDataTierSchema = z.enum(["rich", "medium", "sparse"]);
export const scoredOutcomeContextLabelSchema = z.enum([
  "success",
  "failure",
  "stagnant",
  "ongoing"
]);
export const redistributionStatusSchema = z.enum([
  "public-urls-redistribution-not-established",
  "public-domain",
  "redistribution-permitted",
  "licensed-for-redistribution",
  "redistribution-prohibited"
]);

const manifestIdentifierTypeSchema = z.enum([
  "AU_ABN",
  "AU_ACN",
  "GB_COMPANIES_HOUSE",
  "LEI",
  "SEC_CIK",
  "US_DELAWARE_ENTITY_ID",
  "OTHER"
]);

const manifestIdentifierSchema = z
  .object({
    type: manifestIdentifierTypeSchema,
    value: nonEmptyStringSchema.max(120),
    note: nonEmptyStringSchema.max(500).optional()
  })
  .strict();

const sourceAuditSchema = z
  .object({
    approvedPublicSourceCategories: z.array(sourceClassSchema).min(1),
    cutoffDate: isoDateSchema,
    knownPostCutoffLeakageRisks: z.array(nonEmptyStringSchema.max(1_000)).min(1),
    redistributionStatus: redistributionStatusSchema,
    rawDocumentPolicy: nonEmptyStringSchema.max(1_000),
    onlyUrlsAndShortExcerptsMayBeCommitted: z.boolean()
  })
  .strict()
  .superRefine((audit, context) => {
    addDuplicateIssue(
      audit.approvedPublicSourceCategories,
      context,
      ["approvedPublicSourceCategories"],
      "approved public source category"
    );
  });

const scoredOutcomeContextSchema = z
  .object({
    label: scoredOutcomeContextLabelSchema,
    summary: nonEmptyStringSchema.max(1_000)
  })
  .strict();

const demoOutcomeContextSchema = z
  .object({
    label: z.literal("demo"),
    summary: nonEmptyStringSchema.max(1_000)
  })
  .strict();

const valuationErrorEligibilitySchema = z.discriminatedUnion("eligible", [
  z
    .object({
      eligible: z.literal(true),
      eligibleFields: z.array(nonEmptyStringSchema.max(120)).min(1),
      reason: nonEmptyStringSchema.max(1_000)
    })
    .strict()
    .superRefine((eligibility, context) => {
      addDuplicateIssue(eligibility.eligibleFields, context, ["eligibleFields"], "eligible field");
    }),
  z
    .object({
      eligible: z.literal(false),
      eligibleFields: z.never().optional(),
      reason: nonEmptyStringSchema.max(1_000)
    })
    .strict()
]);

const benchmarkCaseCommonSchema = z
  .object({
    caseId: stableCaseIdSchema,
    companyLegalName: nonEmptyStringSchema.max(240),
    identifiers: z.array(manifestIdentifierSchema),
    identifierNotes: nonEmptyStringSchema.max(500).optional(),
    sectorRoute: analysisRouteSchema,
    dataTier: benchmarkDataTierSchema,
    measurementDate: isoDateSchema,
    valuationErrorEligibility: valuationErrorEligibilitySchema,
    sourceAudit: sourceAuditSchema
  })
  .strict();

export const demoBenchmarkCaseSchema = benchmarkCaseCommonSchema
  .extend({
    scoringRole: z.literal("demo"),
    countedInScoring: z.literal(false),
    partition: z.literal("demo"),
    purpose: nonEmptyStringSchema.max(500),
    outcomeContext: demoOutcomeContextSchema
  })
  .strict()
  .superRefine(validateCaseAudit);

export const scoredBenchmarkCaseSchema = benchmarkCaseCommonSchema
  .extend({
    scoringRole: z.literal("scored"),
    countedInScoring: z.literal(true),
    partition: benchmarkPartitionSchema,
    outcomeContext: scoredOutcomeContextSchema
  })
  .strict()
  .superRefine(validateCaseAudit);

const authorityBoundarySchema = z
  .object({
    benchmarkAuthority: nonEmptyStringSchema.max(500),
    officialContestRulesStatus: z.enum(["not-supplied", "partially-supplied", "supplied"]),
    contestComplianceClaimAllowed: z.literal(false),
    missingOfficialRulesHandling: nonEmptyStringSchema.max(500),
    prohibitedClaims: z.array(nonEmptyStringSchema.max(120)).min(1)
  })
  .strict()
  .superRefine((authorityBoundary, context) => {
    addDuplicateIssue(authorityBoundary.prohibitedClaims, context, ["prohibitedClaims"], "prohibited claim");
  });

const caseSelectionPolicySchema = z
  .object({
    sourceSlate: nonEmptyStringSchema.max(500),
    scoreInspectionStatusAtLock: nonEmptyStringSchema.max(1_000),
    demoCasePolicy: nonEmptyStringSchema.max(500)
  })
  .strict();

const coverageRequirementsSchema = z
  .object({
    scoredCaseCount: z.number().int().positive(),
    demoCaseCount: z.number().int().positive(),
    partitionCounts: z
      .object({
        development: z.number().int().nonnegative(),
        "locked-test": z.number().int().nonnegative()
      })
      .strict(),
    dataTierCounts: z
      .object({
        rich: z.number().int().nonnegative(),
        medium: z.number().int().nonnegative(),
        sparse: z.number().int().nonnegative()
      })
      .strict(),
    requiredSectorRoutes: z.array(analysisRouteSchema).min(1),
    requiredOutcomeContexts: z.array(scoredOutcomeContextLabelSchema).min(1)
  })
  .strict()
  .superRefine((requirements, context) => {
    addDuplicateIssue(
      requirements.requiredSectorRoutes,
      context,
      ["requiredSectorRoutes"],
      "required sector route"
    );
    addDuplicateIssue(
      requirements.requiredOutcomeContexts,
      context,
      ["requiredOutcomeContexts"],
      "required outcome context"
    );
  });

export const benchmarkManifestSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-manifest.v1"),
    lockId: nonEmptyStringSchema.max(120).regex(benchmarkVersionPattern),
    status: z.literal("frozen"),
    frozen: z.literal(true),
    lockDate: isoDateSchema,
    purpose: z.literal("internal-product-validation-benchmark"),
    primaryMetric: z.literal("evidence-supported-claim-precision"),
    authorityBoundary: authorityBoundarySchema,
    caseSelectionPolicy: caseSelectionPolicySchema,
    coverageRequirements: coverageRequirementsSchema,
    demoCases: z.array(demoBenchmarkCaseSchema),
    scoredCases: z.array(scoredBenchmarkCaseSchema)
  })
  .strict()
  .superRefine(validateManifestConstraints);

export type BenchmarkPartition = z.infer<typeof benchmarkPartitionSchema>;
export type BenchmarkDataTier = z.infer<typeof benchmarkDataTierSchema>;
export type ScoredOutcomeContextLabel = z.infer<typeof scoredOutcomeContextLabelSchema>;
export type RedistributionStatus = z.infer<typeof redistributionStatusSchema>;
export type ManifestIdentifier = z.infer<typeof manifestIdentifierSchema>;
export type SourceAudit = z.infer<typeof sourceAuditSchema>;
export type ValuationErrorEligibility = z.infer<typeof valuationErrorEligibilitySchema>;
export type DemoBenchmarkCase = z.infer<typeof demoBenchmarkCaseSchema>;
export type ScoredBenchmarkCase = z.infer<typeof scoredBenchmarkCaseSchema>;
export type BenchmarkManifest = z.infer<typeof benchmarkManifestSchema>;

export interface BenchmarkManifestSummary {
  readonly lockId: string;
  readonly schemaVersion: "trace.benchmark-manifest.v1";
  readonly status: "frozen";
  readonly demoCaseCount: number;
  readonly scoredCaseCount: number;
  readonly partitionCounts: Readonly<Record<BenchmarkPartition, number>>;
  readonly dataTierCounts: Readonly<Record<BenchmarkDataTier, number>>;
  readonly sectorRoutes: readonly AnalysisRoute[];
  readonly outcomeContexts: readonly ScoredOutcomeContextLabel[];
  readonly caseIds: readonly string[];
}

export class BenchmarkManifestJsonError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BenchmarkManifestJsonError";
  }
}

export function parseBenchmarkManifestJson(jsonText: string): BenchmarkManifest {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new BenchmarkManifestJsonError(`Invalid benchmark manifest JSON: ${message}`);
  }

  return validateBenchmarkManifest(parsed);
}

export function validateBenchmarkManifest(input: unknown): BenchmarkManifest {
  return benchmarkManifestSchema.parse(input);
}

export async function loadBenchmarkManifestFromJsonFile(
  manifestPath: string
): Promise<BenchmarkManifest> {
  const jsonText = await readFile(manifestPath, "utf8");

  return parseBenchmarkManifestJson(jsonText);
}

export function summarizeBenchmarkManifest(manifest: BenchmarkManifest): BenchmarkManifestSummary {
  const scoredCases = manifest.scoredCases;

  return {
    lockId: manifest.lockId,
    schemaVersion: manifest.schemaVersion,
    status: manifest.status,
    demoCaseCount: manifest.demoCases.length,
    scoredCaseCount: scoredCases.length,
    partitionCounts: countPartitions(scoredCases),
    dataTierCounts: countDataTiers(scoredCases),
    sectorRoutes: uniqueSorted(scoredCases.map((caseEntry) => caseEntry.sectorRoute)),
    outcomeContexts: uniqueSorted(scoredCases.map((caseEntry) => caseEntry.outcomeContext.label)),
    caseIds: [...manifest.demoCases, ...scoredCases]
      .map((caseEntry) => caseEntry.caseId)
      .sort(compareStrings)
  };
}

function validateCaseAudit(
  caseEntry: DemoBenchmarkCase | ScoredBenchmarkCase,
  context: z.RefinementCtx
): void {
  if (caseEntry.sourceAudit.cutoffDate !== caseEntry.measurementDate) {
    context.addIssue({
      code: "custom",
      path: ["sourceAudit", "cutoffDate"],
      message: "Source audit cutoff date must match the case measurement date"
    });
  }

  if (caseEntry.identifiers.length === 0 && caseEntry.identifierNotes === undefined) {
    context.addIssue({
      code: "custom",
      path: ["identifierNotes"],
      message: "Cases without public identifiers must include identifier notes"
    });
  }
}

function validateManifestConstraints(manifest: BenchmarkManifest, context: z.RefinementCtx): void {
  const allCases = [...manifest.demoCases, ...manifest.scoredCases];
  const partitionCounts = countPartitions(manifest.scoredCases);
  const dataTierCounts = countDataTiers(manifest.scoredCases);
  const sectorRoutes = new Set(manifest.scoredCases.map((caseEntry) => caseEntry.sectorRoute));
  const outcomeContexts = new Set(
    manifest.scoredCases.map((caseEntry) => caseEntry.outcomeContext.label)
  );

  addDuplicateIssue(
    allCases.map((caseEntry) => caseEntry.caseId),
    context,
    ["caseId"],
    "case id"
  );

  addExpectedCountIssue(
    manifest.coverageRequirements.scoredCaseCount,
    requiredScoredCaseCount,
    context,
    ["coverageRequirements", "scoredCaseCount"],
    "coverage scored case count"
  );
  addExpectedCountIssue(
    manifest.scoredCases.length,
    requiredScoredCaseCount,
    context,
    ["scoredCases"],
    "scored case count"
  );
  addExpectedCountIssue(
    manifest.coverageRequirements.demoCaseCount,
    requiredDemoCaseCount,
    context,
    ["coverageRequirements", "demoCaseCount"],
    "coverage demo case count"
  );
  addExpectedCountIssue(
    manifest.demoCases.length,
    requiredDemoCaseCount,
    context,
    ["demoCases"],
    "demo case count"
  );

  for (const partition of benchmarkPartitionSchema.options) {
    addExpectedCountIssue(
      manifest.coverageRequirements.partitionCounts[partition],
      requiredPartitionCounts[partition],
      context,
      ["coverageRequirements", "partitionCounts", partition],
      `${partition} coverage partition count`
    );
    addExpectedCountIssue(
      partitionCounts[partition],
      requiredPartitionCounts[partition],
      context,
      ["scoredCases", "partition", partition],
      `${partition} scored case count`
    );
  }

  for (const dataTier of benchmarkDataTierSchema.options) {
    addExpectedCountIssue(
      manifest.coverageRequirements.dataTierCounts[dataTier],
      requiredDataTierCounts[dataTier],
      context,
      ["coverageRequirements", "dataTierCounts", dataTier],
      `${dataTier} coverage data tier count`
    );
    addExpectedCountIssue(
      dataTierCounts[dataTier],
      requiredDataTierCounts[dataTier],
      context,
      ["scoredCases", "dataTier", dataTier],
      `${dataTier} scored case count`
    );
  }

  for (const sectorRoute of requiredSectorRoutes) {
    addRequiredValueIssue(
      manifest.coverageRequirements.requiredSectorRoutes,
      sectorRoute,
      context,
      ["coverageRequirements", "requiredSectorRoutes"],
      "required sector route"
    );

    if (!sectorRoutes.has(sectorRoute)) {
      context.addIssue({
        code: "custom",
        path: ["scoredCases"],
        message: `Missing required scored sector route: ${sectorRoute}`
      });
    }
  }

  for (const outcomeContext of requiredOutcomeContexts) {
    addRequiredValueIssue(
      manifest.coverageRequirements.requiredOutcomeContexts,
      outcomeContext,
      context,
      ["coverageRequirements", "requiredOutcomeContexts"],
      "required outcome context"
    );

    if (!outcomeContexts.has(outcomeContext)) {
      context.addIssue({
        code: "custom",
        path: ["scoredCases"],
        message: `Missing required scored outcome context: ${outcomeContext}`
      });
    }
  }
}

function countPartitions(
  scoredCases: readonly ScoredBenchmarkCase[]
): Record<BenchmarkPartition, number> {
  return {
    development: scoredCases.filter((caseEntry) => caseEntry.partition === "development").length,
    "locked-test": scoredCases.filter((caseEntry) => caseEntry.partition === "locked-test").length
  };
}

function countDataTiers(
  scoredCases: readonly ScoredBenchmarkCase[]
): Record<BenchmarkDataTier, number> {
  return {
    rich: scoredCases.filter((caseEntry) => caseEntry.dataTier === "rich").length,
    medium: scoredCases.filter((caseEntry) => caseEntry.dataTier === "medium").length,
    sparse: scoredCases.filter((caseEntry) => caseEntry.dataTier === "sparse").length
  };
}

function addExpectedCountIssue(
  actual: number,
  expected: number,
  context: z.RefinementCtx,
  path: Array<string | number>,
  label: string
): void {
  if (actual !== expected) {
    context.addIssue({
      code: "custom",
      path,
      message: `Expected ${label} to be ${String(expected)}, received ${String(actual)}`
    });
  }
}

function addRequiredValueIssue<T extends string>(
  values: readonly T[],
  expected: T,
  context: z.RefinementCtx,
  path: Array<string | number>,
  label: string
): void {
  if (!values.includes(expected)) {
    context.addIssue({
      code: "custom",
      path,
      message: `Missing ${label}: ${expected}`
    });
  }
}

function addDuplicateIssue(
  values: readonly string[],
  context: z.RefinementCtx,
  pathPrefix: Array<string | number>,
  label: string
): void {
  const seen = new Set<string>();

  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        path: [...pathPrefix, index],
        message: `Duplicate ${label}: ${value}`
      });
    }

    seen.add(value);
  }
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
