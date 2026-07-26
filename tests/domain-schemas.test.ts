import { ZodError } from "zod";
import { describe, expect, it } from "vitest";

import {
  evidenceRecordSchema,
  reportSchema,
  runMetadataSchema,
  valuationOutputSchema
} from "../src/domain/schemas.js";
import type {
  Abstention,
  EvidenceRecord,
  MissingInformation,
  Report,
  RouteDecision,
  Sufficiency,
  ValuationConclusion,
  ValuationField,
  ValuationOutput
} from "../src/domain/schemas.js";

const validEvidence = {
  id: "ev-annual-report",
  sourceUrl: "https://example.com/annual-report.pdf",
  sourceTitle: "Example Annual Report 2025",
  retrievedDate: "2026-07-26",
  publishedDate: "2026-03-01",
  effectiveDate: "2025-12-31",
  sourceClass: "audited-filing",
  epistemicClass: "extracted",
  locator: "p. 7",
  shortExcerpt: "The report identifies Example Holdings Ltd as the reporting entity.",
  observedFacts: [
    {
      id: "fact-legal-name",
      statement: "Example Holdings Ltd is the reporting entity.",
      epistemicClass: "observed",
      value: "Example Holdings Ltd",
      period: {
        instantDate: "2025-12-31"
      }
    }
  ],
  documentHash: {
    algorithm: "sha256",
    value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    contentType: "application/pdf",
    byteLength: 123_456
  }
} satisfies EvidenceRecord;

const capitalStructureMissing = {
  id: "missing-capital-structure",
  topic: "Capital structure and share rights",
  description: "The evidence bundle does not disclose share rights, preferences, or dilution.",
  consequence: "TRACE cannot support enterprise, total-equity, or security-level fair value.",
  requiredFor: ["enterprise-value", "total-equity-value", "security-level-fair-value"]
} satisfies MissingInformation;

const capitalStructureAbstention = {
  reasonCode: "capital-structure-not-disclosed",
  explanation: "Security-level fair value requires instrument rights and cap-table evidence.",
  missingInformation: [capitalStructureMissing],
  evidenceIds: ["ev-annual-report"]
} satisfies Abstention;

function makeAbstainedValuation(field: ValuationField): ValuationConclusion {
  return {
    status: "abstained",
    field,
    abstention: capitalStructureAbstention
  };
}

const validValuation = {
  headlineValuation: {
    status: "concluded",
    field: "headline-valuation",
    range: {
      low: {
        amount: 70,
        currency: "USD",
        scale: "billions"
      },
      base: {
        amount: 75,
        currency: "USD",
        scale: "billions"
      },
      high: {
        amount: 80,
        currency: "USD",
        scale: "billions"
      }
    },
    basis: {
      method: "recent-secondary-calibration",
      description: "Observed headline transaction value is retained as a calibration input.",
      evidenceIds: ["ev-annual-report"],
      assumptions: ["The headline value is not treated as enterprise value."],
      limitations: ["Share rights and transaction terms are not disclosed."]
    }
  },
  enterpriseValue: makeAbstainedValuation("enterprise-value"),
  totalEquityValue: makeAbstainedValuation("total-equity-value"),
  securityLevelFairValue: makeAbstainedValuation("security-level-fair-value")
} satisfies ValuationOutput;

const validSufficiency = {
  status: "sufficient",
  score: 0.75,
  criteria: [
    {
      criterion: "Entity and audited statement coverage",
      status: "met",
      explanation: "The evidence identifies the legal entity and reporting period.",
      evidenceIds: ["ev-annual-report"]
    }
  ],
  missingInformation: [capitalStructureMissing],
  rationale: "The available evidence is enough for routing but not for all valuation fields."
} satisfies Sufficiency;

const validRoute = {
  status: "selected",
  selectedRoute: "financial-services",
  selectedReasons: [
    {
      summary: "Audited evidence supports a financial-services route.",
      evidenceIds: ["ev-annual-report"]
    }
  ],
  candidates: [
    {
      route: "financial-services",
      status: "selected",
      score: 0.9,
      reasons: [
        {
          summary: "The entity has bank-like audited statement evidence.",
          evidenceIds: ["ev-annual-report"]
        }
      ]
    }
  ],
  rejectedRoutes: [
    {
      route: "software-saas",
      status: "rejected",
      score: 0.2,
      reasons: [
        {
          summary: "The available evidence does not support a generic SaaS route.",
          evidenceIds: ["ev-annual-report"]
        }
      ]
    }
  ]
} satisfies RouteDecision;

