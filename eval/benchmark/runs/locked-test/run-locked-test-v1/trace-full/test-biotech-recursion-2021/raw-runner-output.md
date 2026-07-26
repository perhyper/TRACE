# TRACE Report: Recursion Pharmaceuticals, Inc.

## Summary
- Company: Recursion Pharmaceuticals, Inc. (US-DE; identity resolved)
- Measurement date: 2021-04-15
- Decision mode: full-analysis
- Sufficiency: sufficient (0.725)
- Route: biotech-rnpv
- Review: warnings
- Run ID: run-locked-test-v1

## Evidence Ledger
| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |
| --- | --- | --- | --- | --- | --- |
| ev-95a848a8ee5a | regulatory-filing | 2021-03-22 | 2026-07-26 | Recursion Pharmaceuticals Form S-1 (https://www.sec.gov/Archives/edgar/data/1601830/000119312521089610/d89478ds1.htm) | The S-1 identifies Recursion, describes its biology-decoding platform, IPO registration and biotechnology operating model. |
| ev-da68c304b2cc | regulatory-filing | 2021-04-15 | 2026-07-26 | Recursion Pharmaceuticals final prospectus (https://www.sec.gov/Archives/edgar/data/1601830/000119312521119404/d89478d424b4.htm) | The final prospectus states the Class A IPO share count, USD 18 public price, gross proceeds and dual-class stock details. |

## Material Facts
- Recursion described itself as a clinical-stage biotechnology company using technology to decode biology. value=clinical-stage biotechnology company; period=instant 2021-03-22; epistemic=extracted [ev-95a848a8ee5a]
- Recursion described the Recursion OS as combining infrastructure, biological datasets, algorithms and machine-learning tools. value=Recursion OS platform; period=instant 2021-03-22; epistemic=extracted [ev-95a848a8ee5a]
- Recursion filed a Form S-1 registration statement for its initial public offering before the cutoff. value=true; period=instant 2021-03-22; epistemic=observed [ev-95a848a8ee5a]
- The S-1 identifies the registrant as Recursion Pharmaceuticals, Inc., incorporated in Delaware, with CIK 0001601830. value=SEC-CIK-0001601830; unit=SEC CIK; period=instant 2021-03-22; epistemic=observed [ev-95a848a8ee5a]
- The final prospectus describes Class A shares with one vote and Class B shares with ten votes per share. value=Class A: one vote, Class B: ten votes; period=instant 2021-04-15; epistemic=extracted [ev-da68c304b2cc]
- The final prospectus states Recursion was offering 24,242,424 shares of Class A common stock. value=24242424; unit=Class A shares offered; period=instant 2021-04-15; epistemic=extracted [ev-da68c304b2cc]
- The final prospectus states an initial public offering price of USD 18.00 per share. value=18; unit=USD per share; period=instant 2021-04-15; epistemic=extracted [ev-da68c304b2cc]
- The final prospectus states total initial public offering price of USD 436,363,632 before deductions. value=436.363632; unit=USD millions gross offering value; period=instant 2021-04-15; epistemic=extracted [ev-da68c304b2cc]

## Inferences
- Enterprise Value abstained: Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value. [ev-95a848a8ee5a, ev-da68c304b2cc]
- Headline Valuation abstained: TRACE excludes IPO pricing or fully diluted value published after the measurement-date cutoff and does not use it as a headline-valuation input. [ev-95a848a8ee5a, ev-da68c304b2cc]
- Security-Level Fair Value abstained: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available. [ev-95a848a8ee5a, ev-da68c304b2cc]
- Selected route biotech-rnpv: Evidence describes a biotech, diagnostics, or therapeutics company with clinical studies, pipeline, FDA, CRISPR, product-launch, or rNPV facts. [ev-95a848a8ee5a]
- Sufficiency is sufficient with score 0.725: Evidence coverage is sufficient for route selection before valuation.
- Total Equity Value abstained: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence. [ev-95a848a8ee5a, ev-da68c304b2cc]

## Valuation
### Headline Valuation
- Status: abstained
- Reason: post-cutoff-pricing-not-input
- Explanation: TRACE excludes IPO pricing or fully diluted value published after the measurement-date cutoff and does not use it as a headline-valuation input.
- Evidence: ev-95a848a8ee5a, ev-da68c304b2cc
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cutoff-visible-pricing | Cutoff-visible pricing | headline-valuation | TRACE abstains from a cutoff-date headline valuation. |

### Enterprise Value
- Status: abstained
- Reason: no-product-cash-flow-forecast
- Explanation: Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value.
- Evidence: ev-95a848a8ee5a, ev-da68c304b2cc
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-product-cash-flow-forecast | Product cash-flow forecast | enterprise-value | TRACE abstains from enterprise value. |

### Total Equity Value
- Status: abstained
- Reason: missing-total-equity-capitalization
- Explanation: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- Evidence: ev-95a848a8ee5a, ev-da68c304b2cc
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

### Security-Level Fair Value
- Status: abstained
- Reason: missing-security-rights-and-cap-table
- Explanation: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Evidence: ev-95a848a8ee5a, ev-da68c304b2cc
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Limitations
- Clinical, diagnostics, therapeutics, pipeline, or product-stage evidence supports biotech-rNPV routing, but no product cash-flow forecast and probability assumptions support enterprise value.
- Evidence record recursion-2021-04-16-ipo-pricing-post-cutoff was published after the measurement date and was excluded.
- Excluded recursion-2021-04-16-ipo-pricing-post-cutoff because publishedDate 2021-04-16 is after measurementDate 2021-04-15.
- TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- TRACE excludes IPO pricing or fully diluted value published after the measurement-date cutoff and does not use it as a headline-valuation input.
- TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.
- extraction note recursion-product-cash-flow-not-public: The IPO sources support route and offering-value references but not product-level rNPV cash-flow forecasts.

## Conflicts
- None identified.

## Counterarguments
- Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: financial-services, software-saas, marketplace, asset-based, recent-transaction, general-private-company.

## Missing Information
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-cutoff-visible-pricing | Cutoff-visible pricing | headline-valuation | TRACE abstains from a cutoff-date headline valuation. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-financial-and-operating-fact-coverage | Financial and operating fact coverage | routing, sufficiency | TRACE cannot support route selection without this evidence. |
| missing-product-cash-flow-forecast | Product cash-flow forecast | enterprise-value | TRACE abstains from enterprise value. |
| missing-route-defining-business-model-evidence | Route-defining business-model evidence | routing, sufficiency | TRACE treats this as a routing limitation unless stronger evidence is supplied. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

## Next Diligence Questions
- What evidence resolves Cap table for total-equity-value, security-level-fair-value?
- What evidence resolves Cutoff-visible pricing for headline-valuation?
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
| review-abstention-triggers | pass | abstention | ev-95a848a8ee5a, ev-da68c304b2cc | Abstained valuation fields include missing-information reasons, and security-level triggers are respected. |
| review-calculation-integrity | pass | calculation | ev-95a848a8ee5a, ev-da68c304b2cc | No concluded valuation calculations were emitted; abstentions are explicit. |
| review-citation-support | pass | evidence | ev-95a848a8ee5a, ev-da68c304b2cc | Sufficiency, route, and valuation claims cite included evidence IDs where citations are required. |
| review-cutoff-compliance | warning | cutoff | ev-95a848a8ee5a, ev-da68c304b2cc | Post-measurement-date evidence was excluded by provider validation and remains visible in warnings. |
| review-entity-certainty | pass | entity | ev-95a848a8ee5a, ev-da68c304b2cc | Target identity is resolved and supported by included evidence. |
| review-evidence-coverage | pass | evidence | ev-95a848a8ee5a, ev-da68c304b2cc | Evidence coverage satisfies the sufficiency gate for route selection. |
| review-route-appropriateness | pass | route | ev-95a848a8ee5a, ev-da68c304b2cc | Route selection is consistent with sufficiency status: biotech-rnpv. |
| review-valuation-field-separation | pass | valuation-separation | ev-95a848a8ee5a, ev-da68c304b2cc | Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields. |

## Run Metadata
- Run ID: run-locked-test-v1
- Runtime version: 0.1.0
- Command: trace benchmark --partition locked-test --runner trace-full --case-id test-biotech-recursion-2021
- Measurement date: 2021-04-15
- Started at: 2026-07-26T00:00:00.000Z
- Completed at: 2026-07-26T00:00:00.292Z
- Duration ms: 292
- Input path: benchmark:locked-test:test-biotech-recursion-2021
- Output directory: benchmark-artifact:locked-test/run-locked-test-v1/trace-full/test-biotech-recursion-2021
- Warnings:
- Excluded recursion-2021-04-16-ipo-pricing-post-cutoff because publishedDate 2021-04-16 is after measurementDate 2021-04-15.
