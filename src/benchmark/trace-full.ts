import { createHash } from "node:crypto";

import {
  defaultTraceRuntimeVersion,
  runTraceAnalyzer
} from "../runtime/analyzer.js";
import {
  runMetadataSchema
} from "../domain/schemas.js";
import type {
  EvidenceRecord,
  ExecutionLog,
  MoneyAmount,
  ObservedFact,
  Report,
  RouteDecision,
  RunMetadata,
  ValuationConclusion,
  ValuationField
} from "../domain/schemas.js";
import {
  composeExecutionLog,
  composeReport,
  renderMarkdownReport
} from "../reports/report.js";
import type {
  ReportOutputPaths,
  ReportRuntimeResult
} from "../reports/report.js";
import {
  benchmarkCaseInputSchema,
  benchmarkRunnerNameSchema,
  benchmarkRunnerOutputSchema
} from "./contracts.js";
import type {
  BenchmarkCaseInput,
  BenchmarkCasePartition,
  BenchmarkCitation,
  BenchmarkEmittedAbstention,
  BenchmarkEmittedClaim,
  BenchmarkEmittedRoute,
  BenchmarkEmittedValuation,
  BenchmarkFailureRecord,
  BenchmarkNormalizedRunnerOutput,
  BenchmarkRunnerOutput,
  BenchmarkTimingMetadata
} from "./contracts.js";

export interface BenchmarkTraceFullRunOptions {
  readonly input: unknown;
  readonly runId: string;
  readonly runtimeVersion?: string;
}

interface TraceFullContext {
  readonly input: BenchmarkCaseInput;
  readonly inputFingerprint: string;
  readonly runtimeResult: ReportRuntimeResult;
  readonly report: Report;
  readonly executionLog: ExecutionLog;
}

interface TraceFullRawJson {
  readonly schemaVersion: "trace.trace-full-runner-output.v1";
  readonly runnerName: "trace-full";
  readonly analyzerVersion: string;
  readonly inputFingerprint: string;
  readonly case: TraceFullCaseMetadata;
  readonly sourcePolicy: BenchmarkCaseInput["sourcePolicy"];
  readonly authorityBoundary: BenchmarkCaseInput["authorityBoundary"];
  readonly analyzerPath: readonly string[];
  readonly runtimeResult: ReportRuntimeResult;
  readonly report: Report;
  readonly executionLog: ExecutionLog;
}

interface TraceFullCaseMetadata {
  readonly caseId: string;
  readonly partition: BenchmarkCasePartition;
  readonly scoringRole: BenchmarkCaseInput["scoringRole"];
  readonly countedInScoring: boolean;
  readonly companyLegalName: string;
  readonly measurementDate: string;
  readonly cutoffDate: string;
  readonly dataTier: BenchmarkCaseInput["dataTier"];
  readonly manifestLockId: string;
  readonly sourceRecordIds: readonly string[];
}

interface FailureIdentity {
  readonly caseId: string;
  readonly partition: BenchmarkCasePartition;
  readonly companyLegalName: string;
}

const deterministicTimingBaseMs = Date.UTC(2026, 6, 26, 0, 0, 0, 0);
const valuationFields = [
  "headline-valuation",
  "enterprise-value",
  "total-equity-value",
  "security-level-fair-value"
] satisfies readonly ValuationField[];

export function runTraceFull(options: BenchmarkTraceFullRunOptions): BenchmarkRunnerOutput {
  benchmarkRunnerNameSchema.parse("trace-full");
  const inputResult = benchmarkCaseInputSchema.safeParse(options.input);

  if (!inputResult.success) {
    return buildFailedOutput({
      runId: options.runId,
      identity: identityFromUnknownInput(options.input),
      message: truncateFailureMessage(`Benchmark case input failed validation: ${inputResult.error.issues
        .map((issue) => issue.message)
        .join("; ")}`)
    });
  }

  const input = inputResult.data;
  const runtimeVersion = options.runtimeVersion ?? defaultTraceRuntimeVersion;

  try {
    const timing = deterministicTiming(input, "completed");
    const runtimeResult = runTraceAnalyzer(input.evidenceLedger);
    const run = buildRunMetadata(input, options.runId, runtimeVersion, timing);
    const report = composeReport({
      ...runtimeResult,
      run
    });
    const executionLog = composeExecutionLog({
      ...runtimeResult,
      run,
      inputPath: benchmarkInputReference(input),
      outputPaths: benchmarkOutputPathReferences(input, options.runId)
    });
    const context: TraceFullContext = {
      input,
      inputFingerprint: shortHash(stableStringify(input)),
      runtimeResult,
      report,
      executionLog
    };
    const normalized = normalizeTraceFullOutput(context);
    const rawJson = buildRawJson(context, runtimeVersion);

    return benchmarkRunnerOutputSchema.parse({
      schemaVersion: "trace.benchmark-runner-output.v1",
      runnerName: "trace-full",
      runId: options.runId,
      caseId: input.caseId,
      partition: input.partition,
      status: "completed",
      timing,
      rawOutput: {
        markdown: renderMarkdownReport(report),
        json: rawJson
      },
      normalized,
      failures: []
    });
  } catch (error) {
    return buildFailedOutput({
      runId: options.runId,
      identity: {
        caseId: input.caseId,
        partition: input.partition,
        companyLegalName: input.companyLegalName
      },
      message: truncateFailureMessage(errorMessage(error)),
      input
    });
  }
}

