# TRACE Report: Figma, Inc.

## Summary
- Company: Figma, Inc. (US; identity resolved)
- Measurement date: 2022-09-14
- Decision mode: full-analysis
- Sufficiency: sufficient (0.85)
- Route: software-saas
- Review: warnings
- Run ID: run-dev-generalization-v1

## Evidence Ledger
| Evidence ID | Source class | Published | Retrieved | Source | Excerpt |
| --- | --- | --- | --- | --- | --- |
| ev-268f1126e759 | company-primary | 2021-06-24 | 2026-07-26 | Figma's Series E (https://www.figma.com/blog/figmas-series-e/) | Figma announced a new funding round led by Durable Capital with Counterpoint Global joining as a new investor. |
| ev-aeeecbc6a15d | news | 2021-06-24 | 2026-07-26 | Figma raises USD 200 million at USD 10 billion valuation (https://www.theinformation.com/briefings/5a0e84) | Public briefing reports Figma raised USD 200m Series E funding at a USD 10bn valuation. |
| ev-bc3049cd3474 | company-primary | 2021-04-21 | 2026-07-26 | Introducing FigJam (https://www.figma.com/blog/introducing-figjam/) | Figma introduced FigJam as an online whiteboard for brainstorming and ideation with teams. |

## Material Facts
- FigJam was described as supporting sticky notes, drawing tools, shapes, connectors, stamps, cursor chats and audio collaboration. value=sticky notes, drawing tools, shapes and connectors, stamps, cursor chats, audio collaboration; period=instant 2021-04-21; epistemic=extracted [ev-bc3049cd3474]
- Figma announced it closed a Series E financing round on 2021-06-24. value=Series E closed; period=instant 2021-06-24; epistemic=observed [ev-268f1126e759]
- Figma described its vision as making design accessible to all through multiplayer, expert tools and broader product-development collaboration. value=collaborative design software; period=instant 2021-06-24; epistemic=extracted [ev-268f1126e759]
- Figma introduced FigJam on 2021-04-21 as an online whiteboard for teams. value=FigJam launched; period=instant 2021-04-21; epistemic=observed [ev-bc3049cd3474]
- Figma said FigJam would have free and paid plans in 2022 at USD 3 and USD 5 per editor per month. value=USD 3 per editor per month, USD 5 per editor per month; period=instant 2021-04-21; epistemic=observed [ev-bc3049cd3474]
- Figma said Morgan Stanley Counterpoint Global and prior investors including Index, Greylock, Kleiner Perkins, Sequoia and a16z participated. value=Morgan Stanley Counterpoint Global, Index, Greylock, Kleiner Perkins, Sequoia, a16z; period=instant 2021-06-24; epistemic=observed [ev-268f1126e759]
- Figma said the Series E was led by Durable Capital Partners. value=Durable Capital Partners; period=instant 2021-06-24; epistemic=observed [ev-268f1126e759]
- Public reporting described Figma's Series E amount as USD 200 million. value=200; unit=USD millions; period=instant 2021-06-24; epistemic=observed [ev-aeeecbc6a15d]
- Public reporting described Figma's Series E headline valuation as USD 10 billion. value=10; unit=USD billions headline valuation; period=instant 2021-06-24; epistemic=observed [ev-aeeecbc6a15d]

## Inferences
- Enterprise Value abstained: Software product, customer, funding, or qualitative traction evidence supports the software-SaaS route, but no public revenue, margin, or cash-flow statements support enterprise value. [ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474]
- Headline Valuation abstained: TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input. [ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474]
- Security-Level Fair Value abstained: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available. [ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474]
- Selected route software-saas: Evidence describes software products for team collaboration, product or issue tracking, developer tools, and paid or subscription plans. [ev-268f1126e759, ev-bc3049cd3474]
- Sufficiency is sufficient with score 0.85: Evidence coverage is sufficient for route selection before valuation.
- Total Equity Value abstained: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence. [ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474]

## Valuation
### Headline Valuation
- Status: abstained
- Reason: post-cutoff-transaction-announcement
- Explanation: TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input.
- Evidence: ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cutoff-visible-transaction | Cutoff-visible transaction | headline-valuation | TRACE abstains from a cutoff-date headline valuation. |

### Enterprise Value
- Status: abstained
- Reason: no-public-financial-statements
- Explanation: Software product, customer, funding, or qualitative traction evidence supports the software-SaaS route, but no public revenue, margin, or cash-flow statements support enterprise value.
- Evidence: ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-public-financial-statements | Public financial statements | enterprise-value | TRACE abstains from enterprise value. |

### Total Equity Value
- Status: abstained
- Reason: missing-total-equity-capitalization
- Explanation: TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- Evidence: ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

### Security-Level Fair Value
- Status: abstained
- Reason: missing-security-rights-and-cap-table
- Explanation: TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- Evidence: ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474
- Missing information:
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |

## Limitations
- Evidence record figma-2022-09-15-adobe-acquisition-post-cutoff was published after the measurement date and was excluded.
- Excluded figma-2022-09-15-adobe-acquisition-post-cutoff because publishedDate 2022-09-15 is after measurementDate 2022-09-14.
- Software product, customer, funding, or qualitative traction evidence supports the software-SaaS route, but no public revenue, margin, or cash-flow statements support enterprise value.
- TRACE abstains from security-level fair value because share rights, preferences, dilution, and cap-table data are not sufficiently available.
- TRACE cannot conclude total equity value without a supported company valuation and fully diluted capitalization or equity-bridge evidence.
- TRACE excludes an acquisition, merger, or transaction announcement published after the measurement-date cutoff and does not use it as a headline-valuation input.
- TRACE output is decision support, not an appraisal, investment recommendation, benchmark-superiority claim, or contest-compliance claim; official contest rules are not supplied.
- extraction note figma-sec-cik-post-cutoff-note: Figma's SEC CIK is available from post-cutoff public filings, but those filings are not eligible input for the 2022-09-14 case.

## Conflicts
- None identified.

## Counterarguments
- Rejected route candidates could become relevant if new evidence changes the sufficiency and route facts: financial-services, marketplace, biotech-rnpv, asset-based, recent-transaction, general-private-company.

## Missing Information
| ID | Topic | Required for | Consequence |
| --- | --- | --- | --- |
| missing-cap-table | Cap table | total-equity-value, security-level-fair-value | TRACE cannot allocate value across securities or holders. |
| missing-cutoff-visible-transaction | Cutoff-visible transaction | headline-valuation | TRACE abstains from a cutoff-date headline valuation. |
| missing-dilution | Dilution | total-equity-value, security-level-fair-value | TRACE cannot convert company-level headline value into per-security fair value. |
| missing-financial-and-operating-fact-coverage | Financial and operating fact coverage | routing, sufficiency | TRACE cannot support route selection without this evidence. |
| missing-public-financial-statements | Public financial statements | enterprise-value | TRACE abstains from enterprise value. |
| missing-share-preferences | Share preferences | security-level-fair-value | TRACE cannot determine whether the security participates equally in the headline value. |
| missing-share-rights | Share rights | security-level-fair-value | TRACE cannot assign the headline reference to a specific share class. |
| missing-total-equity-capitalization | Total equity capitalization | total-equity-value | TRACE abstains from total equity value. |

## Next Diligence Questions
- What evidence resolves Cap table for total-equity-value, security-level-fair-value?
- What evidence resolves Cutoff-visible transaction for headline-valuation?
- What evidence resolves Dilution for total-equity-value, security-level-fair-value?
- What evidence resolves Financial and operating fact coverage for routing, sufficiency?
- What evidence resolves Public financial statements for enterprise-value?
- What evidence resolves Share preferences for security-level-fair-value?
- What evidence resolves Share rights for security-level-fair-value?
- What evidence resolves Total equity capitalization for total-equity-value?

## Reviewer Findings
- Reviewer version: trace-reviewer.v1
- Status: warnings

| ID | Severity | Category | Evidence | Message |
| --- | --- | --- | --- | --- |
| review-abstention-triggers | pass | abstention | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Abstained valuation fields include missing-information reasons, and security-level triggers are respected. |
| review-calculation-integrity | pass | calculation | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | No concluded valuation calculations were emitted; abstentions are explicit. |
| review-citation-support | pass | evidence | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Sufficiency, route, and valuation claims cite included evidence IDs where citations are required. |
| review-cutoff-compliance | warning | cutoff | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Post-measurement-date evidence was excluded by provider validation and remains visible in warnings. |
| review-entity-certainty | pass | entity | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Target identity is resolved and supported by included evidence. |
| review-evidence-coverage | pass | evidence | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Evidence coverage satisfies the sufficiency gate for route selection. |
| review-route-appropriateness | pass | route | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Route selection is consistent with sufficiency status: software-saas. |
| review-valuation-field-separation | pass | valuation-separation | ev-268f1126e759, ev-aeeecbc6a15d, ev-bc3049cd3474 | Headline valuation, enterprise value, total equity value, and security-level fair value remain separate fields. |

## Run Metadata
- Run ID: run-dev-generalization-v1
- Runtime version: 0.1.0
- Command: trace benchmark --partition development --runner trace-full --case-id dev-saas-figma-2022
- Measurement date: 2022-09-14
- Started at: 2026-07-26T00:00:00.000Z
- Completed at: 2026-07-26T00:00:00.322Z
- Duration ms: 322
- Input path: benchmark:development:dev-saas-figma-2022
- Output directory: benchmark-artifact:development/run-dev-generalization-v1/trace-full/dev-saas-figma-2022
- Warnings:
- Excluded figma-2022-09-15-adobe-acquisition-post-cutoff because publishedDate 2022-09-15 is after measurementDate 2022-09-14.
