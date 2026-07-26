import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { z } from "zod";

import {
  loadBenchmarkManifestFromJsonFile
} from "./manifest.js";
import {
  isoDateSchema
} from "../domain/schemas.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const sha256HashSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);
const relativePathSchema = nonEmptyStringSchema
  .max(500)
  .refine((value) => !isAbsolute(value), {
    message: "Expected a relative path"
  })
  .refine((value) => !pathSegments(value).includes(".."), {
    message: "Relative paths must not traverse parent directories"
  });

const freezeHashBaseSchema = z
  .object({
    description: nonEmptyStringSchema.max(1_000),
    hash: sha256HashSchema
  })
  .strict();

const freezeFileHashSchema = freezeHashBaseSchema
  .extend({
    kind: z.literal("file"),
    path: relativePathSchema,
    byteLength: z.number().int().nonnegative()
  })
  .strict();

const freezeTreeHashSchema = freezeHashBaseSchema
  .extend({
    kind: z.literal("tree"),
    path: relativePathSchema,
    fileCount: z.number().int().nonnegative()
  })
  .strict();

const freezePathSetHashSchema = freezeHashBaseSchema
  .extend({
    kind: z.literal("path-set"),
    paths: z.array(relativePathSchema).min(1),
    fileCount: z.number().int().nonnegative()
  })
  .strict()
  .superRefine((entry, context) => {
    addDuplicateIssue(entry.paths, context, ["paths"], "path");
  });

export const benchmarkFreezeHashEntrySchema = z.discriminatedUnion("kind", [
  freezeFileHashSchema,
  freezeTreeHashSchema,
  freezePathSetHashSchema
]);

const runnerVersionsSchema = z
  .object({
    "baseline-a": nonEmptyStringSchema.max(120),
    "baseline-b": nonEmptyStringSchema.max(120),
    "trace-full": nonEmptyStringSchema.max(120)
  })
  .strict();

const scorerVersionsSchema = z
  .object({
    scorerInput: nonEmptyStringSchema.max(120),
    perClaimScore: nonEmptyStringSchema.max(120),
    caseScore: nonEmptyStringSchema.max(120),
    aggregateScore: nonEmptyStringSchema.max(120),
    scoringWeights: nonEmptyStringSchema.max(120)
  })
  .strict();

const commandTemplatesSchema = z
  .object({
    freezeValidation: nonEmptyStringSchema.max(500),
    authoritativeLockedTest: nonEmptyStringSchema.max(500),
    exploratoryLockedTest: nonEmptyStringSchema.max(500)
  })
  .strict();

const environmentAssumptionsSchema = z
  .object({
    node: nonEmptyStringSchema.max(120),
    packageManager: nonEmptyStringSchema.max(120),
    network: nonEmptyStringSchema.max(500),
    timezone: nonEmptyStringSchema.max(500),
    secrets: nonEmptyStringSchema.max(500)
  })
  .strict();

const volatileFieldPolicySchema = z
  .object({
    scope: nonEmptyStringSchema.max(160),
    fields: z.array(nonEmptyStringSchema.max(160)).min(1),
    reason: nonEmptyStringSchema.max(1_000)
  })
  .strict()
  .superRefine((policy, context) => {
    addDuplicateIssue(policy.fields, context, ["fields"], "field");
  });

const codeStateSchema = z
  .object({
    basisCommit: nonEmptyStringSchema.max(120),
    finalCommitSelfReference: z.literal(false),
    hashBoundary: nonEmptyStringSchema.max(1_000)
  })
  .strict();

const lockedTestPolicySchema = z
  .object({
    noTuningStatement: nonEmptyStringSchema.max(1_500),
    authoritativeRunPolicy: nonEmptyStringSchema.max(1_000),
    exploratoryRunPolicy: nonEmptyStringSchema.max(1_000)
  })
  .strict();

export const benchmarkFreezeRecordSchema = z
  .object({
    schemaVersion: z.literal("trace.benchmark-freeze.v1"),
    freezeId: nonEmptyStringSchema
      .max(120)
      .regex(/^trace-internal-benchmark-freeze-\d{4}-\d{2}-\d{2}-v\d+$/u),
    freezeDate: isoDateSchema,
    status: z.literal("frozen"),
    manifestLockId: nonEmptyStringSchema.max(160),
    developmentRunId: nonEmptyStringSchema.max(160),
    codeState: codeStateSchema,
    runnerVersions: runnerVersionsSchema,
    scorerVersions: scorerVersionsSchema,
    commandTemplates: commandTemplatesSchema,
    environmentAssumptions: environmentAssumptionsSchema,
    allowedVolatileFields: z.array(volatileFieldPolicySchema).min(1),
    frozenHashes: z
      .object({
        manifest: freezeFileHashSchema,
        benchmarkSourceAndConfig: freezePathSetHashSchema,
        developmentEvidenceFixtures: freezeTreeHashSchema,
        lockedTestEvidenceFixtures: freezeTreeHashSchema,
        developmentAnnotations: freezeTreeHashSchema,
        lockedTestAnnotations: freezeTreeHashSchema,
        developmentRunArtifacts: freezeTreeHashSchema
      })
      .strict(),
    lockedTestPolicy: lockedTestPolicySchema
  })
  .strict()
  .superRefine((record, context) => {
    addDuplicateIssue(
      record.allowedVolatileFields.map((policy) => policy.scope),
      context,
      ["allowedVolatileFields"],
      "volatile-field policy scope"
    );
  });

