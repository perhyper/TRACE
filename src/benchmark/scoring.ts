import type {
  EvidenceRecord,
  FactPeriod,
  FactValue,
  ObservedFact,
  SourceClass,
  ValuationField
} from "../domain/schemas.js";
import {
  evidenceIdForSourceUrl,
  type ExcludedEvidenceRecord
} from "../providers/evidence-bundle.js";
import {
  benchmarkCaseScoreOutputSchema,
  benchmarkClaimScoreSchema,
  benchmarkPerClaimScoreOutputSchema,
  benchmarkScorerInputSchema
} from "./contracts.js";
import type {
  BenchmarkCaseScoreOutput,
  BenchmarkCitation,
  BenchmarkCitationScore,
  BenchmarkClaimScore,
  BenchmarkClaimSupportStatus,
  BenchmarkEmittedAbstention,
  BenchmarkEmittedClaim,
  BenchmarkEmittedValuation,
  BenchmarkExpectedAbstention,
  BenchmarkHistoricalValuationTarget,
  BenchmarkFailureRecord,
  BenchmarkMetricScore,
  BenchmarkPerClaimScoreOutput,
  BenchmarkScoredClaimKind,
  BenchmarkScorerInput,
  BenchmarkSourceAvailability,
  BenchmarkSourceQualityCategory
} from "./contracts.js";

export interface BenchmarkClaimScoringResult {
  readonly perClaimScore: BenchmarkPerClaimScoreOutput;
  readonly caseScore: BenchmarkCaseScoreOutput;
}

interface ExpectedMaterialClaim {
  readonly id: string;
  readonly kind: BenchmarkScoredClaimKind;
  readonly statement: string;
  readonly expectedValue: FactValue;
  readonly unit?: string;
  readonly period?: FactPeriod;
  readonly evidenceIds: readonly string[];
  readonly sourceAvailability?: BenchmarkSourceAvailability;
}

interface DedupedEmittedClaim {
  readonly id: string;
  readonly kind: BenchmarkScoredClaimKind;
  readonly statement: string;
  readonly value?: FactValue;
  readonly unit?: string;
  readonly period?: FactPeriod;
  readonly citations: readonly BenchmarkCitation[];
  readonly duplicateEmittedClaimIds: readonly string[];
}

interface EvidenceLookup {
  readonly evidenceById: ReadonlyMap<string, EvidenceRecord>;
  readonly excludedById: ReadonlyMap<string, ExcludedEvidenceRecord>;
}

interface SourceQualityPolicy {
  readonly category: BenchmarkSourceQualityCategory;
  readonly weight: number;
}

const metricIds = [
  "evidence-supported-claim-precision",
  "citation-validity",
  "source-quality",
  "route-accuracy",
  "abstention-behavior",
  "valuation-separation",
  "historical-valuation-error",
  "completeness",
  "reproducibility",
  "completion-status",
  "duration",
  "failure-records"
] as const;

const claimMetricIds = metricIds.slice(0, 3);

const valuationFields = [
  "headline-valuation",
  "enterprise-value",
  "total-equity-value",
  "security-level-fair-value"
] satisfies readonly ValuationField[];

const valuationFieldSet = new Set<string>(valuationFields);

const sourceQualityByClass = {
  "audited-filing": {
    category: "audited",
    weight: 1
  },
  "regulatory-filing": {
    category: "regulatory",
    weight: 0.95
  },
  government: {
    category: "government",
    weight: 0.9
  },
  "legal-record": {
    category: "legal",
    weight: 0.88
  },
  "company-primary": {
    category: "company-originated",
    weight: 0.8
  },
  "company-secondary": {
    category: "company-originated",
    weight: 0.72
  },
  "market-data": {
    category: "market-data",
    weight: 0.75
  },
  news: {
    category: "news",
    weight: 0.58
  },
  "expert-analysis": {
    category: "expert",
    weight: 0.65
  },
  "peer-reviewed": {
    category: "peer-reviewed",
    weight: 0.9
  },
  "commercial-data": {
    category: "commercial",
    weight: 0.62
  },
  other: {
    category: "other",
    weight: 0.4
  }
} satisfies Record<SourceClass, SourceQualityPolicy>;

export function scoreBenchmarkCase(input: BenchmarkScorerInput): BenchmarkClaimScoringResult {
  const scorerInput = benchmarkScorerInputSchema.parse(input);

  if (scorerInput.runnerOutput.status === "failed") {
    return failedScoreOutput(scorerInput);
  }

  const expectedClaims = materialExpectedClaims(scorerInput);
  const emittedClaims = dedupeMaterialEmittedClaims(
    scorerInput.runnerOutput.normalized.claims
  );
  const evidenceLookup = buildEvidenceLookup(scorerInput);
  const emittedClaimScores = emittedClaims.map((emittedClaim) =>
    scoreEmittedClaim({
      scorerInput,
      emittedClaim,
      expectedClaims,
      evidenceLookup
    })
  );
  const matchedExpectedClaimIds = new Set(
    emittedClaimScores
      .map((claimScore) => claimScore.expectedClaimId)
      .filter((claimId): claimId is string => claimId !== undefined)
  );
  const notEmittedClaimScores = expectedClaims
    .filter((expectedClaim) => !matchedExpectedClaimIds.has(expectedClaim.id))
    .map((expectedClaim) => notEmittedClaimScore(expectedClaim));
  const claimScores = [...emittedClaimScores, ...notEmittedClaimScores].sort(
    compareClaimScores
  );
  const failures = [...scorerInput.runnerOutput.failures].sort(compareFailures);
  const perClaimScore = benchmarkPerClaimScoreOutputSchema.parse({
    schemaVersion: "trace.benchmark-per-claim-score.v1",
    runId: scorerInput.runId,
    runnerName: scorerInput.runnerName,
    caseId: scorerInput.caseId,
    partition: scorerInput.partition,
    status: "scored",
    claims: claimScores,
    failures
  });
  const caseScore = benchmarkCaseScoreOutputSchema.parse({
    schemaVersion: "trace.benchmark-case-score.v1",
    runId: scorerInput.runId,
    runnerName: scorerInput.runnerName,
    caseId: scorerInput.caseId,
    partition: scorerInput.partition,
    status: "scored",
    metrics: orderedMetrics([
      ...caseMetrics(emittedClaimScores),
      scoreRouteAccuracy(scorerInput, evidenceLookup),
      scoreAbstentionBehavior(scorerInput, evidenceLookup),
      scoreValuationSeparation(scorerInput),
      scoreHistoricalValuationError(scorerInput, evidenceLookup),
      scoreCompleteness(scorerInput, evidenceLookup),
      reproducibilityCaseMetric(),
      completionStatusMetric(scorerInput),
      durationMetric(scorerInput),
      failureRecordsMetric(scorerInput)
    ]),
    failures
  });

  return {
    perClaimScore,
    caseScore
  };
}

