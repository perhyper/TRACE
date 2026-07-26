import { reviewSchema } from "../domain/schemas.js";
import type {
  EvidenceRecord,
  MissingInformation,
  Review,
  ReviewFinding,
  RouteDecision,
  Sufficiency,
  ValuationConclusion,
  ValuationOutput
} from "../domain/schemas.js";
import type { EvidenceLedger } from "../providers/evidence-bundle.js";

export interface RuntimeReviewInput {
  readonly ledger: EvidenceLedger;
  readonly sufficiency: Sufficiency;
  readonly route: RouteDecision;
  readonly valuation: ValuationOutput;
}

interface CitationUse {
  readonly location: string;
  readonly evidenceIds: readonly string[];
  readonly requiresCitation: boolean;
}

interface SecurityInformationCoverage {
  readonly hasShareRights: boolean;
  readonly hasPreferences: boolean;
  readonly hasDilution: boolean;
  readonly hasCapTable: boolean;
}

const reviewerVersion = "trace-reviewer.v1";

export function reviewRuntimeResult(input: RuntimeReviewInput): Review {
  const findings = [
    reviewEntityCertainty(input.ledger),
    reviewEvidenceCoverage(input.ledger, input.sufficiency),
    reviewCitationSupport(input),
    reviewCutoffCompliance(input.ledger),
    reviewRouteAppropriateness(input.sufficiency, input.route, input.valuation),
    reviewCalculationIntegrity(input.valuation),
    reviewValuationFieldSeparation(input.valuation),
    reviewAbstentionTriggers(input.ledger, input.valuation)
  ].sort(compareReviewFindings);
  const status = findings.some((finding) => finding.severity === "fail")
    ? "failed"
    : findings.some((finding) => finding.severity === "warning")
      ? "warnings"
      : "passed";

  return reviewSchema.parse({
    status,
    reviewerVersion,
    findings
  });
}

function reviewEntityCertainty(ledger: EvidenceLedger): ReviewFinding {
  const evidenceIds = identityEvidenceIds(ledger);

  if (ledger.target.identityConfidence === "unresolved") {
    return finding({
      id: "review-entity-certainty",
      severity: "fail",
      category: "entity",
      message: "Target identity is unresolved, so TRACE cannot support entity-specific conclusions.",
      evidenceIds,
      missingInformation: [
        {
          id: "missing-resolved-entity-identity",
          topic: "Resolved company identity",
          description: "The evidence bundle does not resolve the target legal entity.",
          consequence: "TRACE cannot tie route or valuation conclusions to a specific company.",
          requiredFor: ["entity-resolution", "routing", "headline-valuation"]
        }
      ]
    });
  }

  if (ledger.target.identityConfidence === "ambiguous" || evidenceIds.length === 0) {
    return finding({
      id: "review-entity-certainty",
      severity: "warning",
      category: "entity",
      message:
        ledger.target.identityConfidence === "ambiguous"
          ? "Target identity is marked ambiguous and should be resolved before relying on conclusions."
          : "Target identity is marked resolved but no included evidence explicitly mentions the legal name, alias, or identifier.",
      evidenceIds,
      missingInformation:
        evidenceIds.length === 0
          ? [
              {
                id: "missing-entity-citation",
                topic: "Entity identity citation",
                description:
                  "No included evidence record explicitly cites the target legal name, alias, or identifier.",
                consequence: "TRACE output should be reviewed for possible entity mismatch.",
                requiredFor: ["entity-resolution"]
              }
            ]
          : []
    });
  }

  return finding({
    id: "review-entity-certainty",
    severity: "pass",
    category: "entity",
    message: "Target identity is resolved and supported by included evidence.",
    evidenceIds,
    missingInformation: []
  });
}

