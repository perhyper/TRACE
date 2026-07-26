import { createHash } from "node:crypto";

import {
  executionLogSchema,
  reportSchema
} from "../domain/schemas.js";
import type {
  EvidenceRecord,
  ExecutionLog,
  MissingInformation,
  MoneyAmount,
  MoneyRange,
  ObservedFact,
  Report,
  ReportSections,
  Review,
  RouteDecision,
  RunMetadata,
  Sufficiency,
  ValuationConclusion,
  ValuationOutput
} from "../domain/schemas.js";
import type { EvidenceLedger } from "../providers/evidence-bundle.js";

export interface ReportRuntimeResult {
  readonly ledger: EvidenceLedger;
  readonly sufficiency: Sufficiency;
  readonly route: RouteDecision;
  readonly valuation: ValuationOutput;
  readonly review: Review;
}

export interface ReportCompositionInput extends ReportRuntimeResult {
  readonly run: RunMetadata;
}

export interface ReportOutputPaths {
  readonly jsonReport: string;
  readonly markdownReport: string;
  readonly executionLog: string;
}

export interface ExecutionLogInput extends ReportRuntimeResult {
  readonly run: RunMetadata;
  readonly inputPath: string;
  readonly outputPaths: ReportOutputPaths;
}

const authorityBoundaryLimitation =
  "TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.";

export function composeReport(input: ReportCompositionInput): Report {
  const report = {
    schemaVersion: "trace.report.v1",
    company: input.ledger.target,
    measurementDate: input.ledger.measurementDate,
    decisionMode: input.ledger.decisionMode,
    evidence: [...input.ledger.evidence].sort(compareEvidenceRecords),
    sufficiency: input.sufficiency,
    route: input.route,
    valuation: input.valuation,
    review: input.review,
    sections: buildReportSections(input),
    run: input.run
  } satisfies Report;

  return reportSchema.parse(report);
}

export function composeExecutionLog(input: ExecutionLogInput): ExecutionLog {
  return executionLogSchema.parse({
    schemaVersion: "trace.execution-log.v1",
    runId: input.run.runId,
    runtimeVersion: input.run.runtimeVersion,
    measurementDate: input.ledger.measurementDate,
    inputPath: input.inputPath,
    outputPaths: input.outputPaths,
    startedAt: input.run.startedAt,
    completedAt: input.run.completedAt,
    durationMs: input.run.durationMs,
    validationWarnings: validationWarnings(input.ledger),
    reviewerFindings: input.review.findings,
    deterministicIdentifiers: {
      evidenceLedgerHash: hashStable(input.ledger),
      runtimeResultHash: runtimeResultHash(input, input.run.runtimeVersion)
    }
  });
}

export function deterministicRunId(
  input: ReportRuntimeResult,
  runtimeVersion: string
): string {
  return `run-${runtimeResultHash(input, runtimeVersion).slice(0, 16)}`;
}

export function serializeReportJson(report: Report): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function serializeExecutionLog(log: ExecutionLog): string {
  return `${JSON.stringify(log, null, 2)}\n`;
}

export function renderMarkdownReport(report: Report): string {
  return [
    `# TRACE Report: ${report.company.legalName}`,
    "",
    "## Summary",
    ...renderSummary(report),
    "",
    "## Evidence Ledger",
    ...renderEvidenceTable(report.evidence),
    "",
    "## Material Facts",
    ...renderList(report.sections.facts),
    "",
    "## Inferences",
    ...renderList(report.sections.inferences),
    "",
    "## Valuation",
    ...renderValuation(report.valuation),
    "",
    "## Limitations",
    ...renderList(report.sections.limitations),
    "",
    "## Conflicts",
    ...renderList(report.sections.conflicts),
    "",
    "## Counterarguments",
    ...renderList(report.sections.counterarguments),
    "",
    "## Missing Information",
    ...renderMissingInformation(report.sections.missingInformation),
    "",
    "## Next Diligence Questions",
    ...renderList(report.sections.nextDiligenceQuestions),
    "",
    "## Reviewer Findings",
    ...renderReviewerFindings(report.review),
    "",
    "## Run Metadata",
    ...renderRunMetadata(report.run)
  ].join("\n").concat("\n");
}