function failedScoreOutput(scorerInput: BenchmarkScorerInput): BenchmarkClaimScoringResult {
  const failures = [...scorerInput.runnerOutput.failures].sort(compareFailures);
  const failedMetrics = claimMetricIds.map((metricId) => ({
    metricId,
    status: "failed" as const,
    notes: ["Runner failed before claim, citation, and source-quality scoring."]
  }));
  const perClaimScore = benchmarkPerClaimScoreOutputSchema.parse({
    schemaVersion: "trace.benchmark-per-claim-score.v1",
    runId: scorerInput.runId,
    runnerName: scorerInput.runnerName,
    caseId: scorerInput.caseId,
    partition: scorerInput.partition,
    status: "failed",
    claims: [],
    failures
  });
  const caseScore = benchmarkCaseScoreOutputSchema.parse({
    schemaVersion: "trace.benchmark-case-score.v1",
    runId: scorerInput.runId,
    runnerName: scorerInput.runnerName,
    caseId: scorerInput.caseId,
    partition: scorerInput.partition,
    status: "failed",
    metrics: orderedMetrics([
      ...failedMetrics,
      failedMetric(
        "route-accuracy",
        "Runner failed before route-accuracy scoring."
      ),
      failedMetric(
        "abstention-behavior",
        "Runner failed before abstention-behavior scoring."
      ),
      failedMetric(
        "valuation-separation",
        "Runner failed before valuation-separation scoring."
      ),
      failedMetric(
        "historical-valuation-error",
        "Runner failed before historical valuation-error scoring."
      ),
      failedMetric("completeness", "Runner failed before completeness scoring."),
      reproducibilityCaseMetric(),
      completionStatusMetric(scorerInput),
      durationMetric(scorerInput),
      failureRecordsMetric(scorerInput)
    ]),
    failures
  });

  return {
    perClaimScore,
    caseScore
  };
}

function materialExpectedClaims(scorerInput: BenchmarkScorerInput): ExpectedMaterialClaim[] {
  return [
    ...scorerInput.annotation.binaryClaims.map((claim) => ({
      id: claim.id,
      kind: "binary" as const,
      statement: claim.statement,
      expectedValue: claim.expectedValue,
      evidenceIds: [...claim.evidenceIds].sort(compareStrings),
      ...(claim.sourceAvailability !== undefined
        ? { sourceAvailability: claim.sourceAvailability }
        : {})
    })),
    ...scorerInput.annotation.observableClaims.map((claim) => ({
      id: claim.id,
      kind: "observable" as const,
      statement: claim.statement,
      expectedValue: claim.expectedValue,
      ...(claim.unit !== undefined ? { unit: claim.unit } : {}),
      ...(claim.period !== undefined ? { period: claim.period } : {}),
      evidenceIds: [...claim.evidenceIds].sort(compareStrings),
      ...(claim.sourceAvailability !== undefined
        ? { sourceAvailability: claim.sourceAvailability }
        : {})
    }))
  ].sort(compareExpectedClaims);
}

function dedupeMaterialEmittedClaims(
  claims: readonly BenchmarkEmittedClaim[]
): DedupedEmittedClaim[] {
  const claimByKey = new Map<string, DedupedEmittedClaim>();

  for (const claim of [...claims].sort(compareEmittedClaims)) {
    if (!isMaterialClaimKind(claim.kind)) {
      continue;
    }

    const key = stableStringify({
      kind: claim.kind,
      statement: normalizeStatement(claim.statement),
      value: normalizeFactValue(claim.value),
      unit: claim.unit,
      period: claim.period
    });
    const existing = claimByKey.get(key);

    if (existing === undefined) {
      claimByKey.set(key, {
        id: claim.id,
        kind: claim.kind,
        statement: claim.statement,
        ...(claim.value !== undefined ? { value: claim.value } : {}),
        ...(claim.unit !== undefined ? { unit: claim.unit } : {}),
        ...(claim.period !== undefined ? { period: claim.period } : {}),
        citations: sortedUniqueCitations(claim.citations),
        duplicateEmittedClaimIds: []
      });
      continue;
    }

    claimByKey.set(key, {
      ...existing,
      citations: sortedUniqueCitations([...existing.citations, ...claim.citations]),
      duplicateEmittedClaimIds: [...existing.duplicateEmittedClaimIds, claim.id].sort(
        compareStrings
      )
    });
  }

  return Array.from(claimByKey.values()).sort(compareDedupedEmittedClaims);
}

function scoreEmittedClaim(options: {
  readonly scorerInput: BenchmarkScorerInput;
  readonly emittedClaim: DedupedEmittedClaim;
  readonly expectedClaims: readonly ExpectedMaterialClaim[];
  readonly evidenceLookup: EvidenceLookup;
}): BenchmarkClaimScore {
  const expectedClaim = bestExpectedMatch(options.emittedClaim, options.expectedClaims);
  const citationScores = options.emittedClaim.citations
    .map((citation) =>
      scoreCitation({
        scorerInput: options.scorerInput,
        emittedClaim: options.emittedClaim,
        expectedClaim,
        citation,
        evidenceLookup: options.evidenceLookup
      })
    )
    .sort(compareCitationScores);
  const supportStatus = claimSupportStatus(
    options.emittedClaim,
    expectedClaim,
    citationScores
  );
  const sourceQuality = claimSourceQuality(citationScores);
  const denominatorReasons =
    supportStatus === "supported" ? [] : [supportStatus];
  const notes = claimNotes({
    emittedClaim: options.emittedClaim,
    expectedClaim,
    supportStatus,
    citationScores
  });

  return parseClaimScore({
    claimId: expectedClaim?.id ?? options.emittedClaim.id,
    kind: options.emittedClaim.kind,
    supportStatus,
    denominatorIncluded: true,
    denominatorReasons,
    ...(expectedClaim !== undefined ? { expectedClaimId: expectedClaim.id } : {}),
    emittedClaimId: options.emittedClaim.id,
    ...(expectedClaim !== undefined ? { expectedStatement: expectedClaim.statement } : {}),
    emittedStatement: options.emittedClaim.statement,
    ...(expectedClaim !== undefined ? { expectedValue: expectedClaim.expectedValue } : {}),
    ...(options.emittedClaim.value !== undefined
      ? { emittedValue: options.emittedClaim.value }
      : {}),
    ...(expectedClaim?.unit !== undefined ? { expectedUnit: expectedClaim.unit } : {}),
    ...(options.emittedClaim.unit !== undefined
      ? { emittedUnit: options.emittedClaim.unit }
      : {}),
    ...(expectedClaim?.period !== undefined ? { expectedPeriod: expectedClaim.period } : {}),
    ...(options.emittedClaim.period !== undefined
      ? { emittedPeriod: options.emittedClaim.period }
      : {}),
    expectedEvidenceIds: expectedClaim === undefined ? [] : [...expectedClaim.evidenceIds],
    emittedEvidenceIds: uniqueSorted(
      options.emittedClaim.citations.map((citation) => citation.evidenceId)
    ),
    citationScores,
    sourceQuality,
    duplicateEmittedClaimIds: [...options.emittedClaim.duplicateEmittedClaimIds].sort(
      compareStrings
    ),
    notes
  });
}

