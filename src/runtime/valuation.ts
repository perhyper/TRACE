import {
  moneyRangeSchema,
  valuationOutputSchema
} from "../domain/schemas.js";
import type {
  AnalysisRoute,
  Abstention,
  CurrencyCode,
  EvidenceRecord,
  MissingInformation,
  MoneyAmount,
  MoneyRange,
  SourceClass,
  ValuationField,
  ValuationOutput
} from "../domain/schemas.js";
import type { EvidenceLedger } from "../providers/evidence-bundle.js";

type TransactionType = "secondary" | "primary" | "mixed" | "unknown";

export interface RecentSecondaryTransactionFact {
  readonly evidenceId: string;
  readonly factIds: readonly string[];
  readonly transactionDate: string;
  readonly headlineValue: MoneyAmount;
  readonly transactionType: TransactionType;
  readonly sourceClass: SourceClass;
  readonly disclosureLimitations: readonly string[];
}

interface FxRateObservation {
  readonly evidenceId: string;
  readonly factIds: readonly string[];
  readonly date: string;
  readonly pair: "GBP/USD";
  readonly usdPerGbp: number;
  readonly sourceClass: SourceClass;
}

interface NormalizedHeadline {
  readonly amount: MoneyAmount;
  readonly evidenceIds: readonly string[];
  readonly assumptions: readonly string[];
  readonly limitations: readonly string[];
}

interface SecurityInformationCoverage {
  readonly hasShareRights: boolean;
  readonly hasPreferences: boolean;
  readonly hasDilution: boolean;
  readonly hasCapTable: boolean;
}

const recentTransactionWindowDays = 548;
const baseHeadlineUncertainty = 0.05;
const secondaryTransactionWidening = 0.05;
const opaqueShareRightsWidening = 0.1;
const weakerSourceClassWidening = 0.05;
const highAuthorityTransactionSourceClasses = new Set<SourceClass>([
  "audited-filing",
  "regulatory-filing",
  "government",
  "legal-record",
  "company-primary",
  "market-data"
]);

const transactionPatterns = [
  /\bsecondary\b/iu,
  /\bshare sale\b/iu,
  /\btender offer\b/iu,
  /\btransaction\b/iu,
  /\bfundraising\b/iu
];

const headlinePatterns = [
  /\bheadline valuation\b/iu,
  /\bimplied valuation\b/iu,
  /\bvaluation\b/iu,
  /\bvalued at\b/iu,
  /\bvalue of\b/iu
];

const fedH10AuthorityPatterns = [
  /\bfederal reserve\b/iu,
  /\bh\.?10\b/iu
];

const gbpUsdRatePatterns = [
  /\busd per gbp\b/iu,
  /\bgbp\/usd\b/iu
];

const limitationPatterns = [
  {
    pattern: /\bterms?\b.{0,160}\bnot disclosed\b/isu,
    text: "Transaction terms are not disclosed."
  },
  {
    pattern: /\bshare rights?\b.{0,160}\bnot disclosed\b/isu,
    text: "Share rights are not disclosed."
  },
  {
    pattern: /\bpreferences?\b.{0,160}\bnot disclosed\b/isu,
    text: "Share preferences are not disclosed."
  },
  {
    pattern: /\bdilution\b.{0,160}\bnot disclosed\b/isu,
    text: "Dilution is not disclosed."
  },
  {
    pattern: /\bcap(?:italization)?[- ]?table\b.{0,160}\bnot disclosed\b/isu,
    text: "Cap-table data is not disclosed."
  },
  {
    pattern: /\bvolume\b.{0,160}\bnot disclosed\b/isu,
    text: "Transaction volume is not disclosed."
  },
  {
    pattern: /\bdiscounts?\b.{0,160}\bnot disclosed\b/isu,
    text: "Transaction discounts are not disclosed."
  }
];

