import { describe, expect, it } from "vitest";

import {
  compileBenchmarkCases,
  createBenchmarkScorerInput
} from "../src/benchmark/compiler.js";
import {
  benchmarkCaseScoreOutputSchema,
  benchmarkPerClaimScoreOutputSchema,
  benchmarkRunnerOutputSchema
} from "../src/benchmark/contracts.js";
import type {
  BenchmarkAnnotation,
  BenchmarkCaseScoreOutput,
  BenchmarkClaimScore,
  BenchmarkCompiledCase,
  BenchmarkEmittedClaim,
  BenchmarkNormalizedRunnerOutput,
  BenchmarkExpectedBinaryClaim,
  BenchmarkExpectedObservableClaim,
  BenchmarkMetricScore,
  BenchmarkRunnerOutput
} from "../src/benchmark/contracts.js";
import { scoreBenchmarkCase } from "../src/benchmark/scoring.js";
import type { SourceClass } from "../src/domain/schemas.js";

async function chimeFixture(): Promise<BenchmarkCompiledCase> {
  return developmentFixture("dev-fintech-chime-2025");
}

async function developmentFixture(caseId: string): Promise<BenchmarkCompiledCase> {
  const compiledCases = await compileBenchmarkCases({ partitions: ["development"] });
  const compiledCase = compiledCases.find(
    (candidate) => candidate.caseId === caseId
  );

  if (compiledCase === undefined || compiledCase.scorerReference.kind !== "scored") {
    throw new Error(`Expected ${caseId} to be a scored fixture`);
  }

  return compiledCase;
}

function scoredAnnotation(compiledCase: BenchmarkCompiledCase): BenchmarkAnnotation {
  if (compiledCase.scorerReference.kind !== "scored") {
    throw new Error("Expected a scored compiled case");
  }

  return compiledCase.scorerReference.annotation;
}

function observableClaim(
  annotation: BenchmarkAnnotation,
  claimId: string
): BenchmarkExpectedObservableClaim {
  const claim = annotation.observableClaims.find((candidate) => candidate.id === claimId);

  if (claim === undefined) {
    throw new Error(`Missing observable claim ${claimId}`);
  }

  return claim;
}

function binaryClaim(
  annotation: BenchmarkAnnotation,
  claimId: string
): BenchmarkExpectedBinaryClaim {
  const claim = annotation.binaryClaims.find((candidate) => candidate.id === claimId);

  if (claim === undefined) {
    throw new Error(`Missing binary claim ${claimId}`);
  }

  return claim;
}

function evidenceId(claim: {
  readonly id: string;
  readonly evidenceIds: readonly string[];
}): string {
  const firstEvidenceId = claim.evidenceIds[0];

  if (firstEvidenceId === undefined) {
    throw new Error(`Expected ${claim.id} to cite evidence`);
  }

  return firstEvidenceId;
}

function otherEvidenceId(
  compiledCase: BenchmarkCompiledCase,
  excludedEvidenceId: string
): string {
  const otherEvidenceRecord = compiledCase.runnerInput.evidenceLedger.evidence.find(
    (record) => record.id !== excludedEvidenceId
  );

  if (otherEvidenceRecord === undefined) {
    throw new Error("Expected at least two cutoff-visible evidence records");
  }

  return otherEvidenceRecord.id;
}

function evidenceIdForSourceClass(
  compiledCase: BenchmarkCompiledCase,
  sourceClass: SourceClass
): string {
  const evidenceRecord = compiledCase.runnerInput.evidenceLedger.evidence.find(
    (record) => record.sourceClass === sourceClass
  );

  if (evidenceRecord === undefined) {
    throw new Error(`Expected source class ${sourceClass}`);
  }

  return evidenceRecord.id;
}

function firstPostCutoffEvidenceId(compiledCase: BenchmarkCompiledCase): string {
  const excludedRecord = compiledCase.runnerInput.evidenceLedger.excludedRecords[0];

  if (excludedRecord === undefined) {
    throw new Error("Expected a post-cutoff excluded evidence record");
  }

  return excludedRecord.recordId;
}

function emittedObservable(
  claim: BenchmarkExpectedObservableClaim,
  options: {
    readonly id: string;
    readonly evidenceId?: string;
    readonly value?: BenchmarkExpectedObservableClaim["expectedValue"];
    readonly citations?: BenchmarkEmittedClaim["citations"];
  }
): BenchmarkEmittedClaim {
  return {
    id: options.id,
    kind: "observable",
    statement: claim.statement,
    value: options.value ?? claim.expectedValue,
    ...(claim.unit !== undefined ? { unit: claim.unit } : {}),
    ...(claim.period !== undefined ? { period: claim.period } : {}),
    citations: options.citations ?? [
      {
        evidenceId: options.evidenceId ?? evidenceId(claim)
      }
    ]
  };
}

