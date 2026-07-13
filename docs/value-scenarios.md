# Value Scenarios (Phase 11)

Scenarios model “what if” without changing the current assessment SSOT.

## Isolation

- Clone valuation inputs → recompute → return scenario result
- `isolatedFromAssessment: true` always
- Never overwrite snapshot actuals or persisted financial facts

## Catalog (Phase 10/11)

Examples: growth, margin, churn, NRR, burn, raise capital, hire VP Sales, new product, acquire, governance, SOC2, concentration.

API: `POST /api/company/value-navigator` with `{ scenarioKey }`.

Each scenario returns enterprise value range, change vs current, assumptions, risks, recommended actions.

## Relationship to potential EV

Potential enterprise value on Doctor uses a 36-month execution scenario derived from ranked value drivers and business discounts — not aspirational fiction.