function reviewEvidenceCoverage(ledger: EvidenceLedger, sufficiency: Sufficiency): ReviewFinding {
  if (ledger.evidence.length === 0) {
    return finding({
      id: "review-evidence-coverage",
      severity: "fail",
      category: "evidence",
      message: "No eligible evidence records remain after provider validation.",
      evidenceIds: [],
      missingInformation: sufficiency.missingInformation
    });
  }

  if (sufficiency.status === "insufficient") {
    return finding({
      id: "review-evidence-coverage",
      severity: "warning",
      category: "evidence",
      message: "Evidence coverage is insufficient for a supported analysis route.",
      evidenceIds: sortedEvidenceIds(ledger.evidence),
      missingInformation: sufficiency.missingInformation
    });
  }

  return finding({
    id: "review-evidence-coverage",
    severity: "pass",
    category: "evidence",
    message: "Evidence coverage satisfies the sufficiency gate for route selection.",
    evidenceIds: sortedEvidenceIds(ledger.evidence),
    missingInformation: []
  });
}

function reviewCitationSupport(input: RuntimeReviewInput): ReviewFinding {
  const evidenceIdSet = new Set(input.ledger.evidence.map((record) => record.id));
  const citationUses = collectCitationUses(input);
  const missingCitationLocations = citationUses
    .filter((citationUse) => citationUse.requiresCitation && citationUse.evidenceIds.length === 0)
    .map((citationUse) => citationUse.location)
    .sort(compareStrings);
  const unknownEvidenceIds = uniqueSorted(
    citationUses
      .flatMap((citationUse) => citationUse.evidenceIds)
      .filter((evidenceId) => !evidenceIdSet.has(evidenceId))
  );
  const citedEvidenceIds = uniqueSorted(
    citationUses.flatMap((citationUse) =>
      citationUse.evidenceIds.filter((evidenceId) => evidenceIdSet.has(evidenceId))
    )
  );

  if (missingCitationLocations.length > 0 || unknownEvidenceIds.length > 0) {
    return finding({
      id: "review-citation-support",
      severity: "fail",
      category: "evidence",
      message: [
        "Material runtime claims are missing valid evidence citations.",
        missingCitationLocations.length > 0
          ? `Missing citations: ${missingCitationLocations.join(", ")}.`
          : undefined,
        unknownEvidenceIds.length > 0
          ? `Unknown evidence IDs: ${unknownEvidenceIds.join(", ")}.`
          : undefined
      ]
        .filter((part): part is string => part !== undefined)
        .join(" "),
      evidenceIds: uniqueSorted([...citedEvidenceIds, ...unknownEvidenceIds]),
      missingInformation: []
    });
  }

  return finding({
    id: "review-citation-support",
    severity: "pass",
    category: "evidence",
    message: "Sufficiency, route, and valuation claims cite included evidence IDs where citations are required.",
    evidenceIds: citedEvidenceIds,
    missingInformation: []
  });
}

function reviewCutoffCompliance(ledger: EvidenceLedger): ReviewFinding {
  const leakingEvidence = ledger.evidence.filter(
    (record) => record.publishedDate !== undefined && record.publishedDate > ledger.measurementDate
  );

  if (leakingEvidence.length > 0) {
    return finding({
      id: "review-cutoff-compliance",
      severity: "fail",
      category: "cutoff",
      message: "Evidence published after the measurement date is present in the runtime ledger.",
      evidenceIds: leakingEvidence.map((record) => record.id),
      missingInformation: []
    });
  }

  if (ledger.excludedRecords.length > 0) {
    return finding({
      id: "review-cutoff-compliance",
      severity: "warning",
      category: "cutoff",
      message:
        "Post-measurement-date evidence was excluded by provider validation and remains visible in warnings.",
      evidenceIds: sortedEvidenceIds(ledger.evidence),
      missingInformation: []
    });
  }

  return finding({
    id: "review-cutoff-compliance",
    severity: "pass",
    category: "cutoff",
    message: "Included evidence satisfies the measurement-date publication cutoff.",
    evidenceIds: sortedEvidenceIds(ledger.evidence),
    missingInformation: []
  });
}

