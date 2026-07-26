# TRACE

TRACE is an evidence-first agent for screening private companies. It resolves
the company and measurement date, records public evidence in a structured
ledger, chooses an analysis route from data sufficiency and company
characteristics, and produces a reviewable Markdown and JSON result.

The current local evaluation surface has two parts: a non-scored Revolut demo
slice and a frozen internal product-validation benchmark. The benchmark is an
internal engineering artifact, not an official contest submission or compliance
claim.

TRACE is decision support, not an appraisal or investment recommendation. A
reported transaction value is a calibration input and is not automatically a
fair-value conclusion.

## Status

- Research policy and the first evaluation protocol are recorded under
  `references/` and `eval/`.
- The internal benchmark manifest is frozen as
  `trace-internal-benchmark-lock-2026-07-26-v1`: one non-scored Revolut demo
  case plus 12 scored cases split into six development and six locked-test
  cases.
- The authoritative locked-test artifact is
  `eval/benchmark/runs/locked-test/run-locked-test-v1/`. Locked-test results
  must not drive source, fixture, runner, scoring, weight, or manifest changes.
- The post-v1 metric diagnosis and proposed successor design are recorded in
  `eval/benchmark/v2-design-proposal.md`; its complete design literature
  register is `references/benchmark-evaluation-literature.md`.
- Official contest rules have not been supplied. Contest-specific acceptance
  criteria remain explicitly `UNVERIFIED`.
- No remote repository or deployment is configured.
- Source PDFs, cached pages, secrets, scratch downloads, deployment files, and
  external-account artifacts must stay out of Git.

## Local Reproduction

Use Node.js 22.18 or newer. Install dependencies with:

```bash
npm ci
```

Run the complete TypeScript, lint, and test suite with:

```bash
npm run check
```

Run the Revolut first-slice fixture end to end with:

```bash
npm run trace -- analyze --input fixtures/evidence/revolut-2025-evidence-bundle.json --out /tmp/trace-revolut-first-slice
```

The committed reference artifacts are under `eval/revolut-first-slice/`. To
refresh those artifacts intentionally, use the same input with that output
directory:

```bash
npm run trace -- analyze --input fixtures/evidence/revolut-2025-evidence-bundle.json --out eval/revolut-first-slice
```

Refreshing the committed artifact directory rewrites run timestamps and
duration fields; deterministic identifiers and report conclusions should
remain stable. `tests/revolut-end-to-end.test.ts` runs the fixture in a
temporary directory and compares the generated output contract against the
committed reference artifacts.

## Internal Benchmark

Validate the frozen manifest:

```bash
npm run trace -- validate-benchmark-manifest --manifest eval/benchmark-manifest.json
```

Reproduce the committed development benchmark artifacts:

```bash
npm run trace -- benchmark --partition development --runner all --out eval/benchmark/runs --run-id run-dev-generalization-v1
git diff --exit-code -- eval/benchmark/runs/development/run-dev-generalization-v1
```

Validate the freeze boundary before inspecting or reproducing locked-test
work:

```bash
npm run trace -- validate-benchmark-freeze --freeze eval/benchmark/freeze.json --manifest eval/benchmark-manifest.json
```

The locked test was run once after the freeze. Inspect the committed locked
artifact instead of tuning from it:

```bash
sed -n '1,80p' eval/benchmark/runs/locked-test/run-locked-test-v1/aggregate-score.md
find eval/benchmark/runs/locked-test/run-locked-test-v1 -name failure-record.json -print
```

Re-running the locked-test command with `--run-id run-locked-test-v1` rewrites
the committed authoritative artifact and should be done only when explicitly
reproducing the frozen run, followed by `git diff --exit-code` over that run
directory. Any run with changed frozen hashes must use `--exploratory` and must
not be reported as the authoritative locked-test result.

## Benchmark Result Snapshot

The once-only locked-test run completed all 18 runner/case executions with no
technical failures or retries:

