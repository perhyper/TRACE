import {
  routeDecisionSchema,
  sufficiencySchema
} from "../domain/schemas.js";
import type {
  AnalysisRoute,
  EvidenceRecord,
  MissingInformation,
  RouteCandidate,
  RouteDecision,
  RouteReason,
  Sufficiency,
  SufficiencyCriterion
} from "../domain/schemas.js";
import type { EvidenceLedger } from "../providers/evidence-bundle.js";

export interface RoutingGateResult {
  readonly sufficiency: Sufficiency;
  readonly route: RouteDecision;
}

type CriterionStatus = SufficiencyCriterion["status"];

interface EvidenceMatch {
  readonly evidenceIds: string[];
  readonly count: number;
}

interface FinancialSignals {
  readonly balanceSheet: EvidenceMatch;
  readonly regulatedActivity: EvidenceMatch;
  readonly auditedFinancials: EvidenceMatch;
  readonly operatingFacts: EvidenceMatch;
  readonly transactionReference: EvidenceMatch;
}

interface RouteSignal {
  readonly route: AnalysisRoute;
  readonly score: number;
  readonly evidenceIds: string[];
  readonly reasons: RouteReason[];
  readonly hasCriticalEvidence?: boolean;
}

const highAuthoritySourceClasses = new Set([
  "audited-filing",
  "regulatory-filing",
  "government",
  "legal-record",
  "company-primary",
  "market-data"
]);

const auditedOrRegulatorLinkedSourceClasses = new Set([
  "audited-filing",
  "regulatory-filing"
]);

const routeOrder = [
  "financial-services",
  "software-saas",
  "marketplace",
  "biotech-rnpv",
  "asset-based",
  "recent-transaction",
  "general-private-company",
  "insufficient-evidence"
] satisfies readonly AnalysisRoute[];

const financialBalanceSheetPatterns = [
  /\bcustomer deposits?\b/iu,
  /\bdeposits?\b/iu,
  /\bsafeguarded balances?\b/iu,
  /\bsafeguarding\b/iu,
  /\btreasury assets?\b/iu,
  /\bfinancial assets?\b/iu,
  /\bfinancial liabilities?\b/iu,
  /\bclient money\b/iu,
  /\bcash and balances?\b/iu,
  /\bloans? (?:and advances|to customers?)\b/iu
];

const regulatedFinancialActivityPatterns = [
  /\bbank(?:s|ing)?\b/iu,
  /\bpartner[- ]banks?\b/iu,
  /\bfinancial (?:services?|technology)\b/iu,
  /\belectronic money\b/iu,
  /\be-money\b/iu,
  /\bpayments?\b/iu,
  /\bpayment services?\b/iu,
  /\bpurchase volume\b/iu,
  /\bprimary account relationship\b/iu,
  /\blending\b/iu,
  /\bcredit\b/iu,
  /\bregulated\b/iu,
  /\blicen[cs]e[ds]?\b/iu,
  /\bauthori[sz]ed\b/iu,
  /\bfca\b/iu,
  /\bpra\b/iu
];

const auditedFinancialStatementPatterns = [
  /\bbalance sheet\b/iu,
  /\bstatement of financial position\b/iu,
  /\bassets?\b/iu,
  /\bliabilities\b/iu,
  /\bequity attributable\b/iu,
  /\bcash flows?\b/iu
];

const operatingFactPatterns = [
  /\brevenue\b/iu,
  /\bincome\b/iu,
  /\bprofit\b/iu,
  /\bnet loss\b/iu,
  /\bcustomers?\b/iu,
  /\bactive members?\b/iu,
  /\bdeposits?\b/iu,
  /\bassets?\b/iu,
  /\btransaction volume\b/iu,
  /\bpurchase volume\b/iu,
  /\bpayment volume\b/iu,
  /\bprimary account relationship\b/iu,
  /\bgross merchandise value\b/iu
];

const transactionPatterns = [
  /\bsecondary\b/iu,
  /\bshare sale\b/iu,
  /\btransaction\b/iu,
  /\bheadline valuation\b/iu,
  /\bvaluation\b/iu,
  /\btender offer\b/iu
];