function reviewRouteAppropriateness(
  sufficiency: Sufficiency,
  route: RouteDecision,
  valuation: ValuationOutput
): ReviewFinding {
  const concludedValuationFields = valuationConclusions(valuation)
    .filter((conclusion) => conclusion.status === "concluded")
    .map((conclusion) => conclusion.field)
    .sort(compareStrings);

  if (sufficiency.status === "insufficient" && route.status === "selected") {
    return finding({
      id: "review-route-appropriateness",
      severity: "fail",
      category: "route",
      message: "A route was selected despite an insufficient sufficiency result.",
      evidenceIds: routeEvidenceIds(route),
      missingInformation: sufficiency.missingInformation
    });
  }

  if (sufficiency.status === "sufficient" && route.status === "abstained") {
    return finding({
      id: "review-route-appropriateness",
      severity: "fail",
      category: "route",
      message: "The runtime abstained from route selection despite sufficient evidence coverage.",
      evidenceIds: routeEvidenceIds(route),
      missingInformation: route.abstention.missingInformation
    });
  }

  if (route.status === "abstained" && concludedValuationFields.length > 0) {
    return finding({
      id: "review-route-appropriateness",
      severity: "fail",
      category: "route",
      message: `Valuation fields were concluded despite route abstention: ${concludedValuationFields.join(", ")}.`,
      evidenceIds: routeEvidenceIds(route),
      missingInformation: route.abstention.missingInformation
    });
  }

  return finding({
    id: "review-route-appropriateness",
    severity: "pass",
    category: "route",
    message:
      route.status === "selected"
        ? `Route selection is consistent with sufficiency status: ${route.selectedRoute}.`
        : "Route abstention is consistent with insufficient evidence coverage.",
    evidenceIds: routeEvidenceIds(route),
    missingInformation: []
  });
}

function reviewCalculationIntegrity(valuation: ValuationOutput): ReviewFinding {
  const concluded = valuationConclusions(valuation).filter(
    (conclusion): conclusion is Extract<ValuationConclusion, { status: "concluded" }> =>
      conclusion.status === "concluded"
  );
  const invalidFields = concluded
    .filter((conclusion) => !moneyRangeIsInternallyConsistent(conclusion.range))
    .map((conclusion) => conclusion.field)
    .sort(compareStrings);
  const uncitedFields = concluded
    .filter((conclusion) => conclusion.basis.evidenceIds.length === 0)
    .map((conclusion) => conclusion.field)
    .sort(compareStrings);

  if (invalidFields.length > 0 || uncitedFields.length > 0) {
    return finding({
      id: "review-calculation-integrity",
      severity: "fail",
      category: "calculation",
      message: [
        "Concluded valuation calculations failed integrity checks.",
        invalidFields.length > 0 ? `Invalid ranges: ${invalidFields.join(", ")}.` : undefined,
        uncitedFields.length > 0 ? `Uncited calculations: ${uncitedFields.join(", ")}.` : undefined
      ]
        .filter((part): part is string => part !== undefined)
        .join(" "),
      evidenceIds: valuationEvidenceIds(valuation),
      missingInformation: []
    });
  }

  return finding({
    id: "review-calculation-integrity",
    severity: "pass",
    category: "calculation",
    message:
      concluded.length > 0
        ? "Concluded valuation ranges are internally ordered, unit-consistent, and evidence-cited."
        : "No concluded valuation calculations were emitted; abstentions are explicit.",
    evidenceIds: valuationEvidenceIds(valuation),
    missingInformation: []
  });
}

function reviewValuationFieldSeparation(valuation: ValuationOutput): ReviewFinding {
  const fieldMismatches = expectedValuationFields()
    .filter(([key, expectedField]) => valuation[key].field !== expectedField)
    .map(([, expectedField]) => expectedField);
  const copiedHeadlineFields = copiedHeadlineValuationFields(valuation);

  if (fieldMismatches.length > 0 || copiedHeadlineFields.length > 0) {
    return finding({
      id: "review-valuation-field-separation",
      severity: "fail",
      category: "valuation-separation",
      message: [
        "Valuation fields are not properly separated.",
        fieldMismatches.length > 0
          ? `Mismatched field keys: ${fieldMismatches.sort(compareStrings).join(", ")}.`
          : undefined,
        copiedHeadlineFields.length > 0
          ? `Headline calibration copied into: ${copiedHeadlineFields.join(", ")}.`
          : undefined
      ]
        .filter((part): part is string => part !== undefined)
        .join(" "),
      evidenceIds: valuationEvidenceIds(valuation),
      missingInformation: valuationMissingInformation(valuation)
    });
  }

  return finding({
    id: "review-valuation-field-separation",
    severity: "pass",
    category: "valuation-separation",
    message:
      "Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields.",
    evidenceIds: valuationEvidenceIds(valuation),
    missingInformation: []
  });
}

