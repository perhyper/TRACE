import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { z } from "zod";

import {
  companyIdentitySchema,
  decisionModeSchema,
  evidenceRecordSchema,
  isoDateSchema,
  isoDateTimeSchema
} from "../domain/schemas.js";
import type {
  EvidenceRecord,
  ObservedFact
} from "../domain/schemas.js";

const nonEmptyStringSchema = z.string().trim().min(1);
const recordIdSchema = nonEmptyStringSchema.max(120);
const missingDateSortValue = "9999-12-31";

export const evidenceDecisionModeSchema = decisionModeSchema;

export const originatingSourceSchema = z
  .object({
    sourceUrl: z.url(),
    sourceTitle: nonEmptyStringSchema.max(240).optional(),
    publishedDate: isoDateSchema.optional()
  })
  .strict();

export const evidenceBundleSourceRecordSchema = evidenceRecordSchema
  .extend({
    originatingSource: originatingSourceSchema.optional()
  })
  .strict();

export const failedEvidenceNoteSchema = z
  .object({
    id: recordIdSchema,
    stage: z.enum(["access", "extraction"]),
    sourceUrl: z.url().optional(),
    sourceTitle: nonEmptyStringSchema.max(240).optional(),
    attemptedAt: isoDateTimeSchema.optional(),
    note: nonEmptyStringSchema.max(1_000)
  })
  .strict();

export const evidenceBundleSchema = z
  .object({
    schemaVersion: z.literal("trace.evidence-bundle.v1"),
    target: companyIdentitySchema,
    measurementDate: isoDateSchema,
    decisionMode: evidenceDecisionModeSchema,
    sourceRecords: z.array(evidenceBundleSourceRecordSchema).min(1),
    failedNotes: z.array(failedEvidenceNoteSchema).default([])
  })
  .strict();

export const evidenceLedgerWarningSchema = z
  .object({
    code: z.enum(["published-after-measurement-date", "duplicate-originating-source"]),
    message: nonEmptyStringSchema.max(1_000),
    recordIds: z.array(recordIdSchema).min(1),
    sourceUrls: z.array(z.url()).min(1),
    evidenceIds: z.array(recordIdSchema)
  })
  .strict();

export const excludedEvidenceRecordSchema = z
  .object({
    recordId: recordIdSchema,
    reasonCode: z.literal("published-after-measurement-date"),
    message: nonEmptyStringSchema.max(1_000),
    sourceUrl: z.url(),
    sourceTitle: nonEmptyStringSchema.max(240),
    publishedDate: isoDateSchema,
    measurementDate: isoDateSchema
  })
  .strict();

export const evidenceLedgerSchema = z
  .object({
    schemaVersion: z.literal("trace.evidence-ledger.v1"),
    target: companyIdentitySchema,
    measurementDate: isoDateSchema,
    decisionMode: evidenceDecisionModeSchema,
    evidence: z.array(evidenceRecordSchema),
    excludedRecords: z.array(excludedEvidenceRecordSchema),
    failedNotes: z.array(failedEvidenceNoteSchema),
    warnings: z.array(evidenceLedgerWarningSchema)
  })
  .strict();

export type EvidenceDecisionMode = z.infer<typeof evidenceDecisionModeSchema>;
export type OriginatingSource = z.infer<typeof originatingSourceSchema>;
export type EvidenceBundleSourceRecord = z.infer<typeof evidenceBundleSourceRecordSchema>;
export type FailedEvidenceNote = z.infer<typeof failedEvidenceNoteSchema>;
export type EvidenceBundle = z.infer<typeof evidenceBundleSchema>;
export type EvidenceLedgerWarning = z.infer<typeof evidenceLedgerWarningSchema>;
export type ExcludedEvidenceRecord = z.infer<typeof excludedEvidenceRecordSchema>;
export type EvidenceLedger = z.infer<typeof evidenceLedgerSchema>;

export class EvidenceBundleJsonError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "EvidenceBundleJsonError";
  }
}

export function parseEvidenceBundleJson(jsonText: string): EvidenceBundle {
  let parsed: unknown;

  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown JSON parse error";
    throw new EvidenceBundleJsonError(`Invalid evidence bundle JSON: ${message}`);
  }

  return evidenceBundleSchema.parse(parsed);
}