function buildReportSections(input: ReportCompositionInput): ReportSections {
  const missingInformation = collectMissingInformation(input);

  return {
    facts: buildFactSections(input.ledger.evidence),
    inferences: buildInferenceSections(input),
    conflicts: buildConflictSections(input.ledger),
    limitations: buildLimitationSections(input),
    counterarguments: buildCounterarguments(input),
    missingInformation,
    nextDiligenceQuestions: buildNextDiligenceQuestions(missingInformation)
  };
}

function buildFactSections(evidence: readonly EvidenceRecord[]): string[] {
  return evidence
    .flatMap((record) =>
      [...record.observedFacts]
        .sort(compareObservedFacts)
        .map((fact) => sectionText(`${fact.statement}${formatFactDetails(fact)} [${record.id}]`))
    )
    .sort(compareStrings);
}

function buildInferenceSections(input: ReportCompositionInput): string[] {
  const inferences = [
    sectionText(
      `Sufficiency is ${input.sufficiency.status} with score ${formatScore(input.sufficiency.score)}: ${input.sufficiency.rationale}`
    ),
    ...routeInferences(input.route),
    ...valuationInferences(input.valuation)
  ];

  return uniqueSorted(inferences);
}

function routeInferences(route: RouteDecision): string[] {
  if (route.status === "selected") {
    return route.selectedReasons.map((reason) =>
      sectionText(
        `Selected route ${route.selectedRoute}: ${reason.summary} [${reason.evidenceIds.join(", ")}]`
      )
    );
  }

  return [
    sectionText(
      `Route abstained: ${route.abstention.explanation}${formatEvidenceIds(route.abstention.evidenceIds)}`
    )
  ];
}

function valuationInferences(valuation: ValuationOutput): string[] {
  return valuationConclusions(valuation).map((conclusion) => {
    if (conclusion.status === "concluded") {
      return sectionText(
        `${labelForValuationField(conclusion.field)} concluded at ${formatMoneyRange(conclusion.range)} using ${conclusion.basis.method} [${conclusion.basis.evidenceIds.join(", ")}]`
      );
    }

    return sectionText(
      `${labelForValuationField(conclusion.field)} abstained: ${conclusion.abstention.explanation}${formatEvidenceIds(conclusion.abstention.evidenceIds)}`
    );
  });
}

function buildConflictSections(ledger: EvidenceLedger): string[] {
  return ledger.warnings
    .filter((warning) => warning.code === "duplicate-originating-source")
    .map((warning) =>
      sectionText(
        `Duplicate originating-source records were merged and not counted as independent support: ${warning.recordIds.join(", ")}.`
      )
    )
    .sort(compareStrings);
}

function buildLimitationSections(input: ReportCompositionInput): string[] {
  return uniqueSorted([
    authorityBoundaryLimitation,
    ...input.ledger.warnings.map((warning) => warning.message),
    ...input.ledger.excludedRecords.map((record) => record.message),
    ...input.ledger.failedNotes.map((note) => `${note.stage} note ${note.id}: ${note.note}`),
    ...valuationConclusions(input.valuation).flatMap((conclusion) =>
      conclusion.status === "concluded"
        ? conclusion.basis.limitations
        : [conclusion.abstention.explanation]
    )
  ].map(sectionText));
}

function buildCounterarguments(input: ReportCompositionInput): string[] {
  const counterarguments: string[] = [];

  if (input.valuation.headlineValuation.status === "concluded") {
    counterarguments.push(
      sectionText(
        `The headline transaction reference may not transfer to enterprise value, total equity value, or any specific security without capital-structure and instrument-rights evidence [${input.valuation.headlineValuation.basis.evidenceIds.join(", ")}].`
      )
    );
  }

  if (input.route.status === "selected" && input.route.rejectedRoutes.length > 0) {
    counterarguments.push(
      sectionText(
        `Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: ${input.route.rejectedRoutes.map((candidate) => candidate.route).join(", ")}.`
      )
    );
  }

  return uniqueSorted(counterarguments);
}

