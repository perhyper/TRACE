# TRACE benchmark v2 design proposal

Status: design proposal, not frozen  
Recorded: 2026-07-27  
Literature register: `references/benchmark-evaluation-literature.md`

This proposal is a successor to the frozen v1 internal product-validation
benchmark. It does not alter the v1 manifest, annotations, scorer, artifacts,
scores, or hypothesis disposition. A v2 benchmark requires a new manifest,
new development and locked partitions, a new freeze record, and a new
preregistration.

## Why v1 claim precision cannot identify the workflow effect

The v1 `baseline-a`, `baseline-b`, and `trace-full` runners all convert every
input `observedFact` into an emitted `observable` claim. TRACE additionally
emits sufficiency, route, valuation, and abstention information, but the v1
material-claim filter scores only `binary` and `observable` claims. The three
runners therefore present the scorer with the same material claim set for
claim precision.

The v1 scorer also treats an output claim that is absent from the partial gold
claim list as unsupported even when it accurately restates ledger evidence.
Conversely, a gold claim that a runner omits does not enter the precision
denominator. The frozen score consequently measures overlap with the partial
annotation more than the effect of claim selection, revision, deletion, or
abstention.

The correct v1 conclusion remains that H1 was not supported by the registered
metric. The additional post-hoc diagnosis is that the metric and runner
contract made the workflow effect non-identifiable. The locked result must not
be reinterpreted as evidence that TRACE and the baselines have equal factual
performance.

## Measurement target

The v2 evaluation unit is an atomic material claim extracted from the final
user-visible Markdown and JSON report. Runner-supplied normalized claim lists
are diagnostic artifacts only and cannot define the scored claim population.

An evaluation-side claim extractor must:

1. split compound statements into independently verifiable claims;
2. preserve entity, date or period, unit, currency, scale, and epistemic type;
3. decontextualize pronouns and local references without adding information;
4. cover every material assertion in the final report; and
5. be validated against a human-annotated extraction sample before it is used
   for scoring.

Claim extraction accuracy is part of evaluator validation, not an assumed
property of the benchmark.

## Claim taxonomy and support rules

Every material claim is assigned one type before correctness is judged:

| Type | Fully supported when |
| --- | --- |
| Observed fact | The cited source directly entails the claim and entity, period, unit, currency, scale, and cutoff all match. |
| Calculated fact | Every material input is supported, the transformation is disclosed, and deterministic recomputation passes. |
| Analytical inference | The cited premises support the stated inference, uncertainty is labelled, and wording adds no unsupported causal, comparative, or universal assertion. |
| Route or sufficiency decision | The decision follows the preregistered evidence requirements and cites the evidence and gaps that control the decision. |
| Valuation or abstention conclusion | The method, inputs, cutoff, units, value type, and required evidence are valid; headline, enterprise, total-equity, and security-level values remain separate. |

The adjudication labels are:

- `fully-supported`;
- `partially-supported`;
- `unsupported`;
- `contradicted`;
- `post-cutoff`;
- `unverifiable`;
- `not-material`.

Only `fully-supported` earns credit in the strict primary precision measure.
Partial support is reported separately and is not rounded up, because doing so
would reward claims whose wording exceeds their evidence. Unsupported,
contradicted, post-cutoff, unverifiable, uncited, and non-retrievable material
claims remain in the denominator.

A claim that is not present in the reference inventory is not automatically
wrong. It is judged against its cited evidence using the same rules. This lets
a system add a useful, correct finding without being penalized merely because
the annotation is incomplete.

## Materiality-weighted grounded precision

Assign materiality without seeing runner identity or correctness:

- Tier 3: valuation, route, sufficiency, identity, key risk, or
  decision-controlling conclusion;
- Tier 2: financial, operating, market, clinical, or transaction fact that can
  materially change the analysis;
- Tier 1: decision-relevant descriptive context.

Weights must be preregistered. An initial development-only candidate is
`Tier 3 = 4`, `Tier 2 = 2`, and `Tier 1 = 1`; final values must be calibrated
before the new locked partition is frozen.

For claims \(i\) with materiality weights \(w_i\):

```text
grounded_precision =
  sum(w_i * 1[fully-supported and attribution-valid and cutoff-valid])
  / sum(w_i)
```

Report the following slices as well as the overall value:

- observed facts;
- calculated facts;
- analytical inferences;
- route and sufficiency decisions;
- valuation and abstention conclusions;
- materiality tier;
- data tier and analysis route.

Macro-average across claim types and across cases so that a long report full of
easy copied facts cannot overwhelm a smaller number of decision-critical
claims.

## Precision must not stand alone

Precision alone rewards silence. Each case therefore needs a human-curated
reference inventory of `must-cover` and `should-cover` facts, calculations,
risks, conflicts, and decisions, each with evidence spans and materiality.

```text
critical_recall =
  sum(reference_weight_j * 1[reference item j is covered and fully supported])
  / sum(reference_weight_j)
```

The recommended primary presentation is:

1. case-macro grounded precision at a preregistered critical-recall floor;
2. case-macro critical recall;
3. grounded F1 as a compact secondary summary; and
4. a risk-coverage curve for systems that can abstain.