export async function loadEvidenceLedgerFromJsonFile(inputPath: string): Promise<EvidenceLedger> {
  const jsonText = await readFile(inputPath, "utf8");

  return normalizeEvidenceBundle(parseEvidenceBundleJson(jsonText));
}

export function normalizeEvidenceBundle(input: unknown): EvidenceLedger {
  const bundle = evidenceBundleSchema.parse(input);
  const eligibleRecords: EvidenceBundleSourceRecord[] = [];
  const excludedRecords: ExcludedEvidenceRecord[] = [];
  const warnings: EvidenceLedgerWarning[] = [];

  for (const sourceRecord of bundle.sourceRecords) {
    const publishedDate = cutoffViolationPublicationDate(sourceRecord, bundle.measurementDate);

    if (publishedDate !== undefined && publishedDate > bundle.measurementDate) {
      excludedRecords.push({
        recordId: sourceRecord.id,
        reasonCode: "published-after-measurement-date",
        message: `Evidence record ${sourceRecord.id} was published after the measurement date and was excluded.`,
        sourceUrl: sourceRecord.sourceUrl,
        sourceTitle: sourceRecord.sourceTitle,
        publishedDate,
        measurementDate: bundle.measurementDate
      });
      warnings.push({
        code: "published-after-measurement-date",
        message: `Excluded ${sourceRecord.id} because publishedDate ${publishedDate} is after measurementDate ${bundle.measurementDate}.`,
        recordIds: [sourceRecord.id],
        sourceUrls: [sourceRecord.sourceUrl],
        evidenceIds: []
      });
      continue;
    }

    eligibleRecords.push(sourceRecord);
  }

  const groupedRecords = groupByOriginatingSource(eligibleRecords);
  const evidence = Array.from(groupedRecords.values()).map((records) =>
    mergeOriginatingSourceRecords(records)
  );

  for (const records of groupedRecords.values()) {
    if (records.length <= 1) {
      continue;
    }

    const originKey = originatingSourceKey(records[0]);
    warnings.push({
      code: "duplicate-originating-source",
      message: `Merged ${String(records.length)} evidence records that cite the same originating source.`,
      recordIds: records.map((record) => record.id).sort(compareStrings),
      sourceUrls: uniqueSorted(records.map((record) => record.sourceUrl)),
      evidenceIds: [canonicalEvidenceId(originKey)]
    });
  }

  const ledger = {
    schemaVersion: "trace.evidence-ledger.v1",
    target: bundle.target,
    measurementDate: bundle.measurementDate,
    decisionMode: bundle.decisionMode,
    evidence: evidence.sort(compareEvidenceRecords),
    excludedRecords: excludedRecords.sort(compareExcludedRecords),
    failedNotes: [...bundle.failedNotes].sort(compareFailedNotes),
    warnings: warnings.sort(compareWarnings)
  } satisfies EvidenceLedger;

  return evidenceLedgerSchema.parse(ledger);
}

export function sourceRecordEvidenceIdMap(
  sourceRecords: readonly EvidenceBundleSourceRecord[]
): ReadonlyMap<string, string> {
  return new Map(
    [...sourceRecords]
      .sort(compareSourceRecordIds)
      .map((sourceRecord) => [
        sourceRecord.id,
        canonicalEvidenceId(originatingSourceKey(sourceRecord))
      ])
  );
}

export function evidenceIdForSourceUrl(sourceUrl: string): string {
  return canonicalEvidenceId(canonicalUrl(sourceUrl));
}

function groupByOriginatingSource(
  sourceRecords: readonly EvidenceBundleSourceRecord[]
): Map<string, EvidenceBundleSourceRecord[]> {
  const groups = new Map<string, EvidenceBundleSourceRecord[]>();

  for (const sourceRecord of sourceRecords) {
    const key = originatingSourceKey(sourceRecord);
    const existing = groups.get(key);

    if (existing === undefined) {
      groups.set(key, [sourceRecord]);
    } else {
      existing.push(sourceRecord);
    }
  }

  return new Map(
    Array.from(groups.entries()).sort(([leftKey], [rightKey]) => compareStrings(leftKey, rightKey))
  );
}