function notEmittedClaimScore(expectedClaim: ExpectedMaterialClaim): BenchmarkClaimScore {
  return parseClaimScore({
    claimId: expectedClaim.id,
    kind: expectedClaim.kind,
    supportStatus: "not-emitted",
    denominatorIncluded: false,
    denominatorReasons: [],
    expectedClaimId: expectedClaim.id,
    expectedStatement: expectedClaim.statement,
    expectedValue: expectedClaim.expectedValue,
    ...(expectedClaim.unit !== undefined ? { expectedUnit: expectedClaim.unit } : {}),
    ...(expectedClaim.period !== undefined ? { expectedPeriod: expectedClaim.period } : {}),
    expectedEvidenceIds: [...expectedClaim.evidenceIds].sort(compareStrings),
    emittedEvidenceIds: [],
    citationScores: [],
    sourceQuality: {
      score: 0,
      citedSourceClasses: [],
      citedSourceQualityCategories: [],
      notes: ["Expected material claim was not emitted by the runner."]
    },
    duplicateEmittedClaimIds: [],
    notes: ["Expected material claim was not emitted by the runner."]
  });
}

function parseClaimScore(claimScore: BenchmarkClaimScore): BenchmarkClaimScore {
  return benchmarkClaimScoreSchema.parse(claimScore);
}

function scoreCitation(options: {
  readonly scorerInput: BenchmarkScorerInput;
  readonly emittedClaim: DedupedEmittedClaim;
  readonly expectedClaim: ExpectedMaterialClaim | undefined;
  readonly citation: BenchmarkCitation;
  readonly evidenceLookup: EvidenceLookup;
}): BenchmarkCitationScore {
  const evidence = options.evidenceLookup.evidenceById.get(options.citation.evidenceId);
  const excluded = options.evidenceLookup.excludedById.get(options.citation.evidenceId);
  const evidenceIdExists = evidence !== undefined || excluded !== undefined;
  const retrievable = evidence !== undefined;
  const sourceUrl = evidence?.sourceUrl ?? excluded?.sourceUrl;
  const sourceUrlPresent = sourceUrl !== undefined && sourceUrl.trim().length > 0;
  const cutoffCompliant =
    evidence !== undefined && sourceDatesCutoffCompliant(evidence, options.scorerInput.caseInput.cutoffDate);
  const sourceDateAligned =
    evidence !== undefined &&
    cutoffCompliant &&
    sourceDateSupportsClaimPeriod(
      evidence,
      options.emittedClaim,
      options.expectedClaim,
      options.scorerInput.caseInput.cutoffDate
    );
  const expectedEvidenceIds = new Set(options.expectedClaim?.evidenceIds ?? []);
  const expectedCitation = expectedEvidenceIds.has(options.citation.evidenceId);
  const supportsEntity = retrievable && expectedCitation;
  const supportsPeriod =
    supportsEntity && periodSupportsExpected(options.emittedClaim, options.expectedClaim);
  const supportsUnit =
    supportsEntity && unitSupportsExpected(options.emittedClaim, options.expectedClaim);
  const supportsWording =
    supportsEntity &&
    wordingSupportsExpected({
      evidence,
      citation: options.citation,
      emittedClaim: options.emittedClaim,
      expectedClaim: options.expectedClaim
    });
  const valid =
    evidenceIdExists &&
    retrievable &&
    sourceUrlPresent &&
    cutoffCompliant &&
    sourceDateAligned &&
    supportsEntity &&
    supportsPeriod &&
    supportsUnit &&
    supportsWording;
  const sourceQuality =
    evidence === undefined ? undefined : sourceQualityByClass[evidence.sourceClass];
  const notes = citationNotes({
    evidenceIdExists,
    retrievable,
    sourceUrlPresent,
    cutoffCompliant,
    sourceDateAligned,
    supportsEntity,
    supportsPeriod,
    supportsUnit,
    supportsWording,
    excluded
  });

  return {
    evidenceId: options.citation.evidenceId,
    ...(options.citation.factId !== undefined ? { factId: options.citation.factId } : {}),
    evidenceIdExists,
    retrievable,
    sourceUrlPresent,
    cutoffCompliant,
    sourceDateAligned,
    supportsEntity,
    supportsPeriod,
    supportsUnit,
    supportsWording,
    valid,
    ...(evidence !== undefined ? { sourceClass: evidence.sourceClass } : {}),
    ...(sourceQuality !== undefined ? { sourceQualityCategory: sourceQuality.category } : {}),
    ...(sourceQuality !== undefined ? { sourceQualityWeight: sourceQuality.weight } : {}),
    notes
  };
}

function claimSupportStatus(
  emittedClaim: DedupedEmittedClaim,
  expectedClaim: ExpectedMaterialClaim | undefined,
  citationScores: readonly BenchmarkCitationScore[]
): BenchmarkClaimSupportStatus {
  if (emittedClaim.citations.length === 0) {
    return "uncited";
  }

  if (
    citationScores.some(
      (score) => score.evidenceIdExists && !score.retrievable && !score.cutoffCompliant
    ) ||
    expectedClaim?.sourceAvailability === "post-cutoff-excluded" ||
    expectedClaim?.sourceAvailability === "post-cutoff-gold-only"
  ) {
    return "post-cutoff";
  }

  if (citationScores.some((score) => !score.evidenceIdExists || !score.retrievable)) {
    return "non-retrievable";
  }

  if (expectedClaim === undefined) {
    return "unsupported";
  }

  if (!claimValueSupportsExpected(emittedClaim, expectedClaim)) {
    return "unsupported";
  }

  if (!unitSupportsExpected(emittedClaim, expectedClaim)) {
    return "unsupported";
  }

  if (!periodSupportsExpected(emittedClaim, expectedClaim)) {
    return "unsupported";
  }

  if (!citationScores.some((score) => score.valid)) {
    return "citation-mismatched";
  }

  return "supported";
}

function caseMetrics(claimScores: readonly BenchmarkClaimScore[]): BenchmarkMetricScore[] {
  const denominatorClaims = claimScores.filter((claimScore) => claimScore.denominatorIncluded);
  const supportedClaims = denominatorClaims.filter(
    (claimScore) => claimScore.supportStatus === "supported"
  );
  const citationDenominator = denominatorClaims.reduce(
    (total, claimScore) => total + Math.max(1, claimScore.citationScores.length),
    0
  );
  const validCitationCount = denominatorClaims.reduce(
    (total, claimScore) =>
      total + claimScore.citationScores.filter((citationScore) => citationScore.valid).length,
    0
  );
  const sourceQualityNumerator = denominatorClaims.reduce(
    (total, claimScore) => total + claimScore.sourceQuality.score,
    0
  );

  return [
    ratioMetric({
      metricId: "evidence-supported-claim-precision",
      numerator: supportedClaims.length,
      denominator: denominatorClaims.length,
      zeroDenominatorNote: "No material binary or observable claims were emitted."
    }),
    ratioMetric({
      metricId: "citation-validity",
      numerator: validCitationCount,
      denominator: citationDenominator,
      zeroDenominatorNote: "No material binary or observable claims were emitted."
    }),
    ratioMetric({
      metricId: "source-quality",
      numerator: roundMetricNumber(sourceQualityNumerator),
      denominator: denominatorClaims.length,
      zeroDenominatorNote: "No material binary or observable claims were emitted."
    })
  ];
}