const validReport = {
  schemaVersion: "trace.report.v1",
  company: {
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
  },
  measurementDate: "2026-03-24",
  evidence: [validEvidence],
  sufficiency: validSufficiency,
  route: validRoute,
  valuation: validValuation,
  review: {
    status: "warnings",
    reviewerVersion: "0.1.0",
    findings: [
      {
        id: "finding-abstention",
        severity: "warning",
        category: "abstention",
        message: "Security-level fair value is explicitly abstained.",
        evidenceIds: ["ev-annual-report"],
        missingInformation: [capitalStructureMissing]
      }
    ]
  },
  sections: {
    facts: ["Example Holdings Ltd is the reporting entity."],
    inferences: ["The route is selected from audited evidence coverage."],
    conflicts: [],
    limitations: ["Security-level fair value is not concluded."],
    counterarguments: ["The headline valuation may not transfer to every security."],
    missingInformation: [capitalStructureMissing],
    nextDiligenceQuestions: ["What rights attach to the securities being valued?"]
  },
  run: {
    runId: "run-example-20260324",
    runtimeVersion: "0.1.0",
    command: "trace analyze --input fixtures/example.json --out examples/output/example",
    measurementDate: "2026-03-24",
    startedAt: "2026-07-26T00:00:00Z",
    completedAt: "2026-07-26T00:00:01Z",
    durationMs: 1_000,
    inputPath: "fixtures/example.json",
    outputDirectory: "examples/output/example",
    warnings: ["Security-level fair value abstained."]
  }
} satisfies Report;

describe("core domain schemas", () => {
  it("validates a complete report contract", () => {
    expect(reportSchema.parse(validReport)).toEqual(validReport);
  });

  it("requires evidence source URLs", () => {
    const withoutSourceUrl: Record<string, unknown> = { ...validEvidence };

    delete withoutSourceUrl.sourceUrl;

    expect(() => evidenceRecordSchema.parse(withoutSourceUrl)).toThrow(ZodError);
  });

  it("rejects unknown fields", () => {
    expect(() =>
      evidenceRecordSchema.parse({
        ...validEvidence,
        searchSnippet: "Discovery snippets are not evidence."
      })
    ).toThrow(ZodError);
  });

  it("rejects invalid calendar dates", () => {
    expect(() =>
      evidenceRecordSchema.parse({
        ...validEvidence,
        retrievedDate: "2026-02-30"
      })
    ).toThrow(ZodError);

    expect(() =>
      runMetadataSchema.parse({
        ...validReport.run,
        startedAt: "2026-02-30T00:00:00Z"
      })
    ).toThrow(ZodError);
  });

  it("rejects invalid source classes", () => {
    expect(() =>
      evidenceRecordSchema.parse({
        ...validEvidence,
        sourceClass: "search-snippet"
      })
    ).toThrow(ZodError);
  });

  it("keeps valuation output fields separated", () => {
    const missingEnterpriseValue: Record<string, unknown> = { ...validValuation };

    delete missingEnterpriseValue.enterpriseValue;

    expect(() => valuationOutputSchema.parse(missingEnterpriseValue)).toThrow(ZodError);
    expect(() =>
      valuationOutputSchema.parse({
        ...validValuation,
        valuation: validValuation.headlineValuation
      })
    ).toThrow(ZodError);
    expect(() =>
      valuationOutputSchema.parse({
        ...validValuation,
        enterpriseValue: {
          ...validValuation.enterpriseValue,
          field: "headline-valuation"
        }
      })
    ).toThrow(ZodError);
  });

  it("requires missing-information detail for abstentions", () => {
    expect(() =>
      valuationOutputSchema.parse({
        ...validValuation,
        securityLevelFairValue: {
          ...validValuation.securityLevelFairValue,
          abstention: {
            ...capitalStructureAbstention,
            missingInformation: []
          }
        }
      })
    ).toThrow(ZodError);
  });
});
