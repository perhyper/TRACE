import { readFile } from "node:fs/promises";

import { z } from "zod";

import {
  analysisRouteSchema,
  companyIdentitySchema,
  factPeriodSchema,
  factValueSchema,
  isoDateSchema,
  isoDateTimeSchema,
  sourceClassSchema,
  valuationFieldSchema
} from "../domain/schemas.js";
import {
  evidenceLedgerSchema
} from "../providers/evidence-bundle.js";
import {
  benchmarkDataTierSchema,
  benchmarkPartitionSchema,
  demoBenchmarkCaseSchema,
  redistributionStatusSchema,
  scoredBenchmarkCaseSchema
} from "./manifest.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const benchmarkIdSchema = nonEmptyStringSchema.max(160);
const evidenceIdSchema = nonEmptyStringSchema.max(120);
const caseIdSchema = nonEmptyStringSchema
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}$/u);
const pathSegmentSchema = nonEmptyStringSchema
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/u);

export const benchmarkRunnerNameSchema = z.enum([
  "baseline-a",
  "baseline-b",
  "trace-full"
]);

export const benchmarkCasePartitionSchema = z.enum([
  "development",
  "locked-test",
  "demo"
]);

export const benchmarkScoredOrAllPartitionSchema = z.enum([
  "development",
  "locked-test",
  "all"
]);

export const benchmarkSourceAvailabilitySchema = z.enum([
  "cutoff-input-visible",
  "post-cutoff-excluded",
  "post-cutoff-gold-only"
]);

export const benchmarkEvidenceIdsSchema = z
  .array(evidenceIdSchema)
  .min(1)
  .superRefine((ids, context) => {
    addDuplicateIssue(ids, context, [], "evidence id");
  });

export const benchmarkExpectedRouteSchema = z
  .object({
    route: analysisRouteSchema,
    acceptableAlternativeRoutes: z.array(analysisRouteSchema),
    evidenceIds: benchmarkEvidenceIdsSchema,
    rationale: nonEmptyStringSchema.max(1_500)
  })
  .strict()
  .superRefine((expectedRoute, context) => {
    addDuplicateIssue(
      expectedRoute.acceptableAlternativeRoutes,
      context,
      ["acceptableAlternativeRoutes"],
      "acceptable alternative route"
    );
  });

export const benchmarkExpectedBinaryClaimSchema = z
  .object({
    id: benchmarkIdSchema,
    statement: nonEmptyStringSchema.max(1_500),
    expectedValue: z.boolean(),
    evidenceIds: benchmarkEvidenceIdsSchema,
    sourceAvailability: benchmarkSourceAvailabilitySchema.optional()
  })
  .strict();

export const benchmarkExpectedObservableClaimSchema = z
  .object({
    id: benchmarkIdSchema,
    statement: nonEmptyStringSchema.max(1_500),
    expectedValue: factValueSchema,
    unit: nonEmptyStringSchema.max(120).optional(),
    period: factPeriodSchema.optional(),
    evidenceIds: benchmarkEvidenceIdsSchema,
    sourceAvailability: benchmarkSourceAvailabilitySchema.optional()
  })
  .strict();

export const benchmarkExpectedAbstentionSchema = z
  .object({
    id: benchmarkIdSchema,
    field: valuationFieldSchema,
    reasonCode: benchmarkIdSchema,
    description: nonEmptyStringSchema.max(1_500),
    evidenceIds: benchmarkEvidenceIdsSchema,
    sourceAvailability: benchmarkSourceAvailabilitySchema.optional()
  })
  .strict();

export const benchmarkValuationSeparationExpectationsSchema = z
  .object({
    allowedValuationFields: z.array(benchmarkIdSchema),
    mustNotConflate: z.array(nonEmptyStringSchema.max(500)).min(1),
    notes: nonEmptyStringSchema.max(1_500)
  })
  .strict()
  .superRefine((expectations, context) => {
    addDuplicateIssue(
      expectations.allowedValuationFields,
      context,
      ["allowedValuationFields"],
      "allowed valuation field"
    );
    addDuplicateIssue(
      expectations.mustNotConflate,
      context,
      ["mustNotConflate"],
      "valuation conflation guardrail"
    );
  });

