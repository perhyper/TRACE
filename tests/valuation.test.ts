import { describe, expect, it } from "vitest";

import type {
  EvidenceBundle,
  EvidenceBundleSourceRecord,
  EvidenceLedger
} from "../src/providers/evidence-bundle.js";
import {
  evidenceBundleSchema,
  normalizeEvidenceBundle
} from "../src/providers/evidence-bundle.js";
import {
  extractRecentSecondaryTransactions,
  valueFromRecentSecondaryTransaction
} from "../src/runtime/valuation.js";

const target = {
  legalName: "Example Holdings Ltd",
  jurisdiction: "GB",
  identifiers: [
    {
      scheme: "company-number",
      value: "12345678",
      jurisdiction: "GB"
    }
  ],
  aliases: ["Example"],
  identityConfidence: "resolved"
} satisfies EvidenceBundle["target"];

function makeFact(
  id: string,
  statement: string,
  value: string | number | boolean = statement,
  unit?: string,
  instantDate = "2025-11-24"
) {
  return {
    id,
    statement,
    epistemicClass: "observed" as const,
    value,
    ...(unit !== undefined ? { unit } : {}),
    period: {
      instantDate
    }
  };
}

function makeRecord(
  id: string,
  overrides: Partial<EvidenceBundleSourceRecord> = {}
): EvidenceBundleSourceRecord {
  return {
    id,
    sourceUrl: `https://source.example/${id}`,
    sourceTitle: `Source ${id}`,
    retrievedDate: "2026-07-26",
    publishedDate: "2026-03-01",
    sourceClass: "company-primary",
    epistemicClass: "extracted",
    shortExcerpt: "Example Holdings Ltd disclosed a measurement-date eligible observed fact.",
    observedFacts: [
      makeFact(`${id}-fact`, "Example Holdings Ltd disclosed a measurement-date eligible observed fact.")
    ],
    ...overrides
  };
}

function makeBundle(
  sourceRecords: readonly EvidenceBundleSourceRecord[],
  overrides: Partial<EvidenceBundle> = {}
): EvidenceBundle {
  return evidenceBundleSchema.parse({
    schemaVersion: "trace.evidence-bundle.v1",
    target,
    measurementDate: "2026-03-24",
    decisionMode: "valuation-review",
    sourceRecords,
    ...overrides
  });
}

function makeSecondaryTransactionRecord(
  overrides: Partial<EvidenceBundleSourceRecord> = {},
  headlineValue = 75,
  headlineUnit = "USD billions"
): EvidenceBundleSourceRecord {
  return makeRecord("secondary-share-sale", {
    sourceUrl: "https://company.example/secondary-share-sale",
    sourceTitle: "Example completes secondary share sale",
    sourceClass: "company-primary",
    shortExcerpt:
      "Example announced an employee secondary share sale with an implied valuation. Transaction terms, share rights, preferences, dilution, and cap-table data were not disclosed.",
    observedFacts: [
      makeFact(
        "transaction-date",
        "The company completed the secondary share sale on 2025-11-24.",
        "2025-11-24"
      ),
      makeFact(
        "headline-valuation",
        "The secondary share sale established an implied headline valuation.",
        headlineValue,
        headlineUnit
      ),
      makeFact(
        "transaction-type",
        "The transaction was an employee secondary share sale.",
        "secondary share sale"
      ),
      makeFact(
        "disclosure-limitations",
        "Transaction terms, share rights, preferences, dilution, and cap-table data were not disclosed.",
        "not disclosed"
      )
    ],
    ...overrides
  });
}

function makeFedH10Record(rate = 1.3383): EvidenceBundleSourceRecord {
  return makeRecord("fed-h10-gbp-usd", {
    sourceUrl: "https://www.federalreserve.gov/releases/h10/hist/dat00_uk.htm",
    sourceTitle: "Federal Reserve H.10 historical GBP rate",
    sourceClass: "government",
    shortExcerpt: "Federal Reserve H.10 reports USD per GBP; 2026-03-24 observation is 1.3383.",
    observedFacts: [
      makeFact(
        "gbp-usd-rate",
        "Federal Reserve H.10 GBP/USD USD per GBP observation for 2026-03-24.",
        rate,
        "USD per GBP",
        "2026-03-24"
      )
    ]
  });
}

function normalizedLedger(records: readonly EvidenceBundleSourceRecord[]): EvidenceLedger {
  return normalizeEvidenceBundle(makeBundle(records));
}

function expectConcludedHeadline(ledger: EvidenceLedger) {
  const valuation = valueFromRecentSecondaryTransaction(ledger);

  if (valuation.headlineValuation.status !== "concluded") {
    throw new Error("Expected concluded headline valuation");
  }

  return valuation.headlineValuation;
}