export type BenchmarkFreezeHashEntry = z.infer<typeof benchmarkFreezeHashEntrySchema>;
export type BenchmarkFreezeRecord = z.infer<typeof benchmarkFreezeRecordSchema>;
export type BenchmarkFreezeMode = "authoritative" | "exploratory";

export interface BenchmarkFreezeHashComparison {
  readonly id: BenchmarkFreezeHashId;
  readonly kind: BenchmarkFreezeHashEntry["kind"];
  readonly description: string;
  readonly expectedHash: string;
  readonly actualHash: string;
  readonly expectedFileCount: number;
  readonly actualFileCount: number;
  readonly expectedByteLength?: number;
  readonly actualByteLength?: number;
  readonly matches: boolean;
}

export interface BenchmarkFreezeMismatch {
  readonly id: BenchmarkFreezeHashId | "manifestLockId";
  readonly expected: string;
  readonly actual: string;
  readonly reason: string;
}

export interface BenchmarkFreezeValidationResult {
  readonly command: "validate-benchmark-freeze";
  readonly freeze: string;
  readonly mode: BenchmarkFreezeMode;
  readonly authority: "authoritative" | "non-authoritative-exploratory";
  readonly status: "valid" | "exploratory-non-authoritative";
  readonly freezeId: string;
  readonly manifestLockId: string;
  readonly developmentRunId: string;
  readonly comparisons: readonly BenchmarkFreezeHashComparison[];
  readonly mismatches: readonly BenchmarkFreezeMismatch[];
}

type BenchmarkFreezeHashId = keyof BenchmarkFreezeRecord["frozenHashes"];

export class BenchmarkFreezeJsonError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "BenchmarkFreezeJsonError";
  }
}

export class BenchmarkFreezeValidationError extends Error {
  public readonly mismatches: readonly BenchmarkFreezeMismatch[];

  public constructor(mismatches: readonly BenchmarkFreezeMismatch[]) {
    super(`Benchmark freeze validation failed: ${renderMismatches(mismatches)}`);
    this.name = "BenchmarkFreezeValidationError";
    this.mismatches = mismatches;
  }
}

export function parseBenchmarkFreezeRecordJson(jsonText: string): BenchmarkFreezeRecord {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new BenchmarkFreezeJsonError(`Invalid benchmark freeze JSON: ${message}`);
  }

  return validateBenchmarkFreezeRecord(parsed);
}

export function validateBenchmarkFreezeRecord(input: unknown): BenchmarkFreezeRecord {
  return benchmarkFreezeRecordSchema.parse(input);
}

export async function loadBenchmarkFreezeRecordFromJsonFile(
  freezePath: string
): Promise<BenchmarkFreezeRecord> {
  const jsonText = await readFile(freezePath, "utf8");

  return parseBenchmarkFreezeRecordJson(jsonText);
}

export async function validateBenchmarkFreezeForLockedTest(options: {
  readonly rootDir?: string;
  readonly freezePath?: string;
  readonly manifestPath?: string;
  readonly mode?: BenchmarkFreezeMode;
} = {}): Promise<BenchmarkFreezeValidationResult> {
  const rootDir = options.rootDir ?? process.cwd();
  const mode = options.mode ?? "authoritative";
  const freezePath = options.freezePath ?? defaultFreezePath(rootDir);
  const record = await loadBenchmarkFreezeRecordFromJsonFile(freezePath);
  const manifestPath =
    options.manifestPath ?? join(rootDir, record.frozenHashes.manifest.path);
  const manifest = await loadBenchmarkManifestFromJsonFile(manifestPath);
  const comparisons = await compareBenchmarkFreezeHashes({
    rootDir,
    record,
    ...(options.manifestPath !== undefined ? { manifestPath: options.manifestPath } : {})
  });
  const hashMismatches = comparisons
    .filter((comparison) => !comparison.matches)
    .map((comparison) => ({
      id: comparison.id,
      expected: comparison.expectedHash,
      actual: comparison.actualHash,
      reason: hashMismatchReason(comparison)
    }));
  const manifestLockMismatches =
    manifest.lockId === record.manifestLockId
      ? []
      : [
          {
            id: "manifestLockId" as const,
            expected: record.manifestLockId,
            actual: manifest.lockId,
            reason: "Current manifest lock ID does not match the freeze record."
          }
        ];
  const mismatches = [...manifestLockMismatches, ...hashMismatches].sort(
    compareMismatches
  );

  if (mismatches.length > 0 && mode === "authoritative") {
    throw new BenchmarkFreezeValidationError(mismatches);
  }

  return {
    command: "validate-benchmark-freeze",
    freeze: freezePath,
    mode,
    authority: mode === "authoritative" ? "authoritative" : "non-authoritative-exploratory",
    status: mismatches.length === 0 ? "valid" : "exploratory-non-authoritative",
    freezeId: record.freezeId,
    manifestLockId: record.manifestLockId,
    developmentRunId: record.developmentRunId,
    comparisons,
    mismatches
  };
}

