import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { runAnalyze } from "../src/commands/analyze.js";
import {
  executionLogSchema,
  reportSchema
} from "../src/domain/schemas.js";
import {
  evidenceBundleSchema
} from "../src/providers/evidence-bundle.js";
import type {
  EvidenceBundle,
  EvidenceBundleSourceRecord
} from "../src/providers/evidence-bundle.js";

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
      makeFact(
        `${id}-fact`,
        "Example Holdings Ltd disclosed a measurement-date eligible observed fact."
      )
    ],
    ...overrides
  };
}

function makeBundle(): EvidenceBundle {
  const annualReport = makeRecord("annual-report", {
    sourceUrl: "https://company.example/annual-report-2025.pdf",
    sourceTitle: "Example Holdings Ltd Annual Report 2025",
    sourceClass: "audited-filing",
    shortExcerpt:
      "Example Holdings Ltd reports customer deposits, treasury assets, financial assets, financial liabilities, banking services, revenue, profit and customers.",
    observedFacts: [
      makeFact(
        "legal-entity",
        "Example Holdings Ltd is the reporting entity for the audited financial statements.",
        "Example Holdings Ltd",
        undefined,
        "2025-12-31"
      ),
      makeFact(
        "balance-sheet",
        "The audited statement of financial position includes customer deposits, treasury assets, financial assets and financial liabilities.",
        "customer deposits, treasury assets, financial assets and financial liabilities",
        undefined,
        "2025-12-31"
      ),
      makeFact(
        "operating-facts",
        "The annual report discloses revenue, profit, customers, deposits and assets as operating facts.",
        "revenue, profit, customers, deposits and assets",
        undefined,
        "2025-12-31"
      )
    ],
    documentHash: {
      algorithm: "sha256",
      value: "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
      contentType: "application/pdf",
      byteLength: 100_000
    }
  });
  const shareSale = makeRecord("secondary-share-sale", {
    sourceUrl: "https://company.example/secondary-share-sale",
    sourceTitle: "Example completes secondary share sale",
    sourceClass: "company-primary",
    shortExcerpt:
      "Example Holdings Ltd announced an employee secondary share sale with an implied valuation. Transaction terms, share rights, preferences, dilution, and cap-table data were not disclosed.",
    observedFacts: [
      makeFact(
        "transaction-date",
        "Example Holdings Ltd completed the secondary share sale on 2025-11-24.",
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
        "disclosure-limitations",
        "Transaction terms, share rights, preferences, dilution, and cap-table data were not disclosed.",
        "not disclosed"
      )
    ]
  });

  return evidenceBundleSchema.parse({
    schemaVersion: "trace.evidence-bundle.v1",
    target,
    measurementDate: "2026-03-24",
    decisionMode: "valuation-review",
    sourceRecords: [shareSale, annualReport]
  });
}

function makeSparseTransactionBundle(): EvidenceBundle {
  const sparseTransaction = makeRecord("sparse-transaction", {
    sourceUrl: "https://news.example/sparse-transaction",
    sourceTitle: "Example sparse secondary share sale report",
    sourceClass: "news",
    shortExcerpt:
      "Example Holdings Ltd was reported to have a secondary share sale with an implied headline valuation, but audited operating and balance-sheet evidence was not supplied.",
    observedFacts: [
      makeFact(
        "transaction-date",
        "Example Holdings Ltd completed the secondary share sale on 2025-11-24.",
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
        "The transaction was a secondary share sale.",
        "secondary share sale"
      )
    ]
  });

  return evidenceBundleSchema.parse({
    schemaVersion: "trace.evidence-bundle.v1",
    target,
    measurementDate: "2026-03-24",
    decisionMode: "valuation-review",
    sourceRecords: [sparseTransaction]
  });
}

