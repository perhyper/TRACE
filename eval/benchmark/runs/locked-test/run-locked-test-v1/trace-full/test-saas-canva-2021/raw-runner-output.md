# TRACE Report: Canva Pty Ltd

## Summary
- Company: Canva Pty Ltd (AU; identity resolved)
- Measurement date: 2021-09-15
- Decision mode: full-analysis
- Sufficiency: sufficient (1)
- Route: recent-transaction
- Review: passed
- Run ID: run-locked-test-v1

## Evidence Ledger
| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |
| --- | --- | --- | --- | --- | --- |
| ev-2b2ee9738bd3 | government | n/a | 2026-07-26 | Current details for ABN 80 158 929 938 (https://abr.business.gov.au/ABN/View?abn=80158929938) | ABN Lookup identifies Canva Pty Ltd as an active Australian private company with ABN and ACN metadata. |
| ev-2eb623901f43 | company-primary | 2021-09-15 | 2026-07-26 | Canva announces USD 40 billion valuation (https://www.canva.com/newsroom/news/canva-announces-usd-40-billion-valuation-fueled-global-demand-visual-communication/) | Canva announced a USD 200m funding round, USD 40bn valuation, more than 60m monthly users and positive free cash flow. |
| ev-6a1dc4f6277d | news | 2021-09-14 | 2026-07-26 | Canva raises USD 200 million at a USD 40 billion valuation (https://techcrunch.com/2021/09/14/canva-raises-200-million-at-a-40-billion-valuation/) | News coverage before the measurement date reported Canva's funding amount, valuation, user scale and enterprise adoption. |

## Material Facts
- ABN Lookup identifies the entity name as CANVA PTY LTD. value=CANVA PTY LTD; period=instant 2012-06-12; epistemic=observed [ev-2b2ee9738bd3]
- ABN Lookup links Canva Pty Ltd to ACN 158 929 938. value=158 929 938; unit=Australian company number; period=instant 2012-06-12; epistemic=observed [ev-2b2ee9738bd3]
- ABN Lookup records ABN 80 158 929 938 as active from 2012-06-12. value=2012-06-12; unit=ABN active date; period=instant 2012-06-12; epistemic=observed [ev-2b2ee9738bd3]
- Canva announced a USD 200 million funding round on 2021-09-15. value=200; unit=USD millions; period=instant 2021-09-15; epistemic=observed [ev-2eb623901f43]
- Canva announced a USD 40 billion headline valuation after the funding round. value=40; unit=USD billions headline valuation; period=instant 2021-09-15; epistemic=observed [ev-2eb623901f43]
- Canva reported generating positive free cash flow at the time of the September 2021 announcement. value=true; period=instant 2021-09-15; epistemic=observed [ev-2eb623901f43]
- Canva reported more than 60 million monthly active users at the time of the funding announcement. value=60; unit=millions monthly active users, greater than; period=instant 2021-09-15; epistemic=observed [ev-2eb623901f43]
- Canva reported users in 190 countries at the time of the funding announcement. value=190; unit=countries; period=instant 2021-09-15; epistemic=observed [ev-2eb623901f43]
- News coverage described Canva as having a team of about 2,000 people. value=2000; unit=employees; period=instant 2021-09-14; epistemic=observed [ev-6a1dc4f6277d]
- News coverage listed Salesforce, Marriott International, PayPal and American Airlines as Canva enterprise customers. value=Salesforce, Marriott International, PayPal, American Airlines; period=instant 2021-09-14; epistemic=observed [ev-6a1dc4f6277d]
- News coverage reported more than 500,000 teams paying for Canva. value=500000; unit=paying teams, greater than; period=instant 2021-09-14; epistemic=observed [ev-6a1dc4f6277d]

## Inferences
- Enterprise Value abstained: TRACE cannot calibrate a company valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed. [ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d]
- Headline Valuation abstained: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed. [ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d]
- Security-Level Fair Value abstained: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available. [ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d]
- Selected route recent-transaction: Evidence includes a recent transaction or headline valuation reference. [ev-2eb623901f43, ev-6a1dc4f6277d]
- Sufficiency is sufficient with score 1: Evidence coverage is sufficient for route selection before valuation.
- Total Equity Value abstained: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence. [ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d]

## Valuation
### Headline Valuation
- Status: abstained
- Reason: recent-secondary-transaction-not-observed
- Explanation: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- Evidence: ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |

### Enterprise Value
- Status: abstained
- Reason: recent-secondary-transaction-not-observed
- Explanation: TRACE cannot calibrate a company valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- Evidence: ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-recent-secondary-transaction | Recent secondary transaction | enterprise-value | TRACE cannot support the recent-secondary calibration pathway. |

### Total Equity Value
- Status: abstained
- Reason: missing-total-equity-capitalization
- Explanation: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- Evidence: ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

### Security-Level Fair Value
- Status: abstained
- Reason: missing-security-rights-and-cap-table
- Explanation: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Evidence: ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Limitations
- TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- TRACE cannot calibrate a company valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.
- extraction note canva-security-rights-not-public: Funding coverage does not disclose security rights, cap table or a completed exit valuation target.

## Conflicts
- None identified.

## Counterarguments
- Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: financial-services, software-saas, marketplace, biotech-rnpv, asset-based, general-private-company.

## Missing Information
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-recent-secondary-transaction | Recent secondary transaction | enterprise-value | TRACE cannot support the recent-secondary calibration pathway. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

## Next Diligence Questions
- What evidence resolves Cap table for total-equity-value, security-level-fair-value?
- What evidence resolves Dilution for total-equity-value, security-level-fair-value?
- What evidence resolves Recent secondary transaction for enterprise-value?
- What evidence resolves Share preferences for security-level-fair-value?
- What evidence resolves Share rights for security-level-fair-value?
- What evidence resolves Total equity capitalization for total-equity-value?

## Reviewer Findings
- Reviewer version: trace-reviewer.v1
- Status: passed

| ID | Severity | Category | Evidence | Message |
| --- | --- | --- | --- | --- |
| review-abstention-triggers | pass | abstention | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Abstained valuation fields include missing-information reasons, and security-level triggers are respected. |
| review-calculation-integrity | pass | calculation | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | No concluded valuation calculations were emitted; abstentions are explicit. |
| review-citation-support | pass | evidence | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Sufficiency, route, and valuation claims cite included evidence IDs where citations are required. |
| review-cutoff-compliance | pass | cutoff | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Included evidence satisfies the measurement-date publication cutoff. |
| review-entity-certainty | pass | entity | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Target identity is resolved and supported by included evidence. |
| review-evidence-coverage | pass | evidence | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Evidence coverage satisfies the sufficiency gate for route selection. |
| review-route-appropriateness | pass | route | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Route selection is consistent with sufficiency status: recent-transaction. |
| review-valuation-field-separation | pass | valuation-separation | ev-2b2ee9738bd3, ev-2eb623901f43, ev-6a1dc4f6277d | Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields. |

## Run Metadata
- Run ID: run-locked-test-v1
- Runtime version: 0.1.0
- Command: trace benchmark --partition locked-test --runner trace-full --case-id test-saas-canva-2021
- Measurement date: 2021-09-15
- Started at: 2026-07-26T00:00:00.000Z
- Completed at: 2026-07-26T00:00:00.331Z
- Duration ms: 331
- Input path: benchmark:locked-test:test-saas-canva-2021
- Output directory: benchmark-artifact:locked-test/run-locked-test-v1/trace-full/test-saas-canva-2021
- Warnings:
- None identified.
