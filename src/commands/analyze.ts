import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { AnalyzeCommand } from "../cli/args.js";
import { runMetadataSchema } from "../domain/schemas.js";
import {
  loadEvidenceLedgerFromJsonFile
} from "../providers/evidence-bundle.js";
import {
  composeExecutionLog,
  composeReport,
  deterministicRunId,
  renderMarkdownReport,
  serializeExecutionLog,
  serializeReportJson
} from "../reports/report.js";
import type { ReportOutputPaths } from "../reports/report.js";
import {
  defaultTraceRuntimeVersion,
  runTraceAnalyzer
} from "../runtime/analyzer.js";

const runtimeVersion = defaultTraceRuntimeVersion;

export interface AnalyzeRunOptions {
  readonly now?: () => Date;
  readonly runtimeVersion?: string;
}

export interface AnalyzeRunResult {
  readonly command: "analyze";
  readonly input: string;
  readonly out: string;
  readonly status: "completed";
  readonly runId: string;
  readonly reviewStatus: "passed" | "warnings" | "failed";
  readonly outputs: ReportOutputPaths;
}

export async function runAnalyze(
  command: AnalyzeCommand,
  options: AnalyzeRunOptions = {}
): Promise<AnalyzeRunResult> {
  const startedAtDate = currentDate(options);
  const ledger = await loadEvidenceLedgerFromJsonFile(command.input);
  const runtimeResult = runTraceAnalyzer(ledger);
  const version = options.runtimeVersion ?? runtimeVersion;
  const runId = deterministicRunId(runtimeResult, version);
  const completedAtDate = currentDate(options);
  const outputPaths = reportOutputPaths(command.out);
  const run = runMetadataSchema.parse({
    runId,
    runtimeVersion: version,
    command: formatAnalyzeCommand(command),
    measurementDate: ledger.measurementDate,
    startedAt: startedAtDate.toISOString(),
    completedAt: completedAtDate.toISOString(),
    durationMs: Math.max(0, completedAtDate.getTime() - startedAtDate.getTime()),
    inputPath: command.input,
    outputDirectory: command.out,
    warnings: ledger.warnings.map((warning) => warning.message).sort(compareStrings)
  });
  const report = composeReport({
    ...runtimeResult,
    run
  });
  const executionLog = composeExecutionLog({
    ...runtimeResult,
    run,
    inputPath: command.input,
    outputPaths
  });

  await mkdir(command.out, { recursive: true });
  await writeFile(outputPaths.jsonReport, serializeReportJson(report), "utf8");
  await writeFile(outputPaths.markdownReport, renderMarkdownReport(report), "utf8");
  await writeFile(outputPaths.executionLog, serializeExecutionLog(executionLog), "utf8");

  return {
    command: command.command,
    input: command.input,
    out: command.out,
    status: "completed",
    runId,
    reviewStatus: runtimeResult.review.status,
    outputs: outputPaths
  };
}

function currentDate(options: AnalyzeRunOptions): Date {
  return options.now?.() ?? new Date();
}

function reportOutputPaths(outputDirectory: string): ReportOutputPaths {
  return {
    jsonReport: join(outputDirectory, "report.json"),
    markdownReport: join(outputDirectory, "report.md"),
    executionLog: join(outputDirectory, "execution-log.json")
  };
}

function formatAnalyzeCommand(command: AnalyzeCommand): string {
  return `trace analyze --input ${command.input} --out ${command.out}`;
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
