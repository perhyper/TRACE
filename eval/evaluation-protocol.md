# TRACE evaluation protocol v0.2

Protocol status: frozen for the internal product-validation benchmark on
2026-07-26. This protocol governs local TRACE engineering evaluation only. It
does not claim official contest compliance because official contest rules,
rubrics, submission formats, and execution constraints have not been supplied.

## Decision context

Primary user: a VC analyst conducting an initial private-company screen.

Primary question: does TRACE produce material claims whose cited evidence
actually supports the entity, value, period, unit, and wording of the claim?

## Benchmark authority

The frozen internal benchmark is identified by
`trace-internal-benchmark-lock-2026-07-26-v1` in
`eval/benchmark-manifest.json`.

The benchmark contains one non-scored Revolut demo case and exactly 12 scored
real-public-data cases. The scored cases are split into six development cases
and six locked-test cases. Across the 12 scored cases, the manifest enforces
four `rich`, four `medium`, and four `sparse` data tiers, with coverage across
`financial-services`, `software-saas`, and `biotech-rnpv`. Every scored case
has an outcome context of `success`, `failure`, `stagnant`, or `ongoing`, plus
an explicit historical valuation-error eligibility decision.

The internal benchmark can be valid for local product validation while every
official contest item remains unverified. Missing official materials must not
be filled in by inference. TRACE must not present benchmark output as contest
readiness, contest compliance, benchmark superiority, investment advice, or an
appraisal.

## Preregistered hypotheses

- H1: TRACE improves evidence-supported claim precision over a general-summary
  baseline given the same evidence bundle and cutoff.
- H2: the route and sufficiency gate improve method appropriateness and safe
  abstention over a fixed-template baseline.
- H3: deterministic validation and adversarial review reduce unsupported
  claims and numerical inconsistencies.
- H4: three runs over identical structured input agree on entity, route,
  material facts, abstention state, and deterministic value ranges.

These hypotheses are local engineering hypotheses. They do not imply official
contest scoring alignment or superiority.

## Primary metric

`evidence-supported claim precision` =

`supported material claims / all material claims emitted`

A material claim can change company identity, market position, a valuation
input or result, a risk, an investment thesis, or a diligence decision.

A claim is supported only when a reviewer can answer yes to every applicable
item:

1. The cited evidence exists and is retrievable from the run ledger.
2. It refers to the resolved legal entity or the relationship is explicit.
3. It entails the claim without adding an unsupported causal or comparative
   assertion.
4. Its date/period is at or before the cutoff and matches the claim.
5. Numeric unit, currency, scale, and observed/calculated/assumed status match.
6. A company-originated assertion is labelled as such.

Unsupported, uncited, citation-mismatched, post-cutoff, and non-retrievable
material claims all remain in the denominator. Duplicate wording of the same
claim is counted once.

## Secondary metrics

- `citation-validity`: valid claim citations divided by citation denominator
  items, with uncited material claims still counted.
- `source-quality`: weighted quality of cited source classes, distinguishing
  audited, regulatory, government, legal, company-originated, market-data,
  news, expert, peer-reviewed, commercial, and other sources.
- `route-accuracy`: selected or abstained route, rationale coverage, and
  cutoff-visible route evidence against the annotation.
- `abstention-behavior`: expected valuation abstentions, reason-code or
  explanation coverage, and expected evidence coverage.
- `valuation-separation`: headline valuation, enterprise value, total equity
  value, and security-level fair value remain distinct fields and are not
  concluded without annotation permission.
- `historical-valuation-error`: scored only for cases with valid scalar
  historical valuation targets; ineligible cases are skipped with their stated
  reason.
- `completeness`: annotated topic coverage plus cited evidence-class coverage.
- `reproducibility`: scored only when repeated runner/case outputs are
  available. A once-only locked-test run is skipped for reproducibility rather
  than rerun for that metric.
- `completion-status`, `duration`, and `failure-records`: runner completion,
  deterministic timing score, and preserved failure accounting.

## Comparisons

- Baseline A: general narrative synthesis from the same evidence bundle.
- Baseline B: fixed report template with no route, sufficiency gate, or
  adversarial review.
- TRACE Full: structured ledger, sufficiency gate, route, deterministic
  calculations, reviewer, and report composer.

Evidence, cutoff, target identity, measurement date, and available structured
context must be identical where the runner contract permits. Baselines may not
receive intentionally weaker inputs.

## Artifacts

Benchmark artifacts are stored under:

- Manifest: `eval/benchmark-manifest.json`
- Freeze record: `eval/benchmark/freeze.json`
- Change-control log: `eval/benchmark/change-control.md`
- Evidence fixtures:
  `fixtures/evidence/benchmark/{development,locked-test}/`
- Annotations: `eval/benchmark/annotations/{development,locked-test}/`
- Development run:
  `eval/benchmark/runs/development/run-dev-generalization-v1/`
- Locked-test run:
  `eval/benchmark/runs/locked-test/run-locked-test-v1/`