function ratioMetric(options: {
  readonly metricId: string;
  readonly numerator: number;
  readonly denominator: number;
  readonly zeroDenominatorNote: string;
}, notes: readonly string[] = []): BenchmarkMetricScore {
  if (options.denominator === 0) {
    return {
      metricId: options.metricId,
      status: "skipped",
      numerator: 0,
      denominator: 0,
      notes: uniqueSorted([options.zeroDenominatorNote, ...notes])
    };
  }

  return {
    metricId: options.metricId,
    status: "scored",
    value: roundMetricNumber(options.numerator / options.denominator),
    numerator: options.numerator,
    denominator: options.denominator,
    notes: uniqueSorted(notes)
  };
}

function failedMetric(metricId: string, note: string): BenchmarkMetricScore {
  return {
    metricId,
    status: "failed",
    notes: [note]
  };
}

function scoreRouteAccuracy(
  scorerInput: BenchmarkScorerInput,
  evidenceLookup: EvidenceLookup
): BenchmarkMetricScore {
  const expectedRoute = scorerInput.annotation.expectedRoute;
  const emittedRoute = scorerInput.runnerOutput.normalized.route;
  const acceptableRoutes = new Set([
    expectedRoute.route,
    ...expectedRoute.acceptableAlternativeRoutes
  ]);
  const emittedEvidenceIds =
    emittedRoute.status === "omitted" ? [] : uniqueSorted(emittedRoute.evidenceIds);
  const evidenceCoverage = evidenceIdsCoverage(emittedEvidenceIds, expectedRoute.evidenceIds);
  const citedEvidenceIsUsable = emittedEvidenceIds.length > 0 &&
    emittedEvidenceIds.every((evidenceId) => cutoffVisibleEvidenceExists(evidenceId, evidenceLookup));
  const emittedRationale =
    emittedRoute.status === "selected"
      ? emittedRoute.rationale
      : emittedRoute.status === "abstained"
        ? emittedRoute.explanation
        : "";
  const rationaleScore =
    emittedRationale.length === 0
      ? 0
      : tokenCoverage(expectedRoute.rationale, emittedRationale) >= 0.25
        ? 1
        : 0;
  const routeScore =
    emittedRoute.status === "selected" && acceptableRoutes.has(emittedRoute.selectedRoute)
      ? 1
      : emittedRoute.status === "abstained" && expectedRoute.route === "insufficient-evidence"
        ? 1
        : 0;
  const numerator = routeScore + rationaleScore + (citedEvidenceIsUsable ? evidenceCoverage : 0);
  const notes = [
    routeScore === 1
      ? undefined
      : emittedRoute.status === "selected"
        ? `Selected route ${emittedRoute.selectedRoute} did not match expected route ${expectedRoute.route}.`
        : emittedRoute.status === "abstained"
          ? `Route selection abstained with reason ${emittedRoute.reasonCode}.`
          : "Route selection was omitted.",
    rationaleScore === 1 ? undefined : "Route rationale did not satisfy the annotated rationale requirement.",
    evidenceCoverage > 0 && citedEvidenceIsUsable
      ? undefined
      : "Route rationale did not cite cutoff-visible expected route evidence."
  ].filter((note): note is string => note !== undefined).sort(compareStrings);

  return ratioMetric({
    metricId: "route-accuracy",
    numerator: roundMetricNumber(numerator),
    denominator: 3,
    zeroDenominatorNote: "Route accuracy has no denominator."
  }, notes);
}

function scoreAbstentionBehavior(
  scorerInput: BenchmarkScorerInput,
  evidenceLookup: EvidenceLookup
): BenchmarkMetricScore {
  const expectedAbstentions = scorerInput.annotation.expectedAbstentions;
  let numerator = 0;
  const notes: string[] = [];

  for (const expectedAbstention of expectedAbstentions) {
    const result = scoreExpectedAbstention({
      expectedAbstention,
      emittedAbstentions: scorerInput.runnerOutput.normalized.abstentions,
      emittedValuations: scorerInput.runnerOutput.normalized.valuations,
      evidenceLookup
    });

    numerator += result.score;
    notes.push(...result.notes);
  }

  return ratioMetric({
    metricId: "abstention-behavior",
    numerator: roundMetricNumber(numerator),
    denominator: expectedAbstentions.length,
    zeroDenominatorNote: "No expected abstentions were annotated."
  }, uniqueSorted(notes));
}

function scoreExpectedAbstention(options: {
  readonly expectedAbstention: BenchmarkExpectedAbstention;
  readonly emittedAbstentions: readonly BenchmarkEmittedAbstention[];
  readonly emittedValuations: readonly BenchmarkEmittedValuation[];
  readonly evidenceLookup: EvidenceLookup;
}): {
  readonly score: number;
  readonly notes: readonly string[];
} {
  const expected = options.expectedAbstention;
  const emittedAbstention = options.emittedAbstentions.find(
    (candidate) => candidate.field === expected.field
  );
  const emittedValuation = options.emittedValuations.find(
    (candidate) => candidate.field === expected.field
  );
  const notes: string[] = [];

  if (emittedAbstention === undefined) {
    if (emittedValuation?.status === "concluded") {
      notes.push(`${expected.id}: expected ${expected.field} abstention but valuation was concluded.`);
    } else if (emittedValuation?.status === "omitted") {
      notes.push(`${expected.id}: expected ${expected.field} abstention but valuation was omitted.`);
    } else if (emittedValuation?.status === "abstained") {
      notes.push(`${expected.id}: expected ${expected.field} abstention lacked a normalized reason code.`);
    } else {
      notes.push(`${expected.id}: expected ${expected.field} abstention was not emitted.`);
    }

    return {
      score: 0,
      notes
    };
  }

  const reasonScore =
    emittedAbstention.reasonCode === expected.reasonCode ||
    tokenCoverage(expected.description, emittedAbstention.explanation) >= 0.25
      ? 1
      : 0;
  const evidenceScore = evidenceIdsCoverage(
    emittedAbstention.evidenceIds.filter((evidenceId) =>
      cutoffVisibleEvidenceExists(evidenceId, options.evidenceLookup)
    ),
    expected.evidenceIds
  );
  const score = (reasonScore + evidenceScore) / 2;

  if (reasonScore === 0) {
    notes.push(
      `${expected.id}: emitted reason ${emittedAbstention.reasonCode} did not match ${expected.reasonCode}.`
    );
  }

  if (evidenceScore === 0) {
    notes.push(`${expected.id}: abstention did not cite expected cutoff-visible evidence.`);
  }

  return {
    score,
    notes: notes.sort(compareStrings)
  };
}