function reviewAbstentionTriggers(
  ledger: EvidenceLedger,
  valuation: ValuationOutput
): ReviewFinding {
  const abstentionsWithoutMissingInformation = valuationConclusions(valuation)
    .filter(
      (conclusion) =>
        conclusion.status === "abstained" && conclusion.abstention.missingInformation.length === 0
    )
    .map((conclusion) => conclusion.field)
    .sort(compareStrings);
  const securityMissingInformation = securityLevelMissingInformation(
    detectSecurityInformationCoverage(ledger.evidence)
  );
  const securityConclusionUnsupported =
    securityMissingInformation.length > 0 && valuation.securityLevelFairValue.status === "concluded";

  if (abstentionsWithoutMissingInformation.length > 0 || securityConclusionUnsupported) {
    return finding({
      id: "review-abstention-triggers",
      severity: "fail",
      category: "abstention",
      message: [
        "Abstention trigger checks failed.",
        abstentionsWithoutMissingInformation.length > 0
          ? `Abstentions without missing information: ${abstentionsWithoutMissingInformation.join(", ")}.`
          : undefined,
        securityConclusionUnsupported
          ? "Security-level fair value is concluded despite missing security rights, preferences, dilution, or cap-table evidence."
          : undefined
      ]
        .filter((part): part is string => part !== undefined)
        .join(" "),
      evidenceIds: valuationEvidenceIds(valuation),
      missingInformation: securityMissingInformation
    });
  }

  return finding({
    id: "review-abstention-triggers",
    severity: "pass",
    category: "abstention",
    message: "Abstained valuation fields include missing-information reasons, and security-level triggers are respected.",
    evidenceIds: valuationEvidenceIds(valuation),
    missingInformation: []
  });
}

function collectCitationUses(input: RuntimeReviewInput): CitationUse[] {
  return [
    ...input.sufficiency.criteria.map((criterion) => ({
      location: `sufficiency:${criterion.criterion}`,
      evidenceIds: criterion.evidenceIds,
      requiresCitation: true
    })),
    ...routeCitationUses(input.route),
    ...valuationConclusions(input.valuation).map((conclusion) => {
      if (conclusion.status === "concluded") {
        return {
          location: `valuation:${conclusion.field}`,
          evidenceIds: conclusion.basis.evidenceIds,
          requiresCitation: true
        };
      }

      return {
        location: `valuation:${conclusion.field}:abstention`,
        evidenceIds: conclusion.abstention.evidenceIds,
        requiresCitation: false
      };
    })
  ];
}

function routeCitationUses(route: RouteDecision): CitationUse[] {
  const candidateUses = route.candidates.flatMap((candidate) =>
    candidate.reasons.map((reason) => ({
      location: `route:${candidate.route}:${candidate.status}`,
      evidenceIds: reason.evidenceIds,
      requiresCitation: true
    }))
  );

  if (route.status === "selected") {
    return [
      ...route.selectedReasons.map((reason) => ({
        location: `route:${route.selectedRoute}:selected`,
        evidenceIds: reason.evidenceIds,
        requiresCitation: true
      })),
      ...candidateUses,
      ...route.rejectedRoutes.flatMap((candidate) =>
        candidate.reasons.map((reason) => ({
          location: `route:${candidate.route}:rejected`,
          evidenceIds: reason.evidenceIds,
          requiresCitation: true
        }))
      )
    ];
  }

  return [
    ...candidateUses,
    {
      location: "route:abstention",
      evidenceIds: route.abstention.evidenceIds,
      requiresCitation: false
    }
  ];
}

function routeEvidenceIds(route: RouteDecision): string[] {
  if (route.status === "selected") {
    return uniqueSorted([
      ...route.selectedReasons.flatMap((reason) => reason.evidenceIds),
      ...route.candidates.flatMap((candidate) =>
        candidate.reasons.flatMap((reason) => reason.evidenceIds)
      ),
      ...route.rejectedRoutes.flatMap((candidate) =>
        candidate.reasons.flatMap((reason) => reason.evidenceIds)
      )
    ]);
  }

  return uniqueSorted([
    ...route.abstention.evidenceIds,
    ...route.candidates.flatMap((candidate) =>
      candidate.reasons.flatMap((reason) => reason.evidenceIds)
    )
  ]);
}

