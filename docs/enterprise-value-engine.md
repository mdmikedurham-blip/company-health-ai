# Transparent Enterprise Value Engine (Phase 11)

Pluggable valuation with **ranges**, **assumptions**, **provenance**, and **confidence**. Never present valuation as fact.

## Providers

| Id | When |
|----|------|
| `market-multiples` | Revenue present |
| `income-heuristic` | EBITDA present (no revenue path) |
| `asset-heuristic` | Cash only |
| `rule-based` / unavailable | Missing unlock inputs |
| Future | External comps provider |

Built on Phase 10 `lib/value-navigator` plugins; Phase 11 wraps them in `lib/enterprise-value`.

## Minimum inputs

At least one of: **revenue**, **ebitda**, **cashBalance**.

Otherwise: `available: false` → “Preliminary valuation unavailable” + the one missing unlock input.

## Business vs evidence discounts

| Kind | Meaning |
|------|---------|
| **Business** | Observed weakness (concentration, low growth, short runway, churn, margin) |
| **Evidence** | Uncertainty from missing data (no concentration export, no churn, incomplete history) |

Same issue is never counted in both. Each discount includes impact range, rationale, confidence, supporting evidence, assumptions, and what would reduce it.

## Confidence model

- Starts from provider completeness
- Evidence discounts reduce **confidence**
- Business discounts reduce **presented current EV** (not fabricated upside)
- Upload that only fills evidence gaps raises confidence without inventing intrinsic operating improvement

## Potential value

Scenario-based (default **36-month** horizon): target assumptions, required improvements, execution probability, dependencies, risks, value range.

## Provenance

```
Valuation → assumption/discount → fact key → evidence id → document
```

If evidence IDs are missing, the engine states provenance is limited — never fabricates citations.

## Extension points

- Add providers in `lib/value-navigator/providers/`
- Discount rules in `lib/enterprise-value/engine.ts`
- Persist discount columns via migration **022** on `company_value_navigators`