export const benchmarkCompletenessExpectationSchema = z
  .object({
    id: benchmarkIdSchema,
    description: nonEmptyStringSchema.max(1_500),
    requiredEvidenceClasses: z.array(sourceClassSchema).min(1),
    requiredTopics: z.array(nonEmptyStringSchema.max(160)).min(1),
    evidenceIds: benchmarkEvidenceIdsSchema,
    sourceAvailability: benchmarkSourceAvailabilitySchema.optional()
  })
  .strict()
  .superRefine((expectation, context) => {
    addDuplicateIssue(
      expectation.requiredEvidenceClasses,
      context,
      ["requiredEvidenceClasses"],
      "required evidence class"
    );
    addDuplicateIssue(
      expectation.requiredTopics,
      context,
      ["requiredTopics"],
      "required topic"
    );
  });

export const benchmarkHistoricalValuationTargetSchema = z
  .object({
    id: benchmarkIdSchema,
    eligibleField: benchmarkIdSchema,
    targetDate: isoDateSchema,
    targetKind: benchmarkIdSchema,
    expectedValue: z.unknown(),
    unit: nonEmptyStringSchema.max(120),
    sourceEvidenceIds: benchmarkEvidenceIdsSchema,
    sourceAvailability: benchmarkSourceAvailabilitySchema,
    scoringNotes: nonEmptyStringSchema.max(1_500)
  })
  .strict();

export const benchmarkHistoricalValuationTargetsSchema = z.discriminatedUnion("eligible", [
  z
    .object({
      eligible: z.literal(true),
      reason: nonEmptyStringSchema.max(1_500),
      targets: z.array(benchmarkHistoricalValuationTargetSchema).min(1)
    })
    .strict()
    .superRefine((historicalTargets, context) => {
      addDuplicateIssue(
        historicalTargets.targets.map((target) => target.id),
        context,
        ["targets"],
        "historical valuation target id"
      );
    }),
  z
    .object({
      eligible: z.literal(false),
      reason: nonEmptyStringSchema.max(1_500),
      targets: z.array(z.never()).length(0)
    })
    .strict()
]);

export const benchmarkAnnotationSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-annotation.v1"),
    caseId: caseIdSchema,
    partition: benchmarkPartitionSchema,
    measurementDate: isoDateSchema,
    expectedRoute: benchmarkExpectedRouteSchema,
    binaryClaims: z.array(benchmarkExpectedBinaryClaimSchema).min(1),
    observableClaims: z.array(benchmarkExpectedObservableClaimSchema).min(1),
    expectedAbstentions: z.array(benchmarkExpectedAbstentionSchema).min(1),
    valuationSeparationExpectations: benchmarkValuationSeparationExpectationsSchema,
    completenessExpectations: z.array(benchmarkCompletenessExpectationSchema).min(1),
    historicalValuationTargets: benchmarkHistoricalValuationTargetsSchema
  })
  .strict()
  .superRefine((annotation, context) => {
    addDuplicateIssue(
      annotation.binaryClaims.map((claim) => claim.id),
      context,
      ["binaryClaims"],
      "binary claim id"
    );
    addDuplicateIssue(
      annotation.observableClaims.map((claim) => claim.id),
      context,
      ["observableClaims"],
      "observable claim id"
    );
    addDuplicateIssue(
      annotation.expectedAbstentions.map((abstention) => abstention.id),
      context,
      ["expectedAbstentions"],
      "expected abstention id"
    );
    addDuplicateIssue(
      annotation.completenessExpectations.map((expectation) => expectation.id),
      context,
      ["completenessExpectations"],
      "completeness expectation id"
    );
  });