function valuationEvidenceIds(valuation: ValuationOutput): string[] {
  return uniqueSorted(
    valuationConclusions(valuation).flatMap((conclusion) =>
      conclusion.status === "concluded"
        ? conclusion.basis.evidenceIds
        : conclusion.abstention.evidenceIds
    )
  );
}

function valuationMissingInformation(valuation: ValuationOutput): MissingInformation[] {
  return uniqueMissingInformation(
    valuationConclusions(valuation).flatMap((conclusion) =>
      conclusion.status === "abstained" ? conclusion.abstention.missingInformation : []
    )
  );
}

function valuationConclusions(valuation: ValuationOutput): ValuationConclusion[] {
  return [
    valuation.headlineValuation,
    valuation.enterpriseValue,
    valuation.totalEquityValue,
    valuation.securityLevelFairValue
  ];
}

function expectedValuationFields() {
  return [
    ["headlineValuation", "headline-valuation"],
    ["enterpriseValue", "enterprise-value"],
    ["totalEquityValue", "total-equity-value"],
    ["securityLevelFairValue", "security-level-fair-value"]
  ] as const;
}

function copiedHeadlineValuationFields(valuation: ValuationOutput): string[] {
  if (valuation.headlineValuation.status !== "concluded") {
    return [];
  }

  const headlineValuation = valuation.headlineValuation;

  return [
    valuation.enterpriseValue,
    valuation.totalEquityValue,
    valuation.securityLevelFairValue
  ]
    .filter(
      (conclusion): conclusion is Extract<ValuationConclusion, { status: "concluded" }> =>
        conclusion.status === "concluded"
    )
    .filter(
      (conclusion) =>
        stableStringify(conclusion.range) === stableStringify(headlineValuation.range) &&
        conclusion.basis.method === headlineValuation.basis.method
    )
    .map((conclusion) => conclusion.field)
    .sort(compareStrings);
}

function moneyRangeIsInternallyConsistent(
  range: Extract<ValuationConclusion, { status: "concluded" }>["range"]
): boolean {
  const amounts = [range.low, range.base, range.high];
  const unitsMatch = amounts.every(
    (amount) => amount.currency === range.base.currency && amount.scale === range.base.scale
  );

  return (
    unitsMatch &&
    Number.isFinite(range.low.amount) &&
    Number.isFinite(range.base.amount) &&
    Number.isFinite(range.high.amount) &&
    range.low.amount <= range.base.amount &&
    range.base.amount <= range.high.amount
  );
}

function identityEvidenceIds(ledger: EvidenceLedger): string[] {
  const targetTokens = [
    ledger.target.legalName,
    ...(ledger.target.aliases ?? []),
    ...ledger.target.identifiers.map((identifier) => identifier.value)
  ].map((value) => value.toLowerCase());

  return ledger.evidence
    .filter((record) => {
      const text = evidenceText(record).toLowerCase();

      return targetTokens.some((token) => text.includes(token));
    })
    .map((record) => record.id)
    .sort(compareStrings);
}

function detectSecurityInformationCoverage(
  evidence: readonly EvidenceRecord[]
): SecurityInformationCoverage {
  const segments = evidence.flatMap(securityEvidenceSegments);

  return {
    hasShareRights: hasAffirmativeSecuritySegment(segments, [
      /\bshare rights?\b/iu,
      /\brights? attach(?:ing|ed)?\b/iu,
      /\bvoting rights?\b/iu
    ]),
    hasPreferences: hasAffirmativeSecuritySegment(segments, [
      /\bpreferences?\b/iu,
      /\bliquidation preference\b/iu,
      /\bpreferred shares?\b/iu
    ]),
    hasDilution: hasAffirmativeSecuritySegment(segments, [
      /\bdilution\b/iu,
      /\bfully diluted\b/iu,
      /\boptions?\b/iu,
      /\bwarrants?\b/iu,
      /\bconvertibles?\b/iu
    ]),
    hasCapTable: hasAffirmativeSecuritySegment(segments, [
      /\bcap(?:italization)?[- ]?table\b/iu,
      /\bshares outstanding\b/iu,
      /\bshare capital\b/iu
    ])
  };
}