async function withTemporaryWorkspace<T>(callback: (workspace: string) => Promise<T>): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "trace-reporting-"));

  try {
    return await callback(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function writeBundle(workspace: string): Promise<string> {
  return writeBundleToPath(workspace, makeBundle());
}

async function writeBundleToPath(
  workspace: string,
  bundle: EvidenceBundle
): Promise<string> {
  const inputPath = join(workspace, "evidence-bundle.json");

  await writeFile(inputPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");

  return inputPath;
}

describe("reviewer and report composer", () => {
  it("emits validated JSON, Markdown, and execution-log artifacts from one runtime result", async () =>
    withTemporaryWorkspace(async (workspace) => {
      const inputPath = await writeBundle(workspace);
      const outputDirectory = join(workspace, "out");
      const result = await runAnalyze(
        {
          command: "analyze",
          input: inputPath,
          out: outputDirectory
        },
        {
          now: () => new Date("2026-07-26T00:00:00Z"),
          runtimeVersion: "test-runtime"
        }
      );

      const report = reportSchema.parse(
        JSON.parse(await readFile(result.outputs.jsonReport, "utf8"))
      );
      const markdown = await readFile(result.outputs.markdownReport, "utf8");
      const executionLog = executionLogSchema.parse(
        JSON.parse(await readFile(result.outputs.executionLog, "utf8"))
      );

      expect(report.schemaVersion).toBe("trace.report.v1");
      expect(report.decisionMode).toBe("valuation-review");
      expect(report.run.runId).toBe(result.runId);
      expect(report.run.runtimeVersion).toBe("test-runtime");
      expect(report.route.status).toBe("selected");
      expect(report.valuation.headlineValuation.status).toBe("concluded");

      if (report.valuation.headlineValuation.status !== "concluded") {
        throw new Error("Expected concluded headline valuation");
      }

      expect(report.valuation.headlineValuation.range.base).toEqual({
        amount: 75,
        currency: "USD",
        scale: "billions"
      });
      expect(report.valuation.enterpriseValue.status).toBe("abstained");
      expect(report.valuation.totalEquityValue.status).toBe("abstained");
      expect(report.valuation.securityLevelFairValue.status).toBe("abstained");
      expect(new Set(report.review.findings.map((finding) => finding.category))).toEqual(
        new Set([
          "abstention",
          "calculation",
          "cutoff",
          "entity",
          "evidence",
          "route",
          "valuation-separation"
        ])
      );

      expect(markdown).toContain(report.company.legalName);
      expect(markdown).toContain(report.run.runId);
      expect(markdown).toContain("USD 75 billions");
      expect(markdown).toContain("Security-Level Fair Value");
      expect(markdown).toContain("Cap table");
      expect(markdown).toContain("TRACE output is decision support");

      expect(executionLog.runId).toBe(report.run.runId);
      expect(executionLog.outputPaths).toEqual(result.outputs);
      expect(executionLog.validationWarnings).toEqual(report.run.warnings);
      expect(executionLog.reviewerFindings).toEqual(report.review.findings);
      expect(executionLog.deterministicIdentifiers.evidenceLedgerHash).toMatch(/^[a-f0-9]{64}$/u);
      expect(executionLog.deterministicIdentifiers.runtimeResultHash).toMatch(/^[a-f0-9]{64}$/u);
    }));

  it("keeps repeated output byte-identical when inputs and volatile clock values are fixed", async () =>
    withTemporaryWorkspace(async (workspace) => {
      const inputPath = await writeBundle(workspace);
      const outputDirectory = join(workspace, "out");
      const command = {
        command: "analyze" as const,
        input: inputPath,
        out: outputDirectory
      };
      const options = {
        now: () => new Date("2026-07-26T00:00:00Z"),
        runtimeVersion: "test-runtime"
      };
      const firstResult = await runAnalyze(command, options);
      const firstJson = await readFile(firstResult.outputs.jsonReport, "utf8");
      const firstMarkdown = await readFile(firstResult.outputs.markdownReport, "utf8");
      const firstLog = await readFile(firstResult.outputs.executionLog, "utf8");
      const secondResult = await runAnalyze(command, options);

      expect(secondResult.runId).toBe(firstResult.runId);
      expect(await readFile(secondResult.outputs.jsonReport, "utf8")).toBe(firstJson);
      expect(await readFile(secondResult.outputs.markdownReport, "utf8")).toBe(firstMarkdown);
      expect(await readFile(secondResult.outputs.executionLog, "utf8")).toBe(firstLog);
    }));

  it("keeps valuation abstained when the sufficiency gate abstains from route selection", async () =>
    withTemporaryWorkspace(async (workspace) => {
      const inputPath = await writeBundleToPath(workspace, makeSparseTransactionBundle());
      const outputDirectory = join(workspace, "out");
      const result = await runAnalyze(
        {
          command: "analyze",
          input: inputPath,
          out: outputDirectory
        },
        {
          now: () => new Date("2026-07-26T00:00:00Z"),
          runtimeVersion: "test-runtime"
        }
      );
      const report = reportSchema.parse(
        JSON.parse(await readFile(result.outputs.jsonReport, "utf8"))
      );

      expect(report.route.status).toBe("abstained");
      expect(report.valuation.headlineValuation.status).toBe("abstained");
      expect(report.valuation.enterpriseValue.status).toBe("abstained");
      expect(report.valuation.totalEquityValue.status).toBe("abstained");
      expect(report.valuation.securityLevelFairValue.status).toBe("abstained");
      expect(report.review.findings.find((finding) => finding.id === "review-route-appropriateness")).toMatchObject({
        severity: "pass",
        category: "route"
      });
    }));
});