export const benchmarkInputSourcePolicySchema = z
  .object({
    approvedPublicSourceCategories: z.array(sourceClassSchema).min(1),
    redistributionStatus: redistributionStatusSchema,
    rawDocumentPolicy: nonEmptyStringSchema.max(1_000),
    onlyUrlsAndShortExcerptsMayBeCommitted: z.boolean()
  })
  .strict()
  .superRefine((policy, context) => {
    addDuplicateIssue(
      policy.approvedPublicSourceCategories,
      context,
      ["approvedPublicSourceCategories"],
      "approved public source category"
    );
  });

export const benchmarkInputAuthorityBoundarySchema = z
  .object({
    benchmarkAuthority: nonEmptyStringSchema.max(500),
    officialContestRulesStatus: z.enum(["not-supplied", "partially-supplied", "supplied"]),
    contestComplianceClaimAllowed: z.literal(false),
    missingOfficialRulesHandling: nonEmptyStringSchema.max(500),
    prohibitedClaims: z.array(nonEmptyStringSchema.max(120)).min(1)
  })
  .strict()
  .superRefine((authorityBoundary, context) => {
    addDuplicateIssue(
      authorityBoundary.prohibitedClaims,
      context,
      ["prohibitedClaims"],
      "prohibited claim"
    );
  });

export const benchmarkCaseInputSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-case-input.v1"),
    manifestLockId: benchmarkIdSchema,
    manifestSchemaVersion: z.literal("trace.benchmark-manifest.v1"),
    caseId: caseIdSchema,
    partition: benchmarkCasePartitionSchema,
    scoringRole: z.enum(["scored", "demo"]),
    countedInScoring: z.boolean(),
    companyLegalName: nonEmptyStringSchema.max(240),
    target: companyIdentitySchema,
    measurementDate: isoDateSchema,
    cutoffDate: isoDateSchema,
    dataTier: benchmarkDataTierSchema,
    sourcePolicy: benchmarkInputSourcePolicySchema,
    authorityBoundary: benchmarkInputAuthorityBoundarySchema,
    sourceRecordIds: z.array(evidenceIdSchema).min(1),
    evidenceLedger: evidenceLedgerSchema
  })
  .strict()
  .superRefine((input, context) => {
    if (input.partition === "demo" && input.scoringRole !== "demo") {
      context.addIssue({
        code: "custom",
        path: ["scoringRole"],
        message: "Demo partition inputs must use the demo scoring role"
      });
    }

    if (input.partition !== "demo" && input.scoringRole !== "scored") {
      context.addIssue({
        code: "custom",
        path: ["scoringRole"],
        message: "Scored partition inputs must use the scored scoring role"
      });
    }

    if (input.countedInScoring !== (input.scoringRole === "scored")) {
      context.addIssue({
        code: "custom",
        path: ["countedInScoring"],
        message: "countedInScoring must match scoringRole"
      });
    }

    if (input.companyLegalName !== input.target.legalName) {
      context.addIssue({
        code: "custom",
        path: ["target", "legalName"],
        message: "Benchmark target legal name must match companyLegalName"
      });
    }

    if (input.cutoffDate !== input.measurementDate) {
      context.addIssue({
        code: "custom",
        path: ["cutoffDate"],
        message: "Benchmark cutoff date must match measurement date"
      });
    }

    if (input.evidenceLedger.measurementDate !== input.measurementDate) {
      context.addIssue({
        code: "custom",
        path: ["evidenceLedger", "measurementDate"],
        message: "Evidence ledger measurement date must match benchmark input"
      });
    }

    if (input.evidenceLedger.target.legalName !== input.target.legalName) {
      context.addIssue({
        code: "custom",
        path: ["evidenceLedger", "target", "legalName"],
        message: "Evidence ledger target must match benchmark input target"
      });
    }

    addDuplicateIssue(input.sourceRecordIds, context, ["sourceRecordIds"], "source record id");
  });