function buildRunMetadata(
  input: BenchmarkCaseInput,
  runId: string,
  runtimeVersion: string,
  timing: BenchmarkTimingMetadata
): RunMetadata {
  return runMetadataSchema.parse({
    runId,
    runtimeVersion,
    command: `trace benchmark --partition ${input.partition} --runner trace-full --case-id ${input.caseId}`,
    measurementDate: input.measurementDate,
    startedAt: timing.startedAt,
    completedAt: timing.completedAt,
    durationMs: timing.durationMs,
    inputPath: benchmarkInputReference(input),
    outputDirectory: benchmarkOutputDirectoryReference(input, runId),
    warnings: input.evidenceLedger.warnings.map((warning) => warning.message).sort(compareStrings)
  });
}

function buildRawJson(
  context: TraceFullContext,
  analyzerVersion: string
): TraceFullRawJson {
  return {
    schemaVersion: "trace.trace-full-runner-output.v1",
    runnerName: "trace-full",
    analyzerVersion,
    inputFingerprint: context.inputFingerprint,
    case: caseMetadata(context.input),
    sourcePolicy: context.input.sourcePolicy,
    authorityBoundary: context.input.authorityBoundary,
    analyzerPath: [
      "evidence-ledger",
      "sufficiency-gating",
      "route-selection",
      "valuation-engine",
      "adversarial-review",
      "report-composer"
    ],
    runtimeResult: context.runtimeResult,
    report: context.report,
    executionLog: context.executionLog
  };
}

function normalizeTraceFullOutput(context: TraceFullContext): BenchmarkNormalizedRunnerOutput {
  const valuationConclusions = orderedValuationConclusions(context.report.valuation);

  return {
    claims: [
      ...buildEvidenceClaims(context.input, context.report.evidence),
      buildSufficiencyClaim(context),
      buildRouteClaim(context),
      ...valuationConclusions.map((conclusion) => buildValuationClaim(context.input, conclusion))
    ].sort(compareClaims),
    route: normalizeRoute(context.report.route),
    abstentions: valuationConclusions
      .filter((conclusion): conclusion is Extract<ValuationConclusion, { status: "abstained" }> =>
        conclusion.status === "abstained"
      )
      .map((conclusion) => normalizeAbstention(conclusion))
      .sort(compareAbstentions),
    valuations: valuationConclusions.map(normalizeValuation).sort(compareValuations)
  };
}

function buildEvidenceClaims(
  input: BenchmarkCaseInput,
  evidence: readonly EvidenceRecord[]
): BenchmarkEmittedClaim[] {
  return evidence.flatMap((record) =>
    [...record.observedFacts].sort(compareObservedFacts).map((fact) => ({
      id: `trace-claim-${shortHash(`${input.caseId}\n${record.id}\n${fact.id}\n${fact.statement}`)}`,
      kind: "observable" as const,
      statement: fact.statement,
      ...(fact.value !== undefined ? { value: fact.value } : {}),
      ...(fact.unit !== undefined ? { unit: fact.unit } : {}),
      ...(fact.period !== undefined ? { period: fact.period } : {}),
      citations: [
        {
          evidenceId: record.id,
          factId: fact.id,
          ...(record.locator !== undefined ? { locator: record.locator } : {})
        }
      ]
    }))
  );
}