This avoids hiding the safety/coverage tradeoff inside an arbitrary beta
choice. A critical unsupported-claim rate is a separate guardrail: one
unsupported Tier 3 valuation, entity, date, or unit claim must remain visible
even when aggregate precision is high.

## Citation and provenance measures

Do not collapse all source behavior into claim precision. Record these
dimensions independently:

- citation coverage: every material claim has an attribution;
- retrievability: the cited record or URL can be opened from the preserved
  run evidence;
- source relevance: the cited passage concerns the claim;
- factual support: the passage entails the claim;
- source authority: the source class is appropriate for the assertion;
- temporal validity: publication and fact dates comply with the cutoff;
- numeric provenance: inputs, units, currencies, and transformations are
  traceable.

A working link is not evidence that the source supports the claim, and an
authoritative source is not evidence that the particular attribution is
correct.

## Control arms

| Arm | Purpose | Competitive? |
| --- | --- | --- |
| Ledger echo | Confirms compiler/scorer plumbing by rendering known ledger facts. | No; sanity control only. |
| Direct LLM | Same model receives the same evidence, cutoff, task, and total budget in a one-pass cited-report prompt. | Yes; user-relevant baseline. |
| Structured baseline | Same model, evidence, output schema, and report sections as TRACE, but no sufficiency/route gate, deterministic validator, or adversarial reviewer. | Yes; primary causal baseline. |
| TRACE Full | Complete workflow. | Yes; treatment arm. |
| TRACE minus reviewer | Removes only adversarial review. | Ablation. |
| TRACE minus sufficiency/route gate | Removes only evidence gating, route selection, and safe abstention. | Ablation. |
| TRACE minus deterministic validation | Removes only entity/cutoff/unit/calculation validation. | Ablation. |
| Oracle-evidence report | Receives a human-selected sufficient evidence set to estimate the remaining generation ceiling. | Optional upper-bound diagnostic. |

The primary workflow contrast is `TRACE Full - Structured baseline`. Component
claims come from paired comparisons between TRACE Full and the corresponding
single-component ablation. Ledger echo must never again be presented as a
performance baseline.

## Separating workflow effects from model effects

Use two stages:

1. **Causal stage:** fix model family, exact model version, temperature,
   evidence, cutoff, tool availability, and total token/search budget across
   competitive arms. This estimates the workflow effect for one model.
2. **Robustness stage:** cross the same workflow arms with at least two
   materially different model families or capability tiers. Estimate both the
   workflow main effect and the `workflow × model` interaction.

For each case, compare arms on the same input and preregister repeated seeds
when generation is stochastic. A consistent paired lift across models supports
a workflow-general claim. A lift confined to one model must be reported as
model-dependent.

Record actual input, output, search, latency, and cost usage. If equal-budget
and unconstrained-quality runs answer different product questions, report both
instead of silently giving one arm more resources.

## Judge calibration

Use deterministic checks first for citation IDs, entity aliases, cutoff dates,
numeric units, currencies, scales, and recomputable calculations. Use semantic
judges only for entailment, inference quality, and other judgments that cannot
be deterministically resolved.

Semantic judging must be:

- blind to runner and model identity;
- pointwise where possible, with randomized and counterbalanced order for any
  pairwise comparison;
- calibrated on a double-annotated human sample with adjudication;
- evaluated separately for each claim type and data tier; and
- versioned and frozen with the benchmark.

Report judge precision, recall, F1, false-positive rate, false-negative rate,
agreement, and confidence intervals. A high overall F1 cannot hide a
false-positive bias that incorrectly approves unsupported financial claims.
Multiple independent judge families may be aggregated only after each has
passed the human calibration gate.

## Statistical design and freeze policy

The independent unit is the case, not the claim. Claims within one report share
the same sources, prompt, and generation process.

- Report case-macro estimates as primary and claim-micro estimates as
  secondary diagnostics.
- Use paired case-level differences and case-cluster bootstrap confidence
  intervals.
- Balance sector, route, data sufficiency, cutoff difficulty, and outcome
  context.
- Use development pilot results to simulate variance and conduct power
  analysis before fixing the final sample size. The twelve v1 cases are a
  smoke test, not an adequate basis for workflow-by-model interaction claims.
- Keep development/calibration cases separate from a newly created locked
  partition.
- Freeze prompts, model versions, budgets, extractor, judges, annotations,
  weights, code, and aggregation before the locked run.
- Preserve judge disagreements and evidence-backed annotation challenges in a
  versioned audit log.

The v1 locked cases and results have already been inspected. They may be used
as development examples for v2, but they cannot serve as an unseen
authoritative v2 locked test.

## Minimum implementation sequence

1. Build and human-validate the final-report claim extractor.
2. Define the reference-inventory and materiality annotation schema.
3. Implement deterministic entity, temporal, numeric, citation, and
   calculation validators.
4. Implement blinded semantic adjudication with a human calibration set.
5. Implement Direct LLM, Structured baseline, TRACE Full, and the three
   single-component ablations under one resource contract.
6. Pilot only on development cases and run power analysis.
7. Create, preregister, and freeze a new locked set.
8. Run the new locked partition once and preserve all failures and
   disagreements.