export function valueFromRecentSecondaryTransaction(
  ledger: EvidenceLedger,
  selectedRoute: AnalysisRoute = "general-private-company"
): ValuationOutput {
  const transactions = extractRecentSecondaryTransactions(ledger);
  const selectedTransaction = selectRecentEligibleTransaction(transactions, ledger.measurementDate);

  if (selectedTransaction === undefined) {
    return valuationOutputSchema.parse({
      headlineValuation: abstainedValuation(
        "headline-valuation",
        buildNoHeadlineCalibrationAbstention(ledger)
      ),
      enterpriseValue: abstainedValuation(
        "enterprise-value",
        buildEnterpriseValueInputAbstention(ledger, selectedRoute)
      ),
      totalEquityValue: abstainedValuation(
        "total-equity-value",
        buildNoTotalEquityValueAbstention(ledger)
      ),
      securityLevelFairValue: abstainedValuation(
        "security-level-fair-value",
        buildSecurityLevelAbstention(ledger, [])
      )
    });
  }

  const normalizedHeadline = normalizeHeadlineValue(selectedTransaction, ledger);

  if (normalizedHeadline === undefined) {
    return valuationOutputSchema.parse({
      headlineValuation: abstainedValuation(
        "headline-valuation",
        buildMissingCurrencyNormalizationAbstention(ledger, selectedTransaction)
      ),
      enterpriseValue: abstainedValuation(
        "enterprise-value",
        buildHeadlineNotEnterpriseValueAbstention([selectedTransaction.evidenceId])
      ),
      totalEquityValue: abstainedValuation(
        "total-equity-value",
        buildTotalEquityValueAbstention([selectedTransaction.evidenceId])
      ),
      securityLevelFairValue: abstainedValuation(
        "security-level-fair-value",
        buildSecurityLevelAbstention(ledger, [selectedTransaction.evidenceId])
      )
    });
  }

  const securityCoverage = detectSecurityInformationCoverage(ledger.evidence);
  const isOpaque = !hasCompleteSecurityInformation(securityCoverage);
  const uncertainty = headlineUncertainty(selectedTransaction, isOpaque);
  const range = moneyRangeSchema.parse(buildMoneyRange(normalizedHeadline.amount, uncertainty));
  const limitations = uniqueSorted([
    ...normalizedHeadline.limitations,
    ...selectedTransaction.disclosureLimitations,
    ...securityCoverageLimitations(securityCoverage)
  ]);
  const assumptions = uniqueSorted([
    ...normalizedHeadline.assumptions,
    `Source class ${selectedTransaction.sourceClass} is treated as an observed transaction reference, not independent fair-value proof.`,
    `The selected transaction date is ${selectedTransaction.transactionDate}.`,
    "The base case equals the observed headline transaction value after deterministic currency normalization.",
    "The headline transaction reference is not copied into enterprise value, total equity value, or security-level fair value.",
    ...(selectedTransaction.transactionType === "secondary"
      ? ["Uncertainty is widened because the transaction is secondary."]
      : []),
    ...(isOpaque
      ? ["Uncertainty is widened because share rights, preferences, dilution, or cap-table data are unavailable."]
      : [])
  ]);

  return valuationOutputSchema.parse({
    headlineValuation: {
      status: "concluded",
      field: "headline-valuation",
      range,
      basis: {
        method: "recent-secondary-calibration",
        description:
          "Observed recent secondary transaction headline is retained as a company-level calibration reference only.",
        evidenceIds: [...normalizedHeadline.evidenceIds],
        assumptions,
        limitations
      }
    },
    enterpriseValue: abstainedValuation(
      "enterprise-value",
      buildHeadlineNotEnterpriseValueAbstention(normalizedHeadline.evidenceIds)
    ),
    totalEquityValue: abstainedValuation(
      "total-equity-value",
      buildTotalEquityValueAbstention(normalizedHeadline.evidenceIds)
    ),
    securityLevelFairValue: abstainedValuation(
      "security-level-fair-value",
      buildSecurityLevelAbstention(ledger, normalizedHeadline.evidenceIds)
    )
  });
}

export function extractRecentSecondaryTransactions(
  ledger: EvidenceLedger
): RecentSecondaryTransactionFact[] {
  return ledger.evidence
    .map((record) => extractTransactionFromRecord(record))
    .filter((transaction): transaction is RecentSecondaryTransactionFact => transaction !== undefined)
    .filter((transaction) =>
      transaction.transactionType === "secondary" || transaction.transactionType === "mixed"
    )
    .sort(compareTransactions);
}