function scoreValuationSeparation(scorerInput: BenchmarkScorerInput): BenchmarkMetricScore {
  const expectations = scorerInput.annotation.valuationSeparationExpectations;
  const allowedFields = new Set(expectations.allowedValuationFields);
  const concludedValuations = scorerInput.runnerOutput.normalized.valuations
    .filter((valuation) => valuation.status === "concluded")
    .sort(compareValuations);
  const violations: string[] = [];

  for (const valuation of concludedValuations) {
    if (!allowedFields.has(valuation.field)) {
      violations.push(`${valuation.field} was concluded without annotation permission.`);
    }
  }

  for (let leftIndex = 0; leftIndex < concludedValuations.length; leftIndex += 1) {
    const left = concludedValuations[leftIndex];

    if (left === undefined || left.value === undefined) {
      continue;
    }

    for (let rightIndex = leftIndex + 1; rightIndex < concludedValuations.length; rightIndex += 1) {
      const right = concludedValuations[rightIndex];

      if (
        right !== undefined &&
        right.value !== undefined &&
        left.field !== right.field &&
        factValuesEqual(left.value, right.value) &&
        left.unit === right.unit
      ) {
        violations.push(
          `${left.field} and ${right.field} reused the same value/unit, indicating possible conflation.`
        );
      }
    }
  }

  const value = violations.length === 0 ? 1 : 0;
  const notes =
    violations.length === 0
      ? [
          concludedValuations.length === 0
            ? "No valuation conclusions were emitted, so no valuation-field conflation was detected."
            : "Concluded valuation fields stayed within the annotation's allowed valuation fields."
        ]
      : violations.sort(compareStrings);

  return ratioMetric({
    metricId: "valuation-separation",
    numerator: value,
    denominator: 1,
    zeroDenominatorNote: "Valuation separation has no denominator."
  }, notes);
}

function scoreHistoricalValuationError(
  scorerInput: BenchmarkScorerInput,
  evidenceLookup: EvidenceLookup
): BenchmarkMetricScore {
  const historicalTargets = scorerInput.annotation.historicalValuationTargets;

  if (!historicalTargets.eligible) {
    return skippedMetric("historical-valuation-error", historicalTargets.reason);
  }

  const validTargets = historicalTargets.targets.filter((target) =>
    isValidHistoricalValuationTarget(target, evidenceLookup)
  );
  const invalidTargetNotes = historicalTargets.targets
    .filter((target) => !isValidHistoricalValuationTarget(target, evidenceLookup))
    .map((target) => `${target.id}: skipped because the target is not a scalar numeric field with valid target evidence.`);

  if (validTargets.length === 0) {
    return skippedMetric("historical-valuation-error", [
      "No valid scalar historical valuation targets were available for this case.",
      ...invalidTargetNotes
    ]);
  }

  let numerator = 0;
  const notes: string[] = [...invalidTargetNotes];

  for (const target of validTargets) {
    const emittedValue = emittedHistoricalValuationValue(scorerInput, target);
    const expectedValue = target.expectedValue;

    if (typeof expectedValue !== "number") {
      continue;
    }

    if (emittedValue === undefined) {
      notes.push(`${target.id}: no comparable emitted valuation was available.`);
      continue;
    }

    const targetScore = historicalValuationAccuracy(emittedValue.value, expectedValue);

    numerator += targetScore;

    if (targetScore < 1) {
      notes.push(
        `${target.id}: emitted ${String(emittedValue.value)} ${emittedValue.unit ?? ""} versus expected ${String(expectedValue)} ${target.unit}.`.trim()
      );
    }
  }

  return ratioMetric({
    metricId: "historical-valuation-error",
    numerator: roundMetricNumber(numerator),
    denominator: validTargets.length,
    zeroDenominatorNote: "No valid scalar historical valuation targets were available for this case."
  }, uniqueSorted(notes));
}

function scoreCompleteness(
  scorerInput: BenchmarkScorerInput,
  evidenceLookup: EvidenceLookup
): BenchmarkMetricScore {
  const expectations = scorerInput.annotation.completenessExpectations;
  const outputText = outputSearchText(scorerInput);
  const citedEvidenceIds = emittedEvidenceIds(scorerInput);
  let numerator = 0;
  const notes: string[] = [];

  for (const expectation of expectations) {
    const topicCoverage = expectation.requiredTopics.filter((topic) =>
      tokenCoverage(topic, outputText) >= 0.6
    ).length / expectation.requiredTopics.length;
    const classCoverage = expectation.requiredEvidenceClasses.filter((sourceClass) =>
      citedEvidenceIds.some((evidenceId) => {
        const record = evidenceLookup.evidenceById.get(evidenceId);

        return record?.sourceClass === sourceClass;
      })
    ).length / expectation.requiredEvidenceClasses.length;
    const expectationScore = (topicCoverage + classCoverage) / 2;

    numerator += expectationScore;

    if (expectationScore < 1) {
      notes.push(
        `${expectation.id}: topic coverage ${formatMetricRatio(topicCoverage)}, evidence-class coverage ${formatMetricRatio(classCoverage)}.`
      );
    }
  }

  return ratioMetric({
    metricId: "completeness",
    numerator: roundMetricNumber(numerator),
    denominator: expectations.length,
    zeroDenominatorNote: "No completeness expectations were annotated."
  }, uniqueSorted(notes));
}

function reproducibilityCaseMetric(): BenchmarkMetricScore {
  return skippedMetric(
    "reproducibility",
    "Per-case reproducibility requires aggregate comparison across repeated runs."
  );
}

function completionStatusMetric(scorerInput: BenchmarkScorerInput): BenchmarkMetricScore {
  return ratioMetric({
    metricId: "completion-status",
    numerator: scorerInput.runnerOutput.status === "completed" ? 1 : 0,
    denominator: 1,
    zeroDenominatorNote: "Completion status has no denominator."
  }, scorerInput.runnerOutput.status === "completed" ? [] : ["Runner status was failed."]);
}

function durationMetric(scorerInput: BenchmarkScorerInput): BenchmarkMetricScore {
  const durationMs = scorerInput.runnerOutput.timing.durationMs;

  if (durationMs === undefined) {
    return ratioMetric({
      metricId: "duration",
      numerator: 0,
      denominator: 1,
      zeroDenominatorNote: "Duration has no denominator."
    }, ["Runner timing did not include durationMs."]);
  }

  const value = durationScore(durationMs);

  return ratioMetric({
    metricId: "duration",
    numerator: value,
    denominator: 1,
    zeroDenominatorNote: "Duration has no denominator."
  }, [`durationMs=${String(durationMs)}`]);
}

function failureRecordsMetric(scorerInput: BenchmarkScorerInput): BenchmarkMetricScore {
  const failureCount = scorerInput.runnerOutput.failures.length;

  return ratioMetric({
    metricId: "failure-records",
    numerator: failureCount === 0 ? 1 : 0,
    denominator: 1,
    zeroDenominatorNote: "Failure records have no denominator."
  }, failureCount === 0
    ? []
    : scorerInput.runnerOutput.failures
        .map((failure) => `${failure.failureId}: ${failure.message}`)
        .sort(compareStrings));
}

