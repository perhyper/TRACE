import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import {
  benchmarkAnnotationSchema,
  benchmarkCaseInputSchema,
  benchmarkCompiledCaseSchema,
  benchmarkRunnerNameSchema,
  benchmarkScorerInputSchema,
  loadBenchmarkAnnotationFromJsonFile
} from "./contracts.js";
import type {
  BenchmarkAnnotation,
  BenchmarkCaseInput,
  BenchmarkCompiledCase,
  BenchmarkHistoricalValuationTarget,
  BenchmarkRunnerName,
  BenchmarkRunnerOutput,
  BenchmarkScorerInput,
  BenchmarkSourceAvailability
} from "./contracts.js";
import {
  loadBenchmarkManifestFromJsonFile,
  type BenchmarkManifest,
  type BenchmarkPartition,
  type DemoBenchmarkCase,
  type ScoredBenchmarkCase
} from "./manifest.js";
import {
  normalizeEvidenceBundle,
  parseEvidenceBundleJson,
  sourceRecordEvidenceIdMap,
  type EvidenceBundle,
  type EvidenceBundleSourceRecord,
  type EvidenceLedger
} from "../providers/evidence-bundle.js";

type BenchmarkManifestCase = DemoBenchmarkCase | ScoredBenchmarkCase;

export interface BenchmarkInputCompilerOptions {
  readonly rootDir?: string;
  readonly manifestPath?: string;
  readonly partitions?: readonly BenchmarkPartition[];
  readonly includeDemo?: boolean;
}

export class BenchmarkInputCompilerError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BenchmarkInputCompilerError";
  }
}

export async function compileBenchmarkCases(
  options: BenchmarkInputCompilerOptions = {}
): Promise<BenchmarkCompiledCase[]> {
  const rootDir = options.rootDir ?? process.cwd();
  const manifest = await loadBenchmarkManifestFromJsonFile(
    options.manifestPath ?? defaultManifestPath(rootDir)
  );
  const selectedPartitions = new Set<BenchmarkPartition>(
    options.partitions ?? ["development", "locked-test"]
  );
  const scoredCases = manifest.scoredCases
    .filter((caseEntry) => selectedPartitions.has(caseEntry.partition))
    .sort(compareManifestCases);
  const compiledScoredCases = await Promise.all(
    scoredCases.map((caseEntry) => compileScoredCase(rootDir, manifest, caseEntry))
  );
  const compiledDemoCases =
    options.includeDemo === true
      ? await Promise.all(
          [...manifest.demoCases]
            .sort(compareManifestCases)
            .map((caseEntry) => compileDemoCase(rootDir, manifest, caseEntry))
        )
      : [];

  return [...compiledScoredCases, ...compiledDemoCases].sort(compareCompiledCases);
}

export async function compileBenchmarkCaseInputs(
  options: BenchmarkInputCompilerOptions = {}
): Promise<BenchmarkCaseInput[]> {
  const compiledCases = await compileBenchmarkCases(options);

  return compiledCases.map((compiledCase) => compiledCase.runnerInput);
}

export function benchmarkCaseInputForRunner(
  runnerName: BenchmarkRunnerName,
  compiledCase: BenchmarkCompiledCase
): BenchmarkCaseInput {
  benchmarkRunnerNameSchema.parse(runnerName);

  return benchmarkCaseInputSchema.parse(compiledCase.runnerInput);
}

export function createBenchmarkScorerInput(options: {
  readonly compiledCase: BenchmarkCompiledCase;
  readonly runnerOutput: BenchmarkRunnerOutput;
}): BenchmarkScorerInput {
  const scorerReference = options.compiledCase.scorerReference;

  if (scorerReference.kind !== "scored") {
    throw new BenchmarkInputCompilerError("Demo cases do not produce scorer inputs");
  }

  return benchmarkScorerInputSchema.parse({
    schemaVersion: "trace.benchmark-scorer-input.v1",
    runId: options.runnerOutput.runId,
    runnerName: options.runnerOutput.runnerName,
    caseId: options.compiledCase.caseId,
    partition: scorerReference.annotation.partition,
    caseInput: options.compiledCase.runnerInput,
    annotation: scorerReference.annotation,
    runnerOutput: options.runnerOutput
  });
}