function extractTransactionFromRecord(
  record: EvidenceRecord
): RecentSecondaryTransactionFact | undefined {
  const text = evidenceText(record);
  const hasTransactionText = textMatchesAny(text, transactionPatterns);
  const headline = extractHeadlineValue(record);

  if (!hasTransactionText || headline === undefined || !textMatchesAny(text, headlinePatterns)) {
    return undefined;
  }

  const transactionType = extractTransactionType(text);
  const transactionDate = extractTransactionDate(record);

  if (transactionDate === undefined) {
    return undefined;
  }

  return {
    evidenceId: record.id,
    factIds: transactionFactIds(record),
    transactionDate,
    headlineValue: headline,
    transactionType,
    sourceClass: record.sourceClass,
    disclosureLimitations: extractDisclosureLimitations(text)
  };
}

function extractHeadlineValue(record: EvidenceRecord): MoneyAmount | undefined {
  const facts = [...record.observedFacts].sort((left, right) =>
    compareStrings(left.id, right.id)
  );

  for (const fact of facts) {
    const factText = [
      fact.id,
      fact.statement,
      fact.unit,
      typeof fact.value === "string" ? fact.value : undefined
    ]
      .filter((value): value is string => value !== undefined)
      .join("\n");

    if (!textMatchesAny(factText, headlinePatterns)) {
      continue;
    }

    if (typeof fact.value === "number") {
      const unitValue = parseMoneyUnit(fact.unit ?? fact.statement);

      if (unitValue !== undefined) {
        return {
          amount: fact.value,
          currency: unitValue.currency,
          scale: unitValue.scale
        };
      }
    }

    const statementValue = parseMoneyFromText(factText);

    if (statementValue !== undefined) {
      return statementValue;
    }
  }

  return parseMoneyFromText(evidenceText(record));
}

function parseMoneyUnit(value: string): Pick<MoneyAmount, "currency" | "scale"> | undefined {
  const normalizedValue = value.replaceAll(",", " ");
  const currency = extractCurrency(normalizedValue);
  const scale = extractScale(normalizedValue);

  if (currency === undefined || scale === undefined) {
    return undefined;
  }

  return {
    currency,
    scale
  };
}

function parseMoneyFromText(text: string): MoneyAmount | undefined {
  const normalizedText = text.replaceAll(",", "");
  const prefixed = /(?<currency>USD|GBP|US\$|\$|£)\s*(?<amount>\d+(?:\.\d+)?)\s*(?<scale>billion|billions|bn|million|millions|m|thousand|thousands|k)?/iu.exec(
    normalizedText
  );

  if (prefixed?.groups !== undefined) {
    const amount = Number(prefixed.groups["amount"]);
    const currency = normalizeCurrencyToken(prefixed.groups["currency"]);
    const scale = normalizeScaleToken(prefixed.groups["scale"]);

    if (Number.isFinite(amount) && currency !== undefined && scale !== undefined) {
      return {
        amount,
        currency,
        scale
      };
    }
  }

  const suffixed = /(?<amount>\d+(?:\.\d+)?)\s*(?<scale>billion|billions|bn|million|millions|m|thousand|thousands|k)\s*(?<currency>USD|GBP|US\$|\$|£)/iu.exec(
    normalizedText
  );

  if (suffixed?.groups === undefined) {
    return undefined;
  }

  const amount = Number(suffixed.groups["amount"]);
  const currency = normalizeCurrencyToken(suffixed.groups["currency"]);
  const scale = normalizeScaleToken(suffixed.groups["scale"]);

  if (!Number.isFinite(amount) || currency === undefined || scale === undefined) {
    return undefined;
  }

  return {
    amount,
    currency,
    scale
  };
}

function extractCurrency(value: string): CurrencyCode | undefined {
  const match = /\b(?<currency>[A-Z]{3})\b/u.exec(value);

  return normalizeCurrencyToken(match?.groups?.["currency"]);
}

function normalizeCurrencyToken(value: string | undefined): CurrencyCode | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.toUpperCase();

  if (normalized === "$" || normalized === "US$") {
    return "USD";
  }

  if (normalized === "£") {
    return "GBP";
  }

  if (/^[A-Z]{3}$/u.test(normalized)) {
    return normalized;
  }

  return undefined;
}

function extractScale(value: string): MoneyAmount["scale"] | undefined {
  return normalizeScaleToken(
    /\b(?<scale>billion|billions|bn|million|millions|m|thousand|thousands|k|units?)\b/iu.exec(value)
      ?.groups?.["scale"]
  );
}