function mergeOriginatingSourceRecords(
  records: readonly EvidenceBundleSourceRecord[]
): EvidenceRecord {
  const sortedRecords = [...records].sort(compareSourceRecordsForRepresentative);
  const representative = sortedRecords[0];

  if (representative === undefined) {
    throw new Error("Cannot merge an empty evidence record group");
  }

  const originKey = originatingSourceKey(representative);
  const origin = representativeOrigin(records, originKey);
  const facts = mergeObservedFacts(records, originKey);
  const documentHash = sortedRecords.find((record) => record.documentHash !== undefined)?.documentHash;
  const publishedDate = origin?.publishedDate ?? representative.publishedDate;
  const effectiveDate = representative.effectiveDate;
  const locator = representative.locator;

  return {
    id: canonicalEvidenceId(originKey),
    sourceUrl: origin?.sourceUrl ?? representative.sourceUrl,
    sourceTitle: origin?.sourceTitle ?? representative.sourceTitle,
    retrievedDate: earliest(records.map((record) => record.retrievedDate)),
    ...(publishedDate !== undefined ? { publishedDate } : {}),
    ...(effectiveDate !== undefined ? { effectiveDate } : {}),
    sourceClass: representative.sourceClass,
    epistemicClass: representative.epistemicClass,
    ...(locator !== undefined ? { locator } : {}),
    shortExcerpt: representative.shortExcerpt,
    observedFacts: facts,
    ...(documentHash !== undefined ? { documentHash } : {})
  };
}

function representativeOrigin(
  records: readonly EvidenceBundleSourceRecord[],
  originKey: string
): OriginatingSource | undefined {
  const origins = records
    .map((record) => record.originatingSource)
    .filter((origin): origin is OriginatingSource => origin !== undefined)
    .filter((origin) => canonicalUrl(origin.sourceUrl) === originKey)
    .sort(compareOriginatingSources);

  return origins[0];
}

function mergeObservedFacts(
  records: readonly EvidenceBundleSourceRecord[],
  originKey: string
): ObservedFact[] {
  const factsByKey = new Map<string, ObservedFact>();

  for (const record of records) {
    for (const fact of record.observedFacts) {
      const key = observedFactKey(fact);

      if (!factsByKey.has(key)) {
        factsByKey.set(key, {
          ...fact,
          id: canonicalFactId(originKey, key)
        });
      }
    }
  }

  return Array.from(factsByKey.entries())
    .sort(([leftKey], [rightKey]) => compareStrings(leftKey, rightKey))
    .map(([, fact]) => fact);
}

function cutoffViolationPublicationDate(
  sourceRecord: EvidenceBundleSourceRecord,
  measurementDate: string
): string | undefined {
  const publicationDates = [
    sourceRecord.publishedDate,
    sourceRecord.originatingSource?.publishedDate
  ].filter((date): date is string => date !== undefined);

  return publicationDates.filter((publishedDate) => publishedDate > measurementDate).sort(compareStrings)[0];
}

function originatingSourceKey(sourceRecord: EvidenceBundleSourceRecord | undefined): string {
  if (sourceRecord === undefined) {
    throw new Error("Cannot derive an originating source key for an empty record group");
  }

  return canonicalUrl(sourceRecord.originatingSource?.sourceUrl ?? sourceRecord.sourceUrl);
}

function canonicalEvidenceId(originKey: string): string {
  return `ev-${shortHash(originKey)}`;
}

function canonicalFactId(originKey: string, factKey: string): string {
  return `fact-${shortHash(`${originKey}\n${factKey}`)}`;
}