async function compileScoredCase(
  rootDir: string,
  manifest: BenchmarkManifest,
  caseEntry: ScoredBenchmarkCase
): Promise<BenchmarkCompiledCase> {
  const evidenceBundle = await loadEvidenceBundleFromJsonFile(
    scoredEvidenceBundlePath(rootDir, caseEntry)
  );
  const evidenceLedger = normalizeEvidenceBundle(evidenceBundle);
  const rawAnnotation = await loadBenchmarkAnnotationFromJsonFile(
    scoredAnnotationPath(rootDir, caseEntry)
  );
  const annotation = canonicalizeBenchmarkAnnotation(rawAnnotation, evidenceBundle.sourceRecords);

  validateScoredCaseAlignment(caseEntry, evidenceBundle, rawAnnotation);

  return benchmarkCompiledCaseSchema.parse({
    schemaVersion: "trace.compiled-benchmark-case.v1",
    manifestLockId: manifest.lockId,
    caseId: caseEntry.caseId,
    partition: caseEntry.partition,
    scoringRole: caseEntry.scoringRole,
    runnerInput: buildBenchmarkCaseInput(manifest, caseEntry, evidenceBundle, evidenceLedger),
    scorerReference: {
      kind: "scored",
      manifestCase: caseEntry,
      annotation
    }
  });
}

async function compileDemoCase(
  rootDir: string,
  manifest: BenchmarkManifest,
  caseEntry: DemoBenchmarkCase
): Promise<BenchmarkCompiledCase> {
  const evidenceBundle = await loadEvidenceBundleFromJsonFile(
    await resolveDemoEvidenceBundlePath(rootDir, caseEntry)
  );
  const evidenceLedger = normalizeEvidenceBundle(evidenceBundle);

  validateDemoCaseAlignment(caseEntry, evidenceBundle);

  return benchmarkCompiledCaseSchema.parse({
    schemaVersion: "trace.compiled-benchmark-case.v1",
    manifestLockId: manifest.lockId,
    caseId: caseEntry.caseId,
    partition: caseEntry.partition,
    scoringRole: caseEntry.scoringRole,
    runnerInput: buildBenchmarkCaseInput(manifest, caseEntry, evidenceBundle, evidenceLedger),
    scorerReference: {
      kind: "demo",
      manifestCase: caseEntry,
      annotation: null
    }
  });
}

function buildBenchmarkCaseInput(
  manifest: BenchmarkManifest,
  caseEntry: BenchmarkManifestCase,
  evidenceBundle: EvidenceBundle,
  evidenceLedger: EvidenceLedger
): BenchmarkCaseInput {
  return benchmarkCaseInputSchema.parse({
    schemaVersion: "trace.benchmark-case-input.v1",
    manifestLockId: manifest.lockId,
    manifestSchemaVersion: manifest.schemaVersion,
    caseId: caseEntry.caseId,
    partition: caseEntry.partition,
    scoringRole: caseEntry.scoringRole,
    countedInScoring: caseEntry.countedInScoring,
    companyLegalName: caseEntry.companyLegalName,
    target: evidenceBundle.target,
    measurementDate: caseEntry.measurementDate,
    cutoffDate: caseEntry.sourceAudit.cutoffDate,
    dataTier: caseEntry.dataTier,
    sourcePolicy: {
      approvedPublicSourceCategories: sorted(caseEntry.sourceAudit.approvedPublicSourceCategories),
      redistributionStatus: caseEntry.sourceAudit.redistributionStatus,
      rawDocumentPolicy: caseEntry.sourceAudit.rawDocumentPolicy,
      onlyUrlsAndShortExcerptsMayBeCommitted:
        caseEntry.sourceAudit.onlyUrlsAndShortExcerptsMayBeCommitted
    },
    authorityBoundary: {
      benchmarkAuthority: manifest.authorityBoundary.benchmarkAuthority,
      officialContestRulesStatus: manifest.authorityBoundary.officialContestRulesStatus,
      contestComplianceClaimAllowed: manifest.authorityBoundary.contestComplianceClaimAllowed,
      missingOfficialRulesHandling: manifest.authorityBoundary.missingOfficialRulesHandling,
      prohibitedClaims: sorted(manifest.authorityBoundary.prohibitedClaims)
    },
    sourceRecordIds: sorted(
      evidenceBundle.sourceRecords
        .filter((record) => isCutoffVisible(record, evidenceBundle.measurementDate))
        .map((record) => record.id)
    ),
    evidenceLedger
  });
}

