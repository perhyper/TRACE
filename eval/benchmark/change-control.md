# TRACE Internal Benchmark Change Control

## 2026-07-26 - Manifest lock

- Lock ID: `trace-internal-benchmark-lock-2026-07-26-v1`
- Manifest: `eval/benchmark-manifest.json`
- Status: frozen for internal product-validation benchmarking.
- Purpose: lock case membership, partitions, data tiers, outcome-context labels, valuation-error eligibility, and source-audit policy before benchmark scoring begins.
- Authority boundary: this is an internal benchmark lock only. Official contest rules and runtime constraints have not been supplied, so this record does not claim official contest compliance, contest readiness, benchmark superiority, investment advice, or appraisal status.
- Case set: one non-scored Revolut demo case plus exactly 12 scored cases split into six development and six locked-test cases.
- Coverage: four rich, four medium, and four sparse scored cases across financial services, software/SaaS, and biotech rNPV routes.
- Source policy: raw PDFs, cached source documents, secrets, and scratch downloads stay out of Git. Commit only URLs, retrieval metadata, hashes when available, and short excerpts unless redistribution rights are explicitly established.
- Score inspection statement: no benchmark scores, per-case benchmark outputs, aggregate benchmark results, or score-informed code changes had been generated or inspected before this lock event.

## 2026-07-26 - Pre-run Zopa source correction

- Trigger: manual source audit after locked-test fixture creation and before any benchmark runner or scorer existed.
- Case: `test-fintech-zopa-2025`.
- Change: replaced a Research Tree republication with Zopa's directly linked H1 2025 PDF, corrected the publication date from 2025-09-02 to 2025-09-01, and classified the company-issued unaudited update as `company-primary` rather than `regulatory-filing`.
- Expected effect: prevent source-quality overstatement while leaving the observed facts, measurement cutoff, case membership, partition, tier, route label, outcome label, and valuation-error eligibility unchanged.
- Score inspection statement: no benchmark scores or runner outputs existed or were inspected.
