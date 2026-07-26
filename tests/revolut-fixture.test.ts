import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import type { ObservedFact } from "../src/domain/schemas.js";
import type { EvidenceBundle } from "../src/providers/evidence-bundle.js";
import {
  normalizeEvidenceBundle,
  parseEvidenceBundleJson
} from "../src/providers/evidence-bundle.js";

const fixturePath = join(
  process.cwd(),
  "fixtures",
  "evidence",
  "revolut-2025-evidence-bundle.json"
);
const dataSourcesPath = join(process.cwd(), "references", "data-sources.md");
const annualReportUrl = "https://assets.revolut.com/pdf/annualreport2025.pdf";
const approvedSourceUrls = [
  annualReportUrl,
  "https://www.revolut.com/news/revolut_completes_fundraising_process_establishing_75_billion_valuation/",
  "https://www.federalreserve.gov/releases/h10/hist/dat00_uk.htm"
].sort(compareStrings);
const annualReportSha256 =
  "969dd74a7213513ef92c02d64d6427fec03adaec6b1f5470602f9872725e5e24";

async function loadRevolutFixture(): Promise<EvidenceBundle> {
  return parseEvidenceBundleJson(await readFile(fixturePath, "utf8"));
}

function peerContextFact(bundle: EvidenceBundle): ObservedFact {
  const fact = bundle.sourceRecords
    .flatMap((record) => record.observedFacts)
    .find((candidate) => candidate.id === "annual-report-qualitative-peer-context");

  if (fact === undefined) {
    throw new Error("Expected qualitative peer context fact");
  }

  return fact;
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

describe("Revolut 2025 evidence fixture", () => {
  it("uses only approved baseline public sources", async () => {
    const bundle = await loadRevolutFixture();
    const dataSources = await readFile(dataSourcesPath, "utf8");
    const uniqueFixtureUrls = Array.from(
      new Set(bundle.sourceRecords.map((record) => record.sourceUrl))
    ).sort(compareStrings);

    expect(bundle.target.legalName).toBe("Revolut Group Holdings Ltd");
    expect(bundle.target.identifiers).toContainEqual({
      scheme: "company-number",
      value: "GB-12743269",
      jurisdiction: "GB"
    });
    expect(bundle.measurementDate).toBe("2026-03-24");
    expect(uniqueFixtureUrls).toEqual(approvedSourceUrls);

    for (const sourceUrl of uniqueFixtureUrls) {
      expect(dataSources).toContain(sourceUrl);
    }

    for (const record of bundle.sourceRecords) {
      expect(approvedSourceUrls).toContain(record.sourceUrl);
      expect(record.retrievedDate).toBe("2026-07-26");
      expect(record.shortExcerpt.length).toBeGreaterThan(20);
      expect(record.locator).toBeDefined();
    }
  });

  it("keeps fixture evidence within the measurement-date cutoff", async () => {
    const bundle = await loadRevolutFixture();
    const ledger = normalizeEvidenceBundle(bundle);

    for (const record of bundle.sourceRecords) {
      if (record.publishedDate !== undefined) {
        expect(record.publishedDate <= bundle.measurementDate).toBe(true);
      }

      if (record.effectiveDate !== undefined) {
        expect(record.effectiveDate <= bundle.measurementDate).toBe(true);
      }
    }

    expect(ledger.measurementDate).toBe("2026-03-24");
    expect(ledger.excludedRecords).toEqual([]);
    expect(ledger.warnings.every((warning) => warning.code !== "published-after-measurement-date"))
      .toBe(true);
  });

  it("carries the audited annual-report hash from the source catalogue", async () => {
    const bundle = await loadRevolutFixture();
    const dataSources = await readFile(dataSourcesPath, "utf8");
    const annualReportRecords = bundle.sourceRecords.filter(
      (record) => record.sourceUrl === annualReportUrl
    );

    expect(annualReportRecords.length).toBeGreaterThan(0);
    expect(dataSources).toContain(annualReportSha256);

    for (const record of annualReportRecords) {
      expect(record.documentHash).toEqual({
        algorithm: "sha256",
        value: annualReportSha256,
        contentType: "application/pdf",
        byteLength: 12279247
      });
    }
  });

  it("selects qualitative peer context with explicit wording", async () => {
    const bundle = await loadRevolutFixture();
    const fact = peerContextFact(bundle);

    expect(fact.epistemicClass).toBe("inferred");
    expect(fact.statement).toContain("TRACE selects peers qualitatively");
    expect(fact.statement).toContain("no peer metrics are supplied");

    if (!Array.isArray(fact.value)) {
      throw new Error("Expected peer context fact value to be an array");
    }

    expect(fact.value).toEqual([
      "Wise plc - qualitative context only for cross-border money movement and multi-currency account functionality.",
      "Monzo Bank Holding Group Ltd - qualitative context only for UK app-based banking and consumer current-account services.",
      "Starling Bank Ltd - qualitative context only for UK digital banking and business-account services.",
      "Klarna Bank AB - qualitative context only for European consumer fintech, checkout payments, and credit products."
    ]);
    expect(fact.value.length).toBeGreaterThanOrEqual(3);
    expect(fact.value.length).toBeLessThanOrEqual(5);
  });

  it("does not invent quantitative peer metrics", async () => {
    const bundle = await loadRevolutFixture();
    const fact = peerContextFact(bundle);

    if (!Array.isArray(fact.value)) {
      throw new Error("Expected peer context fact value to be an array");
    }

    const unsupportedMetricPattern =
      /(?:\d|%|\$|£|\b(?:USD|GBP|EUR|revenue|profit|valuation|multiple|margin|assets?|deposits?|customers?|growth|arr|gmv)\b)/iu;

    expect(fact.unit).toBeUndefined();

    for (const peerExplanation of fact.value) {
      expect(typeof peerExplanation).toBe("string");
      expect(peerExplanation).toContain("qualitative context only");
      expect(String(peerExplanation)).not.toMatch(unsupportedMetricPattern);
    }
  });
});