function canonicalizeBenchmarkAnnotation(
  annotation: BenchmarkAnnotation,
  sourceRecords: readonly EvidenceBundleSourceRecord[]
): BenchmarkAnnotation {
  const evidenceIdMap = sourceRecordEvidenceIdMap(sourceRecords);
  const canonicalAnnotation = {
    ...annotation,
    expectedRoute: {
      ...annotation.expectedRoute,
      acceptableAlternativeRoutes: sorted(annotation.expectedRoute.acceptableAlternativeRoutes),
      evidenceIds: canonicalEvidenceIds(annotation.expectedRoute.evidenceIds, evidenceIdMap)
    },
    binaryClaims: annotation.binaryClaims
      .map((claim) => ({
        ...claim,
        evidenceIds: canonicalEvidenceIds(claim.evidenceIds, evidenceIdMap)
      }))
      .sort(compareById),
    observableClaims: annotation.observableClaims
      .map((claim) => ({
        ...claim,
        evidenceIds: canonicalEvidenceIds(claim.evidenceIds, evidenceIdMap)
      }))
      .sort(compareById),
    expectedAbstentions: annotation.expectedAbstentions
      .map((abstention) => ({
        ...abstention,
        evidenceIds: canonicalEvidenceIds(abstention.evidenceIds, evidenceIdMap)
      }))
      .sort(compareById),
    valuationSeparationExpectations: {
      ...annotation.valuationSeparationExpectations,
      allowedValuationFields: sorted(
        annotation.valuationSeparationExpectations.allowedValuationFields
      ),
      mustNotConflate: sorted(annotation.valuationSeparationExpectations.mustNotConflate)
    },
    completenessExpectations: annotation.completenessExpectations
      .map((expectation) => ({
        ...expectation,
        requiredEvidenceClasses: sorted(expectation.requiredEvidenceClasses),
        requiredTopics: sorted(expectation.requiredTopics),
        evidenceIds: canonicalEvidenceIds(expectation.evidenceIds, evidenceIdMap)
      }))
      .sort(compareById),
    historicalValuationTargets: canonicalizeHistoricalTargets(
      annotation.historicalValuationTargets,
      evidenceIdMap
    )
  };

  return benchmarkAnnotationSchema.parse(canonicalAnnotation);
}

function canonicalizeHistoricalTargets(
  historicalTargets: BenchmarkAnnotation["historicalValuationTargets"],
  evidenceIdMap: ReadonlyMap<string, string>
): BenchmarkAnnotation["historicalValuationTargets"] {
  if (!historicalTargets.eligible) {
    return historicalTargets;
  }

  return {
    ...historicalTargets,
    targets: historicalTargets.targets
      .map((target) => ({
        ...target,
        sourceEvidenceIds: canonicalEvidenceIds(target.sourceEvidenceIds, evidenceIdMap)
      }))
      .sort(compareById)
  };
}

function canonicalEvidenceIds(
  evidenceIds: readonly string[],
  evidenceIdMap: ReadonlyMap<string, string>
): string[] {
  return Array.from(
    new Set(evidenceIds.map((evidenceId) => evidenceIdMap.get(evidenceId) ?? evidenceId))
  ).sort(compareStrings);
}

