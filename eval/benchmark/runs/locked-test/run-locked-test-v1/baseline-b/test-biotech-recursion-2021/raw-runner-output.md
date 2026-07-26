# Baseline B Fixed Template: Recursion Pharmaceuticals, Inc.

## Case
| Field | Value |
| --- | --- |
| Case ID | test-biotech-recursion-2021 |
| Partition | locked-test |
| Measurement date | 2021-04-15 |
| Cutoff date | 2021-04-15 |
| Data tier | rich |

## Evidence Inventory
| Evidence ID | Source | Class | Date |
| --- | --- | --- | --- |
| ev-95a848a8ee5a | Recursion Pharmaceuticals Form S-1 | regulatory-filing | 2021-03-22 |
| ev-da68c304b2cc | Recursion Pharmaceuticals final prospectus | regulatory-filing | 2021-04-15 |

## Claim Register
| Claim ID | Statement | Citation |
| --- | --- | --- |
| claim-309eab69b184 | Recursion described itself as a clinical-stage biotechnology company using technology to decode biology. | ev-95a848a8ee5a:fact-72b50c96fb48 |
| claim-fcf80f84de39 | Recursion described the Recursion OS as combining infrastructure, biological datasets, algorithms and machine-learning tools. | ev-95a848a8ee5a:fact-513edb126016 |
| claim-a4a369bad296 | Recursion filed a Form S-1 registration statement for its initial public offering before the cutoff. | ev-95a848a8ee5a:fact-760052dc5bfc |
| claim-d8593c949267 | The S-1 identifies the registrant as Recursion Pharmaceuticals, Inc., incorporated in Delaware, with CIK 0001601830. | ev-95a848a8ee5a:fact-436d6b9d4b97 |
| claim-f23a83dcf866 | The final prospectus describes Class A shares with one vote and Class B shares with ten votes per share. | ev-da68c304b2cc:fact-3f04bc86a665 |
| claim-65a4cca4b157 | The final prospectus states Recursion was offering 24,242,424 shares of Class A common stock. | ev-da68c304b2cc:fact-076ec5dfb0e8 |
| claim-76967bfdd3e3 | The final prospectus states an initial public offering price of USD 18.00 per share. | ev-da68c304b2cc:fact-7f8929dbacce |
| claim-1c8e36b2bdf7 | The final prospectus states total initial public offering price of USD 436,363,632 before deductions. | ev-da68c304b2cc:fact-05fd9e45605c |

## Valuation Fields
- headline-valuation: omitted
- enterprise-value: omitted
- total-equity-value: omitted
- security-level-fair-value: omitted

## Limitations
- This baseline performs deterministic evidence summarization only.
- It does not run TRACE route selection, sufficiency gating, valuation logic, or adversarial review.
- It does not claim official contest compliance, benchmark superiority, investment advice, or appraisal status.
- Source use follows the committed policy: Raw source documents, PDFs, cached pages, and scratch downloads stay out of Git unless redistribution rights are explicitly established.
