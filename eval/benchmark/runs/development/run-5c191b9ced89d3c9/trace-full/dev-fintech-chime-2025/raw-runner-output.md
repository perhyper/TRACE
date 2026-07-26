# TRACE Report: Chime Financial, Inc.

## Summary
- Company: Chime Financial, Inc. (US-DE; identity resolved)
- Measurement date: 2025-05-13
- Decision mode: full-analysis
- Sufficiency: sufficient (0.725)
- Route: general-private-company
- Review: warnings
- Run ID: run-5c191b9ced89d3c9

## Evidence Ledger
| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |
| --- | --- | --- | --- | --- | --- |
| ev-4cd4b2c602cb | company-primary | 2025-05-13 | 2026-07-26 | Chime files registration statement for proposed IPO (https://www.chime.com/newsroom/news/chime-files-registration-statement-for-proposed-initial-public-offering/) | Chime announced the S-1 filing, applied for Nasdaq listing as CHYM, and had not yet determined shares or price range. |
| ev-5fdce7b12f43 | regulatory-filing | 2025-05-13 | 2026-07-26 | Chime Financial, Inc. Form S-1 (https://www.sec.gov/Archives/edgar/data/1795586/000162828025025059/chimefinancialinc-sx1wq1da.htm) | The Form S-1 identifies Chime, reports Q1 2025 active members, 2024 operating metrics and partner-bank model limitations. |

## Material Facts
- As of the 2025-05-13 announcement, Chime said the number of shares and price range had not yet been determined. value=not determined; period=instant 2025-05-13; epistemic=observed [ev-4cd4b2c602cb]
- Chime announced on 2025-05-13 that it filed a Form S-1 for a proposed IPO. value=Form S-1 filed; period=instant 2025-05-13; epistemic=observed [ev-4cd4b2c602cb]
- Chime describes itself as a technology company, not a bank, with banking services provided by partner banks. value=technology company with partner-bank services; period=instant 2025-05-13; epistemic=extracted [ev-5fdce7b12f43]
- Chime reported 8.0 million Active Members for 2024. value=8; unit=millions; period=end 2024-12-31; epistemic=extracted [ev-5fdce7b12f43]
- Chime reported 8.6 million Active Members as of 2025-03-31. value=8.6; unit=millions; period=instant 2025-03-31; epistemic=extracted [ev-5fdce7b12f43]
- Chime reported USD 34.540 billion of Purchase Volume for the three months ended 2025-03-31. value=34.54; unit=USD billions; period=start 2025-01-01, end 2025-03-31; epistemic=extracted [ev-5fdce7b12f43]
- Chime reported a USD 25.3 million net loss for 2024. value=25.3; unit=USD millions net loss; period=end 2024-12-31; epistemic=extracted [ev-5fdce7b12f43]
- Chime reported that 67 percent of Active Members relied on Chime as a primary account relationship as of 2025-03-31. value=67; unit=percent; period=instant 2025-03-31; epistemic=extracted [ev-5fdce7b12f43]
- Chime said it applied to list Class A common stock on Nasdaq under ticker CHYM. value=CHYM; unit=ticker; period=instant 2025-05-13; epistemic=observed [ev-4cd4b2c602cb]
- The S-1 identifies the registrant as Chime Financial, Inc., incorporated in Delaware, with CIK 0001795586. value=SEC-CIK-0001795586; unit=SEC CIK; period=instant 2025-05-13; epistemic=observed [ev-5fdce7b12f43]

## Inferences
- Enterprise Value abstained: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed. [ev-4cd4b2c602cb, ev-5fdce7b12f43]
- Headline Valuation abstained: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed. [ev-4cd4b2c602cb, ev-5fdce7b12f43]
- Security-Level Fair Value abstained: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Selected route general-private-company: Eligible evidence is available, but no stronger specialized route is selected. [ev-4cd4b2c602cb, ev-5fdce7b12f43]
- Sufficiency is sufficient with score 0.725: Evidence coverage is sufficient for route selection before valuation.
- Total Equity Value abstained: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed. [ev-4cd4b2c602cb, ev-5fdce7b12f43]

## Valuation
### Headline Valuation
- Status: abstained
- Reason: recent-secondary-transaction-not-observed
- Explanation: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- Evidence: ev-4cd4b2c602cb, ev-5fdce7b12f43
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |

### Enterprise Value
- Status: abstained
- Reason: recent-secondary-transaction-not-observed
- Explanation: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- Evidence: ev-4cd4b2c602cb, ev-5fdce7b12f43
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |

### Total Equity Value
- Status: abstained
- Reason: recent-secondary-transaction-not-observed
- Explanation: TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- Evidence: ev-4cd4b2c602cb, ev-5fdce7b12f43
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |

### Security-Level Fair Value
- Status: abstained
- Reason: security-rights-and-cap-table-not-disclosed
- Explanation: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Evidence: None
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Limitations
- Evidence record chime-2025-06-11-ipo-pricing-post-cutoff was published after the measurement date and was excluded.
- Evidence record chime-2025-06-11-reuters-ipo-value-post-cutoff was published after the measurement date and was excluded.
- Excluded chime-2025-06-11-ipo-pricing-post-cutoff because publishedDate 2025-06-11 is after measurementDate 2025-05-13.
- Excluded chime-2025-06-11-reuters-ipo-value-post-cutoff because publishedDate 2025-06-11 is after measurementDate 2025-05-13.
- TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- TRACE cannot calibrate a headline valuation because no measurement-date-eligible recent secondary transaction with a disclosed headline value was parsed.
- TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.

## Conflicts
- None identified.

## Counterarguments
- Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: financial-services, recent-transaction, software-saas, marketplace, biotech-rnpv, asset-based.

## Missing Information
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-financial-and-operating-fact-coverage | Financial and operating fact coverage | routing, sufficiency | TRACE cannot support route selection without this evidence. |
| missing-recent-secondary-transaction | Recent secondary transaction | headline-valuation | TRACE cannot support the recent-secondary calibration pathway. |
| missing-route-defining-business-model-evidence | Route-defining business-model evidence | routing, sufficiency | TRACE treats this as a routing limitation unless stronger evidence is supplied. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Next Diligence Questions
- What evidence resolves Cap table for total-equity-value, security-level-fair-value?
- What evidence resolves Dilution for total-equity-value, security-level-fair-value?
- What evidence resolves Financial and operating fact coverage for routing, sufficiency?
- What evidence resolves Recent secondary transaction for headline-valuation?
- What evidence resolves Route-defining business-model evidence for routing, sufficiency?
- What evidence resolves Share preferences for security-level-fair-value?
- What evidence resolves Share rights for security-level-fair-value?

## Reviewer Findings
- Reviewer version: trace-reviewer.v1
- Status: warnings

| ID | Severity | Category | Evidence | Message |
| --- | --- | --- | --- | --- |
| review-abstention-triggers | pass | abstention | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Abstained valuation fields include missing-information reasons, and security-level triggers are respected. |
| review-calculation-integrity | pass | calculation | ev-4cd4b2c602cb, ev-5fdce7b12f43 | No concluded valuation calculations were emitted; abstentions are explicit. |
| review-citation-support | pass | evidence | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Sufficiency, route, and valuation claims cite included evidence IDs where citations are required. |
| review-cutoff-compliance | warning | cutoff | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Post-measurement-date evidence was excluded by provider validation and remains visible in warnings. |
| review-entity-certainty | pass | entity | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Target identity is resolved and supported by included evidence. |
| review-evidence-coverage | pass | evidence | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Evidence coverage satisfies the sufficiency gate for route selection. |
| review-route-appropriateness | pass | route | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Route selection is consistent with sufficiency status: general-private-company. |
| review-valuation-field-separation | pass | valuation-separation | ev-4cd4b2c602cb, ev-5fdce7b12f43 | Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields. |

## Run Metadata
- Run ID: run-5c191b9ced89d3c9
- Runtime version: 0.1.0
- Command: trace benchmark --partition development --runner trace-full --case-id dev-fintech-chime-2025
- Measurement date: 2025-05-13
- Started at: 2026-07-26T00:00:00.000Z
- Completed at: 2026-07-26T00:00:00.306Z
- Duration ms: 306
- Input path: benchmark:development:dev-fintech-chime-2025
- Output directory: benchmark-artifact:development/run-5c191b9ced89d3c9/trace-full/dev-fintech-chime-2025
- Warnings:
- Excluded chime-2025-06-11-ipo-pricing-post-cutoff because publishedDate 2025-06-11 is after measurementDate 2025-05-13.
- Excluded chime-2025-06-11-reuters-ipo-value-post-cutoff because publishedDate 2025-06-11 is after measurementDate 2025-05-13.