export const benchmarkScoredCaseReferenceSchema = z
  .object({
    kind: z.literal("scored"),
    manifestCase: scoredBenchmarkCaseSchema,
    annotation: benchmarkAnnotationSchema
  })
  .strict();

export const benchmarkDemoCaseReferenceSchema = z
  .object({
    kind: z.literal("demo"),
    manifestCase: demoBenchmarkCaseSchema,
    annotation: z.null()
  })
  .strict();

export const benchmarkCompiledCaseSchema = z
  .object({
    schemaVersion: z.literal("trace.compiled-benchmark-case.v1"),
    manifestLockId: benchmarkIdSchema,
    caseId: caseIdSchema,
    partition: benchmarkCasePartitionSchema,
    scoringRole: z.enum(["scored", "demo"]),
    runnerInput: benchmarkCaseInputSchema,
    scorerReference: z.discriminatedUnion("kind", [
      benchmarkScoredCaseReferenceSchema,
      benchmarkDemoCaseReferenceSchema
    ])
  })
  .strict()
  .superRefine((compiledCase, context) => {
    if (compiledCase.caseId !== compiledCase.runnerInput.caseId) {
      context.addIssue({
        code: "custom",
        path: ["runnerInput", "caseId"],
        message: "Compiled case id must match runner input case id"
      });
    }

    if (compiledCase.partition !== compiledCase.runnerInput.partition) {
      context.addIssue({
        code: "custom",
        path: ["runnerInput", "partition"],
        message: "Compiled partition must match runner input partition"
      });
    }

    if (compiledCase.scoringRole !== compiledCase.runnerInput.scoringRole) {
      context.addIssue({
        code: "custom",
        path: ["runnerInput", "scoringRole"],
        message: "Compiled scoring role must match runner input scoring role"
      });
    }

    if (compiledCase.scorerReference.manifestCase.caseId !== compiledCase.caseId) {
      context.addIssue({
        code: "custom",
        path: ["scorerReference", "manifestCase", "caseId"],
        message: "Compiled case id must match referenced manifest case"
      });
    }

    if (compiledCase.scorerReference.kind !== compiledCase.scoringRole) {
      context.addIssue({
        code: "custom",
        path: ["scorerReference", "kind"],
        message: "Scorer reference kind must match compiled scoring role"
      });
    }

    if (compiledCase.scorerReference.kind === "scored") {
      if (compiledCase.scorerReference.annotation.caseId !== compiledCase.caseId) {
        context.addIssue({
          code: "custom",
          path: ["scorerReference", "annotation", "caseId"],
          message: "Compiled case id must match annotation case id"
        });
      }

      if (compiledCase.scorerReference.annotation.partition !== compiledCase.partition) {
        context.addIssue({
          code: "custom",
          path: ["scorerReference", "annotation", "partition"],
          message: "Compiled partition must match annotation partition"
        });
      }
    }
  });

export const benchmarkFailureRecordSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-failure.v1"),
    failureId: benchmarkIdSchema,
    stage: z.enum([
      "input-compile",
      "runner",
      "normalization",
      "scoring",
      "aggregation",
      "artifact-write"
    ]),
    severity: z.enum(["warning", "recoverable", "fatal"]),
    message: nonEmptyStringSchema.max(2_000),
    retryable: z.boolean(),
    runId: pathSegmentSchema.optional(),
    runnerName: benchmarkRunnerNameSchema.optional(),
    caseId: caseIdSchema.optional(),
    partition: benchmarkCasePartitionSchema.optional(),
    occurredAt: isoDateTimeSchema.optional(),
    details: z.record(z.string(), z.unknown()).optional()
  })
  .strict();

export const benchmarkTimingMetadataSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-timing.v1"),
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional(),
    durationMs: z.number().int().nonnegative().optional()
  })
  .strict();

