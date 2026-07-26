# TRACE Report: Monzo Bank Holding Group Limited

## Summary
- Company: Monzo Bank Holding Group Limited (GB; identity resolved)
- Measurement date: 2025-12-31
- Decision mode: full-analysis
- Sufficiency: sufficient (0.925)
- Route: financial-services
- Review: passed
- Run ID: run-dev-generalization-v1

## Evidence Ledger
| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |
| --- | --- | --- | --- | --- | --- |
| ev-1d808f14530d | government | 2025-04-04 | 2026-07-26 | Companies House filing history for Monzo Bank Holding Group Limited (https://find-and-update.company-information.service.gov.uk/company/14785367/filing-history?page=2) | Companies House identifies company number 14785367 and a 04 Apr 2025 statement of capital filing. |
| ev-e11520fb730d | company-primary | n/a | 2026-07-26 | Monzo Annual Report 2025 web summary (https://monzo.com/annual-report/2025) | The 2025 annual report summary reports 12m+ customers, GBP 1.2bn revenue, GBP 16.6bn deposits and GBP 18.3bn assets. |

## Material Facts
- Companies House identifies Monzo Bank Holding Group Limited with company number 14785367. value=14785367; unit=company-number; period=instant 2025-04-04; epistemic=observed [ev-1d808f14530d]
- Companies House lists a 04 Apr 2025 SH01 filing for a statement of capital following an allotment of shares on 2025-03-03. value=SH01 filed 2025-04-04 for allotment on 2025-03-03; period=instant 2025-04-04; epistemic=observed [ev-1d808f14530d]
- Monzo reported GBP 1.2 billion of revenue in the 2025 annual report summary. value=1.2; unit=GBP billions; period=end 2025-03-31; epistemic=extracted [ev-e11520fb730d]
- Monzo reported GBP 113.9 million of adjusted profit before tax in the 2025 annual report summary. value=113.9; unit=GBP millions; period=end 2025-03-31; epistemic=extracted [ev-e11520fb730d]
- Monzo reported GBP 16.6 billion of customer deposits in the 2025 annual report summary. value=16.6; unit=GBP billions; period=end 2025-03-31; epistemic=extracted [ev-e11520fb730d]
- Monzo reported GBP 18.3 billion of total assets in the 2025 annual report summary. value=18.3; unit=GBP billions; period=end 2025-03-31; epistemic=extracted [ev-e11520fb730d]
- Monzo reported more than 12 million total customers in its 2025 annual report summary. value=12m+; unit=customers; period=end 2025-03-31; epistemic=extracted [ev-e11520fb730d]
- Monzo reported weekly active customers increased from 5.4 million to 6.9 million in FY2025. value=6.9; unit=millions; period=end 2025-03-31; epistemic=extracted [ev-e11520fb730d]
- The Companies House filing-history row reports statement-of-capital value GBP 237,479.179. value=237479.179; unit=GBP; period=instant 2025-04-04; epistemic=observed [ev-1d808f14530d]

## Inferences
- Enterprise Value abstained: Banking, financial-technology, deposit, asset, customer, and operating metrics support the financial-services route but do not by themselves establish enterprise value. [ev-1d808f14530d, ev-e11520fb730d]
- Headline Valuation abstained: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed. [ev-1d808f14530d, ev-e11520fb730d]
- Security-Level Fair Value abstained: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available. [ev-1d808f14530d, ev-e11520fb730d]
- Selected route financial-services: Evidence describes banking or financial-technology products such as partner-bank services, payments, lending, or electronic money. [ev-1d808f14530d]
- Selected route financial-services: Evidence shows bank-like or deposit-led balance-sheet items. [ev-e11520fb730d]
- Selected route financial-services: Operating facts such as revenue, profit or loss, customers or active members, deposits, assets, and purchase or payment volume require financial-services interpretation. [ev-e11520fb730d]
- Sufficiency is sufficient with score 0.925: Evidence coverage is sufficient for route selection before valuation.
- Total Equity Value abstained: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence. [ev-1d808f14530d, ev-e11520fb730d]

## Valuation
### Headline Valuation
- Status: abstained
- Reason: recent-secondary-transaction-not-observed
- Explanation: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- Evidence: ev-1d808f14530d, ev-e11520fb730d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |

### Enterprise Value
- Status: abstained
- Reason: bank-balance-sheet-not-ev-input
- Explanation: Banking, financial-technology, deposit, asset, customer, and operating metrics support the financial-services route but do not by themselves establish enterprise value.
- Evidence: ev-1d808f14530d, ev-e11520fb730d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-financial-services-valuation-inputs | Financial-services valuation inputs | enterprise-value | TRACE abstains from enterprise value. |

### Total Equity Value
- Status: abstained
- Reason: missing-total-equity-capitalization
- Explanation: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- Evidence: ev-1d808f14530d, ev-e11520fb730d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

### Security-Level Fair Value
- Status: abstained
- Reason: missing-security-rights-and-cap-table
- Explanation: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Evidence: ev-1d808f14530d, ev-e11520fb730d
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Limitations
- Banking, financial-technology, deposit, asset, customer, and operating metrics support the financial-services route but do not by themselves establish enterprise value.
- TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.
- extraction note monzo-2026-report-excluded-note: The latest Monzo annual-report landing page shows post-cutoff FY2026 material; it was not used as input for the 2025-12-31 case.
- extraction note monzo-html-hash-not-recorded: No document hash is recorded for the dynamic HTML page; raw reports and downloads remain outside Git.

## Conflicts
- None identified.

## Counterarguments
- Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: software-saas, marketplace, biotech-rnpv, asset-based, recent-transaction, general-private-company.

## Missing Information
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-financial-and-operating-fact-coverage | Financial and operating fact coverage | routing, sufficiency | TRACE treats this as a routing limitation unless stronger evidence is supplied. |
| missing-financial-services-valuation-inputs | Financial-services valuation inputs | enterprise-value | TRACE abstains from enterprise value. |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

## Next Diligence Questions
- What evidence resolves Cap table for total-equity-value, security-level-fair-value?
- What evidence resolves Dilution for total-equity-value, security-level-fair-value?
- What evidence resolves Financial and operating fact coverage for routing, sufficiency?
- What evidence resolves Financial-services valuation inputs for enterprise-value?
- What evidence resolves Recent secondary transaction for headline-valuation?
- What evidence resolves Share preferences for security-level-fair-value?
- What evidence resolves Share rights for security-level-fair-value?
- What evidence resolves Total equity capitalization for total-equity-value?

## Reviewer Findings
- Reviewer version: trace-reviewer.v1
- Status: passed

| ID | Severity | Category | Evidence | Message |
| --- | --- | --- | --- | --- |
| review-abstention-triggers | pass | abstention | ev-1d808f14530d, ev-e11520fb730d | Abstained valuation fields include missing-information reasons, and security-level triggers are respected. |
| review-calculation-integrity | pass | calculation | ev-1d808f14530d, ev-e11520fb730d | No concluded valuation calculations were emitted; abstentions are explicit. |
| review-citation-support | pass | evidence | ev-1d808f14530d, ev-e11520fb730d | Sufficiency, route, and valuation claims cite included evidence IDs where citations are required. |
| review-cutoff-compliance | pass | cutoff | ev-1d808f14530d, ev-e11520fb730d | Included evidence satisfies the measurement-date publication cutoff. |
| review-entity-certainty | pass | entity | ev-1d808f14530d, ev-e11520fb730d | Target identity is resolved and supported by included evidence. |
| review-evidence-coverage | pass | evidence | ev-1d808f14530d, ev-e11520fb730d | Evidence coverage satisfies the sufficiency gate for route selection. |
| review-route-appropriateness | pass | route | ev-1d808f14530d, ev-e11520fb730d | Route selection is consistent with sufficiency status: financial-services. |
| review-valuation-field-separation | pass | valuation-separation | ev-1d808f14530d, ev-e11520fb730d | Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields. |

## Run Metadata
- Run ID: run-dev-generalization-v1
- Runtime version: 0.1.0
- Command: trace benchmark --partition development --runner trace-full --case-id dev-fintech-monzo-2025
- Measurement date: 2025-12-31
- Started at: 2026-07-26T00:00:00.000Z
- Completed at: 2026-07-26T00:00:00.299Z
- Duration ms: 299
- Input path: benchmark:development:dev-fintech-monzo-2025
- Output directory: benchmark-artifact:development/run-dev-generalization-v1/trace-full/dev-fintech-monzo-2025
- Warnings:
- None identified.