function collectMissingInformation(input: ReportCompositionInput): MissingInformation[] {
  return uniqueMissingInformation([
    ...input.sufficiency.missingInformation,
    ...(input.route.status === "abstained" ? input.route.abstention.missingInformation : []),
    ...valuationConclusions(input.valuation).flatMap((conclusion) =>
      conclusion.status === "abstained" ? conclusion.abstention.missingInformation : []
    ),
    ...input.review.findings.flatMap((finding) => finding.missingInformation)
  ]);
}

function buildNextDiligenceQuestions(
  missingInformation: readonly MissingInformation[]
): string[] {
  return missingInformation
    .map((missing) =>
      sectionText(
        `What evidence resolves ${missing.topic} for ${missing.requiredFor.join(", ")}?`
      )
    )
    .sort(compareStrings);
}

function renderSummary(report: Report): string[] {
  return [
    `- Company: ${report.company.legalName} (${report.company.jurisdiction}; identity ${report.company.identityConfidence})`,
    `- Measurement date: ${report.measurementDate}`,
    `- Decision mode: ${report.decisionMode}`,
    `- Sufficiency: ${report.sufficiency.status} (${formatScore(report.sufficiency.score)})`,
    `- Route: ${routeSummary(report.route)}`,
    `- Review: ${report.review.status}`,
    `- Run ID: ${report.run.runId}`
  ];
}

function renderEvidenceTable(evidence: readonly EvidenceRecord[]): string[] {
  return [
    "| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |",
    "| --- | --- | --- | --- | --- | --- |",
    ...evidence.map(
      (record) =>
        `| ${record.id} | ${record.sourceClass} | ${record.publishedDate ?? "n/a"} | ${record.retrievedDate} | ${record.sourceTitle} (${record.sourceUrl}) | ${record.shortExcerpt} |`
    )
  ];
}

function renderValuation(valuation: ValuationOutput): string[] {
  return valuationConclusions(valuation).flatMap((conclusion) => [
    `### ${labelForValuationField(conclusion.field)}`,
    ...renderValuationConclusion(conclusion),
    ""
  ]).slice(0, -1);
}

function renderValuationConclusion(conclusion: ValuationConclusion): string[] {
  if (conclusion.status === "concluded") {
    return [
      `- Status: ${conclusion.status}`,
      `- Range: ${formatMoneyRange(conclusion.range)}`,
      `- Method: ${conclusion.basis.method}`,
      `- Evidence: ${conclusion.basis.evidenceIds.join(", ")}`,
      "- Assumptions:",
      ...renderList(conclusion.basis.assumptions),
      "- Limitations:",
      ...renderList(conclusion.basis.limitations)
    ];
  }

  return [
    `- Status: ${conclusion.status}`,
    `- Reason: ${conclusion.abstention.reasonCode}`,
    `- Explanation: ${conclusion.abstention.explanation}`,
    `- Evidence: ${conclusion.abstention.evidenceIds.length > 0 ? conclusion.abstention.evidenceIds.join(", ") : "None"}`,
    "- Missing information:",
    ...renderMissingInformation(conclusion.abstention.missingInformation)
  ];
}

function renderMissingInformation(
  missingInformation: readonly MissingInformation[]
): string[] {
  if (missingInformation.length === 0) {
    return ["- None identified."];
  }

  return [
    "| ID | Topic | Required for | Consequence |",
    "| --- | --- | --- | --- |",
    ...missingInformation.map(
      (missing) =>
        `| ${missing.id} | ${missing.topic} | ${missing.requiredFor.join(", ")} | ${missing.consequence} |`
    )
  ];
}

function renderReviewerFindings(review: Review): string[] {
  return [
    `- Reviewer version: ${review.reviewerVersion}`,
    `- Status: ${review.status}`,
    "",
    "| ID | Severity | Category | Evidence | Message |",
    "| --- | --- | --- | --- | --- |",
    ...review.findings.map(
      (finding) =>
        `| ${finding.id} | ${finding.severity} | ${finding.category} | ${finding.evidenceIds.length > 0 ? finding.evidenceIds.join(", ") : "None"} | ${finding.message} |`
    )
  ];
}

