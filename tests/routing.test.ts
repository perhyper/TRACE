import { describe, expect, it } from "vitest";

import type { RouteDecision, RouteReason } from "../src/domain/schemas.js";
import { selectAnalysisRoute } from "../src/runtime/routing.js";
import type {
  EvidenceBundle,
  EvidenceBundleSourceRecord,
  EvidenceLedger
} from "../src/providers/evidence-bundle.js";
import {
  evidenceBundleSchema,
  normalizeEvidenceBundle
} from "../src/providers/evidence-bundle.js";

const revolutTarget = {
  legalName: "Revolut Group Holdings Ltd",
  jurisdiction: "GB",
  identifiers: [
    {
      scheme: "company-number",
      value: "GB-12743269",
      jurisdiction: "GB"
    }
  ],
  aliases: ["Revolut"],
  identityConfidence: "resolved"
} satisfies EvidenceBundle["target"];

const sparseTarget = {
  legalName: "Example Wallet Ltd",
  jurisdiction: "GB",
  identifiers: [
    {
      scheme: "company-number",
      value: "00000000",
      jurisdiction: "GB"
    }
  ],
  identityConfidence: "resolved"
} satisfies EvidenceBundle["target"];

function makeFact(id: string, statement: string, value: string | number | boolean = statement) {
  return {
    id,
    statement,
    epistemicClass: "observed" as const,
    value,
    period: {
      instantDate: "2025-12-31"
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
    shortExcerpt: "Example evidence record.",
    observedFacts: [makeFact(`${id}-fact`, "Example evidence fact.")],
    ...overrides
  };
}

function makeBundle(
  sourceRecords: readonly EvidenceBundleSourceRecord[],
  overrides: Partial<EvidenceBundle> = {}
): EvidenceBundle {
  return evidenceBundleSchema.parse({
    schemaVersion: "trace.evidence-bundle.v1",
    target: revolutTarget,
    measurementDate: "2026-03-24",
    decisionMode: "route-selection",
    sourceRecords,
    ...overrides
  });
}

function makeRevolutLedger(): EvidenceLedger {
  const annualReport = makeRecord("revolut-annual-report", {
    sourceUrl: "https://example.com/revolut-annual-report-2025.pdf",
    sourceTitle: "Revolut Group Holdings Ltd Annual Report 2025",
    sourceClass: "audited-filing",
    shortExcerpt:
      "Revolut Group Holdings Ltd reports customer deposits, treasury assets, financial assets, financial liabilities, revenue, profit and customers.",
    observedFacts: [
      makeFact(
        "legal-entity",
        "Revolut Group Holdings Ltd is the reporting entity for the audited financial statements."
      ),
      makeFact(
        "balance-sheet",
        "The audited statement of financial position includes customer deposits, treasury assets, financial assets and financial liabilities."
      ),
      makeFact(
        "operating-facts",
        "The annual report discloses revenue, profit, customers, deposits and assets as operating facts."
      )
    ],
    documentHash: {
      algorithm: "sha256",
      value: "cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
      contentType: "application/pdf",
      byteLength: 100_000
    }
  });
  const companyAnnouncement = makeRecord("revolut-share-sale", {
    sourceUrl: "https://example.com/revolut-share-sale",
    sourceTitle: "Revolut announces employee secondary share sale",
    sourceClass: "company-primary",
    shortExcerpt:
      "Revolut announced a secondary share sale and describes banking, payments, electronic money and lending services.",
    observedFacts: [
      makeFact(
        "financial-activity",
        "Revolut provides banking, payments, electronic money and lending services."
      ),
      makeFact(
        "secondary-transaction",
        "Revolut announced a secondary share sale with a disclosed headline valuation."
      )
    ]
  });

  return normalizeEvidenceBundle(makeBundle([companyAnnouncement, annualReport]));
}

function routeReasons(route: RouteDecision): RouteReason[] {
  if (route.status === "selected") {
    return [
      ...route.selectedReasons,
      ...route.candidates.flatMap((candidate) => candidate.reasons),
      ...route.rejectedRoutes.flatMap((candidate) => candidate.reasons)
    ];
  }

  return route.candidates.flatMap((candidate) => candidate.reasons);
}

describe("sufficiency gate and sector routing", () => {
  it("selects financial-services for Revolut-style audited, deposit-led fintech evidence", () => {
    const ledger = makeRevolutLedger();
    const result = selectAnalysisRoute(ledger);

    expect(result.sufficiency.status).toBe("sufficient");
    expect(result.sufficiency.score).toBeGreaterThanOrEqual(0.65);
    expect(result.route.status).toBe("selected");

    if (result.route.status !== "selected") {
      throw new Error("Expected a selected route decision");
    }

    expect(result.route.selectedRoute).toBe("financial-services");
    expect(result.route.candidates.map((candidate) => candidate.route)).toContain(
      "recent-transaction"
    );
    expect(result.route.rejectedRoutes.map((candidate) => candidate.route)).toContain(
      "software-saas"
    );
    expect(result.route.selectedReasons.map((reason) => reason.summary).join("\n")).toContain(
      "Audited or regulator-linked statements"
    );
  });

  it("abstains before routing when evidence is too sparse", () => {
    const sparseRecord = makeRecord("valuation-only-news", {
      sourceUrl: "https://news.example/valuation-only",
      sourceTitle: "Example Wallet valuation report",
      sourceClass: "news",
      shortExcerpt:
        "Example Wallet Ltd was described as a fintech company with a desired headline valuation.",
      observedFacts: [
        makeFact(
          "valuation-only",
          "Example Wallet Ltd was described as a fintech company with a desired headline valuation."
        )
      ]
    });
    const ledger = normalizeEvidenceBundle(
      makeBundle([sparseRecord], {
        target: sparseTarget
      })
    );
    const result = selectAnalysisRoute(ledger);

    expect(result.sufficiency.status).toBe("insufficient");
    expect(result.sufficiency.missingInformation.map((missing) => missing.topic)).toContain(
      "Financial and operating fact coverage"
    );
    expect(result.route.status).toBe("abstained");

    if (result.route.status !== "abstained") {
      throw new Error("Expected an abstained route decision");
    }

    expect(result.route.abstention.reasonCode).toBe("insufficient-route-evidence");
    expect(result.route.candidates[0]?.route).toBe("insufficient-evidence");
  });

  it("does not select financial-services from valuation-only conclusions", () => {
    const auditedGenericRecord = makeRecord("generic-audited-report", {
      sourceUrl: "https://example.com/generic-audited-report",
      sourceTitle: "Example Wallet Ltd Annual Report",
      sourceClass: "audited-filing",
      shortExcerpt:
        "Example Wallet Ltd reports revenue, customers, assets, liabilities and a statement of financial position.",
      observedFacts: [
        makeFact(
          "generic-entity",
          "Example Wallet Ltd is the reporting entity for the audited financial statements."
        ),
        makeFact(
          "generic-operating",
          "The company reports revenue, customers, assets and liabilities."
        )
      ]
    });
    const valuationRecord = makeRecord("desired-valuation", {
      sourceUrl: "https://example.com/desired-valuation",
      sourceTitle: "Example Wallet Ltd transaction announcement",
      sourceClass: "company-primary",
      shortExcerpt:
        "Example Wallet Ltd announced a secondary transaction with a desired headline valuation.",
      observedFacts: [
        makeFact(
          "generic-transaction",
          "The company announced a secondary transaction with a desired headline valuation."
        )
      ]
    });
    const ledger = normalizeEvidenceBundle(
      makeBundle([valuationRecord, auditedGenericRecord], {
        target: sparseTarget
      })
    );
    const result = selectAnalysisRoute(ledger);

    expect(result.sufficiency.status).toBe("sufficient");
    expect(result.route.status).toBe("selected");

    if (result.route.status !== "selected") {
      throw new Error("Expected a selected route decision");
    }

    expect(result.route.selectedRoute).not.toBe("financial-services");
  });

  it("selects financial-services from partner-bank activity and operating metrics without deposit balances", () => {
    const filing = makeRecord("partner-bank-filing", {
      sourceClass: "regulatory-filing",
      shortExcerpt:
        "Example Wallet Ltd provides financial technology products through partner banks and reports active members and purchase volume.",
      observedFacts: [
        makeFact(
          "partner-bank-model",
          "Example Wallet Ltd provides financial technology products through partner banks."
        ),
        makeFact(
          "member-volume",
          "The company reported active members, purchase volume and a net loss."
        )
      ]
    });
    const filingAnnouncement = makeRecord("filing-announcement", {
      shortExcerpt: "Example Wallet Ltd filed a public registration statement.",
      observedFacts: [
        makeFact(
          "filing-identity",
          "Example Wallet Ltd filed a public registration statement."
        )
      ]
    });
    const result = selectAnalysisRoute(
      normalizeEvidenceBundle(
        makeBundle([filing, filingAnnouncement], {
          target: sparseTarget
        })
      )
    );

    expect(result.sufficiency.status).toBe("sufficient");
    expect(result.route.status).toBe("selected");

    if (result.route.status !== "selected") {
      throw new Error("Expected a selected route decision");
    }

    expect(result.route.selectedRoute).toBe("financial-services");
    expect(result.route.selectedReasons.map((reason) => reason.summary).join("\n")).toContain(
      "partner-bank services"
    );
  });

  it("selects software-saas from a sparse developer-tool record", () => {
    const productRecord = makeRecord("developer-tool", {
      shortExcerpt: "Example Wallet Ltd sells issue tracking software to product teams.",
      observedFacts: [
        makeFact(
          "developer-tool-product",
          "Example Wallet Ltd sells an issue tracking developer tool to software teams."
        )
      ]
    });
    const operatingRecord = makeRecord("developer-tool-operations", {
      sourceClass: "news",
      shortExcerpt: "The company reports customers and profit.",
      observedFacts: [
        makeFact("developer-tool-customers", "The company reports customers and profit.")
      ]
    });
    const result = selectAnalysisRoute(
      normalizeEvidenceBundle(
        makeBundle([productRecord, operatingRecord], {
          target: sparseTarget
        })
      )
    );

    expect(result.route.status).toBe("selected");

    if (result.route.status !== "selected") {
      throw new Error("Expected a selected route decision");
    }

    expect(result.route.selectedRoute).toBe("software-saas");
  });

  it("recognizes plural clinical-trial and therapeutics evidence as biotech-rnpv", () => {
    const clinicalRecord = makeRecord("clinical-program", {
      shortExcerpt:
        "Example Wallet Ltd develops diagnostics and therapeutics supported by clinical trials.",
      observedFacts: [
        makeFact(
          "clinical-program-fact",
          "Example Wallet Ltd develops diagnostics and therapeutics supported by clinical trials."
        )
      ]
    });
    const operatingRecord = makeRecord("clinical-operations", {
      sourceClass: "regulatory-filing",
      shortExcerpt: "The company reported no revenue and a net loss before commercial launch.",
      observedFacts: [
        makeFact(
          "clinical-operating-fact",
          "The company reported no revenue and a net loss before commercial launch."
        )
      ]
    });
    const result = selectAnalysisRoute(
      normalizeEvidenceBundle(
        makeBundle([clinicalRecord, operatingRecord], {
          target: sparseTarget
        })
      )
    );

    expect(result.route.status).toBe("selected");

    if (result.route.status !== "selected") {
      throw new Error("Expected a selected route decision");
    }

    expect(result.route.selectedRoute).toBe("biotech-rnpv");
  });

  it("keeps repeated routing deterministic", () => {
    const ledger = makeRevolutLedger();
    const first = selectAnalysisRoute(ledger);
    const second = selectAnalysisRoute(ledger);
    const reversedLedger = {
      ...ledger,
      evidence: [...ledger.evidence].reverse()
    } satisfies EvidenceLedger;

    expect(second).toEqual(first);
    expect(selectAnalysisRoute(reversedLedger)).toEqual(first);
  });

  it("cites evidence IDs for every route reason", () => {
    const ledger = makeRevolutLedger();
    const result = selectAnalysisRoute(ledger);
    const ledgerEvidenceIds = new Set(ledger.evidence.map((record) => record.id));
    const reasons = routeReasons(result.route);

    expect(reasons.length).toBeGreaterThan(0);

    for (const reason of reasons) {
      expect(reason.evidenceIds.length).toBeGreaterThan(0);

      for (const evidenceId of reason.evidenceIds) {
        expect(ledgerEvidenceIds.has(evidenceId)).toBe(true);
      }
    }
  });
});
