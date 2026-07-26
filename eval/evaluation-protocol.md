# TRACE evaluation protocol v0.1

Protocol status: frozen for the first vertical slice on 2026-07-26. The
company-level locked test manifest is not frozen; see the documented blockers
below.

## Decision context

Primary user: a VC analyst conducting an initial private-company screen.

Primary question: does TRACE produce material claims whose cited evidence
actually supports the entity, value, period, unit, and wording of the claim?

## Preregistered hypotheses

- H1: TRACE improves evidence-supported claim precision over a general-summary
  baseline given the same evidence bundle and cutoff.
- H2: the route and sufficiency gate improve method appropriateness and safe
  abstention over a fixed-template baseline.
- H3: deterministic validation and adversarial review reduce unsupported
  claims and numerical inconsistencies.
- H4: three runs over identical structured input agree on entity, route,
  material facts, abstention state, and deterministic value ranges.

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

Unsupported, uncited, and citation-mismatched material claims all remain in the
denominator. Duplicate wording of the same claim is counted once.

## Secondary metrics

- citation validity and retrievability
- primary/official source share
- contradiction detection recall on seeded fixtures
- arithmetic and normalization test pass rate
- route and abstention rubric accuracy
- EV/equity/headline-value confusion count
- required report-section coverage
- route, fact, and result agreement across three identical runs
- end-to-end completion rate, duration, and recorded failures

## Comparisons

- Baseline A: general narrative synthesis from the same evidence bundle
- Baseline B: fixed report template with no route, sufficiency gate, or
  adversarial review
- TRACE Full: structured ledger, sufficiency gate, route, deterministic
  calculations, reviewer, and report composer

Prompts, evidence, cutoff, and available context must be identical where the
system contract permits. Baselines may not receive intentionally weaker
instructions.

## First-slice pass criteria

- 100% schema and deterministic calculation tests pass.
- No material numeric claim lacks an evidence or assumption ID.
- The route is `financial-services` for the Revolut fixture.
- The result keeps the USD 75 billion headline separate from enterprise value
  and security-level fair value.
- Missing share rights/cap table cause a security-level abstention.
- Markdown and JSON represent the same values and limitations.
- Three identical structured-input runs produce byte-identical JSON after
  excluding run timestamp and duration.

These are engineering gates, not claims of statistical superiority.

## Leakage and change control

- Evidence published after a case cutoff is excluded from model inputs.
- Search snippets are never evidence.
- Development and demo cases may drive code changes; locked-test outputs may
  not.
- Any post-lock change records the trigger, files, expected effect, and whether
  results are exploratory.
- Technical retries preserve the failed run and do not silently replace it.

## Manifest lock blockers

The full company manifest is not frozen because official contest constraints
are absent and candidate source/cutoff rights have not been audited. A locked
manifest must contain at least three industries and rich/medium/sparse cases,
but its final size will follow the official runtime and scoring constraints
rather than the brief's unverified 12–18 recommendation.

