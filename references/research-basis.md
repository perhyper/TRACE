# Research and professional basis

Last reviewed: 2026-07-26

This file records why a rule exists and where it should appear in code or
tests. It is not an execution-specific evidence ledger.

## Valuation basis

### IFRS Foundation, IFRS 13 Fair Value Measurement

- Source: https://www.ifrs.org/issued-standards/list-of-standards/ifrs-13-fair-value-measurement/
- Authority: international accounting standard setter; primary normative
  source
- Adopted principle: fair value is an exit price in an orderly transaction
  between market participants at the measurement date
- Implementation consequence: require `measurementDate`; distinguish a
  company-reported headline value from a fair-value conclusion; record market
  and transaction assumptions
- Planned locations: valuation policy, schemas, recent-transaction method,
  report disclaimer
- Limitation: TRACE is not an IFRS-compliant appraisal and cannot establish
  compliance without a qualified valuer and full instrument data

### IPEV Board, International Private Equity and Venture Capital Valuation Guidelines, December 2025

- Source:
  https://www.privateequityvaluation.com/Portals/0/Documents/Guidelines/2025%20IPEV%20Valuation%20Guidelines.pdf
- Authority: specialist industry guidance aligned to IFRS 13 and ASC 820
- Version note: published 2025-12-11; effective for quarterly reporting
  periods beginning on or after 2026-04-01, with early adoption encouraged
- Adopted principles: apply consistent methods at each measurement date;
  document inputs and significant judgements; calibrate models to a recent
  investment only when appropriate; do not automatically treat that price as
  fair value; consider different share-class rights; backtest realized events;
  retain professional judgement and accountability when AI is used
- Implementation consequence: transaction-age and quality checks, explicit
  share-right visibility, method limitations, reviewer output, and backtest
  records
- Planned locations: `references/valuation-policy.md`, valuation modules,
  review module, evaluation protocol
- Limitation: the guidelines' legal terms restrict some reuse and translation;
  TRACE cites and operationalizes high-level principles without reproducing
  the document

## Evidence and AI evaluation basis

### NIST, Artificial Intelligence Risk Management Framework 1.0

- Citation: Tabassi, E. (2023), NIST AI 100-1,
  https://doi.org/10.6028/NIST.AI.100-1
- Authority: U.S. national standards institute; voluntary cross-sector
  framework
- Adopted principles: evaluate validity and reliability, transparency,
  explainability, and accountability in the context of use; use documented,
  repeatable test/evaluation/verification/validation processes
- Implementation consequence: preserve structured routes, evidence IDs,
  deterministic calculations, run metadata, failures, and a preregistered
  primary metric
- Planned locations: run manifest, evaluation scorer, result schema
- Limitation: NIST AI RMF is not a finance-specific performance standard

## Biotech basis

### ClinicalTrials.gov protocol registration data definitions

- Source: https://clinicaltrials.gov/policy/protocol-definitions
- Authority: U.S. National Library of Medicine registry definitions, adapted
  substantially from 42 CFR Part 11
- Adopted principle: preserve registry-native identifiers and distinguish
  sponsor-submitted study phase, status, enrollment, and outcome fields
- Implementation consequence: classify registry facts as observed registry
  entries, not proof that a program succeeded
- Planned locations: ClinicalTrials.gov provider and biotech schema tests
- Limitation: completeness and timeliness depend on the responsible party

### Wong, Siah, and Lo, “Estimation of clinical trial success rates and related parameters”

- Citation: *Biostatistics* 20(2), 2019, 273–286,
  https://doi.org/10.1093/biostatistics/kxx069
- Evidence type: peer-reviewed empirical study using 406,038 trial entries and
  more than 21,000 compounds from 2000–2015
- Adopted principle: phase-transition probabilities can be empirical priors,
  not company-specific probabilities; indication and observed program evidence
  must be preserved when adjusting a prior
- Planned locations: biotech rNPV assumptions and prior provenance
- Limitations: historical sample, data linkage choices, selection bias, and
  changing development practice limit external validity

## Initial design decision

The first development case uses a financial-services route rather than a
generic SaaS multiple. Revolut's 2025 audited statement contains customer
deposits, treasury investments, and a bank-like balance sheet. Treating those
liabilities as ordinary operating debt or applying a generic EV/revenue bridge
would create a category error. The first result will therefore emphasize the
observed USD 75 billion secondary-transaction reference, a transparent
uncertainty band, and abstention from security-level fair value while share
rights and the cap table are unavailable.