function validateScoredCaseAlignment(
  caseEntry: ScoredBenchmarkCase,
  evidenceBundle: EvidenceBundle,
  annotation: BenchmarkAnnotation
): void {
  const errors: string[] = [];
  const allRecordIds = new Set(evidenceBundle.sourceRecords.map((record) => record.id));
  const eligibleRecordIds = new Set(
    evidenceBundle.sourceRecords
      .filter((record) => isCutoffVisible(record, evidenceBundle.measurementDate))
      .map((record) => record.id)
  );

  validateEvidenceBundleAlignment(caseEntry, evidenceBundle, errors);

  if (annotation.caseId !== caseEntry.caseId) {
    errors.push(`Annotation caseId ${annotation.caseId} does not match ${caseEntry.caseId}`);
  }

  if (annotation.partition !== caseEntry.partition) {
    errors.push(`Annotation partition ${annotation.partition} does not match ${caseEntry.partition}`);
  }

  if (annotation.measurementDate !== caseEntry.measurementDate) {
    errors.push(
      `Annotation measurementDate ${annotation.measurementDate} does not match ${caseEntry.measurementDate}`
    );
  }

  if (annotation.expectedRoute.route !== caseEntry.sectorRoute) {
    errors.push(
      `Annotation expected route ${annotation.expectedRoute.route} does not match manifest route ${caseEntry.sectorRoute}`
    );
  }

  if (
    annotation.historicalValuationTargets.eligible !==
    caseEntry.valuationErrorEligibility.eligible
  ) {
    errors.push("Annotation historical valuation eligibility does not match manifest");
  }

  for (const evidenceId of annotation.expectedRoute.evidenceIds) {
    if (!eligibleRecordIds.has(evidenceId)) {
      errors.push(`Expected route evidence id ${evidenceId} is not cutoff-visible`);
    }
  }

  for (const claim of annotation.binaryClaims) {
    validateAnnotationEvidenceIds(
      claim.id,
      claim.evidenceIds,
      claim.sourceAvailability,
      allRecordIds,
      eligibleRecordIds,
      errors
    );
  }

  for (const claim of annotation.observableClaims) {
    validateAnnotationEvidenceIds(
      claim.id,
      claim.evidenceIds,
      claim.sourceAvailability,
      allRecordIds,
      eligibleRecordIds,
      errors
    );
  }

  for (const abstention of annotation.expectedAbstentions) {
    validateAnnotationEvidenceIds(
      abstention.id,
      abstention.evidenceIds,
      abstention.sourceAvailability,
      allRecordIds,
      eligibleRecordIds,
      errors
    );
  }

  for (const expectation of annotation.completenessExpectations) {
    validateAnnotationEvidenceIds(
      expectation.id,
      expectation.evidenceIds,
      expectation.sourceAvailability,
      allRecordIds,
      eligibleRecordIds,
      errors
    );
  }

  if (annotation.historicalValuationTargets.eligible) {
    for (const target of annotation.historicalValuationTargets.targets) {
      validateHistoricalTargetEvidenceIds(target, allRecordIds, eligibleRecordIds, errors);
    }
  }

  throwIfAlignmentErrors(caseEntry.caseId, errors);
}

function validateDemoCaseAlignment(
  caseEntry: DemoBenchmarkCase,
  evidenceBundle: EvidenceBundle
): void {
  const errors: string[] = [];

  validateEvidenceBundleAlignment(caseEntry, evidenceBundle, errors);
  throwIfAlignmentErrors(caseEntry.caseId, errors);
}

function validateEvidenceBundleAlignment(
  caseEntry: BenchmarkManifestCase,
  evidenceBundle: EvidenceBundle,
  errors: string[]
): void {
  if (evidenceBundle.target.legalName !== caseEntry.companyLegalName) {
    errors.push(
      `Evidence target ${evidenceBundle.target.legalName} does not match ${caseEntry.companyLegalName}`
    );
  }

  if (evidenceBundle.measurementDate !== caseEntry.measurementDate) {
    errors.push(
      `Evidence measurementDate ${evidenceBundle.measurementDate} does not match ${caseEntry.measurementDate}`
    );
  }
}

function validateAnnotationEvidenceIds(
  ownerId: string,
  evidenceIds: readonly string[],
  sourceAvailability: BenchmarkSourceAvailability | undefined,
  allRecordIds: ReadonlySet<string>,
  eligibleRecordIds: ReadonlySet<string>,
  errors: string[]
): void {
  for (const evidenceId of evidenceIds) {
    if (!allRecordIds.has(evidenceId)) {
      errors.push(`${ownerId} references unknown evidence id ${evidenceId}`);
      continue;
    }

    if (sourceAvailability !== "post-cutoff-excluded" && !eligibleRecordIds.has(evidenceId)) {
      errors.push(`${ownerId} references non-cutoff-visible evidence id ${evidenceId}`);
    }
  }
}