Each runner/case directory contains raw runner output JSON and Markdown,
normalized scorer input, per-claim score, case score, failure record, and
timing metadata. Each run directory contains aggregate JSON, CSV, and Markdown.
Aggregate tables must be regenerated from committed per-case scorer inputs and
case scores and must match the committed aggregate files before a result is
reported as locally reproducible.

## Frozen results and hypothesis disposition

The development run `run-dev-generalization-v1` was the final permitted
pre-freeze tuning run. TRACE Full scored `0.303571` claim precision,
`0.925926` route accuracy, `1` abstention behavior, and `0.895833`
completeness. Both baselines had the same `0.303571` claim precision, zero
route accuracy, and zero abstention behavior.

The authoritative locked-test run `run-locked-test-v1` produced:

| Runner | Claim precision | Citation validity | Route accuracy | Abstention behavior | Completeness | Completion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Baseline A | 0.283019 | 0.283019 | 0 | 0 | 0.75 | 1 |
| Baseline B | 0.283019 | 0.283019 | 0 | 0 | 0.729167 | 1 |
| TRACE Full | 0.283019 | 0.283019 | 0.657407 | 0.708333 | 0.916667 | 1 |

All three runners scored `1` for valuation separation. Historical valuation
error was `0` where scored because no comparable emitted valuation was
available; most cases were ineligible or lacked a valid scalar target.
Reproducibility was skipped because the locked partition was intentionally run
once. All 18 runner/case executions completed with empty failure records and no
retry.

Hypothesis disposition:

- H1 is not supported: TRACE Full tied both baselines on the frozen primary
  claim-precision metric in development and locked-test partitions.
- H2 is supported on the registered secondary measures: TRACE Full exceeded
  both baselines on locked route accuracy, abstention behavior, and
  completeness.
- H3 is not established by this benchmark: valuation separation held, but
  claim precision and citation validity did not improve over the baselines.
- H4 was not tested on the locked partition because the once-only policy takes
  precedence over a repeated-run reproducibility score.

The locked weaknesses remain visible in the committed case scores: one route
abstention, one software case selected as `recent-transaction`, and
route-specific or post-cutoff abstention-reason mismatches. No source, fixture,
annotation, runner, scorer, weight, aggregate-format, or manifest change was
made from those results.

## Source, cutoff, and redistribution audit

Every case has a source audit in the manifest. The audit records approved
public source categories, cutoff date, known post-cutoff leakage risks,
redistribution status, raw document policy, and whether only URLs and short
excerpts may be committed.

Evidence published after the cutoff is excluded from runner inputs. It may be
recorded only as an explicit warning, excluded record, or gold-only historical
target when the annotation contract permits it. Search snippets are never
evidence.

Redistribution statuses are interpreted as follows:

- `public-urls-redistribution-not-established`: commit URLs, retrieval
  metadata, hashes when available, and short excerpts only.
- `public-domain`: redistribution rights are established as public domain.
- `redistribution-permitted`: source terms permit redistribution.
- `licensed-for-redistribution`: a license permits redistribution.
- `redistribution-prohibited`: do not commit source content beyond allowed
  metadata or short excerpts.

Raw PDFs, cached source documents, secrets, scratch downloads, deployment
files, remote configuration changes, and external-account artifacts must stay
out of Git.

## Leakage and change control

The manifest lock came before benchmark scores or per-case benchmark outputs.
Development results could drive code, fixture, and scoring fixes before the
freeze, but every such change had to be recorded in
`eval/benchmark/change-control.md`.

The freeze record `trace-internal-benchmark-freeze-2026-07-26-v1` records the
manifest lock ID, development run ID, runner versions, scorer versions,
fixture and annotation hashes, command templates, environment assumptions, and
allowed volatile fields. After the freeze, locked-test results may not drive
changes to source, fixtures, annotations, runner behavior, scoring config,
weights, aggregate format, or manifest membership.

An authoritative locked-test run must pass freeze validation before runner
execution. A locked-test run with mismatched frozen hashes is allowed only in
explicit exploratory mode and is non-authoritative. Technical retries preserve
the failed run and do not silently replace it.

## Historical valuation-error eligibility

Historical valuation-error scoring is case-specific. Eligible cases list the
exact annotated fields that can be compared to a public historical outcome.
The target must be scalar, numeric, unit-aligned, and supported by valid target
evidence under the annotation's source-availability label. If no valid target
exists, or if the manifest marks the case ineligible, the metric is skipped
with the recorded reason. Headline transaction valuation, enterprise value,
total equity value, and security-level fair value must never be substituted for
one another.

## Local verification

The required local checks are:

```bash
npm run trace -- validate-benchmark-manifest --manifest eval/benchmark-manifest.json
npm run trace -- validate-benchmark-freeze --freeze eval/benchmark/freeze.json --manifest eval/benchmark-manifest.json
npm run check
```

Development artifacts can be reproduced with:

```bash
npm run trace -- benchmark --partition development --runner all --out eval/benchmark/runs --run-id run-dev-generalization-v1
git diff --exit-code -- eval/benchmark/runs/development/run-dev-generalization-v1
```

The locked-test artifact to inspect is:

```bash
eval/benchmark/runs/locked-test/run-locked-test-v1/
```

Do not infer official contest compliance from any local check.
