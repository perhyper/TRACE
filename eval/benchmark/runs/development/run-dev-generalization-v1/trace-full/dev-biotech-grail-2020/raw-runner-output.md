# TRACE Report: GRAIL, Inc.

## Summary
- Company: GRAIL, Inc. (US-DE; identity resolved)
- Measurement date: 2020-09-17
- Decision mode: full-analysis
- Sufficiency: sufficient (0.8)
- Route: biotech-rnpv
- Review: warnings
- Run ID: run-dev-generalization-v1

## Evidence Ledger
| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |
| --- | --- | --- | --- | --- | --- |
| ev-3e462cd1db7e | company-primary | 2020-09-09 | 2026-07-26 | GRAIL announces filing of registration statement for proposed IPO (https://grail.com/press-releases/grail-announces-filing-of-registration-statement-for-proposed-initial-public-offering/) | GRAIL announced an S-1 filing for a proposed IPO and applied to list common stock under GRAL. |
| ev-d6c3dac52c28 | regulatory-filing | 2020-09-17 | 2026-07-26 | GRAIL, Inc. Form S-1/A (https://www.sec.gov/Archives/edgar/data/1699031/000162828020013710/grails-1a1.htm) | The S-1/A identifies GRAIL, describes late-stage Galleri and DAC development, and reports no generated revenues to date. |

## Material Facts
- As of the 2020-09-09 release, GRAIL said the number of shares and price range had not yet been determined. value=not determined; period=instant 2020-09-09; epistemic=observed [ev-3e462cd1db7e]
- GRAIL announced on 2020-09-09 that it filed a Form S-1 for a proposed IPO. value=Form S-1 filed; period=instant 2020-09-09; epistemic=observed [ev-3e462cd1db7e]
- GRAIL planned to commercially launch Galleri in 2021 as a laboratory developed test. value=Galleri planned 2021 LDT launch; period=instant 2020-09-17; epistemic=extracted [ev-d6c3dac52c28]
- GRAIL reported a USD 136.4 million net loss for the six months ended 2020-06-30. value=136.4; unit=USD millions net loss; period=start 2020-01-01, end 2020-06-30; epistemic=extracted [ev-d6c3dac52c28]
- GRAIL said it applied to list common stock on Nasdaq under ticker GRAL. value=GRAL; unit=ticker; period=instant 2020-09-09; epistemic=observed [ev-3e462cd1db7e]
- GRAIL stated it did not yet have a commercial product for sale. value=true; period=instant 2020-09-17; epistemic=extracted [ev-d6c3dac52c28]
- GRAIL stated it had not generated revenues to date and did not expect revenues until products were commercialized. value=true; period=instant 2020-09-17; epistemic=extracted [ev-d6c3dac52c28]
- GRAIL stated its foundational clinical trials had more than 115,000 subjects already enrolled. value=115000; unit=subjects, greater than; period=instant 2020-08-31; epistemic=extracted [ev-d6c3dac52c28]
- The S-1/A identifies the registrant as GRAIL, Inc., incorporated in Delaware, with CIK 0001699031. value=SEC-CIK-0001699031; unit=SEC CIK; period=instant 2020-09-17; epistemic=observed [ev-d6c3dac52c28]
- Through 2020-06-30, GRAIL stated it had raised over USD 1.9 billion from venture and strategic partners. value=1.9; unit=USD billions raised, greater than; period=instant 2020-06-30; epistemic=extracted [ev-d6c3dac52c28]

## Inferences
- Enterprise Value abstained: Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value. [ev-3e462cd1db7e, ev-d6c3dac52c28]
- Headline Valuation abstained: TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input. [ev-3e462cd1db7e, ev-d6c3dac52c28]
- Security-Level Fair Value abstained: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available. [ev-3e462cd1db7e, ev-d6c3dac52c28]
- Selected route biotech-rnpv: Evidence describes a biotech, diagnostics, or therapeutics company with clinical studies, pipeline, FDA, CRISPR, product-launch, or rNPV facts. [ev-d6c3dac52c28]
- Sufficiency is sufficient with score 0.8: Evidence coverage is sufficient for route selection before valuation.
- Total Equity Value abstained: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence. [ev-3e462cd1db7e, ev-d6c3dac52c28]

## Valuation
### Headline Valuation
- Status: abstained
- Reason: post-cutoff-transaction-announcement
- Explanation: TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input.
- Evidence: ev-3e462cd1db7e, ev-d6c3dac52c28
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cutoff-visible-transaction | Cutoff-visible transaction | headline-valuation | TRACE abstains from a cutoff-date headline valuation. |

### Enterprise Value
- Status: abstained
- Reason: no-product-cash-flow-forecast
- Explanation: Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value.
- Evidence: ev-3e462cd1db7e, ev-d6c3dac52c28
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-product-cash-flow-forecast | Product cash-flow forecast | enterprise-value | TRACE abstains from enterprise value. |

### Total Equity Value
- Status: abstained
- Reason: missing-total-equity-capitalization
- Explanation: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- Evidence: ev-3e462cd1db7e, ev-d6c3dac52c28
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

### Security-Level Fair Value
- Status: abstained
- Reason: missing-security-rights-and-cap-table
- Explanation: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Evidence: ev-3e462cd1db7e, ev-d6c3dac52c28
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Limitations
- Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value.
- Evidence record grail-2020-09-21-illumina-acquisition-post-cutoff was published after the measurement date and was excluded.
- Excluded grail-2020-09-21-illumina-acquisition-post-cutoff because publishedDate 2020-09-21 is after measurementDate 2020-09-17.
- TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input.
- TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.

## Conflicts
- None identified.

## Counterarguments
- Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: financial-services, software-saas, marketplace, asset-based, recent-transaction, general-private-company.

## Missing Information
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-cutoff-visible-transaction | Cutoff-visible transaction | headline-valuation | TRACE abstains from a cutoff-date headline valuation. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-financial-and-operating-fact-coverage | Financial and operating fact coverage | routing, sufficiency | TRACE treats this as a routing limitation unless stronger evidence is supplied. |
| missing-product-cash-flow-forecast | Product cash-flow forecast | enterprise-value | TRACE abstains from enterprise value. |
| missing-route-defining-business-model-evidence | Route-defining business-model evidence | routing, sufficiency | TRACE treats this as a routing limitation unless stronger evidence is supplied. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

## Next Diligence Questions
- What evidence resolves Cap table for total-equity-value, security-level-fair-value?
- What evidence resolves Cutoff-visible transaction for headline-valuation?
- What evidence resolves Dilution for total-equity-value, security-level-fair-value?
- What evidence resolves Financial and operating fact coverage for routing, sufficiency?
- What evidence resolves Product cash-flow forecast for enterprise-value?
- What evidence resolves Route-defining business-model evidence for routing, sufficiency?
- What evidence resolves Share preferences for security-level-fair-value?
- What evidence resolves Share rights for security-level-fair-value?
- What evidence resolves Total equity capitalization for total-equity-value?

## Reviewer Findings
- Reviewer version: trace-reviewer.v1
- Status: warnings

| ID | Severity | Category | Evidence | Message |
| --- | --- | --- | --- | --- |
| review-abstention-triggers | pass | abstention | ev-3e462cd1db7e, ev-d6c3dac52c28 | Abstained valuation fields include missing-information reasons, and security-level triggers are respected. |
| review-calculation-integrity | pass | calculation | ev-3e462cd1db7e, ev-d6c3dac52c28 | No concluded valuation calculations were emitted; abstentions are explicit. |
| review-citation-support | pass | evidence | ev-3e462cd1db7e, ev-d6c3dac52c28 | Sufficiency, route, and valuation claims cite included evidence IDs where citations are required. |
| review-cutoff-compliance | warning | cutoff | ev-3e462cd1db7e, ev-d6c3dac52c28 | Post-measurement-date evidence was excluded by provider validation and remains visible in warnings. |
| review-entity-certainty | pass | entity | ev-3e462cd1db7e, ev-d6c3dac52c28 | Target identity is resolved and supported by included evidence. |
| review-evidence-coverage | pass | evidence | ev-3e462cd1db7e, ev-d6c3dac52c28 | Evidence coverage satisfies the sufficiency gate for route selection. |
| review-route-appropriateness | pass | route | ev-3e462cd1db7e, ev-d6c3dac52c28 | Route selection is consistent with sufficiency status: biotech-rnpv. |
| review-valuation-field-separation | pass | valuation-separation | ev-3e462cd1db7e, ev-d6c3dac52c28 | Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields. |

## Run Metadata
- Run ID: run-dev-generalization-v1
- Runtime version: 0.1.0
- Command: trace benchmark --partition development --runner trace-full --case-id dev-biotech-grail-2020
- Measurement date: 2020-09-17
- Started at: 2026-07-26T00:00:00.000Z
- Completed at: 2026-07-26T00:00:00.301Z
- Duration ms: 301
- Input path: benchmark:development:dev-biotech-grail-2020
- Output directory: benchmark-artifact:development/run-dev-generalization-v1/trace-full/dev-biotech-grail-2020
- Warnings:
- Excluded grail-2020-09-21-illumina-acquisition-post-cutoff because publishedDate 2020-09-21 is after measurementDate 2020-09-17.
