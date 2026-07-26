# TRACE

TRACE is an evidence-first agent for screening private companies. It resolves
the company and measurement date, records public evidence in a structured
ledger, chooses an analysis route from data sufficiency and company
characteristics, and produces a reviewable Markdown and JSON result.

The first implementation milestone is deliberately narrow: one real,
reproducible vertical slice before a broad benchmark or user interface.
Revolut Group Holdings Ltd is the development case because its audited annual
report and disclosed employee secondary transaction make it possible to test
source classification, date control, method routing, and capital-structure
abstention without inventing missing data.

TRACE is decision support, not an appraisal or investment recommendation. A
reported transaction value is a calibration input and is not automatically a
fair-value conclusion.

## Status

- Research policy and the first evaluation protocol are recorded under
  `references/` and `eval/`.
- Official contest rules have not been supplied. Contest-specific acceptance
  criteria remain explicitly unverified.
- No remote repository or deployment is configured.

## Local Reproduction

Use Node.js 22.18 or newer. From a clean checkout after dependency
installation, the complete local check is:

```bash
npm ci
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

## First-Slice Deviations

The first slice intentionally stays narrower than the original product brief.
This is consistent with the research baseline in `references/` and the
evaluation protocol in `eval/`:

- The broad 12-18 company benchmark is not locked yet because official contest
  rules, runtime constraints, and source-rights audits are not available.
- Revolut is routed as `financial-services`, not as generic SaaS, because the
  audited 2025 annual report includes customer deposits, customer liabilities,
  treasury investments, and other bank-like balance-sheet facts.
- The USD 75 billion share-sale value is treated as a company-reported
  headline secondary-transaction reference, not as enterprise value, total
  equity value, or a security-level fair-value conclusion.
- TRACE abstains from security-level fair value for this case because share
  rights, preferences, dilution, transaction volume, and cap-table data are
  not disclosed in the approved public evidence.
- Source PDFs are not committed. The Revolut annual-report URL, retrieval date,
  short excerpts, source classification, and audited SHA-256 are recorded in
  the fixture and `references/data-sources.md`.