const softwarePatterns = [
  /\bsoftware\b/iu,
  /\bsaas\b/iu,
  /\bsubscriptions?\b/iu,
  /\barr\b/iu,
  /\bcloud\b/iu,
  /\bdeveloper tools?\b/iu,
  /\bissue tracking\b/iu,
  /\bproduct tracking\b/iu,
  /\bonline whiteboards?\b/iu,
  /\bcollaborative design\b/iu,
  /\bproduct-development collaboration\b/iu,
  /\bpaid plans?\b/iu,
  /\bper (?:editor|user|seat)(?: per month)?\b/iu,
  /\bmultiplayer\b/iu
];

const marketplacePatterns = [
  /\bmarketplace\b/iu,
  /\bgmv\b/iu,
  /\bplatform buyers?\b/iu,
  /\bsellers?\b/iu,
  /\btake rate\b/iu
];

const biotechPatterns = [
  /\bbiotech(?:nology)?\b/iu,
  /\bclinical (?:trials?|stud(?:y|ies)|stage)\b/iu,
  /\bpipeline\b/iu,
  /\bfda\b/iu,
  /\brnpv\b/iu,
  /\btherapeutics?\b/iu,
  /\bdiagnostics?\b/iu,
  /\bdrug candidates?\b/iu,
  /\bgenome editing\b/iu,
  /\bgene editing\b/iu,
  /\bcrispr\b/iu,
  /\bcommercial(?:ly)? launch\b/iu
];

const assetBasedPatterns = [
  /\breal estate\b/iu,
  /\bproperty\b/iu,
  /\bmineral\b/iu,
  /\bnet asset value\b/iu,
  /\bportfolio assets?\b/iu
];

export function selectAnalysisRoute(ledger: EvidenceLedger): RoutingGateResult {
  const sufficiency = scoreEvidenceSufficiency(ledger);
  const route = decideRoute(ledger, sufficiency);

  return {
    sufficiency: sufficiencySchema.parse(sufficiency),
    route: routeDecisionSchema.parse(route)
  };
}

export function scoreEvidenceSufficiency(ledger: EvidenceLedger): Sufficiency {
  const evidenceIds = sortedEvidenceIds(ledger.evidence);
  const entityEvidence = matchTargetIdentityEvidence(ledger);
  const routeEvidence = matchAnyRouteDefiningEvidence(ledger.evidence);
  const highAuthorityEvidence = matchBySourceClass(ledger.evidence, highAuthoritySourceClasses);
  const financialOrOperatingEvidence = matchFinancialOrOperatingEvidence(ledger.evidence);

  const criteria = [
    buildEntityCriterion(ledger, entityEvidence),
    buildEligibleEvidenceCriterion(ledger.evidence),
    buildSourceQualityCriterion(ledger.evidence, highAuthorityEvidence),
    buildRouteEvidenceCriterion(routeEvidence, evidenceIds),
    buildFinancialOperatingCriterion(financialOrOperatingEvidence, evidenceIds)
  ];

  const missingInformation = buildSufficiencyMissingInformation(criteria);
  const score = roundScore(
    weightedCriterionScore(criteria[0], 0.25) +
      weightedCriterionScore(criteria[1], 0.2) +
      weightedCriterionScore(criteria[2], 0.15) +
      weightedCriterionScore(criteria[3], 0.25) +
      weightedCriterionScore(criteria[4], 0.15)
  );
  const hasRequiredCoverage =
    criteria[0]?.status !== "missing" &&
    criteria[1]?.status !== "missing" &&
    criteria[3]?.status !== "missing";
  const status = score >= 0.65 && hasRequiredCoverage ? "sufficient" : "insufficient";
  const rationale =
    status === "sufficient"
      ? "Evidence coverage is sufficient for route selection before valuation."
      : "Evidence coverage is not sufficient for a supported analysis route; TRACE abstains before valuation.";

  return {
    status,
    score,
    criteria,
    missingInformation,
    rationale
  };
}