function skippedMetric(metricId: string, notes: string | readonly string[]): BenchmarkMetricScore {
  return {
    metricId,
    status: "skipped",
    numerator: 0,
    denominator: 0,
    notes: typeof notes === "string" ? [notes] : [...notes].sort(compareStrings)
  };
}

function evidenceIdsCoverage(
  emittedEvidenceIds: readonly string[],
  expectedEvidenceIds: readonly string[]
): number {
  if (expectedEvidenceIds.length === 0) {
    return 0;
  }

  const emitted = new Set(emittedEvidenceIds);
  const matchedCount = expectedEvidenceIds.filter((evidenceId) => emitted.has(evidenceId)).length;

  return matchedCount / expectedEvidenceIds.length;
}

function cutoffVisibleEvidenceExists(
  evidenceId: string,
  evidenceLookup: EvidenceLookup
): boolean {
  return evidenceLookup.evidenceById.has(evidenceId);
}

function isValidHistoricalValuationTarget(
  target: BenchmarkHistoricalValuationTarget,
  evidenceLookup: EvidenceLookup
): boolean {
  return (
    typeof target.expectedValue === "number" &&
    target.sourceEvidenceIds.every((evidenceId) =>
      target.sourceAvailability === "cutoff-input-visible"
        ? evidenceLookup.evidenceById.has(evidenceId)
        : evidenceLookup.evidenceById.has(evidenceId) || evidenceLookup.excludedById.has(evidenceId)
    )
  );
}

function emittedHistoricalValuationValue(
  scorerInput: BenchmarkScorerInput,
  target: BenchmarkHistoricalValuationTarget
): {
  readonly value: number;
  readonly unit?: string;
} | undefined {
  if (valuationFieldSet.has(target.eligibleField)) {
    const emittedValuation = scorerInput.runnerOutput.normalized.valuations.find(
      (valuation) =>
        valuation.field === target.eligibleField &&
        valuation.status === "concluded" &&
        typeof valuation.value === "number" &&
        valuation.unit === target.unit
    );

    if (emittedValuation !== undefined && typeof emittedValuation.value === "number") {
      return {
        value: emittedValuation.value,
        ...(emittedValuation.unit !== undefined ? { unit: emittedValuation.unit } : {})
      };
    }
  }

  const targetNeedles = [
    target.id,
    target.eligibleField,
    target.targetKind
  ].map(normalizeIdentifierToken);
  const emittedClaim = scorerInput.runnerOutput.normalized.claims.find((claim) => {
    if (claim.kind !== "valuation" || typeof claim.value !== "number" || claim.unit !== target.unit) {
      return false;
    }

    const haystack = normalizeIdentifierToken(`${claim.id} ${claim.statement}`);

    return targetNeedles.some((needle) => needle.length > 0 && haystack.includes(needle));
  });

  if (emittedClaim === undefined || typeof emittedClaim.value !== "number") {
    return undefined;
  }

  return {
    value: emittedClaim.value,
    ...(emittedClaim.unit !== undefined ? { unit: emittedClaim.unit } : {})
  };
}

function historicalValuationAccuracy(emittedValue: number, expectedValue: number): number {
  if (expectedValue === 0) {
    return emittedValue === 0 ? 1 : 0;
  }

  const absolutePercentageError = Math.abs(emittedValue - expectedValue) / Math.abs(expectedValue);

  return roundMetricNumber(Math.max(0, 1 - Math.min(1, absolutePercentageError)));
}

function outputSearchText(scorerInput: BenchmarkScorerInput): string {
  return [
    scorerInput.runnerOutput.rawOutput.markdown,
    scorerInput.runnerOutput.rawOutput.text,
    stableStringify(scorerInput.runnerOutput.rawOutput.json),
    ...scorerInput.runnerOutput.normalized.claims.map((claim) => claim.statement),
    scorerInput.runnerOutput.normalized.route.status === "selected"
      ? scorerInput.runnerOutput.normalized.route.rationale
      : scorerInput.runnerOutput.normalized.route.status === "abstained"
        ? scorerInput.runnerOutput.normalized.route.explanation
        : undefined,
    ...scorerInput.runnerOutput.normalized.abstentions.map((abstention) =>
      `${abstention.reasonCode} ${abstention.explanation}`
    ),
    ...scorerInput.runnerOutput.normalized.valuations.map((valuation) =>
      `${valuation.field} ${valuation.status} ${valuation.rationale ?? ""}`
    )
  ].filter((part): part is string => part !== undefined).join("\n");
}

function emittedEvidenceIds(scorerInput: BenchmarkScorerInput): string[] {
  return uniqueSorted([
    ...scorerInput.runnerOutput.normalized.claims.flatMap((claim) =>
      claim.citations.map((citation) => citation.evidenceId)
    ),
    ...(scorerInput.runnerOutput.normalized.route.status === "omitted"
      ? []
      : scorerInput.runnerOutput.normalized.route.evidenceIds),
    ...scorerInput.runnerOutput.normalized.abstentions.flatMap((abstention) =>
      abstention.evidenceIds
    ),
    ...scorerInput.runnerOutput.normalized.valuations.flatMap((valuation) =>
      valuation.evidenceIds
    )
  ]);
}

function durationScore(durationMs: number): number {
  const fullCreditMs = 60_000;
  const zeroCreditMs = 300_000;

  if (durationMs <= fullCreditMs) {
    return 1;
  }

  if (durationMs >= zeroCreditMs) {
    return 0;
  }

  return roundMetricNumber(1 - (durationMs - fullCreditMs) / (zeroCreditMs - fullCreditMs));
}

function formatMetricRatio(value: number): string {
  return roundMetricNumber(value).toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
}

function orderedMetrics(metrics: readonly BenchmarkMetricScore[]): BenchmarkMetricScore[] {
  const order = new Map<string, number>(metricIds.map((metricId, index) => [metricId, index]));

  return [...metrics].sort((left, right) => {
    const leftOrder = order.get(left.metricId);
    const rightOrder = order.get(right.metricId);

    if (leftOrder !== undefined || rightOrder !== undefined) {
      return (leftOrder ?? Number.MAX_SAFE_INTEGER) - (rightOrder ?? Number.MAX_SAFE_INTEGER);
    }

    return compareStrings(left.metricId, right.metricId);
  });
}

function normalizeIdentifierToken(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "");
}

function buildEvidenceLookup(scorerInput: BenchmarkScorerInput): EvidenceLookup {
  const evidenceById = new Map(
    scorerInput.caseInput.evidenceLedger.evidence.map((record) => [record.id, record])
  );
  const excludedById = new Map<string, ExcludedEvidenceRecord>();

  for (const excludedRecord of scorerInput.caseInput.evidenceLedger.excludedRecords) {
    excludedById.set(excludedRecord.recordId, excludedRecord);
    excludedById.set(evidenceIdForSourceUrl(excludedRecord.sourceUrl), excludedRecord);
  }

  return {
    evidenceById,
    excludedById
  };
}