function buildSufficiencyClaim(context: TraceFullContext): BenchmarkEmittedClaim {
  return {
    id: `trace-sufficiency-${shortHash(context.input.caseId)}`,
    kind: "other",
    statement: boundedStatement(
      `TRACE sufficiency is ${context.report.sufficiency.status} with score ${formatScore(context.report.sufficiency.score)}: ${context.report.sufficiency.rationale}`
    ),
    value: context.report.sufficiency.score,
    citations: criterionCitations(context.report.sufficiency.criteria)
  };
}

function buildRouteClaim(context: TraceFullContext): BenchmarkEmittedClaim {
  const route = context.report.route;

  if (route.status === "selected") {
    return {
      id: `trace-route-${shortHash(`${context.input.caseId}\n${route.selectedRoute}`)}`,
      kind: "route",
      statement: boundedStatement(
        `TRACE selected ${route.selectedRoute}: ${route.selectedReasons
          .map((reason) => reason.summary)
          .join(" ")}`
      ),
      value: route.selectedRoute,
      citations: evidenceIdCitations(uniqueSorted(route.selectedReasons.flatMap((reason) => reason.evidenceIds)))
    };
  }

  return {
    id: `trace-route-${shortHash(`${context.input.caseId}\n${route.abstention.reasonCode}`)}`,
    kind: "abstention",
    statement: boundedStatement(`TRACE abstained from route selection: ${route.abstention.explanation}`),
    value: route.abstention.reasonCode,
    citations: evidenceIdCitations(route.abstention.evidenceIds)
  };
}

function buildValuationClaim(
  input: BenchmarkCaseInput,
  conclusion: ValuationConclusion
): BenchmarkEmittedClaim {
  if (conclusion.status === "concluded") {
    return {
      id: `trace-valuation-${shortHash(`${input.caseId}\n${conclusion.field}`)}`,
      kind: "valuation",
      statement: boundedStatement(
        `${labelForValuationField(conclusion.field)} concluded at base ${formatMoneyAmount(conclusion.range.base)} using ${conclusion.basis.method}: ${conclusion.basis.description}`
      ),
      value: conclusion.range.base.amount,
      unit: formatMoneyUnit(conclusion.range.base),
      citations: evidenceIdCitations(conclusion.basis.evidenceIds)
    };
  }

  return {
    id: `trace-valuation-${shortHash(`${input.caseId}\n${conclusion.field}`)}`,
    kind: "abstention",
    statement: boundedStatement(
      `${labelForValuationField(conclusion.field)} abstained: ${conclusion.abstention.explanation}`
    ),
    value: conclusion.abstention.reasonCode,
    citations: evidenceIdCitations(conclusion.abstention.evidenceIds)
  };
}

function normalizeRoute(route: RouteDecision): BenchmarkEmittedRoute {
  if (route.status === "selected") {
    return {
      status: "selected",
      selectedRoute: route.selectedRoute,
      rationale: boundedRationale(route.selectedReasons.map((reason) => reason.summary).join(" ")),
      evidenceIds: uniqueSorted(route.selectedReasons.flatMap((reason) => reason.evidenceIds))
    };
  }

  return {
    status: "abstained",
    reasonCode: route.abstention.reasonCode,
    explanation: boundedRationale(route.abstention.explanation),
    evidenceIds: uniqueSorted(route.abstention.evidenceIds)
  };
}

function normalizeAbstention(
  conclusion: Extract<ValuationConclusion, { status: "abstained" }>
): BenchmarkEmittedAbstention {
  return {
    id: `trace-abstention-${conclusion.field}`,
    field: conclusion.field,
    reasonCode: conclusion.abstention.reasonCode,
    explanation: boundedRationale(conclusion.abstention.explanation),
    evidenceIds: uniqueSorted(conclusion.abstention.evidenceIds)
  };
}

function normalizeValuation(conclusion: ValuationConclusion): BenchmarkEmittedValuation {
  if (conclusion.status === "concluded") {
    return {
      field: conclusion.field,
      status: "concluded",
      value: conclusion.range.base.amount,
      unit: formatMoneyUnit(conclusion.range.base),
      rationale: boundedRationale(conclusion.basis.description),
      evidenceIds: uniqueSorted(conclusion.basis.evidenceIds)
    };
  }

  return {
    field: conclusion.field,
    status: "abstained",
    rationale: boundedRationale(conclusion.abstention.explanation),
    evidenceIds: uniqueSorted(conclusion.abstention.evidenceIds)
  };
}