function decideRoute(ledger: EvidenceLedger, sufficiency: Sufficiency): RouteDecision {
  const evidenceIds = sortedEvidenceIds(ledger.evidence);
  const signals = buildRouteSignals(ledger.evidence);

  if (sufficiency.status === "insufficient") {
    return buildInsufficientEvidenceDecision(sufficiency, evidenceIds, signals);
  }

  const selectedRoute = chooseSelectedRoute(signals);
  const candidates = buildSelectedDecisionCandidates(selectedRoute, signals, evidenceIds);
  const selectedCandidate = candidates.find((candidate) => candidate.route === selectedRoute);

  if (selectedCandidate === undefined) {
    throw new Error(`Selected route ${selectedRoute} was not evaluated`);
  }

  const rejectedRoutes = candidates.filter((candidate) => candidate.status === "rejected");

  return {
    status: "selected",
    selectedRoute,
    selectedReasons: selectedCandidate.reasons,
    candidates,
    rejectedRoutes
  };
}

function buildRouteSignals(evidence: readonly EvidenceRecord[]): readonly RouteSignal[] {
  const financialSignals = detectFinancialSignals(evidence);
  const financialEvidenceIds = uniqueSorted([
    ...financialSignals.balanceSheet.evidenceIds,
    ...financialSignals.regulatedActivity.evidenceIds,
    ...financialSignals.auditedFinancials.evidenceIds,
    ...financialSignals.operatingFacts.evidenceIds,
    ...financialSignals.transactionReference.evidenceIds
  ]);
  const financialCategoryCount = [
    financialSignals.balanceSheet.count,
    financialSignals.regulatedActivity.count,
    financialSignals.auditedFinancials.count,
    financialSignals.operatingFacts.count,
    financialSignals.transactionReference.count
  ].filter((count) => count > 0).length;

  return [
    {
      route: "financial-services",
      score: roundScore(financialCategoryCount / 5),
      evidenceIds: financialEvidenceIds,
      reasons: buildFinancialServicesReasons(financialSignals),
      hasCriticalEvidence: hasCriticalFinancialServicesSignals(financialSignals)
    },
    buildPatternSignal(
      "recent-transaction",
      evidence,
      transactionPatterns,
      "Evidence includes a recent transaction or headline valuation reference."
    ),
    buildPatternSignal(
      "software-saas",
      evidence,
      softwarePatterns,
      "Evidence describes software products for team collaboration, product or issue tracking, developer tools, and paid or subscription plans."
    ),
    buildPatternSignal(
      "marketplace",
      evidence,
      marketplacePatterns,
      "Evidence includes marketplace, GMV, buyer/seller, or take-rate facts."
    ),
    buildPatternSignal(
      "biotech-rnpv",
      evidence,
      biotechPatterns,
      "Evidence describes a biotech, diagnostics, or therapeutics company with clinical studies, pipeline, FDA, CRISPR, product-launch, or rNPV facts."
    ),
    buildPatternSignal(
      "asset-based",
      evidence,
      assetBasedPatterns,
      "Evidence includes asset-heavy, real-estate, mineral, NAV, or portfolio-asset facts."
    ),
    {
      route: "general-private-company",
      score: evidence.length > 0 ? 0.4 : 0,
      evidenceIds: sortedEvidenceIds(evidence),
      reasons:
        evidence.length > 0
          ? [
              {
                summary: "Eligible evidence is available, but no stronger specialized route is selected.",
                evidenceIds: sortedEvidenceIds(evidence)
              }
            ]
          : []
    }
  ];
}

function chooseSelectedRoute(signals: readonly RouteSignal[]): AnalysisRoute {
  const financialSignal = signalForRoute(signals, "financial-services");

  if (financialSignal.score >= 0.4 && hasCriticalFinancialServicesEvidence(financialSignal)) {
    return "financial-services";
  }

  const specializedSignals = signals.filter(
    (signal) => signal.route !== "general-private-company" && signal.route !== "financial-services"
  );
  const selectedSpecializedSignal = [...specializedSignals]
    .filter((signal) => signal.score >= 0.3)
    .sort(compareRouteSignalsByScore)[0];

  return selectedSpecializedSignal?.route ?? "general-private-company";
}

function hasCriticalFinancialServicesEvidence(signal: RouteSignal): boolean {
  return signal.evidenceIds.length > 0 && signal.hasCriticalEvidence === true;
}

