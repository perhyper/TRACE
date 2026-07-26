# Report schema policy

Last reviewed: 2026-07-26

Use this policy before composing or reviewing TRACE Markdown and JSON reports.
It aligns with `src/domain/schemas.ts`, `SKILL.md`,
`references/contest-requirements.md`, and `eval/evaluation-protocol.md`.

## Required JSON contract

The machine-readable report must validate as `trace.report.v1` and include:

- company identity and measurement date;
- evidence ledger records with stable evidence IDs;
- sufficiency result, criteria, gaps, and rationale;
- route decision with selected, considered, and rejected candidates;
- separate valuation conclusions for headline valuation, enterprise value,
  total equity value, and security-level fair value;
- reviewer status and findings;
- report sections for facts, inferences, conflicts, limitations,
  counterarguments, missing information, and next diligence questions;
- run metadata, including run ID, runtime version, command, measurement date,
  timestamps when available, input/output paths when available, and warnings.

## Required Markdown sections

The Markdown report must represent the same validated result as JSON. Include,
at minimum:

- summary of company, measurement date, decision mode, sufficiency, route, and
  valuation/abstention state;
- evidence ledger or citation table keyed by evidence ID;
- material facts and inferences with evidence IDs;
- valuation output with the four value fields kept separate;
- limitations, conflicts, counterarguments, and missing data;
- next diligence questions;
- reviewer findings and run metadata.

Markdown must not introduce material claims that are absent from, or
unsupported by, the JSON report.

## Citation and evidence rules

Every material claim must cite evidence IDs or explicit assumption IDs. Numeric
claims must preserve period, unit, currency, scale, and epistemic label. Do not
cite search snippets. Do not rely on duplicate records from the same
originating source as independent support.

## Authority-boundary wording

Reports must state that TRACE output is decision support, not an appraisal,
investment recommendation, benchmark-superiority claim, or contest-compliance
claim. Because official contest rules are not supplied, contest-specific
acceptance criteria must remain unverified unless later replaced by cited
official materials.

## Conflict and limitation handling

Conflicts, counterarguments, and missing data are first-class sections, not
appendix afterthoughts. If a gap blocks enterprise value, total equity value, or
security-level fair value, the report should abstain for that field and name
the missing evidence needed to proceed.