function normalizeScaleToken(value: string | undefined): MoneyAmount["scale"] | undefined {
  if (value === undefined) {
    return "units";
  }

  const normalized = value.toLowerCase();

  if (normalized === "billion" || normalized === "billions" || normalized === "bn") {
    return "billions";
  }

  if (normalized === "million" || normalized === "millions" || normalized === "m") {
    return "millions";
  }

  if (normalized === "thousand" || normalized === "thousands" || normalized === "k") {
    return "thousands";
  }

  if (normalized === "unit" || normalized === "units") {
    return "units";
  }

  return undefined;
}

function extractTransactionType(text: string): TransactionType {
  const hasSecondary = /\bsecondary\b/iu.test(text) || /\bemployee share sale\b/iu.test(text);
  const hasPrimary =
    /\bprimary (?:transaction|share sale|shares?|issuance|fundraising)\b/iu.test(text) ||
    /\bnew shares?\b/iu.test(text);

  if (hasSecondary && hasPrimary) {
    return "mixed";
  }

  if (hasSecondary) {
    return "secondary";
  }

  if (hasPrimary) {
    return "primary";
  }

  return "unknown";
}

function extractTransactionDate(record: EvidenceRecord): string | undefined {
  const relevantFactIds = new Set(transactionFactIds(record));
  const factDates = record.observedFacts
    .filter((fact) => relevantFactIds.has(fact.id))
    .flatMap((fact) => [
      fact.period?.instantDate,
      typeof fact.value === "string" && isIsoDate(fact.value) ? fact.value : undefined,
      /(?<date>\d{4}-\d{2}-\d{2})/u.exec(fact.statement)?.groups?.["date"]
    ])
    .filter((date): date is string => date !== undefined && isIsoDate(date))
    .sort(compareStrings);

  return factDates[0] ?? record.effectiveDate ?? record.publishedDate;
}

function transactionFactIds(record: EvidenceRecord): string[] {
  return record.observedFacts
    .filter((fact) => {
      const text = [
        fact.id,
        fact.statement,
        fact.unit,
        typeof fact.value === "string" ? fact.value : undefined
      ]
        .filter((value): value is string => value !== undefined)
        .join("\n");

      return textMatchesAny(text, [...transactionPatterns, ...headlinePatterns]);
    })
    .map((fact) => fact.id)
    .sort(compareStrings);
}

function extractDisclosureLimitations(text: string): string[] {
  return limitationPatterns
    .filter((limitation) => limitation.pattern.test(text))
    .map((limitation) => limitation.text)
    .sort(compareStrings);
}

function selectRecentEligibleTransaction(
  transactions: readonly RecentSecondaryTransactionFact[],
  measurementDate: string
): RecentSecondaryTransactionFact | undefined {
  return transactions.find(
    (transaction) =>
      transaction.transactionDate <= measurementDate &&
      daysBetween(transaction.transactionDate, measurementDate) <= recentTransactionWindowDays
  );
}

function normalizeHeadlineValue(
  transaction: RecentSecondaryTransactionFact,
  ledger: EvidenceLedger
): NormalizedHeadline | undefined {
  if (transaction.headlineValue.currency === "USD") {
    return {
      amount: roundMoneyAmount(transaction.headlineValue),
      evidenceIds: [transaction.evidenceId],
      assumptions: [
        "The disclosed USD headline valuation is retained in USD with no currency conversion."
      ],
      limitations: []
    };
  }

  if (transaction.headlineValue.currency !== "GBP") {
    return undefined;
  }

  const fxRate = extractMeasurementDateGbpUsdRate(ledger);

  if (fxRate === undefined) {
    return undefined;
  }

  return {
    amount: {
      amount: roundAmount(transaction.headlineValue.amount * fxRate.usdPerGbp),
      currency: "USD",
      scale: transaction.headlineValue.scale
    },
    evidenceIds: uniqueSorted([transaction.evidenceId, fxRate.evidenceId]),
    assumptions: [
      `GBP headline value is converted to USD using Federal Reserve H.10 GBP/USD ${String(fxRate.usdPerGbp)} for ${fxRate.date}.`
    ],
    limitations: [
      "Federal Reserve H.10 is a reference observation and not a transaction-specific executable quote."
    ]
  };
}