function shortHash(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

function canonicalUrl(value: string): string {
  const url = new URL(value);
  url.protocol = url.protocol.toLowerCase();
  url.hostname = url.hostname.toLowerCase();
  url.hash = "";

  if (url.pathname.length > 1) {
    url.pathname = url.pathname.replace(/\/+$/u, "");
  }

  const sortedParams = Array.from(url.searchParams.entries()).sort(([leftKey, leftValue], [
    rightKey,
    rightValue
  ]) => compareStrings(`${leftKey}\u0000${leftValue}`, `${rightKey}\u0000${rightValue}`));
  url.search = "";

  for (const [key, searchValue] of sortedParams) {
    url.searchParams.append(key, searchValue);
  }

  return url.toString();
}

function observedFactKey(fact: ObservedFact): string {
  return stableStringify({
    statement: fact.statement,
    epistemicClass: fact.epistemicClass,
    value: fact.value,
    unit: fact.unit,
    period: fact.period
  });
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

function compareEvidenceRecords(left: EvidenceRecord, right: EvidenceRecord): number {
  return compareTuple(
    [
      left.publishedDate ?? missingDateSortValue,
      left.effectiveDate ?? missingDateSortValue,
      left.sourceClass,
      canonicalUrl(left.sourceUrl),
      left.sourceTitle,
      left.id
    ],
    [
      right.publishedDate ?? missingDateSortValue,
      right.effectiveDate ?? missingDateSortValue,
      right.sourceClass,
      canonicalUrl(right.sourceUrl),
      right.sourceTitle,
      right.id
    ]
  );
}

function compareSourceRecordsForRepresentative(
  left: EvidenceBundleSourceRecord,
  right: EvidenceBundleSourceRecord
): number {
  return compareTuple(representativeSortTuple(left), representativeSortTuple(right));
}

function compareSourceRecordIds(
  left: EvidenceBundleSourceRecord,
  right: EvidenceBundleSourceRecord
): number {
  return compareStrings(left.id, right.id);
}

function representativeSortTuple(record: EvidenceBundleSourceRecord): readonly string[] {
  const originKey = originatingSourceKey(record);

  return [
    canonicalUrl(record.sourceUrl) === originKey ? "0" : "1",
    record.documentHash === undefined ? "1" : "0",
    record.publishedDate ?? record.originatingSource?.publishedDate ?? missingDateSortValue,
    record.retrievedDate,
    record.sourceClass,
    record.sourceTitle,
    canonicalUrl(record.sourceUrl),
    record.locator ?? "",
    record.shortExcerpt,
    record.id
  ];
}

function compareOriginatingSources(left: OriginatingSource, right: OriginatingSource): number {
  return compareTuple(
    [
      canonicalUrl(left.sourceUrl),
      left.publishedDate ?? missingDateSortValue,
      left.sourceTitle ?? ""
    ],
    [
      canonicalUrl(right.sourceUrl),
      right.publishedDate ?? missingDateSortValue,
      right.sourceTitle ?? ""
    ]
  );
}

function compareExcludedRecords(
  left: ExcludedEvidenceRecord,
  right: ExcludedEvidenceRecord
): number {
  return compareTuple(
    [left.publishedDate, canonicalUrl(left.sourceUrl), left.recordId],
    [right.publishedDate, canonicalUrl(right.sourceUrl), right.recordId]
  );
}

function compareFailedNotes(left: FailedEvidenceNote, right: FailedEvidenceNote): number {
  return compareTuple(
    [
      left.stage,
      left.sourceUrl === undefined ? "" : canonicalUrl(left.sourceUrl),
      left.attemptedAt ?? "",
      left.id,
      left.note
    ],
    [
      right.stage,
      right.sourceUrl === undefined ? "" : canonicalUrl(right.sourceUrl),
      right.attemptedAt ?? "",
      right.id,
      right.note
    ]
  );
}

function compareWarnings(left: EvidenceLedgerWarning, right: EvidenceLedgerWarning): number {
  return compareTuple(
    [
      left.code,
      left.sourceUrls.map(canonicalUrl).join("\u0000"),
      left.recordIds.join("\u0000"),
      left.evidenceIds.join("\u0000")
    ],
    [
      right.code,
      right.sourceUrls.map(canonicalUrl).join("\u0000"),
      right.recordIds.join("\u0000"),
      right.evidenceIds.join("\u0000")
    ]
  );
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

function earliest(values: readonly string[]): string {
  const sortedValues = [...values].sort(compareStrings);
  const value = sortedValues[0];

  if (value === undefined) {
    throw new Error("Cannot select earliest value from an empty array");
  }

  return value;
}