function buildFailedOutput(options: {
  readonly runId: string;
  readonly identity: FailureIdentity;
  readonly message: string;
  readonly input?: BenchmarkCaseInput;
}): BenchmarkRunnerOutput {
  const timing = options.input === undefined
    ? deterministicFailureTiming(options.identity)
    : deterministicTiming(options.input, "failed");
  const failure = failureRecord({
    runId: options.runId,
    identity: options.identity,
    message: options.message,
    ...(timing.completedAt !== undefined ? { occurredAt: timing.completedAt } : {})
  });

  return benchmarkRunnerOutputSchema.parse({
    schemaVersion: "trace.benchmark-runner-output.v1",
    runnerName: "trace-full",
    runId: options.runId,
    caseId: options.identity.caseId,
    partition: options.identity.partition,
    status: "failed",
    timing,
    rawOutput: {
      markdown: renderFailureMarkdown(options.identity, options.message),
      json: {
        schemaVersion: "trace.trace-full-runner-output.v1",
        runnerName: "trace-full",
        analyzerVersion: defaultTraceRuntimeVersion,
        traceFullKind: "failure-record",
        case: options.identity,
        failure
      }
    },
    normalized: {
      claims: [],
      route: {
        status: "omitted"
      },
      abstentions: [],
      valuations: []
    },
    failures: [failure]
  });
}

function failureRecord(options: {
  readonly runId: string;
  readonly identity: FailureIdentity;
  readonly message: string;
  readonly occurredAt?: string;
}): BenchmarkFailureRecord {
  return {
    schemaVersion: "trace.benchmark-failure.v1",
    failureId: `trace-full-runner-${shortHash(options.message)}`,
    stage: "runner",
    severity: "fatal",
    message: options.message,
    retryable: false,
    runId: options.runId,
    runnerName: "trace-full",
    caseId: options.identity.caseId,
    partition: options.identity.partition,
    ...(options.occurredAt !== undefined ? { occurredAt: options.occurredAt } : {})
  };
}

function renderFailureMarkdown(identity: FailureIdentity, message: string): string {
  return [
    `# TRACE Full Failure: ${identity.companyLegalName}`,
    "",
    `Case: ${identity.caseId}`,
    `Partition: ${identity.partition}`,
    "",
    "## Failure",
    message
  ].join("\n").concat("\n");
}

function caseMetadata(input: BenchmarkCaseInput): TraceFullCaseMetadata {
  return {
    caseId: input.caseId,
    partition: input.partition,
    scoringRole: input.scoringRole,
    countedInScoring: input.countedInScoring,
    companyLegalName: input.companyLegalName,
    measurementDate: input.measurementDate,
    cutoffDate: input.cutoffDate,
    dataTier: input.dataTier,
    manifestLockId: input.manifestLockId,
    sourceRecordIds: [...input.sourceRecordIds].sort(compareStrings)
  };
}

function deterministicTiming(
  input: BenchmarkCaseInput,
  status: "completed" | "failed"
): BenchmarkTimingMetadata {
  const evidenceCount = input.evidenceLedger.evidence.length;
  const factCount = input.evidenceLedger.evidence.reduce(
    (total, record) => total + record.observedFacts.length,
    0
  );
  const warningCount =
    input.evidenceLedger.warnings.length + input.evidenceLedger.failedNotes.length;
  const statusOffset = status === "completed" ? 0 : 37;
  const durationMs = 180 + evidenceCount * 23 + factCount * 7 + warningCount * 5 + statusOffset;

  return timingFromDuration(durationMs);
}

function deterministicFailureTiming(identity: FailureIdentity): BenchmarkTimingMetadata {
  const durationMs = 180 + Number.parseInt(shortHash(`trace-full\n${identity.caseId}`).slice(0, 4), 16) % 80;

  return timingFromDuration(durationMs);
}

function timingFromDuration(durationMs: number): BenchmarkTimingMetadata {
  return {
    schemaVersion: "trace.benchmark-timing.v1",
    startedAt: new Date(deterministicTimingBaseMs).toISOString(),
    completedAt: new Date(deterministicTimingBaseMs + durationMs).toISOString(),
    durationMs
  };
}

function orderedValuationConclusions(valuation: Report["valuation"]): ValuationConclusion[] {
  const conclusions = {
    "headline-valuation": valuation.headlineValuation,
    "enterprise-value": valuation.enterpriseValue,
    "total-equity-value": valuation.totalEquityValue,
    "security-level-fair-value": valuation.securityLevelFairValue
  } satisfies Record<ValuationField, ValuationConclusion>;

  return valuationFields.map((field) => conclusions[field]);
}

