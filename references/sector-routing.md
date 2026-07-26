# Sector routing policy

Last reviewed: 2026-07-26

Use this policy when selecting an analysis route. It complements
`references/evidence-policy.md`, `references/research-basis.md`, and
`eval/evaluation-protocol.md`.

## Sufficiency first

Score sufficiency before valuation. The router must decide whether the evidence
can support entity resolution, route selection, and the requested decision mode
without using a desired valuation conclusion as an input. Sparse or conflicting
evidence should select `insufficient-evidence` or abstain rather than force a
route.

A route decision must record:

- selected, considered, and rejected routes;
- evidence IDs supporting each route reason;
- missing information and consequences for partial or missing criteria;
- conflicts that could change the selected route.

## First-slice financial-services route

Select `financial-services` when the evidence shows bank-like or deposit-led
fintech characteristics that make a generic enterprise-value multiple route
unsafe. The first vertical slice uses this route when evidence supports several
of the following:

- customer deposits, safeguarded balances, treasury assets, or similar
  balance-sheet items that are central to the business model;
- lending, payments, electronic-money, banking, or regulated financial
  services activity;
- audited or regulator-linked financial statements with material financial
  assets or liabilities;
- revenue, income, customer, deposit, or asset facts that need
  financial-services interpretation;
- disclosed transaction evidence that is better treated as a calibration
  reference than as a direct EV or security-level fair value.

Do not select this route merely because a company calls itself fintech. Cite
entity, business-model, and balance-sheet evidence. If share rights, regulatory
permissions, or balance-sheet detail are unavailable, record the gap and limit
valuation conclusions accordingly.

## Rejected-route hygiene

For rejected routes, state the reason in terms of evidence fit. For example, a
software route may be rejected when deposits or financial liabilities make
standard ARR/EV treatment misleading. Avoid route explanations that depend on
the output value range.