function emittedBinary(
  claim: BenchmarkExpectedBinaryClaim,
  options: {
    readonly id: string;
    readonly evidenceId?: string;
    readonly value?: boolean;
    readonly citations?: BenchmarkEmittedClaim["citations"];
  }
): BenchmarkEmittedClaim {
  return {
    id: options.id,
    kind: "binary",
    statement: claim.statement,
    value: options.value ?? claim.expectedValue,
    citations: options.citations ?? [
      {
        evidenceId: options.evidenceId ?? evidenceId(claim)
      }
    ]
  };
}

function runnerOutput(
  compiledCase: BenchmarkCompiledCase,
  claims: readonly BenchmarkEmittedClaim[],
  options: {
    readonly route?: BenchmarkNormalizedRunnerOutput["route"];
    readonly abstentions?: BenchmarkNormalizedRunnerOutput["abstentions"];
    readonly valuations?: BenchmarkNormalizedRunnerOutput["valuations"];
    readonly rawMarkdown?: string;
  } = {}
): BenchmarkRunnerOutput {
  return benchmarkRunnerOutputSchema.parse({
    schemaVersion: "trace.benchmark-runner-output.v1",
    runnerName: "baseline-a",
    runId: "scoring-test-run",
    caseId: compiledCase.caseId,
    partition: compiledCase.partition,
    status: "completed",
    timing: {
      schemaVersion: "trace.benchmark-timing.v1",
      startedAt: "2026-07-26T00:00:00.000Z",
      completedAt: "2026-07-26T00:00:01.000Z",
      durationMs: 1000
    },
    rawOutput: {
      markdown: options.rawMarkdown ?? "# Scoring fixture\n"
    },
    normalized: {
      claims,
      route: options.route ?? {
        status: "omitted"
      },
      abstentions: options.abstentions ?? [],
      valuations: options.valuations ?? []
    },
    failures: []
  });
}

function scoreClaims(
  compiledCase: BenchmarkCompiledCase,
  claims: readonly BenchmarkEmittedClaim[],
  options: Parameters<typeof runnerOutput>[2] = {}
): {
  readonly claimScores: readonly BenchmarkClaimScore[];
  readonly caseScore: BenchmarkCaseScoreOutput;
} {
  const scorerInput = createBenchmarkScorerInput({
    compiledCase,
    runnerOutput: runnerOutput(compiledCase, claims, options)
  });
  const score = scoreBenchmarkCase(scorerInput);

  expect(benchmarkPerClaimScoreOutputSchema.parse(score.perClaimScore)).toEqual(
    score.perClaimScore
  );
  expect(benchmarkCaseScoreOutputSchema.parse(score.caseScore)).toEqual(score.caseScore);

  return {
    claimScores: score.perClaimScore.claims,
    caseScore: score.caseScore
  };
}

function denominatorClaimScores(
  claimScores: readonly BenchmarkClaimScore[]
): readonly BenchmarkClaimScore[] {
  return claimScores.filter((claimScore) => claimScore.denominatorIncluded);
}

function claimScoreByExpectedId(
  claimScores: readonly BenchmarkClaimScore[],
  expectedClaimId: string
): BenchmarkClaimScore {
  const claimScore = denominatorClaimScores(claimScores).find(
    (candidate) => candidate.expectedClaimId === expectedClaimId
  );

  if (claimScore === undefined) {
    throw new Error(`Missing score for expected claim ${expectedClaimId}`);
  }

  return claimScore;
}

function metric(
  caseScore: BenchmarkCaseScoreOutput,
  metricId: string
): BenchmarkMetricScore {
  const scoreMetric = caseScore.metrics.find((candidate) => candidate.metricId === metricId);

  if (scoreMetric === undefined) {
    throw new Error(`Missing metric ${metricId}`);
  }

  return scoreMetric;
}

function withEvidenceSourceClass(
  compiledCase: BenchmarkCompiledCase,
  targetEvidenceId: string,
  sourceClass: SourceClass
): BenchmarkCompiledCase {
  return {
    ...compiledCase,
    runnerInput: {
      ...compiledCase.runnerInput,
      evidenceLedger: {
        ...compiledCase.runnerInput.evidenceLedger,
        evidence: compiledCase.runnerInput.evidenceLedger.evidence.map((record) =>
          record.id === targetEvidenceId
            ? {
                ...record,
                sourceClass
              }
            : record
        )
      }
    }
  };
}

