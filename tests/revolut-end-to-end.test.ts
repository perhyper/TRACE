import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

import {
  executionLogSchema,
  reportSchema
} from "../src/domain/schemas.js";
import type {
  ExecutionLog,
  Report,
  ValuationConclusion
} from "../src/domain/schemas.js";

const execFileAsync = promisify(execFile);
const fixturePath = join(
  process.cwd(),
  "fixtures",
  "evidence",
  "revolut-2025-evidence-bundle.json"
);
const committedOutputDirectory = join(process.cwd(), "eval", "revolut-first-slice");
const authorityBoundary =
  "TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.";

interface TraceCliResult {
  readonly command: "analyze";
  readonly input: string;
  readonly out: string;
  readonly status: "completed";
  readonly runId: string;
  readonly reviewStatus: "passed" | "warnings" | "failed";
  readonly outputs: {
    readonly jsonReport: string;
    readonly markdownReport: string;
    readonly executionLog: string;
  };
}

interface ReportArtifacts {
  readonly reportJson: string;
  readonly markdown: string;
  readonly executionLogJson: string;
  readonly report: Report;
  readonly executionLog: ExecutionLog;
}

async function withTemporaryWorkspace<T>(
  callback: (workspace: string) => Promise<T>
): Promise<T> {
  const workspace = await mkdtemp(join(tmpdir(), "trace-revolut-e2e-"));

  try {
    return await callback(workspace);
  } finally {
    await rm(workspace, { recursive: true, force: true });
  }
}

async function runTraceAnalyze(outputDirectory: string): Promise<TraceCliResult> {
  const { stdout } = await execFileAsync(
    "npm",
    [
      "run",
      "trace",
      "--",
      "analyze",
      "--input",
      fixturePath,
      "--out",
      outputDirectory
    ],
    {
      cwd: process.cwd(),
      maxBuffer: 4 * 1024 * 1024
    }
  );

  const jsonStart = stdout.indexOf("{\n  \"command\"");

  if (jsonStart === -1) {
    throw new Error(`Trace CLI did not emit a JSON result: ${stdout}`);
  }

  return JSON.parse(stdout.slice(jsonStart)) as TraceCliResult;
}

async function readArtifacts(outputDirectory: string): Promise<ReportArtifacts> {
  const reportJson = await readFile(join(outputDirectory, "report.json"), "utf8");
  const markdown = await readFile(join(outputDirectory, "report.md"), "utf8");
  const executionLogJson = await readFile(
    join(outputDirectory, "execution-log.json"),
    "utf8"
  );
  const report = reportSchema.parse(JSON.parse(reportJson));
  const executionLog = executionLogSchema.parse(JSON.parse(executionLogJson));

  return {
    reportJson,
    markdown,
    executionLogJson,
    report,
    executionLog
  };
}

function expectRevolutReportContract(artifacts: ReportArtifacts): void {
  const { report, markdown, executionLog } = artifacts;

  expect(report.schemaVersion).toBe("trace.report.v1");
  expect(report.company.legalName).toBe("Revolut Group Holdings Ltd");
  expect(report.measurementDate).toBe("2026-03-24");
  expect(report.decisionMode).toBe("valuation-review");
  expect(report.sufficiency.status).toBe("sufficient");
  expect(report.route.status).toBe("selected");

  if (report.route.status !== "selected") {
    throw new Error("Expected Revolut fixture to select an analysis route");
  }

  expect(report.route.selectedRoute).toBe("financial-services");
  expect(report.review.status).toBe("passed");
  expect(executionLog.runId).toBe(report.run.runId);
  expect(executionLog.reviewerFindings).toEqual(report.review.findings);
  expect(executionLog.deterministicIdentifiers.evidenceLedgerHash).toMatch(/^[a-f0-9]{64}$/u);
  expect(executionLog.deterministicIdentifiers.runtimeResultHash).toMatch(/^[a-f0-9]{64}$/u);

  expectHeadlineOnlyCalibration(report.valuation.headlineValuation);
  expect(report.valuation.enterpriseValue.status).toBe("abstained");
  expect(report.valuation.totalEquityValue.status).toBe("abstained");
  expectSecurityLevelAbstention(report.valuation.securityLevelFairValue);
  expectAuthorityBoundary(report, markdown);
}

function expectHeadlineOnlyCalibration(conclusion: ValuationConclusion): void {
  expect(conclusion.status).toBe("concluded");

  if (conclusion.status !== "concluded") {
    throw new Error("Expected concluded headline valuation");
  }

  expect(conclusion.field).toBe("headline-valuation");
  expect(conclusion.range.base).toEqual({
    amount: 75,
    currency: "USD",
    scale: "billions"
  });
  expect(conclusion.basis.description).toContain("company-level calibration reference only");
  expect(conclusion.basis.assumptions).toContain(
    "The headline transaction reference is not copied into enterprise value, total equity value, or security-level fair value."
  );
}