function criterionCitations(
  criteria: readonly Report["sufficiency"]["criteria"][number][]
): BenchmarkCitation[] {
  return evidenceIdCitations(uniqueSorted(criteria.flatMap((criterion) => criterion.evidenceIds)));
}

function evidenceIdCitations(evidenceIds: readonly string[]): BenchmarkCitation[] {
  return uniqueSorted(evidenceIds).map((evidenceId) => ({ evidenceId }));
}

function benchmarkInputReference(input: BenchmarkCaseInput): string {
  return `benchmark:${input.partition}:${input.caseId}`;
}

function benchmarkOutputDirectoryReference(input: BenchmarkCaseInput, runId: string): string {
  return `benchmark-artifact:${input.partition}/${runId}/trace-full/${input.caseId}`;
}

function benchmarkOutputPathReferences(
  input: BenchmarkCaseInput,
  runId: string
): ReportOutputPaths {
  const outputDirectory = benchmarkOutputDirectoryReference(input, runId);

  return {
    jsonReport: `${outputDirectory}/raw-runner-output.json`,
    markdownReport: `${outputDirectory}/raw-runner-output.md`,
    executionLog: `${outputDirectory}/raw-runner-output.json#executionLog`
  };
}

function identityFromUnknownInput(input: unknown): FailureIdentity {
  if (input !== null && typeof input === "object") {
    const candidate = input as Record<string, unknown>;
    const caseId = stringOrDefault(candidate.caseId, "invalid-benchmark-input-0000");
    const partition = partitionOrDefault(candidate.partition);
    const companyLegalName = stringOrDefault(candidate.companyLegalName, "Invalid benchmark input");

    return {
      caseId: normalizeCaseId(caseId),
      partition,
      companyLegalName
    };
  }

  return {
    caseId: "invalid-benchmark-input-0000",
    partition: "demo",
    companyLegalName: "Invalid benchmark input"
  };
}

function normalizeCaseId(value: string): string {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*-\d{4}$/u.test(value)
    ? value
    : "invalid-benchmark-input-0000";
}

function partitionOrDefault(value: unknown): BenchmarkCasePartition {
  return value === "development" || value === "locked-test" || value === "demo" ? value : "demo";
}

function stringOrDefault(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function boundedStatement(statement: string): string {
  return boundedText(statement, 2_000);
}

function boundedRationale(rationale: string): string {
  return boundedText(rationale, 1_500);
}

function boundedText(value: string, maxLength: number): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 3)}...`;
}

function formatMoneyAmount(amount: MoneyAmount): string {
  return `${amount.currency} ${formatNumber(amount.amount)} ${amount.scale}`;
}

function formatMoneyUnit(amount: MoneyAmount): string {
  return `${amount.currency} ${amount.scale}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatScore(score: number): string {
  return score.toFixed(4).replace(/0+$/u, "").replace(/\.$/u, "");
}

function labelForValuationField(field: ValuationField): string {
  switch (field) {
    case "headline-valuation":
      return "Headline Valuation";
    case "enterprise-value":
      return "Enterprise Value";
    case "total-equity-value":
      return "Total Equity Value";
    case "security-level-fair-value":
      return "Security-Level Fair Value";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown TRACE Full runner failure";
}

function truncateFailureMessage(message: string): string {
  const maxFailureMessageLength = 2_000;

  if (message.length <= maxFailureMessageLength) {
    return message;
  }

  return `${message.slice(0, maxFailureMessageLength - 14)} [truncated]`;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => compareStrings(leftKey, rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function compareClaims(left: BenchmarkEmittedClaim, right: BenchmarkEmittedClaim): number {
  return compareTuple([left.kind, left.statement, left.id], [right.kind, right.statement, right.id]);
}

function compareObservedFacts(
  left: ObservedFact,
  right: ObservedFact
): number {
  return compareTuple([left.statement, left.id], [right.statement, right.id]);
}

function compareAbstentions(
  left: BenchmarkEmittedAbstention,
  right: BenchmarkEmittedAbstention
): number {
  return compareStrings(left.field, right.field);
}

function compareValuations(
  left: BenchmarkEmittedValuation,
  right: BenchmarkEmittedValuation
): number {
  return compareStrings(left.field, right.field);
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

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
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
