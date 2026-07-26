import type { AnalysisRoute } from "../domain/schemas.js";
import {
  benchmarkAggregateScoreOutputSchema
} from "./contracts.js";
import type {
  BenchmarkAggregateScoreOutput,
  BenchmarkCaseScoreOutput,
  BenchmarkCompiledCase,
  BenchmarkFailureRecord,
  BenchmarkMetricScore,
  BenchmarkRunnerName,
  BenchmarkRunnerOutput,
  BenchmarkScoredOrAllPartition
} from "./contracts.js";
import type { BenchmarkDataTier } from "./manifest.js";

export interface BenchmarkAggregateCaseResult {
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerOutput: BenchmarkRunnerOutput;
  readonly caseScore: BenchmarkCaseScoreOutput;
}

export interface BenchmarkAggregateScoreOptions {
  readonly runId: string;
  readonly partition: BenchmarkScoredOrAllPartition;
  readonly caseResults: readonly BenchmarkAggregateCaseResult[];
  readonly generatedAt?: string;
}

type AggregateGroup = BenchmarkAggregateScoreOutput["groups"][number];
type AggregateGroupKind = AggregateGroup["groupKind"];

interface AggregateGroupSpec {
  readonly groupId: string;
  readonly groupKind: AggregateGroupKind;
  readonly runnerName?: BenchmarkRunnerName;
  readonly partition?: BenchmarkScoredOrAllPartition;
  readonly dataTier?: BenchmarkDataTier;
  readonly sectorRoute?: AnalysisRoute;
  readonly records: readonly BenchmarkAggregateCaseResult[];
}

const aggregateMetricIds = [
  "evidence-supported-claim-precision",
  "citation-validity",
  "source-quality",
  "route-accuracy",
  "abstention-behavior",
  "valuation-separation",
  "historical-valuation-error",
  "completeness",
  "reproducibility",
  "completion-status",
  "duration",
  "failure-records"
] as const;

const groupKindOrder: Record<AggregateGroupKind, number> = {
  overall: 0,
  runner: 1,
  partition: 2,
  "data-tier": 3,
  "sector-route": 4
};

export function aggregateBenchmarkScores(
  options: BenchmarkAggregateScoreOptions
): BenchmarkAggregateScoreOutput {
  const records = [...options.caseResults].sort(compareAggregateCaseResults);
  const groups = aggregateGroupSpecs(records, options.partition)
    .map(buildAggregateGroup)
    .sort(compareAggregateGroups);
  const failures = records
    .flatMap((record) => record.caseScore.failures)
    .sort(compareFailures);

  return benchmarkAggregateScoreOutputSchema.parse({
    schemaVersion: "trace.benchmark-aggregate-score.v1",
    runId: options.runId,
    partition: options.partition,
    ...(options.generatedAt !== undefined ? { generatedAt: options.generatedAt } : {}),
    groups,
    failures
  });
}