export async function compareBenchmarkFreezeHashes(options: {
  readonly rootDir?: string;
  readonly record: BenchmarkFreezeRecord;
  readonly manifestPath?: string;
}): Promise<BenchmarkFreezeHashComparison[]> {
  const rootDir = options.rootDir ?? process.cwd();
  const entries = freezeHashEntries(options.record);
  const comparisons = await Promise.all(
    entries.map(([id, entry]) =>
      compareBenchmarkFreezeHash({
        rootDir,
        id,
        entry,
        ...(id === "manifest" && options.manifestPath !== undefined
          ? { overridePath: options.manifestPath }
          : {})
      })
    )
  );

  return comparisons.sort(compareComparisons);
}

export function defaultFreezePath(rootDir: string = process.cwd()): string {
  return join(rootDir, "eval", "benchmark", "freeze.json");
}

async function compareBenchmarkFreezeHash(options: {
  readonly rootDir: string;
  readonly id: BenchmarkFreezeHashId;
  readonly entry: BenchmarkFreezeHashEntry;
  readonly overridePath?: string;
}): Promise<BenchmarkFreezeHashComparison> {
  const actual = await computeHashEntry({
    rootDir: options.rootDir,
    entry: options.entry,
    ...(options.overridePath !== undefined ? { overridePath: options.overridePath } : {})
  });
  const expectedCount = expectedFileCountForEntry(options.entry);
  const expectedByteLength = options.entry.kind === "file" ? options.entry.byteLength : undefined;
  const matches =
    options.entry.hash === actual.hash &&
    expectedCount === actual.fileCount &&
    (expectedByteLength === undefined || expectedByteLength === actual.byteLength);

  return {
    id: options.id,
    kind: options.entry.kind,
    description: options.entry.description,
    expectedHash: options.entry.hash,
    actualHash: actual.hash,
    expectedFileCount: expectedCount,
    actualFileCount: actual.fileCount,
    ...(expectedByteLength !== undefined ? { expectedByteLength } : {}),
    ...(actual.byteLength !== undefined ? { actualByteLength: actual.byteLength } : {}),
    matches
  };
}

async function computeHashEntry(options: {
  readonly rootDir: string;
  readonly entry: BenchmarkFreezeHashEntry;
  readonly overridePath?: string;
}): Promise<{
  readonly hash: string;
  readonly fileCount: number;
  readonly byteLength?: number;
}> {
  if (options.entry.kind === "file") {
    const filePath =
      options.overridePath ?? resolveRecordPath(options.rootDir, options.entry.path);
    const bytes = await readFile(filePath);

    return {
      hash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      fileCount: 1,
      byteLength: bytes.length
    };
  }

  if (options.entry.kind === "tree") {
    const directory = resolveRecordPath(options.rootDir, options.entry.path);
    const files = await listFiles(directory);

    return hashFileSet(options.rootDir, files);
  }

  const files = await filesForPathSet(options.rootDir, options.entry.paths);

  return hashFileSet(options.rootDir, files);
}

async function filesForPathSet(rootDir: string, paths: readonly string[]): Promise<string[]> {
  const files = await Promise.all(
    paths.map(async (path) => {
      const resolvedPath = resolveRecordPath(rootDir, path);
      const pathStat = await stat(resolvedPath);

      if (pathStat.isFile()) {
        return [resolvedPath];
      }

      if (pathStat.isDirectory()) {
        return listFiles(resolvedPath);
      }

      throw new BenchmarkFreezeJsonError(`Unsupported frozen path type: ${path}`);
    })
  );

  return uniqueSorted(files.flat().map((filePath) => resolve(filePath)));
}

