import { createHash } from "node:crypto";

import type {
  EvidenceRecord,
  FactPeriod,
  FactValue,
  ObservedFact,
  ValuationField
} from "../domain/schemas.js";
import {
  benchmarkCaseInputSchema,
  benchmarkRunnerNameSchema,
  benchmarkRunnerOutputSchema
} from "./contracts.js";
import type {
  BenchmarkCaseInput,
  BenchmarkCasePartition,
  BenchmarkEmittedClaim,
  BenchmarkEmittedValuation,
  BenchmarkFailureRecord,
  BenchmarkNormalizedRunnerOutput,
  BenchmarkRunnerName,
  BenchmarkRunnerOutput,
  BenchmarkTimingMetadata
} from "./contracts.js";

export type BenchmarkBaselineRunnerName = Extract<
  BenchmarkRunnerName,
  "baseline-a" | "baseline-b"
>;

export interface BenchmarkBaselineRunOptions {
  readonly input: unknown;
  readonly runId: string;
}

interface BaselineContext {
  readonly input: BenchmarkCaseInput;
  readonly inputFingerprint: string;
  readonly claims: BenchmarkEmittedClaim[];
  readonly evidenceSummaries: EvidenceSummary[];
}

interface EvidenceSummary {
  readonly evidenceId: string;
  readonly sourceTitle: string;
  readonly sourceUrl: string;
  readonly sourceClass: string;
  readonly epistemicClass: string;
  readonly retrievedDate: string;
  readonly publishedDate?: string;
  readonly effectiveDate?: string;
  readonly locator?: string;
  readonly shortExcerpt: string;
  readonly observedFacts: FactSummary[];
}

interface FactSummary {
  readonly factId: string;
  readonly statement: string;
  readonly value?: FactValue;
  readonly unit?: string;
  readonly period?: FactPeriod;
}

const baselineRunnerNames = ["baseline-a", "baseline-b"] as const;
const deterministicTimingBaseMs = Date.UTC(2026, 6, 26, 0, 0, 0, 0);
const valuationFields = [
  "headline-valuation",
  "enterprise-value",
  "total-equity-value",
  "security-level-fair-value"
] satisfies readonly ValuationField[];

export function runBaselineA(options: BenchmarkBaselineRunOptions): BenchmarkRunnerOutput {
  return runBaseline({
    ...options,
    runnerName: "baseline-a",
    renderCompletedOutput: renderBaselineAOutput
  });
}

export function runBaselineB(options: BenchmarkBaselineRunOptions): BenchmarkRunnerOutput {
  return runBaseline({
    ...options,
    runnerName: "baseline-b",
    renderCompletedOutput: renderBaselineBOutput
  });
}

export function runBenchmarkBaseline(options: BenchmarkBaselineRunOptions & {
  readonly runnerName: BenchmarkBaselineRunnerName;
}): BenchmarkRunnerOutput {
  if (options.runnerName === "baseline-a") {
    return runBaselineA(options);
  }

  return runBaselineB(options);
}

export function isBenchmarkBaselineRunnerName(
  runnerName: BenchmarkRunnerName
): runnerName is BenchmarkBaselineRunnerName {
  return baselineRunnerNames.includes(runnerName as BenchmarkBaselineRunnerName);
}