| Runner | Claim precision | Route accuracy | Abstention behavior | Completeness |
| --- | ---: | ---: | ---: | ---: |
| Baseline A | 0.283019 | 0 | 0 | 0.75 |
| Baseline B | 0.283019 | 0 | 0 | 0.729167 |
| TRACE Full | 0.283019 | 0.657407 | 0.708333 | 0.916667 |

TRACE did not improve the frozen primary metric, so the benchmark does not
support a claim of overall superiority. It did improve the registered route,
abstention, and completeness measures over both baselines. Remaining locked
weaknesses include one abstained route, one software case routed as a recent
transaction, and several route-specific or post-cutoff abstention-reason
mismatches. Those results are preserved without post-lock tuning.

## Benchmark Artifacts

Benchmark inputs and outputs are deliberately local and inspectable:

- Manifest: `eval/benchmark-manifest.json`
- Freeze record: `eval/benchmark/freeze.json`
- Change-control log: `eval/benchmark/change-control.md`
- Evidence fixtures:
  `fixtures/evidence/benchmark/{development,locked-test}/`
- Scoring annotations: `eval/benchmark/annotations/{development,locked-test}/`
- Run artifacts: `eval/benchmark/runs/<partition>/<run-id>/`
- Per-case files:
  `raw-runner-output.json`, `raw-runner-output.md`,
  `normalized-scorer-input.json`, `per-claim-score.json`,
  `case-score.json`, `failure-record.json`, and `timing-metadata.json`
- Aggregate files: `aggregate-score.json`, `aggregate-score.csv`, and
  `aggregate-score.md`

Aggregate tables are generated from the stored per-case scorer inputs and case
scores. A regenerated aggregate is valid only if its JSON, CSV, and Markdown
match the committed aggregate files byte-for-byte.

## Scoring Definitions

- `evidence-supported-claim-precision`: supported material binary and
  observable claims divided by all emitted material claims in the denominator.
- `citation-validity`: valid claim citations divided by citation denominator
  items, with uncited material claims still counted.
- `source-quality`: weighted quality of cited source classes such as audited,
  regulatory, government, legal, company-originated, market-data, news, expert,
  peer-reviewed, commercial, and other.
- `route-accuracy`: selected or abstained route, rationale coverage, and
  cutoff-visible route evidence.
- `abstention-behavior`: expected valuation abstentions, reason codes or
  explanation coverage, and expected evidence coverage.
- `valuation-separation`: headline valuation, enterprise value, total equity
  value, and security-level fair value must remain distinct fields.
- `historical-valuation-error`: scored only for cases whose annotations mark
  valid scalar historical valuation targets; ineligible cases are skipped.
- `completeness`: annotated topic coverage plus cited evidence-class coverage.
- `reproducibility`: scored only when repeated runner/case outputs exist;
  single authoritative locked-test outputs are skipped.
- `completion-status`, `duration`, and `failure-records`: runner completion,
  deterministic timing score, and preserved failure accounting.

## Change Control And Source Policy

The change-control log records the manifest lock, development runs,
development-informed changes, freeze, and the once-only locked-test run. After
`eval/benchmark/freeze.json`, locked-test results may not drive changes to
source, fixtures, annotations, runner behavior, scoring config, weights, or
manifest membership.

Every scored case has a source audit with approved public source classes,
cutoff date, known post-cutoff leakage risks, redistribution status, raw
document policy, and whether only URLs and short excerpts may be committed.
Evidence published after the cutoff is excluded from runner inputs and may be
recorded only as an explicit warning or gold-only target when the annotation
allows it.

Redistribution statuses mean:

- `public-urls-redistribution-not-established`: commit URLs, retrieval
  metadata, hashes when available, and short excerpts only.
- `public-domain`: redistribution rights are established as public domain.
- `redistribution-permitted`: source terms permit redistribution.
- `licensed-for-redistribution`: a license permits redistribution.
- `redistribution-prohibited`: do not commit source content beyond allowed
  metadata or short excerpts.

Historical valuation-error eligibility is case-specific. Eligible cases list
the annotated fields that can be compared to historical public outcomes.
Ineligible cases are skipped with a reason rather than forced into a valuation
denominator.