async function listFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries
      .sort((left, right) => compareStrings(left.name, right.name))
      .map(async (entry) => {
        const entryPath = join(directory, entry.name);

        if (entry.isDirectory()) {
          return listFiles(entryPath);
        }

        if (entry.isFile()) {
          return [entryPath];
        }

        throw new BenchmarkFreezeJsonError(`Unsupported frozen path type: ${entryPath}`);
      })
  );

  return nestedFiles.flat().sort(compareStrings);
}

async function hashFileSet(
  rootDir: string,
  files: readonly string[]
): Promise<{
  readonly hash: string;
  readonly fileCount: number;
}> {
  const hash = createHash("sha256");
  const root = resolve(rootDir);

  hash.update("trace.freeze-tree-hash.v1\n");

  for (const filePath of [...files].sort(compareStrings)) {
    const relativePath = rootRelativePath(root, filePath);
    const bytes = await readFile(filePath);

    hash.update(`path:${String(relativePath.length)}:${relativePath}\n`);
    hash.update(`bytes:${String(bytes.length)}\n`);
    hash.update(bytes);
    hash.update("\n");
  }

  return {
    hash: `sha256:${hash.digest("hex")}`,
    fileCount: files.length
  };
}

function freezeHashEntries(
  record: BenchmarkFreezeRecord
): Array<[BenchmarkFreezeHashId, BenchmarkFreezeHashEntry]> {
  return [
    ["manifest", record.frozenHashes.manifest],
    ["benchmarkSourceAndConfig", record.frozenHashes.benchmarkSourceAndConfig],
    ["developmentEvidenceFixtures", record.frozenHashes.developmentEvidenceFixtures],
    ["lockedTestEvidenceFixtures", record.frozenHashes.lockedTestEvidenceFixtures],
    ["developmentAnnotations", record.frozenHashes.developmentAnnotations],
    ["lockedTestAnnotations", record.frozenHashes.lockedTestAnnotations],
    ["developmentRunArtifacts", record.frozenHashes.developmentRunArtifacts]
  ];
}

function expectedFileCountForEntry(entry: BenchmarkFreezeHashEntry): number {
  if (entry.kind === "file") {
    return 1;
  }

  return entry.fileCount;
}

function resolveRecordPath(rootDir: string, recordPath: string): string {
  if (isAbsolute(recordPath) || pathSegments(recordPath).includes("..")) {
    throw new BenchmarkFreezeJsonError(`Freeze record path must stay inside the repo: ${recordPath}`);
  }

  return join(rootDir, recordPath);
}

function rootRelativePath(rootDir: string, filePath: string): string {
  const relativePath = relative(rootDir, resolve(filePath)).split(sep).join("/");

  if (relativePath.startsWith("../") || relativePath === ".." || isAbsolute(relativePath)) {
    throw new BenchmarkFreezeJsonError(`Frozen file is outside the repo root: ${filePath}`);
  }

  return relativePath;
}

function hashMismatchReason(comparison: BenchmarkFreezeHashComparison): string {
  const countChanged =
    comparison.expectedFileCount === comparison.actualFileCount
      ? ""
      : ` file count ${String(comparison.expectedFileCount)} -> ${String(comparison.actualFileCount)};`;
  const bytesChanged =
    comparison.expectedByteLength === undefined ||
    comparison.actualByteLength === undefined ||
    comparison.expectedByteLength === comparison.actualByteLength
      ? ""
      : ` byte length ${String(comparison.expectedByteLength)} -> ${String(comparison.actualByteLength)};`;

  return `Frozen ${comparison.id} hash does not match.${countChanged}${bytesChanged}`;
}

function renderMismatches(mismatches: readonly BenchmarkFreezeMismatch[]): string {
  if (mismatches.length === 0) {
    return "no mismatches";
  }

  return mismatches
    .map((mismatch) => `${mismatch.id} expected ${mismatch.expected}, actual ${mismatch.actual}`)
    .join("; ");
}

function addDuplicateIssue(
  values: readonly string[],
  context: z.RefinementCtx,
  pathPrefix: Array<string | number>,
  label: string
): void {
  const seen = new Set<string>();

  for (const [index, value] of values.entries()) {
    if (seen.has(value)) {
      context.addIssue({
        code: "custom",
        path: [...pathPrefix, index],
        message: `Duplicate ${label}: ${value}`
      });
    }

    seen.add(value);
  }
}

function pathSegments(path: string): string[] {
  return path.split(/[\\/]+/u).filter((segment) => segment.length > 0);
}

function compareComparisons(
  left: BenchmarkFreezeHashComparison,
  right: BenchmarkFreezeHashComparison
): number {
  return compareStrings(left.id, right.id);
}

function compareMismatches(
  left: BenchmarkFreezeMismatch,
  right: BenchmarkFreezeMismatch
): number {
  return compareStrings(left.id, right.id);
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
