# Valuation policy

Last reviewed: 2026-07-26

Use this policy before calculating or reviewing a TRACE value range. It draws
on the high-level principles recorded in `references/research-basis.md` without
reproducing IFRS or IPEV text. TRACE is decision support, not an appraisal,
investment recommendation, or compliance opinion.

## Guardrails

Use a fixed measurement date and document the market-participant, transaction,
unit, currency, and scale assumptions behind each conclusion. Prefer explicit
abstention over invented inputs. Keep professional review responsibility
visible in the report.

Recent transactions may calibrate a method only after checking:

- transaction date and proximity to the measurement date;
- transaction type, including primary/secondary and ordinary/orderly context;
- source class and independence;
- disclosed rights, preferences, discounts, dilution, and cap-table visibility;
- whether later evidence breaches the measurement-date cutoff.

A company-reported transaction headline is an observed reference point, not an
automatic enterprise value, total equity value, or security-level fair value.

## Uncertainty widening

Widen ranges when evidence quality is weaker, the transaction is secondary,
terms are opaque, rights differ across share classes, financial statements are
stale, or the route depends on qualitative inference. Record the reason for
each widening factor in assumptions or limitations, and keep deterministic
arithmetic in code.

## Required value separation

TRACE reports four valuation fields separately:

- `headline-valuation`: a disclosed or calibrated company-level headline
  reference.
- `enterprise-value`: operating business value before equity bridge items,
  concluded only when the route and inputs support it.
- `total-equity-value`: aggregate equity value after relevant bridges,
  concluded only when bridge evidence is available.
- `security-level-fair-value`: value of a specific instrument or share class,
  concluded only when rights, preferences, dilution, and cap-table evidence are
  sufficient.

Do not copy one field into another to fill gaps. If the evidence supports only
a headline calibration, conclude that field and abstain from unsupported fields
with missing-information records.

## First-slice application

For the Revolut first slice described in `references/data-sources.md`, the USD
75 billion company-reported secondary transaction is treated as a recent
headline calibration input. It does not establish enterprise value, total
equity value, or security-level fair value without additional evidence about
share rights, preferences, dilution, and the cap table.
