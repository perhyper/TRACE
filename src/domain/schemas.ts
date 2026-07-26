import { z } from "zod";

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/u;
const isoDateTimePattern =
  /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})$/u;

function isValidIsoDate(value: string): boolean {
  const match = isoDatePattern.exec(value);

  if (match === null) {
    return false;
  }

  const yearRaw = match[1];
  const monthRaw = match[2];
  const dayRaw = match[3];

  if (yearRaw === undefined || monthRaw === undefined || dayRaw === undefined) {
    return false;
  }

  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidIsoDateTime(value: string): boolean {
  const match = isoDateTimePattern.exec(value);

  if (match === null) {
    return false;
  }

  const datePart = match[1];

  return datePart !== undefined && isValidIsoDate(datePart) && Number.isFinite(Date.parse(value));
}

const nonEmptyStringSchema = z.string().trim().min(1);
const evidenceIdSchema = z.string().trim().min(1).max(120);

export const isoDateSchema = z
  .string()
  .refine(isValidIsoDate, "Expected a valid ISO calendar date in YYYY-MM-DD format");

export const isoDateTimeSchema = z
  .string()
  .refine(isValidIsoDateTime, "Expected a valid ISO date-time with an explicit offset");

export const sourceClassSchema = z.enum([
  "audited-filing",
  "regulatory-filing",
  "government",
  "legal-record",
  "company-primary",
  "company-secondary",
  "market-data",
  "news",
  "expert-analysis",
  "peer-reviewed",
  "commercial-data",
  "other"
]);

export const epistemicClassSchema = z.enum([
  "observed",
  "extracted",
  "calculated",
  "assumed",
  "inferred",
  "unknown"
]);

export const decisionModeSchema = z.enum([
  "evidence-ledger",
  "route-selection",
  "valuation-review",
  "full-analysis"
]);

const scalarFactValueSchema = z.union([
  nonEmptyStringSchema,
  z.number(),
  z.boolean()
]);

export const factValueSchema = z.union([
  scalarFactValueSchema,
  z.array(scalarFactValueSchema).min(1)
]);

export const factPeriodSchema = z
  .object({
    startDate: isoDateSchema.optional(),
    endDate: isoDateSchema.optional(),
    instantDate: isoDateSchema.optional()
  })
  .strict()
  .superRefine((period, context) => {
    if (
      period.startDate === undefined &&
      period.endDate === undefined &&
      period.instantDate === undefined
    ) {
      context.addIssue({
        code: "custom",
        message: "At least one period date is required"
      });
    }
  });

export const observedFactSchema = z
  .object({
    id: evidenceIdSchema,
    statement: nonEmptyStringSchema.max(1_000),
    epistemicClass: epistemicClassSchema,
    value: factValueSchema.optional(),
    unit: nonEmptyStringSchema.max(80).optional(),
    period: factPeriodSchema.optional()
  })
  .strict();

export const documentHashSchema = z
  .object({
    algorithm: z.literal("sha256"),
    value: z.string().regex(/^[a-f0-9]{64}$/u, "Expected a lowercase SHA-256 hex digest"),
    contentType: nonEmptyStringSchema.max(120).optional(),
    byteLength: z.number().int().positive().optional()
  })
  .strict();

export const evidenceRecordSchema = z
  .object({
    id: evidenceIdSchema,
    sourceUrl: z.url(),
    sourceTitle: nonEmptyStringSchema.max(240),
    retrievedDate: isoDateSchema,
    publishedDate: isoDateSchema.optional(),
    effectiveDate: isoDateSchema.optional(),
    sourceClass: sourceClassSchema,
    epistemicClass: epistemicClassSchema,
    locator: nonEmptyStringSchema.max(160).optional(),
    shortExcerpt: nonEmptyStringSchema.max(1_000),
    observedFacts: z.array(observedFactSchema).min(1),
    documentHash: documentHashSchema.optional()
  })
  .strict();

export const companyIdentifierSchema = z
  .object({
    scheme: z.enum(["company-number", "lei", "isin", "ticker", "tax-id", "other"]),
    value: nonEmptyStringSchema.max(120),
    jurisdiction: nonEmptyStringSchema.max(80).optional()
  })
  .strict();

export const companyIdentitySchema = z
  .object({
    legalName: nonEmptyStringSchema.max(240),
    jurisdiction: nonEmptyStringSchema.max(80),
    identifiers: z.array(companyIdentifierSchema).min(1),
    aliases: z.array(nonEmptyStringSchema.max(240)).optional(),
    identityConfidence: z.enum(["resolved", "ambiguous", "unresolved"])
  })
  .strict();

export const missingInformationSchema = z
  .object({
    id: evidenceIdSchema,
    topic: nonEmptyStringSchema.max(160),
    description: nonEmptyStringSchema.max(1_000),
    consequence: nonEmptyStringSchema.max(1_000),
    requiredFor: z
      .array(
        z.enum([
          "entity-resolution",
          "routing",
          "sufficiency",
          "headline-valuation",
          "enterprise-value",
          "total-equity-value",
          "security-level-fair-value",
          "review",
          "report"
        ])
      )
      .min(1)
  })
  .strict();

export const abstentionSchema = z
  .object({
    reasonCode: nonEmptyStringSchema.max(120),
    explanation: nonEmptyStringSchema.max(1_500),
    missingInformation: z.array(missingInformationSchema).min(1),
    evidenceIds: z.array(evidenceIdSchema)
  })
  .strict();

export const sufficiencyCriterionSchema = z
  .object({
    criterion: nonEmptyStringSchema.max(160),
    status: z.enum(["met", "partial", "missing"]),
    explanation: nonEmptyStringSchema.max(1_000),
    evidenceIds: z.array(evidenceIdSchema)
  })
  .strict();

export const sufficiencySchema = z
  .object({
    status: z.enum(["sufficient", "insufficient"]),
    score: z.number().min(0).max(1),
    criteria: z.array(sufficiencyCriterionSchema).min(1),
    missingInformation: z.array(missingInformationSchema),
    rationale: nonEmptyStringSchema.max(1_500)
  })
  .strict();

export const analysisRouteSchema = z.enum([
  "financial-services",
  "software-saas",
  "marketplace",
  "biotech-rnpv",
  "asset-based",
  "recent-transaction",
  "general-private-company",
  "insufficient-evidence"
]);

export const routeReasonSchema = z
  .object({
    summary: nonEmptyStringSchema.max(1_000),
    evidenceIds: z.array(evidenceIdSchema).min(1)
  })
  .strict();

export const routeCandidateSchema = z
  .object({
    route: analysisRouteSchema,
    status: z.enum(["selected", "rejected", "considered"]),
    score: z.number().min(0).max(1).optional(),
    reasons: z.array(routeReasonSchema).min(1)
  })
  .strict();

export const routeDecisionSchema = z.discriminatedUnion("status", [
  z
    .object({
      status: z.literal("selected"),
      selectedRoute: analysisRouteSchema,
      selectedReasons: z.array(routeReasonSchema).min(1),
      candidates: z.array(routeCandidateSchema).min(1),
      rejectedRoutes: z.array(routeCandidateSchema)
    })
    .strict(),
  z
    .object({
      status: z.literal("abstained"),
      abstention: abstentionSchema,
      candidates: z.array(routeCandidateSchema)
    })
    .strict()
]);

export const currencyCodeSchema = z.string().regex(/^[A-Z]{3}$/u, "Expected an ISO 4217 currency code");

export const moneyAmountSchema = z
  .object({
    amount: z.number().nonnegative(),
    currency: currencyCodeSchema,
    scale: z.enum(["units", "thousands", "millions", "billions"])
  })
  .strict();

export const moneyRangeSchema = z
  .object({
    low: moneyAmountSchema,
    base: moneyAmountSchema,
    high: moneyAmountSchema
  })
  .strict()
  .superRefine((range, context) => {
    const amounts = [range.low, range.base, range.high];
    const hasMatchingUnits = amounts.every(
      (amount) => amount.currency === range.base.currency && amount.scale === range.base.scale
    );

    if (!hasMatchingUnits) {
      context.addIssue({
        code: "custom",
        message: "Money range amounts must share one currency and scale"
      });
    }

    if (range.low.amount > range.base.amount || range.base.amount > range.high.amount) {
      context.addIssue({
        code: "custom",
        message: "Money range must satisfy low <= base <= high"
      });
    }
  });

export const valuationFieldSchema = z.enum([
  "headline-valuation",
  "enterprise-value",
  "total-equity-value",
  "security-level-fair-value"
]);

export const valuationBasisSchema = z
  .object({
    method: z.enum([
      "recent-secondary-calibration",
      "market-multiple",
      "discounted-cash-flow",
      "risk-adjusted-npv",
      "asset-based",
      "not-applicable"
    ]),
    description: nonEmptyStringSchema.max(1_500),
    evidenceIds: z.array(evidenceIdSchema).min(1),
    assumptions: z.array(nonEmptyStringSchema.max(1_000)),
    limitations: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict();

export const concludedValuationSchema = z
  .object({
    status: z.literal("concluded"),
    field: valuationFieldSchema,
    range: moneyRangeSchema,
    basis: valuationBasisSchema
  })
  .strict();

export const abstainedValuationSchema = z
  .object({
    status: z.literal("abstained"),
    field: valuationFieldSchema,
    abstention: abstentionSchema
  })
  .strict();

export const valuationConclusionSchema = z.discriminatedUnion("status", [
  concludedValuationSchema,
  abstainedValuationSchema
]);

export const valuationOutputSchema = z
  .object({
    headlineValuation: valuationConclusionSchema,
    enterpriseValue: valuationConclusionSchema,
    totalEquityValue: valuationConclusionSchema,
    securityLevelFairValue: valuationConclusionSchema
  })
  .strict()
  .superRefine((valuation, context) => {
    const expectedFields = {
      headlineValuation: "headline-valuation",
      enterpriseValue: "enterprise-value",
      totalEquityValue: "total-equity-value",
      securityLevelFairValue: "security-level-fair-value"
    } as const;

    for (const [key, expectedField] of Object.entries(expectedFields)) {
      const conclusion = valuation[key as keyof typeof expectedFields];

      if (conclusion.field !== expectedField) {
        context.addIssue({
          code: "custom",
          path: [key, "field"],
          message: `Expected valuation field ${expectedField}`
        });
      }
    }
  });

export const reviewFindingSchema = z
  .object({
    id: evidenceIdSchema,
    severity: z.enum(["pass", "warning", "fail"]),
    category: z.enum([
      "entity",
      "evidence",
      "cutoff",
      "route",
      "calculation",
      "valuation-separation",
      "abstention",
      "report"
    ]),
    message: nonEmptyStringSchema.max(1_000),
    evidenceIds: z.array(evidenceIdSchema),
    missingInformation: z.array(missingInformationSchema)
  })
  .strict();

export const reviewSchema = z
  .object({
    status: z.enum(["passed", "warnings", "failed"]),
    reviewerVersion: nonEmptyStringSchema.max(80),
    findings: z.array(reviewFindingSchema)
  })
  .strict();

export const runMetadataSchema = z
  .object({
    runId: nonEmptyStringSchema.max(160),
    runtimeVersion: nonEmptyStringSchema.max(80),
    command: nonEmptyStringSchema.max(240),
    measurementDate: isoDateSchema,
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema.optional(),
    durationMs: z.number().nonnegative().optional(),
    inputPath: nonEmptyStringSchema.max(500).optional(),
    outputDirectory: nonEmptyStringSchema.max(500).optional(),
    warnings: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict();

export const reportSectionsSchema = z
  .object({
    facts: z.array(nonEmptyStringSchema.max(1_000)),
    inferences: z.array(nonEmptyStringSchema.max(1_000)),
    conflicts: z.array(nonEmptyStringSchema.max(1_000)),
    limitations: z.array(nonEmptyStringSchema.max(1_000)),
    counterarguments: z.array(nonEmptyStringSchema.max(1_000)),
    missingInformation: z.array(missingInformationSchema),
    nextDiligenceQuestions: z.array(nonEmptyStringSchema.max(1_000))
  })
  .strict();

export const reportSchema = z
  .object({
    schemaVersion: z.literal("trace.report.v1"),
    company: companyIdentitySchema,
    measurementDate: isoDateSchema,
    decisionMode: decisionModeSchema,
    evidence: z.array(evidenceRecordSchema).min(1),
    sufficiency: sufficiencySchema,
    route: routeDecisionSchema,
    valuation: valuationOutputSchema,
    review: reviewSchema,
    sections: reportSectionsSchema,
    run: runMetadataSchema
  })
  .strict();

export const executionLogSchema = z
  .object({
    schemaVersion: z.literal("trace.execution-log.v1"),
    runId: nonEmptyStringSchema.max(160),
    runtimeVersion: nonEmptyStringSchema.max(80),
    measurementDate: isoDateSchema,
    inputPath: nonEmptyStringSchema.max(500),
    outputPaths: z
      .object({
        jsonReport: nonEmptyStringSchema.max(500),
        markdownReport: nonEmptyStringSchema.max(500),
        executionLog: nonEmptyStringSchema.max(500)
      })
      .strict(),
    startedAt: isoDateTimeSchema,
    completedAt: isoDateTimeSchema,
    durationMs: z.number().nonnegative(),
    validationWarnings: z.array(nonEmptyStringSchema.max(1_000)),
    reviewerFindings: z.array(reviewFindingSchema),
    deterministicIdentifiers: z
      .object({
        evidenceLedgerHash: nonEmptyStringSchema.max(80),
        runtimeResultHash: nonEmptyStringSchema.max(80)
      })
      .strict()
  })
  .strict();

export type IsoDate = z.infer<typeof isoDateSchema>;
export type IsoDateTime = z.infer<typeof isoDateTimeSchema>;
export type SourceClass = z.infer<typeof sourceClassSchema>;
export type EpistemicClass = z.infer<typeof epistemicClassSchema>;
export type DecisionMode = z.infer<typeof decisionModeSchema>;
export type FactValue = z.infer<typeof factValueSchema>;
export type FactPeriod = z.infer<typeof factPeriodSchema>;
export type ObservedFact = z.infer<typeof observedFactSchema>;
export type DocumentHash = z.infer<typeof documentHashSchema>;
export type EvidenceRecord = z.infer<typeof evidenceRecordSchema>;
export type CompanyIdentifier = z.infer<typeof companyIdentifierSchema>;
export type CompanyIdentity = z.infer<typeof companyIdentitySchema>;
export type MissingInformation = z.infer<typeof missingInformationSchema>;
export type Abstention = z.infer<typeof abstentionSchema>;
export type SufficiencyCriterion = z.infer<typeof sufficiencyCriterionSchema>;
export type Sufficiency = z.infer<typeof sufficiencySchema>;
export type AnalysisRoute = z.infer<typeof analysisRouteSchema>;
export type RouteReason = z.infer<typeof routeReasonSchema>;
export type RouteCandidate = z.infer<typeof routeCandidateSchema>;
export type RouteDecision = z.infer<typeof routeDecisionSchema>;
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;
export type MoneyAmount = z.infer<typeof moneyAmountSchema>;
export type MoneyRange = z.infer<typeof moneyRangeSchema>;
export type ValuationField = z.infer<typeof valuationFieldSchema>;
export type ValuationBasis = z.infer<typeof valuationBasisSchema>;
export type ConcludedValuation = z.infer<typeof concludedValuationSchema>;
export type AbstainedValuation = z.infer<typeof abstainedValuationSchema>;
export type ValuationConclusion = z.infer<typeof valuationConclusionSchema>;
export type ValuationOutput = z.infer<typeof valuationOutputSchema>;
export type ReviewFinding = z.infer<typeof reviewFindingSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type RunMetadata = z.infer<typeof runMetadataSchema>;
export type ReportSections = z.infer<typeof reportSectionsSchema>;
export type Report = z.infer<typeof reportSchema>;
export type ExecutionLog = z.infer<typeof executionLogSchema>;