function renderRunMetadata(run: RunMetadata): string[] {
  return [
    `- Run ID: ${run.runId}`,
    `- Runtime version: ${run.runtimeVersion}`,
    `- Command: ${run.command}`,
    `- Measurement date: ${run.measurementDate}`,
    `- Started at: ${run.startedAt}`,
    `- Completed at: ${run.completedAt ?? "n/a"}`,
    `- Duration ms: ${String(run.durationMs ?? 0)}`,
    `- Input path: ${run.inputPath ?? "n/a"}`,
    `- Output directory: ${run.outputDirectory ?? "n/a"}`,
    "- Warnings:",
    ...renderList(run.warnings)
  ];
}

function renderList(items: readonly string[]): string[] {
  if (items.length === 0) {
    return ["- None identified."];
  }

  return items.map((item) => `- ${item}`);
}

function formatFactDetails(fact: ObservedFact): string {
  return [
    fact.value !== undefined ? ` value=${formatFactValue(fact.value)}` : undefined,
    fact.unit !== undefined ? ` unit=${fact.unit}` : undefined,
    fact.period !== undefined ? ` period=${formatPeriod(fact.period)}` : undefined,
    ` epistemic=${fact.epistemicClass}`
  ]
    .filter((part): part is string => part !== undefined)
    .join(";");
}

function formatFactValue(value: ObservedFact["value"]): string {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).join(", ");
  }

  return String(value);
}

function formatPeriod(period: NonNullable<ObservedFact["period"]>): string {
  return [
    period.startDate !== undefined ? `start ${period.startDate}` : undefined,
    period.endDate !== undefined ? `end ${period.endDate}` : undefined,
    period.instantDate !== undefined ? `instant ${period.instantDate}` : undefined
  ]
    .filter((part): part is string => part !== undefined)
    .join(", ");
}

function formatEvidenceIds(evidenceIds: readonly string[]): string {
  return evidenceIds.length > 0 ? ` [${evidenceIds.join(", ")}]` : "";
}

function formatMoneyRange(range: MoneyRange): string {
  return `low ${formatMoneyAmount(range.low)}; base ${formatMoneyAmount(range.base)}; high ${formatMoneyAmount(range.high)}`;
}

function formatMoneyAmount(amount: MoneyAmount): string {
  return `${amount.currency} ${formatNumber(amount.amount)} ${amount.scale}`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value);
}

function formatScore(score: number): string {
  return score.toFixed(4).replace(/0+$/u, "").replace(/\.$/u, "");
}

function routeSummary(route: RouteDecision): string {
  return route.status === "selected" ? route.selectedRoute : `abstained (${route.abstention.reasonCode})`;
}

function labelForValuationField(field: ValuationConclusion["field"]): string {
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

function validationWarnings(ledger: EvidenceLedger): string[] {
  return ledger.warnings.map((warning) => warning.message).sort(compareStrings);
}

function valuationConclusions(valuation: ValuationOutput): ValuationConclusion[] {
  return [
    valuation.headlineValuation,
    valuation.enterpriseValue,
    valuation.totalEquityValue,
    valuation.securityLevelFairValue
  ];
}

function runtimeResultHash(input: ReportRuntimeResult, runtimeVersion: string): string {
  return hashStable({
    runtimeVersion,
    ledger: input.ledger,
    sufficiency: input.sufficiency,
    route: input.route,
    valuation: input.valuation,
    review: input.review
  });
}

function hashStable(value: unknown): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
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

function sectionText(value: string): string {
  const normalized = value.replace(/\s+/gu, " ").trim();

  return normalized.length <= 1_000 ? normalized : `${normalized.slice(0, 997)}...`;
}

function uniqueMissingInformation(values: readonly MissingInformation[]): MissingInformation[] {
  return Array.from(new Map(values.map((value) => [value.id, value])).values()).sort(
    compareMissingInformation
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort(compareStrings);
}

function compareEvidenceRecords(left: EvidenceRecord, right: EvidenceRecord): number {
  return compareStrings(left.id, right.id);
}

function compareObservedFacts(left: ObservedFact, right: ObservedFact): number {
  return compareStrings(left.id, right.id);
}

function compareMissingInformation(left: MissingInformation, right: MissingInformation): number {
  return compareStrings(left.id, right.id);
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