function bestExpectedMatch(
  emittedClaim: DedupedEmittedClaim,
  expectedClaims: readonly ExpectedMaterialClaim[]
): ExpectedMaterialClaim | undefined {
  const candidates = expectedClaims
    .filter((expectedClaim) => expectedClaim.kind === emittedClaim.kind)
    .map((expectedClaim) => ({
      expectedClaim,
      score: expectedMatchScore(emittedClaim, expectedClaim)
    }))
    .filter((candidate) => candidate.score >= expectedMatchThreshold(emittedClaim.kind))
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return compareStrings(left.expectedClaim.id, right.expectedClaim.id);
    });
  const bestCandidate = candidates[0];

  return bestCandidate?.expectedClaim;
}

function expectedMatchScore(
  emittedClaim: DedupedEmittedClaim,
  expectedClaim: ExpectedMaterialClaim
): number {
  const statementScore = tokenCoverage(expectedClaim.statement, emittedClaim.statement) * 4;
  const valueScore = claimValueSupportsExpected(emittedClaim, expectedClaim) ? 4 : 0;
  const unitScore = unitSupportsExpected(emittedClaim, expectedClaim) ? 1.5 : 0;
  const periodScore = periodSupportsExpected(emittedClaim, expectedClaim) ? 1.5 : 0;
  const citationScore = emittedClaim.citations.some((citation) =>
    expectedClaim.evidenceIds.includes(citation.evidenceId)
  )
    ? 1
    : 0;

  return statementScore + valueScore + unitScore + periodScore + citationScore;
}

function expectedMatchThreshold(kind: BenchmarkScoredClaimKind): number {
  return kind === "binary" ? 4.5 : 6;
}

function claimValueSupportsExpected(
  emittedClaim: DedupedEmittedClaim,
  expectedClaim: ExpectedMaterialClaim
): boolean {
  return (
    emittedClaim.value !== undefined &&
    factValuesEqual(emittedClaim.value, expectedClaim.expectedValue)
  );
}

function unitSupportsExpected(
  emittedClaim: DedupedEmittedClaim,
  expectedClaim: ExpectedMaterialClaim | undefined
): boolean {
  if (expectedClaim === undefined || expectedClaim.unit === undefined) {
    return true;
  }

  return emittedClaim.unit === expectedClaim.unit;
}

function periodSupportsExpected(
  emittedClaim: DedupedEmittedClaim,
  expectedClaim: ExpectedMaterialClaim | undefined
): boolean {
  if (expectedClaim === undefined || expectedClaim.period === undefined) {
    return true;
  }

  return (
    emittedClaim.period !== undefined &&
    stableStringify(emittedClaim.period) === stableStringify(expectedClaim.period)
  );
}

function wordingSupportsExpected(options: {
  readonly evidence: EvidenceRecord | undefined;
  readonly citation: BenchmarkCitation;
  readonly emittedClaim: DedupedEmittedClaim;
  readonly expectedClaim: ExpectedMaterialClaim | undefined;
}): boolean {
  const expectedClaim = options.expectedClaim;

  if (expectedClaim === undefined) {
    return false;
  }

  if (!claimValueSupportsExpected(options.emittedClaim, expectedClaim)) {
    return false;
  }

  if (tokenCoverage(expectedClaim.statement, options.emittedClaim.statement) >= 0.35) {
    return true;
  }

  return citedFacts(options.evidence, options.citation).some((fact) =>
    factSupportsExpectedClaim(fact, expectedClaim)
  );
}

function factSupportsExpectedClaim(
  fact: ObservedFact,
  expectedClaim: ExpectedMaterialClaim
): boolean {
  return (
    fact.value !== undefined &&
    factValuesEqual(fact.value, expectedClaim.expectedValue) &&
    (expectedClaim.unit === undefined || fact.unit === expectedClaim.unit) &&
    (expectedClaim.period === undefined ||
      (fact.period !== undefined &&
        stableStringify(fact.period) === stableStringify(expectedClaim.period))) &&
    tokenCoverage(expectedClaim.statement, fact.statement) >= 0.35
  );
}

function citedFacts(
  evidence: EvidenceRecord | undefined,
  citation: BenchmarkCitation
): readonly ObservedFact[] {
  if (evidence === undefined) {
    return [];
  }

  if (citation.factId === undefined) {
    return evidence.observedFacts;
  }

  return evidence.observedFacts.filter((fact) => fact.id === citation.factId);
}

function sourceDatesCutoffCompliant(record: EvidenceRecord, cutoffDate: string): boolean {
  return [record.publishedDate, record.effectiveDate]
    .filter((date): date is string => date !== undefined)
    .every((date) => date <= cutoffDate);
}

function sourceDateSupportsClaimPeriod(
  record: EvidenceRecord,
  emittedClaim: DedupedEmittedClaim,
  expectedClaim: ExpectedMaterialClaim | undefined,
  cutoffDate: string
): boolean {
  const sourceDate = record.publishedDate ?? record.effectiveDate;

  if (sourceDate === undefined || sourceDate > cutoffDate) {
    return false;
  }

  const period = expectedClaim?.period ?? emittedClaim.period;
  const latestPeriodDate = period === undefined ? undefined : maxPeriodDate(period);

  return latestPeriodDate === undefined || latestPeriodDate <= cutoffDate;
}

function maxPeriodDate(period: FactPeriod): string | undefined {
  return [period.startDate, period.endDate, period.instantDate]
    .filter((date): date is string => date !== undefined)
    .sort(compareStrings)
    .at(-1);
}

function claimSourceQuality(citationScores: readonly BenchmarkCitationScore[]): BenchmarkClaimScore["sourceQuality"] {
  const weightedCitations = citationScores.filter(
    (citationScore): citationScore is BenchmarkCitationScore & {
      readonly sourceQualityCategory: BenchmarkSourceQualityCategory;
      readonly sourceQualityWeight: number;
      readonly sourceClass: SourceClass;
    } =>
      citationScore.retrievable &&
      citationScore.cutoffCompliant &&
      citationScore.sourceQualityCategory !== undefined &&
      citationScore.sourceQualityWeight !== undefined &&
      citationScore.sourceClass !== undefined
  );
  const score =
    weightedCitations.length === 0
      ? 0
      : Math.max(...weightedCitations.map((citationScore) => citationScore.sourceQualityWeight));

  return {
    score,
    citedSourceClasses: uniqueSorted(weightedCitations.map((citationScore) => citationScore.sourceClass)),
    citedSourceQualityCategories: uniqueSorted(
      weightedCitations.map((citationScore) => citationScore.sourceQualityCategory)
    ),
    notes:
      weightedCitations.length === 0
        ? ["No retrievable cutoff-compliant cited source class was available."]
        : []
  };
}

