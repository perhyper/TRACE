# Contest requirements and acceptance criteria

Last reviewed: 2026-07-26

## Authority boundary

No official contest announcement, rules, scoring rubric, submission template,
or execution-environment specification has been supplied. The implementation
brief in `TRACE_IMPLEMENTATION_AGENT_PROMPT.md` is a user-authored product and
research brief, not an official contest document. TRACE must not present the
criteria below as confirmed contest requirements.

Before a locked benchmark or submission build, obtain and archive links or
copies of the official materials, record their publication/version dates, and
replace every `UNVERIFIED` item below with a cited pass/fail criterion.

## Unverified contest checks

| ID | Acceptance criterion | Status | Evidence required |
| --- | --- | --- | --- |
| C-01 | The submitted artifact type is permitted. | UNVERIFIED | Official submission-format rule |
| C-02 | The runtime, model, network, and tool usage are permitted. | UNVERIFIED | Official environment/tool rule |
| C-03 | Public-data collection and cached excerpts comply with contest and source terms. | UNVERIFIED | Official data rule plus source terms |
| C-04 | The demo duration and required presentation assets are satisfied. | UNVERIFIED | Official presentation rule |
| C-05 | The evaluation protocol maps to the official scoring rubric. | UNVERIFIED | Official rubric |
| C-06 | Team, attribution, licensing, and disclosure requirements are satisfied. | UNVERIFIED | Official eligibility/IP rule |

## Product-brief acceptance criteria

These criteria come from the user-authored implementation brief and are
binding project targets unless later evidence supports a documented change.

| ID | Verifiable criterion | Initial verification |
| --- | --- | --- |
| P-01 | A run fixes a legal entity and measurement date before analysis. | Integration test and run JSON |
| P-02 | Every material claim is linked to an evidence ID with source class, epistemic status, retrieval time, and source URL. | Schema test and report audit |
| P-03 | Repeated citations of one originating release are not counted as independent evidence. | Deduplication test |
| P-04 | Sufficiency is scored before valuation and can produce `insufficient-evidence` or `abstain`. | Sparse fixture |
| P-05 | Routing records the selected path and reasons without using the desired conclusion as an input. | Route snapshot test |
| P-06 | Currency, unit, period, valuation arithmetic, and scenario calculations are deterministic and unit tested. | Unit tests |
| P-07 | Headline valuation, enterprise value, total equity value, and security-level value are distinct fields. | Runtime schema test |
| P-08 | A recent transaction is a calibration input, not automatic fair value. | Policy test and report wording |
| P-09 | A report contains facts, inferences, conflicts, limitations, counterarguments, missing data, and next diligence questions. | Report contract test |
| P-10 | Markdown and machine-readable JSON are emitted from the same validated result. | End-to-end test |
| P-11 | The first public-data case runs without manual edits after input preparation and preserves a source hash and run metadata. | Clean local run |
| P-12 | The primary benchmark metric is evidence-supported claim precision; baseline and Trace outputs use the same evidence cutoff. | Evaluation protocol and scorer |

## Intentional initial scope change

The brief recommends a 12–18 company locked set early. TRACE instead freezes
the primary metric and judging rubric first, then completes one development
case before locking company membership. Locking an unaudited company list now
would create avoidable post-lock exclusions when source rights, cutoff leakage,
or entity ambiguity are discovered. The full manifest will be locked only
after each candidate passes a source-and-cutoff audit and official contest
constraints are known.