function extractMeasurementDateGbpUsdRate(ledger: EvidenceLedger): FxRateObservation | undefined {
  const rates = ledger.evidence
    .map((record) => extractFxRateFromRecord(record, ledger.measurementDate))
    .filter((rate): rate is FxRateObservation => rate !== undefined)
    .sort(compareFxRates);

  return rates[0];
}

function extractFxRateFromRecord(
  record: EvidenceRecord,
  measurementDate: string
): FxRateObservation | undefined {
  const text = evidenceText(record);

  if (
    record.sourceClass !== "government" ||
    !textMatchesAny(text, fedH10AuthorityPatterns) ||
    !textMatchesAny(text, gbpUsdRatePatterns)
  ) {
    return undefined;
  }

  const facts = [...record.observedFacts].sort((left, right) =>
    compareStrings(left.id, right.id)
  );

  for (const fact of facts) {
    const factText = [fact.id, fact.statement, fact.unit, String(fact.value ?? "")]
      .join("\n");
    const date = fact.period?.instantDate ?? record.effectiveDate ?? record.publishedDate;
    const value = typeof fact.value === "number" ? fact.value : parseRateFromText(factText);

    if (
      date === measurementDate &&
      value !== undefined &&
      value > 0 &&
      textMatchesAny(factText, gbpUsdRatePatterns)
    ) {
      return {
        evidenceId: record.id,
        factIds: [fact.id],
        date,
        pair: "GBP/USD",
        usdPerGbp: value,
        sourceClass: record.sourceClass
      };
    }
  }

  const fallbackRate = parseRateFromText(text);

  if (fallbackRate === undefined) {
    return undefined;
  }

  return {
    evidenceId: record.id,
    factIds: [],
    date: measurementDate,
    pair: "GBP/USD",
    usdPerGbp: fallbackRate,
    sourceClass: record.sourceClass
  };
}

function parseRateFromText(text: string): number | undefined {
  const candidates = Array.from(text.matchAll(/\d+(?:\.\d+)?/gu))
    .map((match) => {
      const rawValue = match[0];

      return {
        rawValue,
        value: Number(rawValue)
      };
    })
    .filter((candidate) => candidate.value > 0 && candidate.value < 10);
  const decimalCandidate = candidates.findLast((candidate) => candidate.rawValue.includes("."));
  const selected = decimalCandidate ?? candidates.at(-1);

  if (selected === undefined || !Number.isFinite(selected.value)) {
    return undefined;
  }

  return selected.value;
}

function headlineUncertainty(
  transaction: RecentSecondaryTransactionFact,
  hasOpaqueShareRights: boolean
): number {
  return (
    baseHeadlineUncertainty +
    (transaction.transactionType === "secondary" || transaction.transactionType === "mixed"
      ? secondaryTransactionWidening
      : 0) +
    (hasOpaqueShareRights ? opaqueShareRightsWidening : 0) +
    (highAuthorityTransactionSourceClasses.has(transaction.sourceClass)
      ? 0
      : weakerSourceClassWidening)
  );
}