describe("benchmark claim, citation, and source-quality scoring", () => {
  it("scores supported binary and observable claims while preserving IDs and values", async () => {
    const compiledCase = await chimeFixture();
    const annotation = scoredAnnotation(compiledCase);
    const binary = binaryClaim(annotation, "chime-s1-filed-by-cutoff");
    const observable = observableClaim(annotation, "chime-q1-2025-active-members");
    const { claimScores, caseScore } = scoreClaims(compiledCase, [
      emittedBinary(binary, { id: "emitted-binary-supported" }),
      emittedObservable(observable, { id: "emitted-observable-supported" })
    ]);
    const denominatorScores = denominatorClaimScores(claimScores);

    expect(denominatorScores.map((claimScore) => claimScore.supportStatus)).toEqual([
      "supported",
      "supported"
    ]);
    expect(claimScoreByExpectedId(claimScores, binary.id)).toMatchObject({
      claimId: binary.id,
      emittedClaimId: "emitted-binary-supported",
      expectedValue: true,
      emittedValue: true,
      expectedEvidenceIds: binary.evidenceIds,
      emittedEvidenceIds: [evidenceId(binary)]
    });
    expect(claimScoreByExpectedId(claimScores, observable.id)).toMatchObject({
      claimId: observable.id,
      emittedClaimId: "emitted-observable-supported",
      expectedValue: observable.expectedValue,
      emittedValue: observable.expectedValue,
      expectedUnit: observable.unit,
      emittedUnit: observable.unit
    });
    expect(metric(caseScore, "evidence-supported-claim-precision")).toMatchObject({
      status: "scored",
      value: 1,
      numerator: 2,
      denominator: 2
    });
    expect(metric(caseScore, "citation-validity")).toMatchObject({
      value: 1,
      numerator: 2,
      denominator: 2
    });
  });

  it("scores a value-mismatched material claim as unsupported", async () => {
    const compiledCase = await chimeFixture();
    const observable = observableClaim(
      scoredAnnotation(compiledCase),
      "chime-q1-2025-active-members"
    );
    const { claimScores, caseScore } = scoreClaims(compiledCase, [
      emittedObservable(observable, {
        id: "emitted-wrong-value",
        value: 9.1
      })
    ]);
    const claimScore = claimScoreByExpectedId(claimScores, observable.id);

    expect(claimScore.supportStatus).toBe("unsupported");
    expect(claimScore).toMatchObject({
      expectedValue: 8.6,
      emittedValue: 9.1,
      denominatorIncluded: true,
      denominatorReasons: ["unsupported"]
    });
    expect(metric(caseScore, "evidence-supported-claim-precision")).toMatchObject({
      value: 0,
      numerator: 0,
      denominator: 1
    });
  });

  it("keeps missing-citation material claims in the denominator", async () => {
    const compiledCase = await chimeFixture();
    const observable = observableClaim(
      scoredAnnotation(compiledCase),
      "chime-q1-2025-purchase-volume"
    );
    const { claimScores, caseScore } = scoreClaims(compiledCase, [
      emittedObservable(observable, {
        id: "emitted-uncited",
        citations: []
      })
    ]);
    const claimScore = claimScoreByExpectedId(claimScores, observable.id);

    expect(claimScore.supportStatus).toBe("uncited");
    expect(claimScore.citationScores).toEqual([]);
    expect(metric(caseScore, "citation-validity")).toMatchObject({
      value: 0,
      numerator: 0,
      denominator: 1
    });
  });

  it("scores wrong-source citations as citation mismatches", async () => {
    const compiledCase = await chimeFixture();
    const observable = observableClaim(
      scoredAnnotation(compiledCase),
      "chime-2024-net-loss"
    );
    const wrongEvidenceId = otherEvidenceId(compiledCase, evidenceId(observable));
    const { claimScores, caseScore } = scoreClaims(compiledCase, [
      emittedObservable(observable, {
        id: "emitted-wrong-source",
        evidenceId: wrongEvidenceId
      })
    ]);
    const claimScore = claimScoreByExpectedId(claimScores, observable.id);
    const citationScore = claimScore.citationScores[0];

    expect(claimScore.supportStatus).toBe("citation-mismatched");
    expect(citationScore).toMatchObject({
      evidenceId: wrongEvidenceId,
      evidenceIdExists: true,
      retrievable: true,
      supportsEntity: false,
      valid: false
    });
    expect(metric(caseScore, "evidence-supported-claim-precision")).toMatchObject({
      value: 0,
      numerator: 0,
      denominator: 1
    });
  });

  it("scores post-cutoff cited evidence as a denominator item", async () => {
    const compiledCase = await chimeFixture();
    const binary = binaryClaim(scoredAnnotation(compiledCase), "chime-s1-filed-by-cutoff");
    const postCutoffEvidenceId = firstPostCutoffEvidenceId(compiledCase);
    const { claimScores } = scoreClaims(compiledCase, [
      emittedBinary(binary, {
        id: "emitted-post-cutoff",
        evidenceId: postCutoffEvidenceId
      })
    ]);
    const claimScore = claimScoreByExpectedId(claimScores, binary.id);
    const citationScore = claimScore.citationScores[0];

    expect(claimScore.supportStatus).toBe("post-cutoff");
    expect(citationScore).toMatchObject({
      evidenceId: postCutoffEvidenceId,
      evidenceIdExists: true,
      retrievable: false,
      cutoffCompliant: false,
      valid: false
    });
  });

  it("weights source quality by committed source class", async () => {
    const compiledCase = await chimeFixture();
    const observable = observableClaim(
      scoredAnnotation(compiledCase),
      "chime-q1-2025-active-members"
    );
    const regulatoryScore = scoreClaims(compiledCase, [
      emittedObservable(observable, { id: "emitted-regulatory-source" })
    ]);
    const newsCase = withEvidenceSourceClass(compiledCase, evidenceId(observable), "news");
    const newsScore = scoreClaims(newsCase, [
      emittedObservable(observable, { id: "emitted-news-source" })
    ]);
    const regulatorySourceQuality = metric(regulatoryScore.caseScore, "source-quality");
    const newsSourceQuality = metric(newsScore.caseScore, "source-quality");

    expect(
      claimScoreByExpectedId(regulatoryScore.claimScores, observable.id).sourceQuality
    ).toMatchObject({
      score: 0.95,
      citedSourceClasses: ["regulatory-filing"],
      citedSourceQualityCategories: ["regulatory"]
    });
    expect(claimScoreByExpectedId(newsScore.claimScores, observable.id).sourceQuality).toMatchObject({
      score: 0.58,
      citedSourceClasses: ["news"],
      citedSourceQualityCategories: ["news"]
    });
    expect(regulatorySourceQuality.value).toBeGreaterThan(newsSourceQuality.value ?? 0);
  });

  it("counts unsupported, uncited, wrong-source, post-cutoff, and non-retrievable claims in the denominator", async () => {
    const compiledCase = await chimeFixture();
    const annotation = scoredAnnotation(compiledCase);
    const activeMembers = observableClaim(annotation, "chime-q1-2025-active-members");
    const purchaseVolume = observableClaim(annotation, "chime-q1-2025-purchase-volume");
    const netLoss = observableClaim(annotation, "chime-2024-net-loss");
    const s1Filed = binaryClaim(annotation, "chime-s1-filed-by-cutoff");
    const bankCharter = binaryClaim(annotation, "chime-bank-charter");
    const { claimScores, caseScore } = scoreClaims(compiledCase, [
      emittedObservable(activeMembers, { id: "denominator-supported" }),
      emittedObservable(activeMembers, {
        id: "denominator-unsupported",
        value: 9.1
      }),
      emittedObservable(purchaseVolume, {
        id: "denominator-uncited",
        citations: []
      }),
      emittedObservable(netLoss, {
        id: "denominator-wrong-source",
        evidenceId: otherEvidenceId(compiledCase, evidenceId(netLoss))
      }),
      emittedBinary(s1Filed, {
        id: "denominator-post-cutoff",
        evidenceId: firstPostCutoffEvidenceId(compiledCase)
      }),
      emittedBinary(bankCharter, {
        id: "denominator-non-retrievable",
        evidenceId: "missing-evidence-id"
      })
    ]);
    const denominatorScores = denominatorClaimScores(claimScores);

    expect(denominatorScores.map((claimScore) => claimScore.supportStatus).sort()).toEqual([
      "citation-mismatched",
      "non-retrievable",
      "post-cutoff",
      "supported",
      "uncited",
      "unsupported"
    ]);
    expect(metric(caseScore, "evidence-supported-claim-precision")).toMatchObject({
      value: 0.166667,
      numerator: 1,
      denominator: 6
    });
    expect(metric(caseScore, "citation-validity")).toMatchObject({
      numerator: 1,
      denominator: 6
    });
  });

  it("scores route accuracy and expected abstention behavior", async () => {
    const compiledCase = await chimeFixture();
    const annotation = scoredAnnotation(compiledCase);
    const { caseScore } = scoreClaims(compiledCase, [], {
      route: {
        status: "selected",
        selectedRoute: annotation.expectedRoute.route,
        rationale: annotation.expectedRoute.rationale,
        evidenceIds: annotation.expectedRoute.evidenceIds
      },
      abstentions: annotation.expectedAbstentions.map((abstention) => ({
        id: `emitted-${abstention.id}`,
        field: abstention.field,
        reasonCode: abstention.reasonCode,
        explanation: abstention.description,
        evidenceIds: abstention.evidenceIds
      }))
    });

    expect(metric(caseScore, "route-accuracy")).toMatchObject({
      status: "scored",
      value: 1,
      numerator: 3,
      denominator: 3
    });
    expect(metric(caseScore, "abstention-behavior")).toMatchObject({
      status: "scored",
      value: 1,
      numerator: 2,
      denominator: 2
    });
  });

  it("detects valuation field conflation", async () => {
    const compiledCase = await developmentFixture("dev-saas-figma-2022");
    const annotation = scoredAnnotation(compiledCase);
    const headlineEvidenceId = evidenceId(
      observableClaim(annotation, "figma-series-e-headline-valuation")
    );
    const { caseScore } = scoreClaims(compiledCase, [], {
      valuations: [
        {
          field: "headline-valuation",
          status: "concluded",
          value: 10,
          unit: "USD billions headline valuation",
          rationale: "Series E headline valuation only.",
          evidenceIds: [headlineEvidenceId]
        },
        {
          field: "enterprise-value",
          status: "concluded",
          value: 10,
          unit: "USD billions headline valuation",
          rationale: "Incorrectly reused the headline valuation as enterprise value.",
          evidenceIds: [headlineEvidenceId]
        }
      ]
    });

    expect(metric(caseScore, "valuation-separation")).toMatchObject({
      status: "scored",
      value: 0,
      numerator: 0,
      denominator: 1
    });
    expect(metric(caseScore, "valuation-separation").notes.join("\n")).toContain(
      "enterprise-value"
    );
  });

  it("skips historical valuation error when the annotation marks the case ineligible", async () => {
    const compiledCase = await developmentFixture("dev-saas-figma-2022");
    const { caseScore } = scoreClaims(compiledCase, []);
    const historicalMetric = metric(caseScore, "historical-valuation-error");

    expect(historicalMetric).toMatchObject({
      status: "skipped",
      numerator: 0,
      denominator: 0
    });
    expect(historicalMetric.notes.join("\n")).toContain("ineligible");
  });

  it("scores historical valuation error only against valid annotated numeric targets", async () => {
    const compiledCase = await chimeFixture();
    const annotation = scoredAnnotation(compiledCase);

    if (!annotation.historicalValuationTargets.eligible) {
      throw new Error("Expected Chime to be historical-valuation eligible");
    }

    const target = annotation.historicalValuationTargets.targets[0];

    if (target === undefined || typeof target.expectedValue !== "number") {
      throw new Error("Expected Chime to have a numeric historical valuation target");
    }

    const { caseScore } = scoreClaims(compiledCase, [
      {
        id: `emitted-${target.id}`,
        kind: "valuation",
        statement: `${target.id} ${target.eligibleField} ${target.targetKind}`,
        value: target.expectedValue * 0.9,
        unit: target.unit,
        citations: []
      }
    ]);

    expect(metric(caseScore, "historical-valuation-error")).toMatchObject({
      status: "scored",
      value: 0.9,
      numerator: 0.9,
      denominator: 1
    });
  });

  it("scores completeness from required topics and cited evidence classes", async () => {
    const compiledCase = await chimeFixture();
    const annotation = scoredAnnotation(compiledCase);
    const s1Filed = binaryClaim(annotation, "chime-s1-filed-by-cutoff");
    const ipoPriceKnown = binaryClaim(annotation, "chime-ipo-price-known-at-cutoff");
    const { caseScore } = scoreClaims(
      compiledCase,
      [
        emittedBinary(s1Filed, {
          id: "completeness-regulatory-source",
          evidenceId: evidenceIdForSourceClass(compiledCase, "regulatory-filing")
        }),
        emittedBinary(ipoPriceKnown, {
          id: "completeness-company-source",
          evidenceId: evidenceIdForSourceClass(compiledCase, "company-primary")
        })
      ],
      {
        rawMarkdown: [
          "# Chime",
          "identity financial-services route member metrics cutoff abstention"
        ].join("\n")
      }
    );

    expect(metric(caseScore, "completeness")).toMatchObject({
      status: "scored",
      value: 1,
      numerator: 1,
      denominator: 1
    });
  });
});
