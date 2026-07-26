---
name: trace
description: Analyze private companies from public evidence for VC screening, market positioning, valuation ranges, fair-value review, biotech rNPV, or diligence. Use when a user asks to analyze a private or unlisted company, compare peers, trace claims to sources, estimate a supportable value range, review a recent funding valuation, or abstain safely when evidence is insufficient.
---

# TRACE

Resolve a legal entity and measurement date, build a structured evidence
ledger, select a data-appropriate analysis route, and produce matching
Markdown and JSON reports. Treat TRACE as decision support; never present its
output as an appraisal or investment recommendation.

## Workflow

1. Fix the user's decision mode, target legal entity, and measurement date.
   Ask only when an unresolved identity could change the company analyzed.
2. Read `references/evidence-policy.md` before collecting or accepting
   evidence. Prefer regulator, audited, legal, and government sources. Label
   company-originated assertions and retain retrieval time and source URL.
3. Read `references/sector-routing.md` when choosing a route. Assess
   sufficiency before valuation. Do not select a route from the conclusion the
   user hopes to receive.
4. Read `references/valuation-policy.md` before calculating a range. Use code
   for normalization, multiples, DCF, rNPV, and scenario arithmetic. Keep
   headline valuation, enterprise value, total equity value, and
   security-level value distinct.
5. Run the validated pipeline:

   ```bash
   npm run trace -- analyze --input <evidence-bundle.json> --out <output-dir>
   ```

6. Inspect validation and reviewer findings. If entity certainty, evidence
   coverage, calculation integrity, or capital-structure visibility is below
   the applicable gate, return a partial result or `abstain`; do not fill gaps
   with plausible numbers.
7. Read `references/report-schema.md` before presenting results. Deliver the
   generated Markdown and JSON together, including conflicts,
   counterarguments, missing information, next diligence questions, and run
   metadata.

## Evidence rules

- Reference structured evidence IDs rather than repeatedly summarizing source
  documents.
- Do not count syndicated copies of one originating release as independent
  evidence.
- Do not use information published after the measurement-date cutoff.
- Mark every quantitative input as observed, extracted, calculated, assumed,
  inferred, or unknown.
- Record failed access and extraction attempts; never cite search snippets as
  evidence.

## Valuation guardrails

- Use a recent transaction only as a calibration input after checking timing,
  orderliness, transaction type, and disclosed rights.
- Do not apply one price to every share class when preferences, dilution, or
  cap-table terms are unknown.
- Prefer low/base/high scenarios and show the assumptions that move the range.
- Keep market position, company quality, valuation, investment thesis, and
  information confidence as separate outputs.
- Preserve professional review responsibility and disclose that AI augments
  rather than replaces expert judgement.

## Resource map

- Read `references/contest-requirements.md` before contest or submission work.
- Read `references/data-sources.md` when selecting providers or caching data.
- Read `references/research-basis.md` when changing a method, prior, or
  evaluation rule.
- Read `eval/evaluation-protocol.md` before running or changing a benchmark.
- Use fixtures under `examples/` for a reproducible first run; never hardcode a
  target company into routing or valuation logic.