export const benchmarkRawRunnerOutputSchema = z
  .object({
    markdown: z.string().optional(),
    json: z.unknown().optional(),
    text: z.string().optional()
  })
  .strict()
  .superRefine((output, context) => {
    if (output.markdown === undefined && output.json === undefined && output.text === undefined) {
      context.addIssue({
        code: "custom",
        message: "At least one raw runner output representation is required"
      });
    }
  });

export const benchmarkCitationSchema = z
  .object({
    evidenceId: evidenceIdSchema,
    factId: evidenceIdSchema.optional(),
    locator: nonEmptyStringSchema.max(160).optional()
  })
  .strict();

export const benchmarkEmittedClaimSchema = z
  .object({
    id: benchmarkIdSchema,
    kind: z.enum(["binary", "observable", "valuation", "route", "abstention", "other"]),
    statement: nonEmptyStringSchema.max(2_000),
    value: factValueSchema.optional(),
    unit: nonEmptyStringSchema.max(120).optional(),
    period: factPeriodSchema.optional(),
    citations: z.array(benchmarkCitationSchema)
  })
  .strict();

export const benchmarkEmittedRouteSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("selected"),
      selectedRoute: analysisRouteSchema,
      rationale: nonEmptyStringSchema.max(1_500),
      evidenceIds: z.array(evidenceIdSchema)
    })
    .strict(),
  z
    .object({
      status: z.literal("abstained"),
      reasonCode: benchmarkIdSchema,
      explanation: nonEmptyStringSchema.max(1_500),
      evidenceIds: z.array(evidenceIdSchema)
    })
    .strict(),
  z
    .object({
      status: z.literal("omitted")
    })
    .strict()
]);

export const benchmarkEmittedAbstentionSchema = z
  .object({
    id: benchmarkIdSchema,
    field: valuationFieldSchema,
    reasonCode: benchmarkIdSchema,
    explanation: nonEmptyStringSchema.max(1_500),
    evidenceIds: z.array(evidenceIdSchema)
  })
  .strict();

export const benchmarkEmittedValuationSchema = z
  .object({
    field: valuationFieldSchema,
    status: z.enum(["concluded", "abstained", "omitted"]),
    value: factValueSchema.optional(),
    unit: nonEmptyStringSchema.max(120).optional(),
    rationale: nonEmptyStringSchema.max(1_500).optional(),
    evidenceIds: z.array(evidenceIdSchema)
  })
  .strict();

export const benchmarkNormalizedRunnerOutputSchema = z
  .object({
    claims: z.array(benchmarkEmittedClaimSchema),
    route: benchmarkEmittedRouteSchema,
    abstentions: z.array(benchmarkEmittedAbstentionSchema),
    valuations: z.array(benchmarkEmittedValuationSchema)
  })
  .strict();

export const benchmarkRunnerOutputSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-runner-output.v1"),
    runnerName: benchmarkRunnerNameSchema,
    runId: pathSegmentSchema,
    caseId: caseIdSchema,
    partition: benchmarkCasePartitionSchema,
    status: z.enum(["completed", "failed"]),
    timing: benchmarkTimingMetadataSchema,
    rawOutput: benchmarkRawRunnerOutputSchema,
    normalized: benchmarkNormalizedRunnerOutputSchema,
    failures: z.array(benchmarkFailureRecordSchema)
  })
  .strict()
  .superRefine((output, context) => {
    if (output.status === "failed" && output.failures.length === 0) {
      context.addIssue({
        code: "custom",
        path: ["failures"],
        message: "Failed runner outputs must include at least one failure record"
      });
    }
  });