function hasCriticalFinancialServicesSignals(signals: FinancialSignals): boolean {
  return (
    (signals.balanceSheet.count > 0 &&
      (signals.regulatedActivity.count > 0 ||
        signals.auditedFinancials.count > 0 ||
        signals.operatingFacts.count > 0)) ||
    (signals.regulatedActivity.count > 0 && signals.operatingFacts.count > 0)
  );
}

function buildSelectedDecisionCandidates(
  selectedRoute: AnalysisRoute,
  signals: readonly RouteSignal[],
  fallbackEvidenceIds: readonly string[]
): RouteCandidate[] {
  return signals
    .map((signal) => {
      const status = signal.route === selectedRoute ? "selected" : "rejected";
      const reasons =
        status === "selected"
          ? signal.reasons
          : buildRejectedRouteReasons(signal, selectedRoute, fallbackEvidenceIds);

      return {
        route: signal.route,
        status,
        score: signal.score,
        reasons
      } satisfies RouteCandidate;
    })
    .sort(compareRouteCandidates);
}

function buildInsufficientEvidenceDecision(
  sufficiency: Sufficiency,
  evidenceIds: readonly string[],
  signals: readonly RouteSignal[]
): RouteDecision {
  const insufficientCandidate: RouteCandidate = {
    route: "insufficient-evidence",
    status: "selected",
    score: 1,
    reasons: [
      {
        summary: "Available evidence does not meet TRACE sufficiency criteria for route selection.",
        evidenceIds: [...evidenceIds]
      }
    ]
  };
  const candidates: RouteCandidate[] =
    evidenceIds.length === 0
      ? []
      : [
          insufficientCandidate,
          ...signals.map(
            (signal): RouteCandidate => ({
              route: signal.route,
              status: "rejected",
              score: signal.score,
              reasons: buildRejectedRouteReasons(signal, "insufficient-evidence", evidenceIds)
            })
          )
        ].sort(compareRouteCandidates);

  return {
    status: "abstained",
    abstention: {
      reasonCode: "insufficient-route-evidence",
      explanation: "TRACE abstains from selecting an analysis route because required evidence coverage is missing.",
      missingInformation: sufficiency.missingInformation,
      evidenceIds: [...evidenceIds]
    },
    candidates
  };
}

function buildFinancialServicesReasons(signals: FinancialSignals): RouteReason[] {
  const reasons: RouteReason[] = [];

  if (signals.balanceSheet.evidenceIds.length > 0) {
    reasons.push({
      summary: "Evidence shows bank-like or deposit-led balance-sheet items.",
      evidenceIds: signals.balanceSheet.evidenceIds
    });
  }

  if (signals.regulatedActivity.evidenceIds.length > 0) {
    reasons.push({
      summary: "Evidence describes banking or financial-technology products such as partner-bank services, payments, lending, or electronic money.",
      evidenceIds: signals.regulatedActivity.evidenceIds
    });
  }

  if (signals.auditedFinancials.evidenceIds.length > 0) {
    reasons.push({
      summary: "Audited or regulator-linked statements provide financial-asset, liability, or balance-sheet facts.",
      evidenceIds: signals.auditedFinancials.evidenceIds
    });
  }

  if (signals.operatingFacts.evidenceIds.length > 0) {
    reasons.push({
      summary: "Operating facts such as revenue, profit or loss, customers or active members, deposits, assets, and purchase or payment volume require financial-services interpretation.",
      evidenceIds: signals.operatingFacts.evidenceIds
    });
  }

  if (signals.transactionReference.evidenceIds.length > 0) {
    reasons.push({
      summary: "Transaction evidence is treated as a route context and not as an enterprise-value or security-level conclusion.",
      evidenceIds: signals.transactionReference.evidenceIds
    });
  }

  return reasons;
}