function runBaseline(options: BenchmarkBaselineRunOptions & {
  readonly runnerName: BenchmarkBaselineRunnerName;
  readonly renderCompletedOutput: (context: BaselineContext) => BaselineRawOutput;
}): BenchmarkRunnerOutput {
  benchmarkRunnerNameSchema.parse(options.runnerName);
  const inputResult = benchmarkCaseInputSchema.safeParse(options.input);

  if (!inputResult.success) {
    return buildFailedOutput({
      runnerName: options.runnerName,
      runId: options.runId,
      identity: identityFromUnknownInput(options.input),
      message: truncateFailureMessage(`Benchmark case input failed validation: ${inputResult.error.issues
        .map((issue) => issue.message)
        .join("; ")}`)
    });
  }

  const input = inputResult.data;

  try {
    const context = buildBaselineContext(input);
    const rawOutput = options.renderCompletedOutput(context);
    const timing = deterministicTiming(options.runnerName, input, "completed");

    return benchmarkRunnerOutputSchema.parse({
      schemaVersion: "trace.benchmark-runner-output.v1",
      runnerName: options.runnerName,
      runId: options.runId,
      caseId: input.caseId,
      partition: input.partition,
      status: "completed",
      timing,
      rawOutput: {
        markdown: rawOutput.markdown,
        json: rawOutput.json
      },
      normalized: rawOutput.normalized,
      failures: []
    });
  } catch (error) {
    return buildFailedOutput({
      runnerName: options.runnerName,
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

interface BaselineRawOutput {
  readonly markdown: string;
  readonly json: BaselineRawJson;
  readonly normalized: BenchmarkNormalizedRunnerOutput;
}

interface BaselineRawJson {
  readonly schemaVersion: "trace.baseline-runner-output.v1";
  readonly runnerName: BenchmarkBaselineRunnerName;
  readonly baselineKind: string;
  readonly inputFingerprint: string;
  readonly case: BaselineCaseMetadata;
  readonly sourcePolicy: BenchmarkCaseInput["sourcePolicy"];
  readonly authorityBoundary: BenchmarkCaseInput["authorityBoundary"];
  readonly evidence: EvidenceSummary[];
  readonly output: Record<string, unknown>;
  readonly omittedTraceLogic: readonly string[];
}

interface BaselineCaseMetadata {
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

function buildBaselineContext(input: BenchmarkCaseInput): BaselineContext {
  if (input.evidenceLedger.evidence.length === 0) {
    throw new BaselineRunnerError(
      "The benchmark input has no cutoff-visible evidence records for baseline synthesis."
    );
  }

  const claims = buildClaims(input.evidenceLedger.evidence);

  if (claims.length === 0) {
    throw new BaselineRunnerError(
      "The benchmark input has no observed facts for baseline synthesis."
    );
  }

  return {
    input,
    inputFingerprint: shortHash(stableStringify(input)),
    claims,
    evidenceSummaries: input.evidenceLedger.evidence.map(summarizeEvidence)
  };
}

function renderBaselineAOutput(context: BaselineContext): BaselineRawOutput {
  const normalized = {
    claims: context.claims,
    route: {
      status: "omitted"
    },
    abstentions: [],
    valuations: []
  } satisfies BenchmarkNormalizedRunnerOutput;
  const json = baseRawJson(context, "baseline-a", "general-narrative-synthesis", {
    narrative: narrativeSentences(context),
    limitations: baselineLimitations(context.input),
    warnings: context.input.evidenceLedger.warnings.map((warning) => warning.message),
    failedNotes: context.input.evidenceLedger.failedNotes.map((note) => note.note),
    excludedRecords: context.input.evidenceLedger.excludedRecords.map((record) => record.message)
  });

  return {
    markdown: renderBaselineAMarkdown(context),
    json,
    normalized
  };
}

function renderBaselineBOutput(context: BaselineContext): BaselineRawOutput {
  const normalized = {
    claims: context.claims,
    route: {
      status: "omitted"
    },
    abstentions: [],
    valuations: omittedValuationFields()
  } satisfies BenchmarkNormalizedRunnerOutput;
  const json = baseRawJson(context, "baseline-b", "fixed-template-report", {
    template: {
      case: caseMetadata(context.input),
      evidenceInventory: context.evidenceSummaries,
      claimRegister: context.claims,
      limitations: baselineLimitations(context.input)
    }
  });

  return {
    markdown: renderBaselineBMarkdown(context),
    json,
    normalized
  };
}

function baseRawJson(
  context: BaselineContext,
  runnerName: BenchmarkBaselineRunnerName,
  baselineKind: string,
  output: Record<string, unknown>
): BaselineRawJson {
  return {
    schemaVersion: "trace.baseline-runner-output.v1",
    runnerName,
    baselineKind,
    inputFingerprint: context.inputFingerprint,
    case: caseMetadata(context.input),
    sourcePolicy: context.input.sourcePolicy,
    authorityBoundary: context.input.authorityBoundary,
    evidence: context.evidenceSummaries,
    output,
    omittedTraceLogic: [
      "route-selection",
      "sufficiency-gating",
      "valuation-engine",
      "adversarial-review"
    ]
  };
}

function renderBaselineAMarkdown(context: BaselineContext): string {
  return [
    `# Baseline A Narrative Synthesis: ${context.input.companyLegalName}`,
    "",
    `Case: ${context.input.caseId}`,
    `Cutoff: ${context.input.cutoffDate}`,
    `Input fingerprint: ${context.inputFingerprint}`,
    "",
    "## Narrative",
    ...narrativeSentences(context).map((sentence) => `- ${sentence}`),
    "",
    "## Evidence Notes",
    ...context.evidenceSummaries.flatMap((record) => [
      `- ${record.sourceTitle} [${record.evidenceId}]`,
      ...record.observedFacts.map((fact) => `  - ${fact.statement}${formatFactDetails(fact)}`)
    ]),
    "",
    "## Limitations",
    ...baselineLimitations(context.input).map((limitation) => `- ${limitation}`)
  ].join("\n").concat("\n");
}

function renderBaselineBMarkdown(context: BaselineContext): string {
  return [
    `# Baseline B Fixed Template: ${context.input.companyLegalName}`,
    "",
    "## Case",
    "| Field | Value |",
    "| --- | --- |",
    `| Case ID | ${escapeTableCell(context.input.caseId)} |`,
    `| Partition | ${escapeTableCell(context.input.partition)} |`,
    `| Measurement date | ${escapeTableCell(context.input.measurementDate)} |`,
    `| Cutoff date | ${escapeTableCell(context.input.cutoffDate)} |`,
    `| Data tier | ${escapeTableCell(context.input.dataTier)} |`,
    "",
    "## Evidence Inventory",
    "| Evidence ID | Source | Class | Date |",
    "| --- | --- | --- | --- |",
    ...context.evidenceSummaries.map((record) =>
      [
        `| ${escapeTableCell(record.evidenceId)}`,
        escapeTableCell(record.sourceTitle),
        escapeTableCell(record.sourceClass),
        `${escapeTableCell(record.publishedDate ?? "undated")} |`
      ].join(" | ")
    ),
    "",
    "## Claim Register",
    "| Claim ID | Statement | Citation |",
    "| --- | --- | --- |",
    ...context.claims.map((claim) =>
      [
        `| ${escapeTableCell(claim.id)}`,
        escapeTableCell(claim.statement),
        `${escapeTableCell(formatClaimCitations(claim))} |`
      ].join(" | ")
    ),
    "",
    "## Valuation Fields",
    ...valuationFields.map((field) => `- ${field}: omitted`),
    "",
    "## Limitations",
    ...baselineLimitations(context.input).map((limitation) => `- ${limitation}`)
  ].join("\n").concat("\n");
}

function buildClaims(evidence: readonly EvidenceRecord[]): BenchmarkEmittedClaim[] {
  return evidence
    .flatMap((record) =>
      [...record.observedFacts]
        .sort(compareObservedFacts)
        .map((fact) => buildClaim(record, fact))
    )
    .sort(compareClaims);
}

function buildClaim(record: EvidenceRecord, fact: ObservedFact): BenchmarkEmittedClaim {
  return {
    id: `claim-${shortHash(`${record.id}\n${fact.id}\n${fact.statement}`)}`,
    kind: "observable",
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
  };
}

function summarizeEvidence(record: EvidenceRecord): EvidenceSummary {
  return {
    evidenceId: record.id,
    sourceTitle: record.sourceTitle,
    sourceUrl: record.sourceUrl,
    sourceClass: record.sourceClass,
    epistemicClass: record.epistemicClass,
    retrievedDate: record.retrievedDate,
    ...(record.publishedDate !== undefined ? { publishedDate: record.publishedDate } : {}),
    ...(record.effectiveDate !== undefined ? { effectiveDate: record.effectiveDate } : {}),
    ...(record.locator !== undefined ? { locator: record.locator } : {}),
    shortExcerpt: record.shortExcerpt,
    observedFacts: [...record.observedFacts].sort(compareObservedFacts).map((fact) => ({
      factId: fact.id,
      statement: fact.statement,
      ...(fact.value !== undefined ? { value: fact.value } : {}),
      ...(fact.unit !== undefined ? { unit: fact.unit } : {}),
      ...(fact.period !== undefined ? { period: fact.period } : {})
    }))
  };
}

function narrativeSentences(context: BaselineContext): string[] {
  const sourceCount = context.evidenceSummaries.length;
  const claimCount = context.claims.length;
  const sourceClasses = uniqueSorted(
    context.evidenceSummaries.map((record) => record.sourceClass)
  );
  const firstClaims = context.claims.slice(0, 5).map((claim) => claim.statement);

  return [
    `${context.input.companyLegalName} is summarized from ${String(sourceCount)} cutoff-visible public evidence records dated on or before ${context.input.cutoffDate}.`,
    `The normalized claim list contains ${String(claimCount)} cited observations from source classes: ${sourceClasses.join(", ")}.`,
    ...firstClaims
  ];
}

function baselineLimitations(input: BenchmarkCaseInput): string[] {
  return [
    "This baseline performs deterministic evidence summarization only.",
    "It does not run TRACE route selection, sufficiency gating, valuation logic, or adversarial review.",
    "It does not claim official contest compliance, benchmark superiority, investment advice, or appraisal status.",
    `Source use follows the committed policy: ${input.sourcePolicy.rawDocumentPolicy}`
  ];
}

function omittedValuationFields(): BenchmarkEmittedValuation[] {
  return valuationFields.map((field) => ({
    field,
    status: "omitted",
    evidenceIds: []
  }));
}

function caseMetadata(input: BenchmarkCaseInput): BaselineCaseMetadata {
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

function buildFailedOutput(options: {
  readonly runnerName: BenchmarkBaselineRunnerName;
  readonly runId: string;
  readonly identity: FailureIdentity;
  readonly message: string;
  readonly input?: BenchmarkCaseInput;
}): BenchmarkRunnerOutput {
  const timing = options.input === undefined
    ? deterministicFailureTiming(options.runnerName, options.identity)
    : deterministicTiming(options.runnerName, options.input, "failed");
  const failure = failureRecord({
    runnerName: options.runnerName,
    runId: options.runId,
    identity: options.identity,
    message: options.message,
    ...(timing.completedAt !== undefined ? { occurredAt: timing.completedAt } : {})
  });

  return benchmarkRunnerOutputSchema.parse({
    schemaVersion: "trace.benchmark-runner-output.v1",
    runnerName: options.runnerName,
    runId: options.runId,
    caseId: options.identity.caseId,
    partition: options.identity.partition,
    status: "failed",
    timing,
    rawOutput: {
      markdown: renderFailureMarkdown(options.identity, options.message),
      json: {
        schemaVersion: "trace.baseline-runner-output.v1",
        runnerName: options.runnerName,
        baselineKind: "failure-record",
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
  readonly runnerName: BenchmarkBaselineRunnerName;
  readonly runId: string;
  readonly identity: FailureIdentity;
  readonly message: string;
  readonly occurredAt?: string;
}): BenchmarkFailureRecord {
  return {
    schemaVersion: "trace.benchmark-failure.v1",
    failureId: `${options.runnerName}-runner-${shortHash(options.message)}`,
    stage: "runner",
    severity: "fatal",
    message: options.message,
    retryable: false,
    runId: options.runId,
    runnerName: options.runnerName,
    caseId: options.identity.caseId,
    partition: options.identity.partition,
    ...(options.occurredAt !== undefined ? { occurredAt: options.occurredAt } : {})
  };
}

function renderFailureMarkdown(identity: FailureIdentity, message: string): string {
  return [
    `# Baseline Failure: ${identity.companyLegalName}`,
    "",
    `Case: ${identity.caseId}`,
    `Partition: ${identity.partition}`,
    "",
    "## Failure",
    message
  ].join("\n").concat("\n");
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

function deterministicTiming(
  runnerName: BenchmarkBaselineRunnerName,
  input: BenchmarkCaseInput,
  status: "completed" | "failed"
): BenchmarkTimingMetadata {
  const evidenceCount = input.evidenceLedger.evidence.length;
  const factCount = input.evidenceLedger.evidence.reduce(
    (total, record) => total + record.observedFacts.length,
    0
  );
  const warningCount = input.evidenceLedger.warnings.length + input.evidenceLedger.failedNotes.length;
  const runnerOffset = runnerName === "baseline-a" ? 0 : 13;
  const statusOffset = status === "completed" ? 0 : 29;
  const durationMs = 100 + evidenceCount * 17 + factCount * 5 + warningCount * 3 + runnerOffset + statusOffset;

  return timingFromDuration(durationMs);
}

function deterministicFailureTiming(
  runnerName: BenchmarkBaselineRunnerName,
  identity: FailureIdentity
): BenchmarkTimingMetadata {
  const durationMs = 100 + Number.parseInt(shortHash(`${runnerName}\n${identity.caseId}`).slice(0, 4), 16) % 50;

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

function formatFactDetails(fact: FactSummary): string {
  const details = [
    fact.value === undefined ? undefined : `value=${formatFactValue(fact.value)}`,
    fact.unit === undefined ? undefined : `unit=${fact.unit}`,
    fact.period === undefined ? undefined : `period=${formatPeriod(fact.period)}`
  ].filter((detail): detail is string => detail !== undefined);

  return details.length === 0 ? "" : ` (${details.join("; ")})`;
}

function formatFactValue(value: FactValue): string {
  return Array.isArray(value) ? value.map(String).join(", ") : String(value);
}

function formatPeriod(period: FactPeriod): string {
  return [
    period.instantDate === undefined ? undefined : `instant ${period.instantDate}`,
    period.startDate === undefined ? undefined : `start ${period.startDate}`,
    period.endDate === undefined ? undefined : `end ${period.endDate}`
  ].filter((part): part is string => part !== undefined).join(", ");
}

function formatClaimCitations(claim: BenchmarkEmittedClaim): string {
  return claim.citations
    .map((citation) =>
      citation.factId === undefined ? citation.evidenceId : `${citation.evidenceId}:${citation.factId}`
    )
    .join(", ");
}

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown baseline runner failure";
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
  return compareTuple(
    [left.statement, left.citations[0]?.evidenceId ?? "", left.citations[0]?.factId ?? "", left.id],
    [right.statement, right.citations[0]?.evidenceId ?? "", right.citations[0]?.factId ?? "", right.id]
  );
}

function compareObservedFacts(left: ObservedFact, right: ObservedFact): number {
  return compareTuple([left.statement, left.id], [right.statement, right.id]);
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

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

class BaselineRunnerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BaselineRunnerError";
  }
}