function expectSecurityLevelAbstention(conclusion: ValuationConclusion): void {
  expect(conclusion.status).toBe("abstained");

  if (conclusion.status !== "abstained") {
    throw new Error("Expected security-level fair value abstention");
  }

  expect(conclusion.field).toBe("security-level-fair-value");
  expect(conclusion.abstention.reasonCode).toBe(
    "missing-security-rights-and-cap-table"
  );
  expect(conclusion.abstention.explanation).toContain("share rights");
  expect(conclusion.abstention.explanation).toContain("cap-table data");
  expect(conclusion.abstention.missingInformation.map((missing) => missing.id).sort()).toEqual([
    "missing-cap-table",
    "missing-dilution",
    "missing-share-preferences",
    "missing-share-rights"
  ]);
}

function expectAuthorityBoundary(report: Report, markdown: string): void {
  const reportText = `${JSON.stringify(report)}\n${markdown}`;

  expect(report.sections.limitations).toContain(authorityBoundary);
  expect(markdown).toContain(authorityBoundary);

  for (const pattern of forbiddenAffirmativeClaimPatterns()) {
    expect(reportText).not.toMatch(pattern);
  }
}

function forbiddenAffirmativeClaimPatterns(): RegExp[] {
  return [
    /\bcontest[- ]compliant\b/iu,
    /\bcomplies with (?:the )?contest\b/iu,
    /\bcontest[- ]compliance\s+(?:is|was|has been|confirmed|demonstrated|achieved)\b/iu,
    /\bbenchmark[- ]superiority\s+(?:is|was|has been|confirmed|demonstrated|achieved)\b/iu,
    /\boutperforms? (?:the )?benchmark\b/iu,
    /\b(?:is|was|constitutes) an appraisal\b/iu,
    /\bappraisal status:\s*(?:complete|approved|final)\b/iu,
    /\binvestment advice\b/iu,
    /\b(?:buy|sell|hold) recommendation\b/iu,
    /\binvestors? should\b/iu
  ];
}

function normalizeReportJson(reportJson: string): string {
  const report = reportSchema.parse(JSON.parse(reportJson));

  return JSON.stringify(
    {
      ...report,
      run: {
        ...report.run,
        startedAt: "<started-at>",
        completedAt: "<completed-at>",
        durationMs: 0
      }
    },
    null,
    2
  );
}

function normalizeExecutionLogJson(executionLogJson: string): string {
  const executionLog = executionLogSchema.parse(JSON.parse(executionLogJson));

  return JSON.stringify(
    {
      ...executionLog,
      startedAt: "<started-at>",
      completedAt: "<completed-at>",
      durationMs: 0
    },
    null,
    2
  );
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/^- Started at: .+$/mu, "- Started at: <started-at>")
    .replace(/^- Completed at: .+$/mu, "- Completed at: <completed-at>")
    .replace(/^- Duration ms: \d+$/mu, "- Duration ms: <duration-ms>");
}

describe("Revolut end-to-end analyze command", () => {
  it("emits validated report artifacts for the first-slice fixture", async () =>
    withTemporaryWorkspace(async (workspace) => {
      const outputDirectory = join(workspace, "out");
      const result = await runTraceAnalyze(outputDirectory);
      const artifacts = await readArtifacts(outputDirectory);

      expect(result).toMatchObject({
        command: "analyze",
        input: fixturePath,
        out: outputDirectory,
        status: "completed",
        runId: artifacts.report.run.runId,
        reviewStatus: "passed",
        outputs: {
          jsonReport: join(outputDirectory, "report.json"),
          markdownReport: join(outputDirectory, "report.md"),
          executionLog: join(outputDirectory, "execution-log.json")
        }
      });
      expectRevolutReportContract(artifacts);
    }));

  it("keeps repeated fixture output deterministic outside run timing fields", async () =>
    withTemporaryWorkspace(async (workspace) => {
      const outputDirectory = join(workspace, "out");
      const firstResult = await runTraceAnalyze(outputDirectory);
      const firstArtifacts = await readArtifacts(outputDirectory);
      const secondResult = await runTraceAnalyze(outputDirectory);
      const secondArtifacts = await readArtifacts(outputDirectory);

      expect(secondResult.runId).toBe(firstResult.runId);
      expect(normalizeReportJson(secondArtifacts.reportJson)).toBe(
        normalizeReportJson(firstArtifacts.reportJson)
      );
      expect(normalizeMarkdown(secondArtifacts.markdown)).toBe(
        normalizeMarkdown(firstArtifacts.markdown)
      );
      expect(normalizeExecutionLogJson(secondArtifacts.executionLogJson)).toBe(
        normalizeExecutionLogJson(firstArtifacts.executionLogJson)
      );
    }));

  it("keeps the stable eval first-slice artifacts valid and authority-bound", async () => {
    const artifacts = await readArtifacts(committedOutputDirectory);

    expect(artifacts.report.run.command).toBe(
      "trace analyze --input fixtures/evidence/revolut-2025-evidence-bundle.json --out eval/revolut-first-slice"
    );
    expect(artifacts.executionLog.outputPaths).toEqual({
      jsonReport: "eval/revolut-first-slice/report.json",
      markdownReport: "eval/revolut-first-slice/report.md",
      executionLog: "eval/revolut-first-slice/execution-log.json"
    });
    expectRevolutReportContract(artifacts);
  });
});