export const benchmarkScorerInputSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-scorer-input.v1"),
    runId: pathSegmentSchema,
    runnerName: benchmarkRunnerNameSchema,
    caseId: caseIdSchema,
    partition: benchmarkPartitionSchema,
    caseInput: benchmarkCaseInputSchema,
    annotation: benchmarkAnnotationSchema,
    runnerOutput: benchmarkRunnerOutputSchema
  })
  .strict()
  .superRefine((scorerInput, context) => {
    if (scorerInput.caseInput.scoringRole !== "scored") {
      context.addIssue({
        code: "custom",
        path: ["caseInput", "scoringRole"],
        message: "Scorer inputs require scored benchmark case inputs"
      });
    }

    if (scorerInput.caseInput.caseId !== scorerInput.caseId) {
      context.addIssue({
        code: "custom",
        path: ["caseInput", "caseId"],
        message: "Scorer case id must match case input"
      });
    }

    if (scorerInput.annotation.caseId !== scorerInput.caseId) {
      context.addIssue({
        code: "custom",
        path: ["annotation", "caseId"],
        message: "Scorer case id must match annotation"
      });
    }

    if (scorerInput.runnerOutput.caseId !== scorerInput.caseId) {
      context.addIssue({
        code: "custom",
        path: ["runnerOutput", "caseId"],
        message: "Scorer case id must match runner output"
      });
    }

    if (scorerInput.runnerOutput.runId !== scorerInput.runId) {
      context.addIssue({
        code: "custom",
        path: ["runnerOutput", "runId"],
        message: "Scorer run id must match runner output"
      });
    }

    if (scorerInput.runnerOutput.runnerName !== scorerInput.runnerName) {
      context.addIssue({
        code: "custom",
        path: ["runnerOutput", "runnerName"],
        message: "Scorer runner name must match runner output"
      });
    }
  });