function buildMoneyRange(base: MoneyAmount, uncertainty: number): MoneyRange {
  return {
    low: {
      amount: roundAmount(base.amount * Math.max(0, 1 - uncertainty)),
      currency: base.currency,
      scale: base.scale
    },
    base: roundMoneyAmount(base),
    high: {
      amount: roundAmount(base.amount * (1 + uncertainty)),
      currency: base.currency,
      scale: base.scale
    }
  };
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

function isNegativeDisclosureSegment(segment: string): boolean {
  return /\bnot disclosed\b|\bunavailable\b|\bnot available\b|\bnot provided\b|\bunknown\b/iu.test(
    segment
  );
}

function hasCompleteSecurityInformation(coverage: SecurityInformationCoverage): boolean {
  return (
    coverage.hasShareRights &&
    coverage.hasPreferences &&
    coverage.hasDilution &&
    coverage.hasCapTable
  );
}

function securityCoverageLimitations(coverage: SecurityInformationCoverage): string[] {
  const limitations: string[] = [];

  if (!coverage.hasShareRights) {
    limitations.push("Share rights are unavailable in the evidence ledger.");
  }

  if (!coverage.hasPreferences) {
    limitations.push("Share preferences are unavailable in the evidence ledger.");
  }

  if (!coverage.hasDilution) {
    limitations.push("Dilution evidence is unavailable in the evidence ledger.");
  }

  if (!coverage.hasCapTable) {
    limitations.push("Cap-table evidence is unavailable in the evidence ledger.");
  }

  return limitations.sort(compareStrings);
}

function buildNoHeadlineCalibrationAbstention(ledger: EvidenceLedger): Abstention {
  const evidenceIds = sortedEvidenceIds(ledger.evidence);
  const excludedPricing = ledger.excludedRecords.find((record) =>
    /\b(?:ipo )?pricing\b|\bprice (?:range|per share)\b|\bfully diluted\b/iu.test(
      `${record.recordId} ${record.sourceTitle}`
    )
  );
  const excludedTransaction = ledger.excludedRecords.find((record) =>
    /\bacquir(?:e|es|ed|ing|er)|\bacquisition\b|\bmerger\b|\btransaction\b/iu.test(
      `${record.recordId} ${record.sourceTitle}`
    )
  );

  if (excludedPricing !== undefined) {
    return {
      reasonCode: "post-cutoff-pricing-not-input",
      explanation:
        "TRACE excludes IPO pricing or fully diluted value published after the measurement-date cutoff and does not use it as a headline-valuation input.",
      missingInformation: [
        {
          id: "missing-cutoff-visible-pricing",
          topic: "Cutoff-visible pricing",
          description:
            "The available pricing reference was published after the measurement date and is excluded from model inputs.",
          consequence: "TRACE abstains from a cutoff-date headline valuation.",
          requiredFor: ["headline-valuation"]
        }
      ],
      evidenceIds
    };
  }

  if (excludedTransaction !== undefined) {
    return {
      reasonCode: "post-cutoff-transaction-announcement",
      explanation:
        "TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input.",
      missingInformation: [
        {
          id: "missing-cutoff-visible-transaction",
          topic: "Cutoff-visible transaction",
          description:
            "The available transaction announcement was published after the measurement date and is excluded from model inputs.",
          consequence: "TRACE abstains from a cutoff-date headline valuation.",
          requiredFor: ["headline-valuation"]
        }
      ],
      evidenceIds
    };
  }

  return {
    reasonCode: "recent-secondary-transaction-not-observed",
    explanation:
      "TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.",
    missingInformation: [
      {
        id: "missing-recent-secondary-transaction",
        topic: "Recent secondary transaction",
        description:
          "The evidence ledger does not contain transaction date, transaction type, currency, and disclosed headline value for a recent secondary transaction.",
        consequence: "TRACE cannot support the recent-secondary calibration pathway.",
        requiredFor: ["headline-valuation"]
      }
    ],
    evidenceIds
  };
}

function buildEnterpriseValueInputAbstention(
  ledger: EvidenceLedger,
  selectedRoute: AnalysisRoute
): Abstention {
  const evidenceIds = sortedEvidenceIds(ledger.evidence);

  if (selectedRoute === "financial-services") {
    return {
      reasonCode: "bank-balance-sheet-not-ev-input",
      explanation:
        "Banking, financial-technology, deposit, asset, customer, and operating metrics support the financial-services route but do not by themselves establish enterprise value.",
      missingInformation: [
        {
          id: "missing-financial-services-valuation-inputs",
          topic: "Financial-services valuation inputs",
          description:
            "The evidence does not provide a supported financial-services valuation method and the inputs needed to apply it.",
          consequence: "TRACE abstains from enterprise value.",
          requiredFor: ["enterprise-value"]
        }
      ],
      evidenceIds
    };
  }

  if (selectedRoute === "biotech-rnpv") {
    return {
      reasonCode: "no-product-cash-flow-forecast",
      explanation:
        "Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value.",
      missingInformation: [
        {
          id: "missing-product-cash-flow-forecast",
          topic: "Product cash-flow forecast",
          description:
            "The evidence does not provide product-level cash flows, development probabilities, milestones, and commercial timing required for rNPV.",
          consequence: "TRACE abstains from enterprise value.",
          requiredFor: ["enterprise-value"]
        }
      ],
      evidenceIds
    };
  }

  if (selectedRoute === "software-saas") {
    return {
      reasonCode: "no-public-financial-statements",
      explanation:
        "Software product, customer, funding, or qualitative traction evidence supports the software-SaaS route, but no public revenue, margin, or cash-flow statements support enterprise value.",
      missingInformation: [
        {
          id: "missing-public-financial-statements",
          topic: "Public financial statements",
          description:
            "The evidence does not provide a public revenue, margin, cash-flow, or comparable-company base for enterprise value.",
          consequence: "TRACE abstains from enterprise value.",
          requiredFor: ["enterprise-value"]
        }
      ],
      evidenceIds
    };
  }

  return buildNoRecentSecondaryTransactionAbstention(ledger);
}

function buildNoTotalEquityValueAbstention(ledger: EvidenceLedger): Abstention {
  return {
    reasonCode: "missing-total-equity-capitalization",
    explanation:
      "TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.",
    missingInformation: [
      {
        id: "missing-total-equity-capitalization",
        topic: "Total equity capitalization",
        description:
          "The evidence does not provide a supported company valuation, fully diluted capitalization, share count, preference stack, or equity bridge.",
        consequence: "TRACE abstains from total equity value.",
        requiredFor: ["total-equity-value"]
      }
    ],
    evidenceIds: sortedEvidenceIds(ledger.evidence)
  };
}

function buildNoRecentSecondaryTransactionAbstention(ledger: EvidenceLedger): Abstention {
  const evidenceIds = sortedEvidenceIds(ledger.evidence);

  return {
    reasonCode: "recent-secondary-transaction-not-observed",
    explanation:
      "TRACE cannot calibrate a company valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.",
    missingInformation: [
      {
        id: "missing-recent-secondary-transaction",
        topic: "Recent secondary transaction",
        description:
          "The evidence ledger does not contain transaction date, transaction type, currency, and disclosed headline value for a recent secondary transaction.",
        consequence: "TRACE cannot support the recent-secondary calibration pathway.",
        requiredFor: ["enterprise-value"]
      }
    ],
    evidenceIds
  };
}

function buildMissingCurrencyNormalizationAbstention(
  ledger: EvidenceLedger,
  transaction: RecentSecondaryTransactionFact
): Abstention {
  return {
    reasonCode: "currency-normalization-missing",
    explanation:
      "TRACE parsed a recent secondary headline value but cannot normalize it to USD without supported measurement-date currency evidence.",
    missingInformation: [
      {
        id: "missing-measurement-date-fx",
        topic: "Measurement-date currency normalization",
        description: `No Federal Reserve H.10 GBP/USD observation at ${ledger.measurementDate} supports conversion of the ${transaction.headlineValue.currency} headline value.`,
        consequence: "TRACE cannot produce a deterministic headline calibration in the output currency.",
        requiredFor: ["headline-valuation"]
      }
    ],
    evidenceIds: [transaction.evidenceId]
  };
}

function buildHeadlineNotEnterpriseValueAbstention(
  evidenceIds: readonly string[]
): Abstention {
  return {
    reasonCode: "headline-reference-not-enterprise-value",
    explanation:
      "The observed transaction headline is not an enterprise-value conclusion because operating valuation inputs and bridge evidence are unavailable.",
    missingInformation: [
      {
        id: "missing-enterprise-value-support",
        topic: "Enterprise-value support",
        description:
          "The evidence ledger does not provide operating valuation inputs, net debt or cash bridge items, or transaction terms needed to infer enterprise value from the headline.",
        consequence: "TRACE must keep the headline calibration separate from enterprise value.",
        requiredFor: ["enterprise-value"]
      }
    ],
    evidenceIds: [...evidenceIds]
  };
}

function buildTotalEquityValueAbstention(evidenceIds: readonly string[]): Abstention {
  return {
    reasonCode: "headline-reference-not-total-equity-value",
    explanation:
      "The observed transaction headline is not a total-equity-value conclusion because capitalization and equity bridge evidence are unavailable.",
    missingInformation: [
      {
        id: "missing-total-equity-capitalization",
        topic: "Total equity capitalization",
        description:
          "The evidence ledger does not provide fully diluted capitalization, share count, preference stack, or equity bridge data.",
        consequence: "TRACE must keep the headline calibration separate from total equity value.",
        requiredFor: ["total-equity-value", "security-level-fair-value"]
      }
    ],
    evidenceIds: [...evidenceIds]
  };
}

function buildSecurityLevelAbstention(
  ledger: EvidenceLedger,
  evidenceIds: readonly string[]
): Abstention {
  const coverage = detectSecurityInformationCoverage(ledger.evidence);
  const missingInformation = buildSecurityLevelMissingInformation(coverage);

  return {
    reasonCode: "missing-security-rights-and-cap-table",
    explanation:
      "TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.",
    missingInformation,
    evidenceIds: uniqueSorted([...evidenceIds, ...sortedEvidenceIds(ledger.evidence)])
  };
}

function buildSecurityLevelMissingInformation(
  coverage: SecurityInformationCoverage
): MissingInformation[] {
  const missing: MissingInformation[] = [];

  if (!coverage.hasShareRights) {
    missing.push({
      id: "missing-share-rights",
      topic: "Share rights",
      description: "The evidence ledger does not disclose rights attached to the specific security.",
      consequence: "TRACE cannot assign the headline reference to a specific share class.",
      requiredFor: ["security-level-fair-value"]
    });
  }

  if (!coverage.hasPreferences) {
    missing.push({
      id: "missing-share-preferences",
      topic: "Share preferences",
      description: "The evidence ledger does not disclose liquidation or economic preferences.",
      consequence: "TRACE cannot determine whether the security participates equally in the headline value.",
      requiredFor: ["security-level-fair-value"]
    });
  }

  if (!coverage.hasDilution) {
    missing.push({
      id: "missing-dilution",
      topic: "Dilution",
      description: "The evidence ledger does not disclose fully diluted shares, options, warrants, or convertibles.",
      consequence: "TRACE cannot convert company-level headline value into per-security fair value.",
      requiredFor: ["total-equity-value", "security-level-fair-value"]
    });
  }

  if (!coverage.hasCapTable) {
    missing.push({
      id: "missing-cap-table",
      topic: "Cap table",
      description: "The evidence ledger does not disclose capitalization table data.",
      consequence: "TRACE cannot allocate value across securities or holders.",
      requiredFor: ["total-equity-value", "security-level-fair-value"]
    });
  }

  if (missing.length === 0) {
    missing.push({
      id: "missing-security-level-method",
      topic: "Security-level valuation method",
      description:
        "The first recent-secondary pathway supports headline calibration only and does not implement a security-level allocation method.",
      consequence: "TRACE keeps security-level fair value abstained even when some capital-structure facts are available.",
      requiredFor: ["security-level-fair-value"]
    });
  }

  return missing.sort((left, right) => compareStrings(left.id, right.id));
}

function abstainedValuation(field: ValuationField, abstention: Abstention) {
  return {
    status: "abstained" as const,
    field,
    abstention
  };
}

function roundMoneyAmount(amount: MoneyAmount): MoneyAmount {
  return {
    amount: roundAmount(amount.amount),
    currency: amount.currency,
    scale: amount.scale
  };
}

function roundAmount(value: number): number {
  return Number(value.toFixed(4));
}

function textMatchesAny(text: string, patterns: readonly RegExp[]): boolean {
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

function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  return Math.floor((end - start) / 86_400_000);
}

function isIsoDate(value: string): boolean {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/u.exec(value);

  if (match?.groups === undefined) {
    return false;
  }

  const year = Number(match.groups["year"]);
  const month = Number(match.groups["month"]);
  const day = Number(match.groups["day"]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function compareTransactions(
  left: RecentSecondaryTransactionFact,
  right: RecentSecondaryTransactionFact
): number {
  return compareTuple(
    [right.transactionDate, left.evidenceId, String(left.headlineValue.amount)],
    [left.transactionDate, right.evidenceId, String(right.headlineValue.amount)]
  );
}

function compareFxRates(left: FxRateObservation, right: FxRateObservation): number {
  return compareTuple(
    [left.date, left.evidenceId, String(left.usdPerGbp)],
    [right.date, right.evidenceId, String(right.usdPerGbp)]
  );
}

function sortedEvidenceIds(evidence: readonly EvidenceRecord[]): string[] {
  return evidence.map((record) => record.id).sort(compareStrings);
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
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