function buildRejectedRouteReasons(
  signal: RouteSignal,
  selectedRoute: AnalysisRoute,
  fallbackEvidenceIds: readonly string[]
): RouteReason[] {
  const evidenceIds = signal.evidenceIds.length > 0 ? signal.evidenceIds : fallbackEvidenceIds;
  const citedEvidenceIds = [...evidenceIds];

  if (selectedRoute === "financial-services" && signal.route === "software-saas") {
    return [
      {
        summary: "Financial-services evidence makes generic SaaS enterprise-value treatment unsupported.",
        evidenceIds: citedEvidenceIds
      }
    ];
  }

  if (selectedRoute === "financial-services" && signal.route === "recent-transaction") {
    return [
      {
        summary: "Transaction evidence may support later calibration, but sector routing is governed by bank-like operating and balance-sheet facts.",
        evidenceIds: citedEvidenceIds
      }
    ];
  }

  const routeLabel = signal.route.replaceAll("-", " ");
  const selectedLabel = selectedRoute.replaceAll("-", " ");

  return [
    {
      summary:
        signal.evidenceIds.length > 0
          ? `Evidence for ${routeLabel} was considered but did not outrank the selected ${selectedLabel} route.`
          : `Available evidence does not support the ${routeLabel} route.`,
      evidenceIds: citedEvidenceIds
    }
  ];
}

function detectFinancialSignals(evidence: readonly EvidenceRecord[]): FinancialSignals {
  return {
    balanceSheet: matchEvidencePatterns(evidence, financialBalanceSheetPatterns),
    regulatedActivity: matchEvidencePatterns(evidence, regulatedFinancialActivityPatterns),
    auditedFinancials: matchAuditedFinancialEvidence(evidence),
    operatingFacts: matchEvidencePatterns(evidence, operatingFactPatterns),
    transactionReference: matchEvidencePatterns(evidence, transactionPatterns)
  };
}

function buildPatternSignal(
  route: AnalysisRoute,
  evidence: readonly EvidenceRecord[],
  patterns: readonly RegExp[],
  summary: string
): RouteSignal {
  const match = matchEvidencePatterns(evidence, patterns);

  return {
    route,
    score: roundScore(Math.min(match.count, 3) / 3),
    evidenceIds: match.evidenceIds,
    reasons:
      match.evidenceIds.length > 0
        ? [
            {
              summary,
              evidenceIds: match.evidenceIds
            }
          ]
        : []
  };
}

function buildEntityCriterion(
  ledger: EvidenceLedger,
  entityEvidence: EvidenceMatch
): SufficiencyCriterion {
  if (ledger.target.identityConfidence === "resolved" && entityEvidence.evidenceIds.length > 0) {
    return {
      criterion: "Entity resolution",
      status: "met",
      explanation: "The target identity is resolved and supported by eligible evidence.",
      evidenceIds: entityEvidence.evidenceIds
    };
  }

  if (ledger.target.identityConfidence === "resolved") {
    return {
      criterion: "Entity resolution",
      status: "partial",
      explanation: "The target identity is marked resolved, but eligible evidence does not cite the entity directly.",
      evidenceIds: []
    };
  }

  return {
    criterion: "Entity resolution",
    status: "missing",
    explanation: "The target identity is not resolved enough for route selection.",
    evidenceIds: entityEvidence.evidenceIds
  };
}

function buildEligibleEvidenceCriterion(evidence: readonly EvidenceRecord[]): SufficiencyCriterion {
  if (evidence.length >= 2) {
    return {
      criterion: "Measurement-date eligible evidence",
      status: "met",
      explanation: "Multiple eligible evidence records remain after cutoff filtering.",
      evidenceIds: sortedEvidenceIds(evidence)
    };
  }

  if (evidence.length === 1) {
    return {
      criterion: "Measurement-date eligible evidence",
      status: "partial",
      explanation: "Only one eligible evidence record remains after cutoff filtering.",
      evidenceIds: sortedEvidenceIds(evidence)
    };
  }

  return {
    criterion: "Measurement-date eligible evidence",
    status: "missing",
    explanation: "No eligible evidence records remain after cutoff filtering.",
    evidenceIds: []
  };
}