function securityEvidenceSegments(evidence: EvidenceRecord): string[] {
  return [
    evidence.shortExcerpt,
    ...evidence.observedFacts.flatMap((fact) => [
      fact.statement,
      fact.unit,
      typeof fact.value === "string"
        ? fact.value
        : Array.isArray(fact.value)
          ? fact.value.filter((value): value is string => typeof value === "string").join(" ")
          : undefined
    ])
  ].filter((value): value is string => value !== undefined);
}

function hasAffirmativeSecuritySegment(
  segments: readonly string[],
  patterns: readonly RegExp[]
): boolean {
  return segments.some(
    (segment) => textMatchesAny(segment, patterns) && !isNegativeDisclosureSegment(segment)
  );
}

function securityLevelMissingInformation(
  coverage: SecurityInformationCoverage
): MissingInformation[] {
  const missingInformation: MissingInformation[] = [];

  if (!coverage.hasShareRights) {
    missingInformation.push({
      id: "missing-share-rights",
      topic: "Share rights",
      description: "The evidence ledger does not disclose rights attached to the specific security.",
      consequence: "TRACE cannot assign the headline reference to a specific share class.",
      requiredFor: ["security-level-fair-value"]
    });
  }

  if (!coverage.hasPreferences) {
    missingInformation.push({
      id: "missing-share-preferences",
      topic: "Share preferences",
      description: "The evidence ledger does not disclose liquidation or economic preferences.",
      consequence: "TRACE cannot determine whether the security participates equally in the headline value.",
      requiredFor: ["security-level-fair-value"]
    });
  }

  if (!coverage.hasDilution) {
    missingInformation.push({
      id: "missing-dilution",
      topic: "Dilution",
      description: "The evidence ledger does not disclose fully diluted shares, options, warrants, or convertibles.",
      consequence: "TRACE cannot convert company-level headline value into per-security fair value.",
      requiredFor: ["total-equity-value", "security-level-fair-value"]
    });
  }

  if (!coverage.hasCapTable) {
    missingInformation.push({
      id: "missing-cap-table",
      topic: "Cap table",
      description: "The evidence ledger does not disclose capitalization table data.",
      consequence: "TRACE cannot allocate value across securities or holders.",
      requiredFor: ["total-equity-value", "security-level-fair-value"]
    });
  }

  return missingInformation.sort(compareMissingInformation);
}

function evidenceText(record: EvidenceRecord): string {
  return [
    record.sourceTitle,
    record.sourceClass,
    record.epistemicClass,
    record.locator,
    record.shortExcerpt,
    ...record.observedFacts.flatMap((fact) => [
      fact.id,
      fact.statement,
      fact.unit,
      typeof fact.value === "string"
        ? fact.value
        : Array.isArray(fact.value)
          ? fact.value.filter((value): value is string => typeof value === "string").join(" ")
          : undefined
    ])
  ]
    .filter((value): value is string => value !== undefined)
    .join("\n");
}

function isNegativeDisclosureSegment(segment: string): boolean {
  return /\bnot disclosed\b|\bunavailable\b|\bnot available\b|\bnot provided\b|\bunknown\b/iu.test(
    segment
  );
}

function textMatchesAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function finding(input: ReviewFinding): ReviewFinding {
  return {
    ...input,
    evidenceIds: uniqueSorted(input.evidenceIds),
    missingInformation: uniqueMissingInformation(input.missingInformation)
  };
}

function uniqueMissingInformation(values: readonly MissingInformation[]): MissingInformation[] {
  return Array.from(new Map(values.map((value) => [value.id, value])).values()).sort(
    compareMissingInformation
  );
}

function sortedEvidenceIds(evidence: readonly EvidenceRecord[]): string[] {
  return evidence.map((record) => record.id).sort(compareStrings);
}

function uniqueSorted(values: readonly string[]): string[] {
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

function compareReviewFindings(left: ReviewFinding, right: ReviewFinding): number {
  return compareStrings(left.id, right.id);
}

function compareMissingInformation(left: MissingInformation, right: MissingInformation): number {
  return compareStrings(left.id, right.id);
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