function validateHistoricalTargetEvidenceIds(
  target: BenchmarkHistoricalValuationTarget,
  allRecordIds: ReadonlySet<string>,
  eligibleRecordIds: ReadonlySet<string>,
  errors: string[]
): void {
  for (const evidenceId of target.sourceEvidenceIds) {
    if (!allRecordIds.has(evidenceId)) {
      errors.push(`${target.id} references unknown historical target evidence id ${evidenceId}`);
      continue;
    }

    if (
      target.sourceAvailability === "cutoff-input-visible" &&
      !eligibleRecordIds.has(evidenceId)
    ) {
      errors.push(`${target.id} references non-cutoff-visible target evidence id ${evidenceId}`);
    }
  }
}

function throwIfAlignmentErrors(caseId: string, errors: readonly string[]): void {
  if (errors.length > 0) {
    throw new BenchmarkInputCompilerError(
      `Benchmark input alignment failed for ${caseId}: ${errors.join("; ")}`
    );
  }
}

function isCutoffVisible(record: EvidenceBundleSourceRecord, measurementDate: string): boolean {
  const dates = [record.publishedDate, record.originatingSource?.publishedDate].filter(
    (date): date is string => date !== undefined
  );

  return dates.every((date) => date <= measurementDate);
}

async function loadEvidenceBundleFromJsonFile(inputPath: string): Promise<EvidenceBundle> {
  const jsonText = await readFile(inputPath, "utf8");

  return parseEvidenceBundleJson(jsonText);
}

async function resolveDemoEvidenceBundlePath(
  rootDir: string,
  caseEntry: DemoBenchmarkCase
): Promise<string> {
  const canonicalDemoPath = join(
    rootDir,
    "fixtures",
    "evidence",
    "benchmark",
    "demo",
    `${caseEntry.caseId}-evidence-bundle.json`
  );

  if (await fileExists(canonicalDemoPath)) {
    return canonicalDemoPath;
  }

  const topLevelEvidenceDirectory = join(rootDir, "fixtures", "evidence");
  const entries = await readdir(topLevelEvidenceDirectory, { withFileTypes: true });
  const candidatePaths = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith("-evidence-bundle.json"))
    .map((entry) => join(topLevelEvidenceDirectory, entry.name))
    .sort(compareStrings);
  const matchingPaths: string[] = [];

  for (const candidatePath of candidatePaths) {
    const evidenceBundle = await loadEvidenceBundleFromJsonFile(candidatePath);

    if (
      evidenceBundle.target.legalName === caseEntry.companyLegalName &&
      evidenceBundle.measurementDate === caseEntry.measurementDate
    ) {
      matchingPaths.push(candidatePath);
    }
  }

  if (matchingPaths.length !== 1) {
    throw new BenchmarkInputCompilerError(
      `Expected exactly one demo evidence bundle for ${caseEntry.caseId}, found ${String(matchingPaths.length)}`
    );
  }

  const matchingPath = matchingPaths[0];

  if (matchingPath === undefined) {
    throw new BenchmarkInputCompilerError(`No demo evidence bundle found for ${caseEntry.caseId}`);
  }

  return matchingPath;
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path, "utf8");
    return true;
  } catch (error) {
    if (isErrorWithCode(error, "ENOENT")) {
      return false;
    }

    throw error;
  }
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === code
  );
}

function defaultManifestPath(rootDir: string): string {
  return join(rootDir, "eval", "benchmark-manifest.json");
}

function scoredEvidenceBundlePath(rootDir: string, caseEntry: ScoredBenchmarkCase): string {
  return join(
    rootDir,
    "fixtures",
    "evidence",
    "benchmark",
    caseEntry.partition,
    `${caseEntry.caseId}-evidence-bundle.json`
  );
}

function scoredAnnotationPath(rootDir: string, caseEntry: ScoredBenchmarkCase): string {
  return join(
    rootDir,
    "eval",
    "benchmark",
    "annotations",
    caseEntry.partition,
    `${caseEntry.caseId}-annotation.json`
  );
}

function compareManifestCases(
  left: BenchmarkManifestCase,
  right: BenchmarkManifestCase
): number {
  return compareStrings(left.caseId, right.caseId);
}

function compareCompiledCases(
  left: BenchmarkCompiledCase,
  right: BenchmarkCompiledCase
): number {
  return compareStrings(left.caseId, right.caseId);
}

function compareById<T extends { readonly id: string }>(left: T, right: T): number {
  return compareStrings(left.id, right.id);
}

function sorted<T extends string>(values: readonly T[]): T[] {
  return [...values].sort(compareStrings);
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
