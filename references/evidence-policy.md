# Evidence policy

Last reviewed: 2026-07-26

Use this policy before accepting, normalizing, or reviewing TRACE evidence.
It operationalizes the evidence requirements in `SKILL.md`,
`references/data-sources.md`, and `eval/evaluation-protocol.md`.

## Source classes

Use the schema source classes exactly as written:

- `audited-filing`: audited financial statements or audit-backed filing
  sections.
- `regulatory-filing`: regulator-filed company disclosures not separately
  treated as audited.
- `government`: government or central-bank records and datasets.
- `legal-record`: court, registry, contract, or other legal records.
- `company-primary`: direct company releases, websites, reports, and investor
  communications.
- `company-secondary`: company-supplied facts repeated by a host platform or
  intermediary.
- `market-data`: exchange, rate, index, or other market observation data.
- `news`: editorial reporting.
- `expert-analysis`: analyst, industry, or professional commentary.
- `peer-reviewed`: peer-reviewed literature.
- `commercial-data`: licensed or vendor data.
- `other`: only when no listed class fits; explain why.

Prefer regulator, audited, legal, and government evidence for material claims.
Company-originated assertions remain usable, but the report must label them as
company-originated and avoid treating them as independent confirmation.

## Epistemic labels

Use the schema epistemic classes exactly as written:

- `observed`: the source directly states the fact.
- `extracted`: TRACE extracted the fact from a table, filing, or document.
- `calculated`: TRACE calculated the fact from cited inputs.
- `assumed`: TRACE introduced an explicit scenario or modelling assumption.
- `inferred`: TRACE derived a qualitative conclusion from cited evidence.
- `unknown`: the evidence does not establish the fact.

Every quantitative input must carry one of these labels. Unknown or unavailable
inputs should create missing-information records, not silent defaults.

## Required evidence fields

Every evidence record must include a source URL, source title, retrieval date,
source class, epistemic class, short excerpt, and at least one observed fact.
Add publication and effective dates when available. For audited PDFs or other
cached documents, store hash metadata when available and keep raw documents out
of Git unless redistribution rights are established.

Short excerpts should be enough to audit the linked fact without copying large
third-party text. Use page, section, table, or row locators when they materially
improve retrievability.

## Deduplication

Do not count syndicated copies, reposts, or repeated citations of one
originating source as independent evidence. When multiple records point to the
same originating source, merge them deterministically, preserve the best
locator/hash metadata, and emit an auditable duplicate warning.

## Measurement-date cutoff

Evidence with a publication date after the measurement date is excluded from
analysis and recorded as a cutoff warning. If the only available date is an
effective date, use it for fact period alignment, not as proof that the source
was available before the cutoff. Failed access and extraction attempts should
remain in the ledger when supplied.

## Search snippets

Search-result snippets are discovery aids only. They are never evidence, never
source excerpts, and never support material claims in Markdown or JSON reports.