function buildSourceQualityCriterion(
  evidence: readonly EvidenceRecord[],
  highAuthorityEvidence: EvidenceMatch
): SufficiencyCriterion {
  if (highAuthorityEvidence.evidenceIds.length >= 2) {
    return {
      criterion: "Source quality",
      status: "met",
      explanation: "Multiple high-authority source classes support routing.",
      evidenceIds: highAuthorityEvidence.evidenceIds
    };
  }

  if (highAuthorityEvidence.evidenceIds.length === 1) {
    return {
      criterion: "Source quality",
      status: "partial",
      explanation: "One high-authority source class supports routing.",
      evidenceIds: highAuthorityEvidence.evidenceIds
    };
  }

  return {
    criterion: "Source quality",
    status: evidence.length > 0 ? "partial" : "missing",
    explanation:
      evidence.length > 0
        ? "Evidence is available, but high-authority source classes are missing."
        : "No evidence is available for source-quality assessment.",
    evidenceIds: sortedEvidenceIds(evidence)
  };
}

function buildRouteEvidenceCriterion(
  routeEvidence: EvidenceMatch,
  fallbackEvidenceIds: readonly string[]
): SufficiencyCriterion {
  if (routeEvidence.evidenceIds.length >= 2) {
    return {
      criterion: "Route-defining business-model evidence",
      status: "met",
      explanation: "Evidence contains multiple business-model facts relevant to routing.",
      evidenceIds: routeEvidence.evidenceIds
    };
  }

  if (routeEvidence.evidenceIds.length === 1) {
    return {
      criterion: "Route-defining business-model evidence",
      status: "partial",
      explanation: "Evidence contains one business-model fact relevant to routing.",
      evidenceIds: routeEvidence.evidenceIds
    };
  }

  return {
    criterion: "Route-defining business-model evidence",
    status: "missing",
    explanation: "Evidence does not contain business-model facts sufficient for routing.",
    evidenceIds: [...fallbackEvidenceIds]
  };
}

function buildFinancialOperatingCriterion(
  evidence: EvidenceMatch,
  fallbackEvidenceIds: readonly string[]
): SufficiencyCriterion {
  if (evidence.evidenceIds.length >= 2) {
    return {
      criterion: "Financial and operating fact coverage",
      status: "met",
      explanation: "Evidence contains multiple financial or operating facts usable for route selection.",
      evidenceIds: evidence.evidenceIds
    };
  }

  if (evidence.evidenceIds.length === 1) {
    return {
      criterion: "Financial and operating fact coverage",
      status: "partial",
      explanation: "Evidence contains one financial or operating fact usable for route selection.",
      evidenceIds: evidence.evidenceIds
    };
  }

  return {
    criterion: "Financial and operating fact coverage",
    status: "missing",
    explanation: "Evidence does not contain financial or operating facts usable for route selection.",
    evidenceIds: [...fallbackEvidenceIds]
  };
}

function buildSufficiencyMissingInformation(
  criteria: readonly SufficiencyCriterion[]
): MissingInformation[] {
  const missing: MissingInformation[] = [];

  for (const criterion of criteria) {
    if (criterion.status === "met") {
      continue;
    }

    const id = `missing-${slugify(criterion.criterion)}`;

    missing.push({
      id,
      topic: criterion.criterion,
      description: criterion.explanation,
      consequence:
        criterion.status === "missing"
          ? "TRACE cannot support route selection without this evidence."
          : "TRACE treats this as a routing limitation unless stronger evidence is supplied.",
      requiredFor: ["routing", "sufficiency"]
    });
  }

  return missing;
}

function matchTargetIdentityEvidence(ledger: EvidenceLedger): EvidenceMatch {
  const identityTerms = [
    ledger.target.legalName,
    ...ledger.target.identifiers.map((identifier) => identifier.value),
    ...(ledger.target.aliases ?? [])
  ].map(escapeRegExp);
  const patterns = identityTerms.map((term) => new RegExp(term, "iu"));

  return matchEvidencePatterns(ledger.evidence, patterns);
}

function matchAnyRouteDefiningEvidence(evidence: readonly EvidenceRecord[]): EvidenceMatch {
  return mergeMatches([
    matchEvidencePatterns(evidence, financialBalanceSheetPatterns),
    matchEvidencePatterns(evidence, regulatedFinancialActivityPatterns),
    matchEvidencePatterns(evidence, softwarePatterns),
    matchEvidencePatterns(evidence, marketplacePatterns),
    matchEvidencePatterns(evidence, biotechPatterns),
    matchEvidencePatterns(evidence, assetBasedPatterns),
    matchEvidencePatterns(evidence, transactionPatterns)
  ]);
}