export const benchmarkMetricScoreSchema = z
  .object({
    metricId: benchmarkIdSchema,
    status: z.enum(["scored", "skipped", "failed"]),
    value: z.number().min(0).max(1).optional(),
    numerator: z.number().nonnegative().optional(),
    denominator: z.number().nonnegative().optional(),
    weight: z.number().nonnegative().optional(),
    notes: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict()
  .superRefine((metric, context) => {
    if (metric.status === "scored" && metric.value === undefined) {
      context.addIssue({
        code: "custom",
        path: ["value"],
        message: "Scored metrics must include a numeric value"
      });
    }
  });

export const benchmarkScoredClaimKindSchema = z.enum(["binary", "observable"]);

export const benchmarkClaimSupportStatusSchema = z.enum([
  "supported",
  "unsupported",
  "uncited",
  "citation-mismatched",
  "post-cutoff",
  "non-retrievable",
  "not-emitted"
]);

export const benchmarkSourceQualityCategorySchema = z.enum([
  "audited",
  "regulatory",
  "government",
  "legal",
  "company-originated",
  "market-data",
  "news",
  "expert",
  "peer-reviewed",
  "commercial",
  "other"
]);

export const benchmarkCitationScoreSchema = z
  .object({
    evidenceId: evidenceIdSchema,
    factId: evidenceIdSchema.optional(),
    evidenceIdExists: z.boolean(),
    retrievable: z.boolean(),
    sourceUrlPresent: z.boolean(),
    cutoffCompliant: z.boolean(),
    sourceDateAligned: z.boolean(),
    supportsEntity: z.boolean(),
    supportsPeriod: z.boolean(),
    supportsUnit: z.boolean(),
    supportsWording: z.boolean(),
    valid: z.boolean(),
    sourceClass: sourceClassSchema.optional(),
    sourceQualityCategory: benchmarkSourceQualityCategorySchema.optional(),
    sourceQualityWeight: z.number().min(0).max(1).optional(),
    notes: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict();

export const benchmarkClaimSourceQualityScoreSchema = z
  .object({
    score: z.number().min(0).max(1),
    citedSourceClasses: z.array(sourceClassSchema),
    citedSourceQualityCategories: z.array(benchmarkSourceQualityCategorySchema),
    notes: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict();

export const benchmarkClaimScoreSchema = z
  .object({
    claimId: benchmarkIdSchema,
    kind: benchmarkScoredClaimKindSchema,
    supportStatus: benchmarkClaimSupportStatusSchema,
    denominatorIncluded: z.boolean(),
    denominatorReasons: z.array(benchmarkClaimSupportStatusSchema),
    expectedClaimId: benchmarkIdSchema.optional(),
    emittedClaimId: benchmarkIdSchema.optional(),
    expectedStatement: nonEmptyStringSchema.max(1_500).optional(),
    emittedStatement: nonEmptyStringSchema.max(2_000).optional(),
    expectedValue: factValueSchema.optional(),
    emittedValue: factValueSchema.optional(),
    expectedUnit: nonEmptyStringSchema.max(120).optional(),
    emittedUnit: nonEmptyStringSchema.max(120).optional(),
    expectedPeriod: factPeriodSchema.optional(),
    emittedPeriod: factPeriodSchema.optional(),
    expectedEvidenceIds: z.array(evidenceIdSchema),
    emittedEvidenceIds: z.array(evidenceIdSchema),
    citationScores: z.array(benchmarkCitationScoreSchema),
    sourceQuality: benchmarkClaimSourceQualityScoreSchema,
    duplicateEmittedClaimIds: z.array(benchmarkIdSchema),
    notes: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict()
  .superRefine((claim, context) => {
    if (claim.expectedClaimId === undefined && claim.emittedClaimId === undefined) {
      context.addIssue({
        code: "custom",
        message: "Claim scores must preserve at least one expected or emitted claim id"
      });
    }

    if (claim.supportStatus === "not-emitted" && claim.denominatorIncluded) {
      context.addIssue({
        code: "custom",
        path: ["denominatorIncluded"],
        message: "Not-emitted expected claims are not precision denominator items"
      });
    }
  });

export const benchmarkCaseScoreOutputSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-case-score.v1"),
    runId: pathSegmentSchema,
    runnerName: benchmarkRunnerNameSchema,
    caseId: caseIdSchema,
    partition: benchmarkPartitionSchema,
    status: z.enum(["scored", "failed", "skipped"]),
    metrics: z.array(benchmarkMetricScoreSchema),
    failures: z.array(benchmarkFailureRecordSchema)
  })
  .strict();

export const benchmarkPerClaimScoreOutputSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-per-claim-score.v1"),
    runId: pathSegmentSchema,
    runnerName: benchmarkRunnerNameSchema,
    caseId: caseIdSchema,
    partition: benchmarkPartitionSchema,
    status: z.enum(["scored", "failed", "skipped"]),
    claims: z.array(benchmarkClaimScoreSchema),
    failures: z.array(benchmarkFailureRecordSchema)
  })
  .strict();

export const benchmarkAggregateScoreGroupSchema = z
  .object({
    groupId: benchmarkIdSchema,
    groupKind: z.enum(["overall", "partition", "data-tier", "sector-route", "runner"]),
    runnerName: benchmarkRunnerNameSchema.optional(),
    partition: benchmarkScoredOrAllPartitionSchema.optional(),
    caseCount: z.number().int().nonnegative(),
    scoredCaseCount: z.number().int().nonnegative(),
    failedCaseCount: z.number().int().nonnegative(),
    metrics: z.array(benchmarkMetricScoreSchema)
  })
  .strict();

export const benchmarkAggregateScoreOutputSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-aggregate-score.v1"),
    runId: pathSegmentSchema,
    partition: benchmarkScoredOrAllPartitionSchema,
    generatedAt: isoDateTimeSchema.optional(),
    groups: z.array(benchmarkAggregateScoreGroupSchema),
    failures: z.array(benchmarkFailureRecordSchema)
  })
  .strict();

export class BenchmarkAnnotationJsonError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BenchmarkAnnotationJsonError";
  }
}

export function parseBenchmarkAnnotationJson(jsonText: string): BenchmarkAnnotation {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new BenchmarkAnnotationJsonError(`Invalid benchmark annotation JSON: ${message}`);
  }

  return benchmarkAnnotationSchema.parse(parsed);
}

