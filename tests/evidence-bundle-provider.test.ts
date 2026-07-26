import { ZodError } from "zod";
import { describe, expect, it } from "vitest";

import type {
  EvidenceBundle,
  EvidenceBundleSourceRecord,
  EvidenceLedger
} from "../src/providers/evidence-bundle.js";
import {
  evidenceBundleSchema,
  normalizeEvidenceBundle,
  parseEvidenceBundleJson
} from "../src/providers/evidence-bundle.js";
import type { DocumentHash, EvidenceRecord, ObservedFact } from "../src/domain/schemas.js";

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
  identityConfidence: "resolved"
} satisfies EvidenceBundle["target"];

const documentHash = {
  algorithm: "sha256",
  value: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  contentType: "application/pdf",
  byteLength: 42_000
} satisfies DocumentHash;

function makeFact(id: string, statement: string): ObservedFact {
  return {
    id,
    statement,
    epistemicClass: "observed",
    value: statement,
    period: {
      instantDate: "2026-01-31"
    }
  };
}

function makeRecord(
  overrides: Partial<EvidenceBundleSourceRecord> = {}
): EvidenceBundleSourceRecord {
  return {
    id: "record-a",
    sourceUrl: "https://source.example/doc-a",
    sourceTitle: "Example source A",
    retrievedDate: "2026-07-26",
    publishedDate: "2026-02-01",
    sourceClass: "company-primary",
    epistemicClass: "extracted",
    shortExcerpt: "Example Holdings Ltd disclosed a relevant observed fact.",
    observedFacts: [
      makeFact("fact-a", "Example Holdings Ltd disclosed a relevant observed fact.")
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

function singleEvidenceRecord(ledger: EvidenceLedger): EvidenceRecord {
  expect(ledger.evidence).toHaveLength(1);

  const record = ledger.evidence[0];

  if (record === undefined) {
    throw new Error("Expected one evidence record");
  }

  return record;
}

describe("JSON evidence-bundle provider", () => {
  it("rejects invalid bundle schemas before normalization", () => {
    const validRecord = makeRecord();
    const bundle = makeBundle([validRecord]);

    expect(() =>
      normalizeEvidenceBundle({
        ...bundle,
        decisionMode: "benchmark"
      })
    ).toThrow(ZodError);

    expect(() =>
      normalizeEvidenceBundle({
        ...bundle,
        target: {
          ...target,
          identifiers: []
        }
      })
    ).toThrow(ZodError);

    expect(() =>
      normalizeEvidenceBundle({
        ...bundle,
        sourceRecords: [
          {
            ...validRecord,
            observedFacts: []
          }
        ]
      })
    ).toThrow(ZodError);
  });

  it("parses JSON bundles through the public provider entrypoint", () => {
    const bundle = makeBundle([makeRecord()]);

    expect(parseEvidenceBundleJson(JSON.stringify(bundle))).toEqual(bundle);
  });

  it("deduplicates repeated citations to one originating source", () => {
    const origin = {
      sourceUrl: "https://company.example/news/transaction",
      sourceTitle: "Company transaction announcement",
      publishedDate: "2026-02-15"
    };
    const repeatedFact = makeFact(
      "fact-from-origin",
      "The company announced a transaction reference."
    );
    const firstRecord = makeRecord({
      id: "syndicated-record-a",
      sourceUrl: "https://news.example/a?b=2&a=1",
      sourceTitle: "News copy A",
      observedFacts: [repeatedFact],
      originatingSource: origin
    });
    const secondRecord = makeRecord({
      id: "syndicated-record-b",
      sourceUrl: "https://wire.example/b",
      sourceTitle: "News copy B",
      observedFacts: [
        {
          ...repeatedFact,
          id: "fact-from-origin-duplicate"
        }
      ],
      originatingSource: origin
    });

    const ledger = normalizeEvidenceBundle(makeBundle([secondRecord, firstRecord]));
    const evidence = singleEvidenceRecord(ledger);

    expect(evidence.sourceUrl).toBe(origin.sourceUrl);
    expect(evidence.sourceTitle).toBe(origin.sourceTitle);
    expect(evidence.observedFacts).toHaveLength(1);
    expect(evidence.id).toMatch(/^ev-[a-f0-9]{12}$/u);
    expect(evidence.observedFacts[0]?.id).toMatch(/^fact-[a-f0-9]{12}$/u);
    expect(ledger.warnings).toEqual([
      {
        code: "duplicate-originating-source",
        message: "Merged 2 evidence records that cite the same originating source.",
        recordIds: ["syndicated-record-a", "syndicated-record-b"],
        sourceUrls: ["https://news.example/a?b=2&a=1", "https://wire.example/b"],
        evidenceIds: [evidence.id]
      }
    ]);
  });

  it("excludes evidence published after the measurement-date cutoff", () => {
    const staleRecord = makeRecord({
      id: "after-cutoff",
      sourceUrl: "https://source.example/after-cutoff",
      sourceTitle: "After cutoff disclosure",
      publishedDate: "2026-03-25"
    });

    const ledger = normalizeEvidenceBundle(makeBundle([staleRecord]));

    expect(ledger.evidence).toEqual([]);
    expect(ledger.excludedRecords).toEqual([
      {
        recordId: "after-cutoff",
        reasonCode: "published-after-measurement-date",
        message:
          "Evidence record after-cutoff was published after the measurement date and was excluded.",
        sourceUrl: "https://source.example/after-cutoff",
        sourceTitle: "After cutoff disclosure",
        publishedDate: "2026-03-25",
        measurementDate: "2026-03-24"
      }
    ]);
    expect(ledger.warnings).toEqual([
      {
        code: "published-after-measurement-date",
        message:
          "Excluded after-cutoff because publishedDate 2026-03-25 is after measurementDate 2026-03-24.",
        recordIds: ["after-cutoff"],
        sourceUrls: ["https://source.example/after-cutoff"],
        evidenceIds: []
      }
    ]);
  });

  it("excludes syndicated records published after cutoff even when the origin predates cutoff", () => {
    const record = makeRecord({
      id: "after-cutoff-syndication",
      sourceUrl: "https://news.example/after-cutoff-syndication",
      sourceTitle: "After cutoff syndicated copy",
      publishedDate: "2026-03-26",
      originatingSource: {
        sourceUrl: "https://company.example/before-cutoff-origin",
        sourceTitle: "Before cutoff origin",
        publishedDate: "2026-03-01"
      },
      observedFacts: [
        makeFact("fact-after-cutoff", "This fact must not leak through the origin record.")
      ]
    });

    const ledger = normalizeEvidenceBundle(makeBundle([record]));

    expect(ledger.evidence).toEqual([]);
    expect(ledger.excludedRecords).toHaveLength(1);
    expect(ledger.excludedRecords[0]?.publishedDate).toBe("2026-03-26");
    expect(ledger.warnings[0]?.code).toBe("published-after-measurement-date");
  });

  it("normalizes stable ordering independent of input order", () => {
    const earlierRecord = makeRecord({
      id: "z-input-id",
      sourceUrl: "https://source.example/earlier",
      sourceTitle: "Earlier source",
      publishedDate: "2026-01-10",
      observedFacts: [makeFact("fact-z", "Earlier source fact.")]
    });
    const laterRecord = makeRecord({
      id: "a-input-id",
      sourceUrl: "https://source.example/later",
      sourceTitle: "Later source",
      publishedDate: "2026-03-01",
      observedFacts: [makeFact("fact-a", "Later source fact.")]
    });
    const firstLedger = normalizeEvidenceBundle(makeBundle([laterRecord, earlierRecord]));
    const secondLedger = normalizeEvidenceBundle(makeBundle([earlierRecord, laterRecord]));

    expect(firstLedger).toEqual(secondLedger);
    expect(firstLedger.evidence.map((record) => record.sourceTitle)).toEqual([
      "Earlier source",
      "Later source"
    ]);
    expect(firstLedger.evidence.map((record) => record.id)).not.toEqual([
      "z-input-id",
      "a-input-id"
    ]);
  });

  it("preserves document hashes and failed access notes", () => {
    const record = makeRecord({
      documentHash
    });
    const failedNote = {
      id: "failed-access-a",
      stage: "access",
      sourceUrl: "https://source.example/missing-document",
      sourceTitle: "Missing document",
      attemptedAt: "2026-07-26T00:00:00Z",
      note: "The provider received an HTTP 404 while retrieving the source."
    } satisfies EvidenceBundle["failedNotes"][number];

    const ledger = normalizeEvidenceBundle(
      makeBundle([record], {
        failedNotes: [failedNote]
      })
    );

    expect(singleEvidenceRecord(ledger).documentHash).toEqual(documentHash);
    expect(ledger.failedNotes).toEqual([failedNote]);
  });
});