function matchFinancialOrOperatingEvidence(evidence: readonly EvidenceRecord[]): EvidenceMatch {
  return mergeMatches([
    matchEvidencePatterns(evidence, financialBalanceSheetPatterns),
    matchEvidencePatterns(evidence, auditedFinancialStatementPatterns),
    matchEvidencePatterns(evidence, operatingFactPatterns)
  ]);
}

function matchAuditedFinancialEvidence(evidence: readonly EvidenceRecord[]): EvidenceMatch {
  return matchEvidence(
    evidence,
    (record) =>
      auditedOrRegulatorLinkedSourceClasses.has(record.sourceClass) &&
      textMatchesPatterns(evidenceText(record), auditedFinancialStatementPatterns)
  );
}

function matchBySourceClass(
  evidence: readonly EvidenceRecord[],
  sourceClasses: ReadonlySet<string>
): EvidenceMatch {
  return matchEvidence(evidence, (record) => sourceClasses.has(record.sourceClass));
}

function matchEvidencePatterns(
  evidence: readonly EvidenceRecord[],
  patterns: readonly RegExp[]
): EvidenceMatch {
  return matchEvidence(evidence, (record) => textMatchesPatterns(evidenceText(record), patterns));
}

function matchEvidence(
  evidence: readonly EvidenceRecord[],
  predicate: (record: EvidenceRecord) => boolean
): EvidenceMatch {
  const evidenceIds = evidence
    .filter((record) => predicate(record))
    .map((record) => record.id)
    .sort(compareStrings);

  return {
    evidenceIds,
    count: evidenceIds.length
  };
}

function mergeMatches(matches: readonly EvidenceMatch[]): EvidenceMatch {
  const evidenceIds = uniqueSorted(matches.flatMap((match) => match.evidenceIds));

  return {
    evidenceIds,
    count: evidenceIds.length
  };
}

function textMatchesPatterns(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function evidenceText(record: EvidenceRecord): string {
  return [
    record.sourceTitle,
    record.sourceClass,
    record.epistemicClass,
    record.locator,
    record.shortExcerpt,
    ...record.observedFacts.flatMap((fact) => [
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

function weightedCriterionScore(
  criterion: SufficiencyCriterion | undefined,
  weight: number
): number {
  if (criterion === undefined) {
    return 0;
  }

  return criterionScore(criterion.status) * weight;
}

function criterionScore(status: CriterionStatus): number {
  if (status === "met") {
    return 1;
  }

  if (status === "partial") {
    return 0.5;
  }

  return 0;
}

function signalForRoute(signals: readonly RouteSignal[], route: AnalysisRoute): RouteSignal {
  const signal = signals.find((candidate) => candidate.route === route);

  if (signal === undefined) {
    throw new Error(`Route ${route} was not evaluated`);
  }

  return signal;
}

function compareRouteSignalsByScore(left: RouteSignal, right: RouteSignal): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return routeRank(left.route) - routeRank(right.route);
}

function compareRouteCandidates(left: RouteCandidate, right: RouteCandidate): number {
  const statusComparison = routeCandidateStatusRank(left.status) - routeCandidateStatusRank(right.status);

  if (statusComparison !== 0) {
    return statusComparison;
  }

  return routeRank(left.route) - routeRank(right.route);
}

function routeCandidateStatusRank(status: RouteCandidate["status"]): number {
  if (status === "selected") {
    return 0;
  }

  if (status === "considered") {
    return 1;
  }

  return 2;
}

function routeRank(route: AnalysisRoute): number {
  const index = routeOrder.indexOf(route);

  return index === -1 ? routeOrder.length : index;
}

function roundScore(value: number): number {
  return Number(value.toFixed(4));
}

function sortedEvidenceIds(evidence: readonly EvidenceRecord[]): string[] {
  return evidence.map((record) => record.id).sort(compareStrings);
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("&", " and ")
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
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