describe("recent-secondary valuation calibration", () => {
  it("parses recent secondary transaction facts from the evidence ledger", () => {
    const ledger = normalizedLedger([makeSecondaryTransactionRecord()]);
    const transactions = extractRecentSecondaryTransactions(ledger);
    const transaction = transactions[0];

    expect(transactions).toHaveLength(1);
    expect(transaction).toMatchObject({
      transactionDate: "2025-11-24",
      transactionType: "secondary",
      sourceClass: "company-primary",
      headlineValue: {
        amount: 75,
        currency: "USD",
        scale: "billions"
      }
    });
    expect(transaction?.disclosureLimitations).toContain("Transaction terms are not disclosed.");
    expect(transaction?.evidenceId).toMatch(/^ev-[a-f0-9]{12}$/u);
    expect(transaction?.factIds.length).toBeGreaterThan(0);
  });

  it("calibrates the USD 75 billion headline without turning it into enterprise value", () => {
    const valuation = valueFromRecentSecondaryTransaction(
      normalizedLedger([makeSecondaryTransactionRecord()])
    );

    expect(valuation.headlineValuation.status).toBe("concluded");

    if (valuation.headlineValuation.status !== "concluded") {
      throw new Error("Expected concluded headline valuation");
    }

    expect(valuation.headlineValuation.range).toEqual({
      low: {
        amount: 60,
        currency: "USD",
        scale: "billions"
      },
      base: {
        amount: 75,
        currency: "USD",
        scale: "billions"
      },
      high: {
        amount: 90,
        currency: "USD",
        scale: "billions"
      }
    });
    expect(valuation.headlineValuation.basis.assumptions.join("\n")).toContain(
      "not copied into enterprise value"
    );
    expect(valuation.enterpriseValue.status).toBe("abstained");
    expect(valuation.totalEquityValue.status).toBe("abstained");
    expect(valuation.enterpriseValue).not.toEqual(valuation.headlineValuation);
  });

  it("uses Federal Reserve H.10 GBP/USD evidence for measurement-date normalization", () => {
    const headline = expectConcludedHeadline(
      normalizedLedger([
        makeSecondaryTransactionRecord({}, 100, "GBP billions"),
        makeFedH10Record()
      ])
    );

    expect(headline.range.base).toEqual({
      amount: 133.83,
      currency: "USD",
      scale: "billions"
    });
    expect(headline.range.low.amount).toBe(107.064);
    expect(headline.range.high.amount).toBe(160.596);
    expect(headline.basis.evidenceIds).toHaveLength(2);
    expect(headline.basis.assumptions.join("\n")).toContain("Federal Reserve H.10 GBP/USD 1.3383");
  });

  it("widens uncertainty for secondary transactions and opaque share rights", () => {
    const opaqueHeadline = expectConcludedHeadline(
      normalizedLedger([makeSecondaryTransactionRecord()])
    );
    const transparentHeadline = expectConcludedHeadline(
      normalizedLedger([
        makeSecondaryTransactionRecord({
          observedFacts: [
            makeFact(
              "transaction-date",
              "The company completed the secondary share sale on 2025-11-24.",
              "2025-11-24"
            ),
            makeFact(
              "headline-valuation",
              "The secondary share sale established an implied headline valuation.",
              75,
              "USD billions"
            ),
            makeFact(
              "transaction-type",
              "The transaction was an employee secondary share sale.",
              "secondary share sale"
            ),
            makeFact(
              "share-rights",
              "The evidence discloses share rights, voting rights, share preferences, fully diluted shares outstanding, options, dilution, and cap-table data.",
              "share rights, preferences, dilution, cap table"
            )
          ]
        })
      ])
    );

    expect(opaqueHeadline.range.low.amount).toBeLessThan(transparentHeadline.range.low.amount);
    expect(opaqueHeadline.range.high.amount).toBeGreaterThan(transparentHeadline.range.high.amount);
    expect(transparentHeadline.range).toEqual({
      low: {
        amount: 67.5,
        currency: "USD",
        scale: "billions"
      },
      base: {
        amount: 75,
        currency: "USD",
        scale: "billions"
      },
      high: {
        amount: 82.5,
        currency: "USD",
        scale: "billions"
      }
    });
    expect(opaqueHeadline.basis.assumptions.join("\n")).toContain(
      "Uncertainty is widened because share rights"
    );
  });

  it("abstains from security-level fair value when security terms are unavailable", () => {
    const valuation = valueFromRecentSecondaryTransaction(
      normalizedLedger([makeSecondaryTransactionRecord()])
    );

    expect(valuation.securityLevelFairValue.status).toBe("abstained");

    if (valuation.securityLevelFairValue.status !== "abstained") {
      throw new Error("Expected security-level fair value abstention");
    }

    expect(valuation.securityLevelFairValue.abstention.reasonCode).toBe(
      "security-rights-and-cap-table-not-disclosed"
    );
    expect(
      valuation.securityLevelFairValue.abstention.missingInformation.map((missing) => missing.topic)
    ).toEqual(["Cap table", "Dilution", "Share preferences", "Share rights"]);
  });

  it("keeps calibration arithmetic deterministic across repeated and reordered ledgers", () => {
    const ledger = normalizedLedger([
      makeSecondaryTransactionRecord({}, 100, "GBP billions"),
      makeFedH10Record()
    ]);
    const reversedLedger = {
      ...ledger,
      evidence: [...ledger.evidence].reverse()
    } satisfies EvidenceLedger;
    const first = valueFromRecentSecondaryTransaction(ledger);
    const second = valueFromRecentSecondaryTransaction(ledger);
    const reversed = valueFromRecentSecondaryTransaction(reversedLedger);

    expect(second).toEqual(first);
    expect(reversed).toEqual(first);
  });
});