export async function loadBenchmarkAnnotationFromJsonFile(
  annotationPath: string
): Promise<BenchmarkAnnotation> {
  const jsonText = await readFile(annotationPath, "utf8");

  return parseBenchmarkAnnotationJson(jsonText);
}

export type BenchmarkRunnerName = z.infer<typeof benchmarkRunnerNameSchema>;
export type BenchmarkCasePartition = z.infer<typeof benchmarkCasePartitionSchema>;
export type BenchmarkScoredOrAllPartition = z.infer<
  typeof benchmarkScoredOrAllPartitionSchema
>;
export type BenchmarkSourceAvailability = z.infer<typeof benchmarkSourceAvailabilitySchema>;
export type BenchmarkExpectedRoute = z.infer<typeof benchmarkExpectedRouteSchema>;
export type BenchmarkExpectedBinaryClaim = z.infer<
  typeof benchmarkExpectedBinaryClaimSchema
>;
export type BenchmarkExpectedObservableClaim = z.infer<
  typeof benchmarkExpectedObservableClaimSchema
>;
export type BenchmarkExpectedAbstention = z.infer<
  typeof benchmarkExpectedAbstentionSchema
>;
export type BenchmarkCompletenessExpectation = z.infer<
  typeof benchmarkCompletenessExpectationSchema
>;
export type BenchmarkHistoricalValuationTarget = z.infer<
  typeof benchmarkHistoricalValuationTargetSchema
>;
export type BenchmarkHistoricalValuationTargets = z.infer<
  typeof benchmarkHistoricalValuationTargetsSchema
>;
export type BenchmarkAnnotation = z.infer<typeof benchmarkAnnotationSchema>;
export type BenchmarkCaseInput = z.infer<typeof benchmarkCaseInputSchema>;
export type BenchmarkCompiledCase = z.infer<typeof benchmarkCompiledCaseSchema>;
export type BenchmarkFailureRecord = z.infer<typeof benchmarkFailureRecordSchema>;
export type BenchmarkTimingMetadata = z.infer<typeof benchmarkTimingMetadataSchema>;
export type BenchmarkCitation = z.infer<typeof benchmarkCitationSchema>;
export type BenchmarkEmittedClaim = z.infer<typeof benchmarkEmittedClaimSchema>;
export type BenchmarkEmittedRoute = z.infer<typeof benchmarkEmittedRouteSchema>;
export type BenchmarkEmittedAbstention = z.infer<typeof benchmarkEmittedAbstentionSchema>;
export type BenchmarkEmittedValuation = z.infer<typeof benchmarkEmittedValuationSchema>;
export type BenchmarkNormalizedRunnerOutput = z.infer<
  typeof benchmarkNormalizedRunnerOutputSchema
>;
export type BenchmarkRunnerOutput = z.infer<typeof benchmarkRunnerOutputSchema>;
export type BenchmarkScorerInput = z.infer<typeof benchmarkScorerInputSchema>;
export type BenchmarkMetricScore = z.infer<typeof benchmarkMetricScoreSchema>;
export type BenchmarkScoredClaimKind = z.infer<typeof benchmarkScoredClaimKindSchema>;
export type BenchmarkClaimSupportStatus = z.infer<typeof benchmarkClaimSupportStatusSchema>;
export type BenchmarkSourceQualityCategory = z.infer<
  typeof benchmarkSourceQualityCategorySchema
>;
export type BenchmarkCitationScore = z.infer<typeof benchmarkCitationScoreSchema>;
export type BenchmarkClaimScore = z.infer<typeof benchmarkClaimScoreSchema>;
export type BenchmarkPerClaimScoreOutput = z.infer<
  typeof benchmarkPerClaimScoreOutputSchema
>;
export type BenchmarkCaseScoreOutput = z.infer<typeof benchmarkCaseScoreOutputSchema>;
export type BenchmarkAggregateScoreOutput = z.infer<
  typeof benchmarkAggregateScoreOutputSchema
>;

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