function claimNotes(options: {
  readonly emittedClaim: DedupedEmittedClaim;
  readonly expectedClaim: ExpectedMaterialClaim | undefined;
  readonly supportStatus: BenchmarkClaimSupportStatus;
  readonly citationScores: readonly BenchmarkCitationScore[];
}): string[] {
  const notes: string[] = [];

  if (options.expectedClaim === undefined) {
    notes.push("No annotation claim matched the emitted material claim.");
  }

  if (options.emittedClaim.duplicateEmittedClaimIds.length > 0) {
    notes.push(
      `Deduplicated repeated emitted claim ids: ${options.emittedClaim.duplicateEmittedClaimIds.join(", ")}.`
    );
  }

  if (options.supportStatus !== "supported") {
    notes.push(`Material claim remains in the precision denominator as ${options.supportStatus}.`);
  }

  if (
    options.citationScores.length > 0 &&
    options.citationScores.every((citationScore) => !citationScore.valid)
  ) {
    notes.push("No citation satisfied all evidence existence, cutoff, and support checks.");
  }

  return notes.sort(compareStrings);
}

function citationNotes(options: {
  readonly evidenceIdExists: boolean;
  readonly retrievable: boolean;
  readonly sourceUrlPresent: boolean;
  readonly cutoffCompliant: boolean;
  readonly sourceDateAligned: boolean;
  readonly supportsEntity: boolean;
  readonly supportsPeriod: boolean;
  readonly supportsUnit: boolean;
  readonly supportsWording: boolean;
  readonly excluded: ExcludedEvidenceRecord | undefined;
}): string[] {
  const notes: string[] = [];

  if (!options.evidenceIdExists) {
    notes.push("Evidence ID was not found in the run ledger or excluded-record index.");
  }

  if (options.excluded !== undefined) {
    notes.push(`Evidence was excluded as post-cutoff: ${options.excluded.publishedDate}.`);
  }

  if (!options.retrievable) {
    notes.push("Citation is not retrievable from the cutoff-visible run ledger.");
  }

  if (!options.sourceUrlPresent) {
    notes.push("Citation source URL is missing.");
  }

  if (!options.cutoffCompliant) {
    notes.push("Citation source is not cutoff-compliant.");
  }

  if (!options.sourceDateAligned) {
    notes.push("Citation source date does not align with the claim period and cutoff.");
  }

  if (!options.supportsEntity) {
    notes.push("Citation does not support the annotated entity/source relationship.");
  }

  if (!options.supportsPeriod) {
    notes.push("Citation does not support the expected claim period.");
  }

  if (!options.supportsUnit) {
    notes.push("Citation does not support the expected claim unit.");
  }

  if (!options.supportsWording) {
    notes.push("Citation does not support the expected claim wording/value.");
  }

  return notes.sort(compareStrings);
}

function factValuesEqual(left: FactValue, right: FactValue): boolean {
  return stableStringify(normalizeFactValue(left)) === stableStringify(normalizeFactValue(right));
}

function normalizeFactValue(value: FactValue | undefined): unknown {
  if (typeof value === "string") {
    return value.trim().toLowerCase();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeFactValue(item)).sort(compareNormalizedValues);
  }

  return value;
}

function compareNormalizedValues(left: unknown, right: unknown): number {
  return compareStrings(stableStringify(left), stableStringify(right));
}

function tokenCoverage(expectedStatement: string, actualStatement: string): number {
  const expectedTokens = uniqueSorted(tokens(expectedStatement));
  const actualTokens = new Set(tokens(actualStatement));

  if (expectedTokens.length === 0) {
    return 0;
  }

  const matchedCount = expectedTokens.filter((token) => actualTokens.has(token)).length;

  return matchedCount / expectedTokens.length;
}

function tokens(statement: string): string[] {
  return normalizeStatement(statement)
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "had",
  "in",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "was",
  "were",
  "with"
]);

function normalizeStatement(statement: string): string {
  return statement.trim().toLowerCase().replace(/\s+/gu, " ");
}

function sortedUniqueCitations(citations: readonly BenchmarkCitation[]): BenchmarkCitation[] {
  const citationByKey = new Map(
    citations.map((citation) => [
      stableStringify({
        evidenceId: citation.evidenceId,
        factId: citation.factId,
        locator: citation.locator
      }),
      citation
    ])
  );

  return Array.from(citationByKey.values()).sort(compareCitations);
}

function isMaterialClaimKind(kind: BenchmarkEmittedClaim["kind"]): kind is BenchmarkScoredClaimKind {
  return kind === "binary" || kind === "observable";
}

function roundMetricNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => compareStrings(leftKey, rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function compareExpectedClaims(
  left: ExpectedMaterialClaim,
  right: ExpectedMaterialClaim
): number {
  return compareTuple([left.kind, left.id], [right.kind, right.id]);
}

function compareEmittedClaims(
  left: BenchmarkEmittedClaim,
  right: BenchmarkEmittedClaim
): number {
  return compareTuple(
    [
      left.kind,
      normalizeStatement(left.statement),
      stableStringify(normalizeFactValue(left.value)),
      left.unit ?? "",
      stableStringify(left.period),
      left.id
    ],
    [
      right.kind,
      normalizeStatement(right.statement),
      stableStringify(normalizeFactValue(right.value)),
      right.unit ?? "",
      stableStringify(right.period),
      right.id
    ]
  );
}

function compareDedupedEmittedClaims(
  left: DedupedEmittedClaim,
  right: DedupedEmittedClaim
): number {
  return compareTuple(
    [
      left.kind,
      normalizeStatement(left.statement),
      stableStringify(normalizeFactValue(left.value)),
      left.unit ?? "",
      stableStringify(left.period),
      left.id
    ],
    [
      right.kind,
      normalizeStatement(right.statement),
      stableStringify(normalizeFactValue(right.value)),
      right.unit ?? "",
      stableStringify(right.period),
      right.id
    ]
  );
}

function compareClaimScores(left: BenchmarkClaimScore, right: BenchmarkClaimScore): number {
  return compareTuple(
    [
      left.kind,
      left.expectedClaimId ?? "",
      left.emittedClaimId ?? "",
      left.supportStatus,
      left.claimId
    ],
    [
      right.kind,
      right.expectedClaimId ?? "",
      right.emittedClaimId ?? "",
      right.supportStatus,
      right.claimId
    ]
  );
}

function compareCitationScores(
  left: BenchmarkCitationScore,
  right: BenchmarkCitationScore
): number {
  return compareTuple(
    [left.evidenceId, left.factId ?? ""],
    [right.evidenceId, right.factId ?? ""]
  );
}

function compareCitations(left: BenchmarkCitation, right: BenchmarkCitation): number {
  return compareTuple(
    [left.evidenceId, left.factId ?? "", left.locator ?? ""],
    [right.evidenceId, right.factId ?? "", right.locator ?? ""]
  );
}

function compareValuations(
  left: BenchmarkEmittedValuation,
  right: BenchmarkEmittedValuation
): number {
  return compareTuple([left.field, left.status], [right.field, right.status]);
}

function compareFailures(left: BenchmarkFailureRecord, right: BenchmarkFailureRecord): number {
  return compareTuple(
    [left.stage, left.severity, left.failureId],
    [right.stage, right.severity, right.failureId]
  );
}

function compareTuple(left: readonly string[], right: readonly string[]): number {
  const length = Math.max(left.length, right.length);

  for (let index = 0; index < length; index += 1) {
    const comparison = compareStrings(left[index] ?? "", right[index] ?? "");

    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
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