export function renderBenchmarkAggregateCsv(output: BenchmarkAggregateScoreOutput): string {
  const rows = output.groups.flatMap((group) =>
    group.metrics.map((metric) => [
      group.groupId,
      group.groupKind,
      group.runnerName ?? "",
      group.partition ?? "",
      group.dataTier ?? "",
      group.sectorRoute ?? "",
      String(group.caseCount),
      String(group.scoredCaseCount),
      String(group.failedCaseCount),
      metric.metricId,
      metric.status,
      metric.value === undefined ? "" : formatNumber(metric.value),
      metric.numerator === undefined ? "" : formatNumber(metric.numerator),
      metric.denominator === undefined ? "" : formatNumber(metric.denominator)
    ])
  );
  const header = [
    "group_id",
    "group_kind",
    "runner_name",
    "partition",
    "data_tier",
    "sector_route",
    "case_count",
    "scored_case_count",
    "failed_case_count",
    "metric_id",
    "status",
    "value",
    "numerator",
    "denominator"
  ];

  return [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n")
    .concat("\n");
}

export function renderBenchmarkAggregateMarkdown(
  output: BenchmarkAggregateScoreOutput
): string {
  const rows = output.groups.flatMap((group) =>
    group.metrics.map((metric) => [
      group.groupId,
      group.groupKind,
      group.runnerName ?? "",
      group.partition ?? "",
      group.dataTier ?? "",
      group.sectorRoute ?? "",
      String(group.caseCount),
      String(group.failedCaseCount),
      metric.metricId,
      metric.status,
      metric.value === undefined ? "" : formatNumber(metric.value)
    ])
  );
  const header = [
    "Group",
    "Kind",
    "Runner",
    "Partition",
    "Data Tier",
    "Sector",
    "Cases",
    "Failed",
    "Metric",
    "Status",
    "Value"
  ];

  return [
    `# Benchmark Aggregate Score: ${output.runId}`,
    "",
    `Partition: ${output.partition}`,
    "",
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escapeMarkdownCell).join(" | ")} |`)
  ].join("\n").concat("\n");
}

function aggregateGroupSpecs(
  records: readonly BenchmarkAggregateCaseResult[],
  aggregatePartition: BenchmarkScoredOrAllPartition
): AggregateGroupSpec[] {
  const runners = uniqueSorted(records.map((record) => record.runnerOutput.runnerName));
  const partitions = uniqueSorted(
    records.map((record) => record.caseScore.partition)
  );
  const dataTiers = uniqueSorted(records.map((record) => record.compiledCase.runnerInput.dataTier));
  const sectorRoutes = uniqueSorted(records.map(sectorRouteForRecord));
  const specs: AggregateGroupSpec[] = [
    {
      groupId: "overall",
      groupKind: "overall",
      partition: aggregatePartition,
      records
    }
  ];

  for (const partition of partitions) {
    const partitionRecords = records.filter((record) => record.caseScore.partition === partition);

    if (partitionRecords.length === 0) {
      continue;
    }

    specs.push({
      groupId: `partition:${partition}`,
      groupKind: "partition",
      partition,
      records: partitionRecords
    });
  }

  for (const dataTier of dataTiers) {
    const dataTierRecords = records.filter(
      (record) => record.compiledCase.runnerInput.dataTier === dataTier
    );

    if (dataTierRecords.length === 0) {
      continue;
    }

    specs.push({
      groupId: `data-tier:${dataTier}`,
      groupKind: "data-tier",
      dataTier,
      partition: aggregatePartition,
      records: dataTierRecords
    });
  }

  for (const sectorRoute of sectorRoutes) {
    const sectorRecords = records.filter(
      (record) => sectorRouteForRecord(record) === sectorRoute
    );

    if (sectorRecords.length === 0) {
      continue;
    }

    specs.push({
      groupId: `sector-route:${sectorRoute}`,
      groupKind: "sector-route",
      sectorRoute,
      partition: aggregatePartition,
      records: sectorRecords
    });
  }

  for (const runnerName of runners) {
    const runnerRecords = records.filter((record) => record.runnerOutput.runnerName === runnerName);

    specs.push({
      groupId: `runner:${runnerName}`,
      groupKind: "runner",
      runnerName,
      partition: aggregatePartition,
      records: runnerRecords
    });

    for (const partition of partitions) {
      const partitionRecords = runnerRecords.filter(
        (record) => record.caseScore.partition === partition
      );

      if (partitionRecords.length === 0) {
        continue;
      }

      specs.push({
        groupId: `partition:${partition}:runner:${runnerName}`,
        groupKind: "partition",
        runnerName,
        partition,
        records: partitionRecords
      });
    }

    for (const dataTier of dataTiers) {
      const dataTierRecords = runnerRecords.filter(
        (record) => record.compiledCase.runnerInput.dataTier === dataTier
      );

      if (dataTierRecords.length === 0) {
        continue;
      }

      specs.push({
        groupId: `data-tier:${dataTier}:runner:${runnerName}`,
        groupKind: "data-tier",
        runnerName,
        dataTier,
        partition: aggregatePartition,
        records: dataTierRecords
      });
    }

    for (const sectorRoute of sectorRoutes) {
      const sectorRecords = runnerRecords.filter(
        (record) => sectorRouteForRecord(record) === sectorRoute
      );

      if (sectorRecords.length === 0) {
        continue;
      }

      specs.push({
        groupId: `sector-route:${sectorRoute}:runner:${runnerName}`,
        groupKind: "sector-route",
        runnerName,
        sectorRoute,
        partition: aggregatePartition,
        records: sectorRecords
      });
    }
  }

  return specs.sort(compareAggregateGroupSpecs);
}

function buildAggregateGroup(spec: AggregateGroupSpec): AggregateGroup {
  const failedCaseCount = spec.records.filter(
    (record) => record.caseScore.status === "failed" || record.runnerOutput.status === "failed"
  ).length;

  return {
    groupId: spec.groupId,
    groupKind: spec.groupKind,
    ...(spec.runnerName !== undefined ? { runnerName: spec.runnerName } : {}),
    ...(spec.partition !== undefined ? { partition: spec.partition } : {}),
    ...(spec.dataTier !== undefined ? { dataTier: spec.dataTier } : {}),
    ...(spec.sectorRoute !== undefined ? { sectorRoute: spec.sectorRoute } : {}),
    caseCount: spec.records.length,
    scoredCaseCount: spec.records.filter((record) => record.caseScore.status === "scored").length,
    failedCaseCount,
    metrics: aggregateGroupMetrics(spec.records)
  };
}

function aggregateGroupMetrics(
  records: readonly BenchmarkAggregateCaseResult[]
): BenchmarkMetricScore[] {
  return aggregateMetricIds.map((metricId) =>
    metricId === "reproducibility"
      ? aggregateReproducibilityMetric(records)
      : aggregateMetric(records, metricId)
  );
}

function aggregateMetric(
  records: readonly BenchmarkAggregateCaseResult[],
  metricId: string
): BenchmarkMetricScore {
  const metrics = records
    .map((record) => record.caseScore.metrics.find((metric) => metric.metricId === metricId))
    .filter((metric): metric is BenchmarkMetricScore => metric !== undefined);
  const scoredMetrics = metrics.filter(
    (metric): metric is BenchmarkMetricScore & { readonly value: number } =>
      metric.status === "scored" && metric.value !== undefined
  );
  const notes = uniqueSorted(metrics.flatMap((metric) => metric.notes));

  if (scoredMetrics.length === 0) {
    return {
      metricId,
      status: metrics.some((metric) => metric.status === "failed") ? "failed" : "skipped",
      numerator: 0,
      denominator: 0,
      notes: notes.length === 0 ? [`No scored ${metricId} metrics were available.`] : notes
    };
  }

  const denominator = scoredMetrics.reduce(
    (total, metric) => total + (metric.denominator ?? 0),
    0
  );

  if (denominator > 0) {
    const numerator = scoredMetrics.reduce(
      (total, metric) => total + (metric.numerator ?? metric.value),
      0
    );

    return {
      metricId,
      status: "scored",
      value: roundMetricNumber(numerator / denominator),
      numerator: roundMetricNumber(numerator),
      denominator: roundMetricNumber(denominator),
      notes
    };
  }

  const numerator = scoredMetrics.reduce((total, metric) => total + metric.value, 0);

  return {
    metricId,
    status: "scored",
    value: roundMetricNumber(numerator / scoredMetrics.length),
    numerator: roundMetricNumber(numerator),
    denominator: scoredMetrics.length,
    notes
  };
}

function aggregateReproducibilityMetric(
  records: readonly BenchmarkAggregateCaseResult[]
): BenchmarkMetricScore {
  const repeatBuckets = new Map<string, BenchmarkAggregateCaseResult[]>();

  for (const record of records) {
    const key = `${record.runnerOutput.runnerName}\n${record.caseScore.caseId}`;
    const existing = repeatBuckets.get(key) ?? [];

    repeatBuckets.set(key, [...existing, record]);
  }

  const repeatedRuns = Array.from(repeatBuckets.values()).filter((bucket) => bucket.length > 1);

  if (repeatedRuns.length === 0) {
    return {
      metricId: "reproducibility",
      status: "skipped",
      numerator: 0,
      denominator: 0,
      notes: ["No repeated runner/case outputs were available for reproducibility scoring."]
    };
  }

  const stableRuns = repeatedRuns.filter((bucket) => {
    const fingerprints = new Set(bucket.map((record) => reproducibilityFingerprint(record)));

    return fingerprints.size === 1;
  });
  const unstableNotes = repeatedRuns
    .filter((bucket) => new Set(bucket.map((record) => reproducibilityFingerprint(record))).size > 1)
    .map((bucket) => {
      const firstRecord = bucket[0];

      return firstRecord === undefined
        ? "Unknown repeated run had unstable fingerprints."
        : `${firstRecord.runnerOutput.runnerName}/${firstRecord.caseScore.caseId} differed across repeated runs.`;
    });

  return {
    metricId: "reproducibility",
    status: "scored",
    value: roundMetricNumber(stableRuns.length / repeatedRuns.length),
    numerator: stableRuns.length,
    denominator: repeatedRuns.length,
    notes: unstableNotes.sort(compareStrings)
  };
}

function reproducibilityFingerprint(record: BenchmarkAggregateCaseResult): string {
  return stableStringify({
    status: record.runnerOutput.status,
    normalized: record.runnerOutput.normalized,
    failures: record.runnerOutput.failures.map((failure) => ({
      stage: failure.stage,
      severity: failure.severity,
      message: failure.message,
      retryable: failure.retryable
    }))
  });
}

function sectorRouteForRecord(record: BenchmarkAggregateCaseResult): AnalysisRoute {
  return record.compiledCase.scorerReference.manifestCase.sectorRoute;
}

function compareAggregateCaseResults(
  left: BenchmarkAggregateCaseResult,
  right: BenchmarkAggregateCaseResult
): number {
  return compareTuple(
    [left.runnerOutput.runnerName, left.caseScore.partition, left.caseScore.caseId, left.caseScore.runId],
    [right.runnerOutput.runnerName, right.caseScore.partition, right.caseScore.caseId, right.caseScore.runId]
  );
}

function compareAggregateGroupSpecs(
  left: AggregateGroupSpec,
  right: AggregateGroupSpec
): number {
  return compareTuple(
    [String(groupKindOrder[left.groupKind]), left.groupId],
    [String(groupKindOrder[right.groupKind]), right.groupId]
  );
}

function compareAggregateGroups(left: AggregateGroup, right: AggregateGroup): number {
  return compareTuple(
    [String(groupKindOrder[left.groupKind]), left.groupId],
    [String(groupKindOrder[right.groupKind]), right.groupId]
  );
}

function compareFailures(left: BenchmarkFailureRecord, right: BenchmarkFailureRecord): number {
  return compareTuple(
    [left.runnerName ?? "", left.caseId ?? "", left.stage, left.severity, left.failureId],
    [right.runnerName ?? "", right.caseId ?? "", right.stage, right.severity, right.failureId]
  );
}

function escapeCsvCell(value: string): string {
  return /[",\n]/u.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
}

function escapeMarkdownCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(6).replace(/0+$/u, "").replace(/\.$/u, "");
}

function roundMetricNumber(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return Array.from(new Set(values)).sort(compareStrings);
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
