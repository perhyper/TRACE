# Data source catalogue

Last reviewed: 2026-07-26

Raw documents are not redistributed unless their terms clearly permit it.
TRACE stores URLs, retrieval timestamps, hashes, short supporting excerpts,
and normalized facts. Source terms must be reviewed again before a public
release.

## Sources used by the first vertical slice

### Revolut Group Holdings Ltd annual report 2025

- Provider: Revolut Group Holdings Ltd; independent auditor: BDO LLP
- URL: https://assets.revolut.com/pdf/annualreport2025.pdf
- Retrieved: 2026-07-26
- SHA-256:
  `969dd74a7213513ef92c02d64d6427fec03adaec6b1f5470602f9872725e5e24`
- Coverage: year ended 2025-12-31; registered number 12743269; consolidated
  income, financial position, cash flow, KPIs, governance, and audit opinion
- Useful pages: 7, 38, 94–101, 131, 198–200
- Source class: `audited-filing` for audited statements; narrative sections
  remain `company-primary`
- Access/redistribution: publicly downloadable; redistribution permission not
  established, so the PDF stays outside Git
- Risks: company narrative is not independent verification; banking balance
  sheet items are not directly comparable with non-bank fintech peers
- TRACE use: entity resolution, financial facts, transaction description,
  sufficiency, route selection, report evidence ledger

### Revolut 2025 share-sale announcement

- Provider: Revolut
- URL: https://www.revolut.com/news/revolut_completes_fundraising_process_establishing_75_billion_valuation/
- Published: 2025-11-24
- Retrieved: 2026-07-26
- Coverage: disclosed share sale, participating investor names, and a
  company-described implied valuation of USD 75 billion
- Source class: `company-primary`
- Access/redistribution: public web page; store only short excerpts and facts
- Risks: transaction terms, share rights, volume, discounts, and cap table are
  not disclosed; the headline value is not a security-level fair-value label
- TRACE use: recent-transaction calibration and capital-structure warning

### Federal Reserve H.10 historical GBP rate

- Provider: Board of Governors of the Federal Reserve System
- URL: https://www.federalreserve.gov/releases/h10/hist/dat00_uk.htm
- Retrieved: 2026-07-26
- Coverage: USD per GBP daily observations; 2026-03-24 observation is 1.3383
- Source class: `government`
- Access/redistribution: public government data; verify applicable site terms
  before redistributing a bulk snapshot
- Risks: the publication is a reference observation, not a tradeable quote
- TRACE use: deterministic unit normalization at the measurement date

## Planned provider candidates

### SEC EDGAR data APIs

- Provider: U.S. Securities and Exchange Commission
- Documentation:
  https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- Access: JSON APIs on `data.sec.gov`; no API key; automated access must follow
  the SEC privacy/security and fair-access policy and identify the client
- Coverage: submissions and standardized XBRL company facts for public peers
- Risks: custom tags and fiscal calendars still require semantic and period
  checks; SEC data is primarily useful for public comparables, not most private
  targets
- Planned modules: peer financials and filing provenance

### Companies House Public Data API

- Provider: UK Companies House
- Documentation:
  https://developer.company-information.service.gov.uk/get-started
- Access: API authentication required; default rate limit is 600 requests per
  five minutes
- Coverage: company identity, filings, officers, and people with significant
  control
- Risks: filed facts are supplied by companies; PDF/account extraction and
  filing-period alignment remain necessary
- Planned modules: UK entity resolution and filing discovery

### ClinicalTrials.gov API and records

- Provider: U.S. National Library of Medicine
- API landing page: https://clinicaltrials.gov/data-api/about-api
- Data definitions: https://clinicaltrials.gov/policy/protocol-definitions
- Access: public HTTP API; confirm current API terms and version before a
  benchmark freeze
- Coverage: sponsor, intervention, phase, recruitment status, dates, outcomes,
  and study identifiers
- Risks: sponsors submit records; a registered status is evidence of the
  record, not independent proof of clinical success
- Planned modules: biotech route, trial status, and pipeline evidence

## Candidate sources not yet adopted

- DART, KRX, KOSIS, KIPRIS, NTIS, and CRIS: relevant to Korean targets, but
  authentication, redistribution, and stable snapshot procedures must be
  checked before implementation.
- Commercial market and deal databases: excluded from the first slice because
  no license has been supplied.
- Search-result snippets: discovery only; never evidence.

