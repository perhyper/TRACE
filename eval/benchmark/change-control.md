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

## 2026-07-26 - Development benchmark run

- Run ID: `run-5c191b9ced89d3c9`
- Partition: `development`
- Runner selection: `all` (`baseline-a`, `baseline-b`, `trace-full`)
- Command: `npm run trace -- benchmark --partition development --runner all --out eval/benchmark/runs`
- Manifest hash: `sha256:b2ef8a7504b7747286aa24daec1f571bef9d531920a797eb83ac2f8dff0943ca`
- Development evidence fixture tree hash: `sha256:ace8ce03fd082cb02864b4a31c89e230e48018e36ce4450087c1d78ea0ae9cfa`
- Development annotation tree hash: `sha256:73344856d3c6cd0b1001e6750506906accebe1b1c8e83e6530b17874c3d58371`
- Benchmark runner/scorer/config tree hash: `sha256:7747e732d45b48254c582fe61a287dc764318b9cf3b4d7db92579e6e0056a0e6`
- Development artifact tree hash: `sha256:f50991da63ef3f362c47f7760acbcae6711585815653898ddf521b3c6d2de651`
- Artifacts: 18 runner/case artifact directories, each with raw runner output, normalized scorer input, per-claim score, case score, failure record, and timing metadata, plus run-level aggregate JSON, CSV, and Markdown under `eval/benchmark/runs/development/run-5c191b9ced89d3c9/`.
- Failures: none. All 18 runner/case executions completed and all 18 failure-record files are empty arrays.
- Aggregate regeneration: regenerated development aggregate JSON, CSV, and Markdown from stored per-case scorer inputs and case scores; regenerated outputs matched the stored aggregate files.
- Development-result changes: no code, fixture, annotation, runner-config, scorer, scoring-weight, or aggregate-format changes were made because of development results.
- Locked-test boundary: the locked-test partition was not run and no locked-test run artifacts were created.
